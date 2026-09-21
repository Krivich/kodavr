/**
 * CONTRACT: scripts/lib/audit-llm-channels.mjs
 * ROLE: wire Layers 4+5 into one channel list — judge (+ ensemble) and trace channels, degrading visibly
 * EXPORTS:
 *   buildLlmChannels — files + env → ChannelResults; a failed provider is a visible llm-error flag, never a throw
 * CONSUMES:
 *   ./audit-channel.mjs — makeChannelResult (the normalized channel output)
 *   ./audit-llm.mjs — providerFromEnv, withRetry (the provider and its backoff)
 *   ./audit-judge.mjs — judgeChannel, judgeEnsembleChannel (Layer 4)
 *   ./audit-trace.mjs — traceResidueChannel (Layer 5 deterministic)
 *   ./audit-meta.mjs — metaReviewChannel (Layer 5 LLM witness)
 * INVARIANTS:
 *   — pure of side effects except the injected fetch: no environment read beyond the passed env, no clock, no key logged
 *   — a provider failure degrades to a VISIBLE llm-error flag channel (THINK); never a silent merge or a crash
 *   — a missing reasoning trace simply drops the Layer-5 channels (graceful degradation, §4.6.6)
 *   — never throws: every failure becomes a channel or a skipped step
 */
import { makeChannelResult } from './audit-channel.mjs';
import { providerFromEnv, withRetry } from './audit-llm.mjs';
import { judgeChannel, judgeEnsembleChannel } from './audit-judge.mjs';
import { traceResidueChannel } from './audit-trace.mjs';
import { metaReviewChannel } from './audit-meta.mjs';

// buildLlmChannels({files,env,fetchImpl,sleep}) → an array of valid ChannelResults,
// possibly empty. The primary judge run is retried on transient provider errors;
// the ensemble ALWAYS runs a second judge — the same model under the skeptical
// framing, or AUDIT_LLM_MODEL_2 under the default framing — and reduces both.
// Layer 5 reads the primary run's reasoning trace: the deterministic
// residue channel always, the meta-reviewer as an independent witness. If the
// provider is missing the list is empty (deterministic-only); if it is configured
// but fails, the result is a single visible `llm-error` flag (the policy yields
// THINK) — never a silent merge, never a crash. `sleep` is injectable for tests.
export async function buildLlmChannels({
  files = [],
  env = process.env,
  fetchImpl = globalThis.fetch,
  sleep,
} = {}) {
  const primary = providerFromEnv(env);
  if (!primary) return [];
  const tier = env.AUDIT_LLM_SCHEMA_TIER || 'none';
  const retryOptions = sleep ? { sleep } : {};

  let primaryRun;
  try {
    primaryRun = await withRetry(
      () => judgeChannel({ files, config: primary, schemaTier: tier, fetchImpl }),
      retryOptions,
    );
  } catch {
    // The provider is configured but unreachable: a loud, human-bound flag. The
    // caller may log the error text; no decision is invented here.
    return [makeChannelResult({ channel: 'llm-error', score: 1, spans: [], verdict: 'flag' })];
  }

  const channels = [];
  // The ensemble always runs twice (§4.5.6). With no second model the SAME model
  // reruns under the skeptical framing; with AUDIT_LLM_MODEL_2 the second run uses
  // that model under the default framing. Either way the two readings are reduced
  // into one llm-judge-ensemble channel — never a bare single judge.
  const secondModel = typeof env.AUDIT_LLM_MODEL_2 === 'string' ? env.AUDIT_LLM_MODEL_2.trim() : '';
  const secondConfig = secondModel ? { ...primary, model: secondModel } : primary;
  const secondFraming = secondModel ? 'default' : 'skeptical';
  let secondRun;
  try {
    secondRun = await withRetry(
      () => judgeChannel({ files, config: secondConfig, framing: secondFraming, schemaTier: tier, fetchImpl }),
      retryOptions,
    );
  } catch (error) {
    secondRun = { error };
  }
  channels.push(judgeEnsembleChannel({ runs: [primaryRun, secondRun] }));

  // Layer 5 reads the primary run's trace; no trace → both channels are absent
  // (the policy redistributes the weights, §4.6.6).
  const trace = primaryRun.reasoning;
  if (typeof trace === 'string' && trace.trim() !== '') {
    const residue = traceResidueChannel({ trace, files });
    if (!residue.skipped) channels.push(residue);
    try {
      const meta = await metaReviewChannel({ trace, files, config: primary, schemaTier: tier, fetchImpl });
      if (!meta.skipped) channels.push(meta.result);
    } catch {
      // The meta-reviewer is a witness: a failed call drops the channel, not the audit.
    }
  }

  return channels;
}

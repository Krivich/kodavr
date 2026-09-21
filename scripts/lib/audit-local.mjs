/**
 * CONTRACT: scripts/lib/audit-local.mjs
 * ROLE: the repeatable local harness — the repository's own dumps → the audit pipeline's verdicts
 * EXPORTS:
 *   TRUSTED_AUTHOR — the author signals of a long-established trusted, non-fork author
 *   dumpToPr — a dump's text files → an addition-only single-directory PR + the scan list
 *   auditDumps — run the deterministic audit over every dump, preserving the result
 *   summarizeRuns — the decision tally and the flagged (non-MERGE) slugs
 * CONSUMES:
 *   ./audit-pr.mjs — runAudit
 * INVARIANTS:
 *   — pure: no fs, no network, no environment; the CLI owns every disk read
 *   — filenames are synthesized as additions under content/dumps/<slug>/ — nothing else
 *   — the harness reports the pipeline's verdicts verbatim; it never re-tunes them
 */
import { runAudit } from './audit-pr.mjs';

// A trusted author: old account (the CLI fills createdAt), no PR today, an already
// merged PR, same-repo. This exercises the CONTENT channels instead of the envelope.
export const TRUSTED_AUTHOR = { createdAt: null, prsToday: 0, hasMergedPr: true, isFork: false };

// dumpToPr(slug, files) → {prFiles,scanFiles}. files = [{name,text}] with names
// relative to the dump directory. Every path is content/dumps/<slug>/<name>, added,
// and the scan list carries the same paths with the real text. Order is preserved.
export function dumpToPr(slug, files) {
  const list = Array.isArray(files) ? files : [];
  const prFiles = list.map((f) => ({
    filename: `content/dumps/${slug}/${f.name}`,
    status: 'added',
  }));
  const scanFiles = list.map((f) => ({
    file: `content/dumps/${slug}/${f.name}`,
    text: f.text,
  }));
  return { prFiles, scanFiles };
}

// auditDumps(dumps, options) → [{slug,prFiles,scanFiles,result}]. dumps = [{slug,files}].
// result is runAudit's exact verdict: the harness adds no decision of its own.
export function auditDumps(dumps, { authorSignals, contentGate = {}, facts = {}, policyConfig = {} } = {}) {
  const list = Array.isArray(dumps) ? dumps : [];
  return list.map(({ slug, files }) => {
    const { prFiles, scanFiles } = dumpToPr(slug, files);
    const result = runAudit({ prFiles, scanFiles, authorSignals, contentGate, facts, policyConfig });
    return { slug, prFiles, scanFiles, result };
  });
}

// summarizeRuns(runs) → {total,byDecision,flagged}. byDecision always carries the
// four decision keys (zero-filled); flagged lists every non-MERGE slug in order.
export function summarizeRuns(runs) {
  const list = Array.isArray(runs) ? runs : [];
  const byDecision = { MANUAL: 0, MERGE: 0, THINK: 0, DECLINE: 0 };
  const flagged = [];
  for (const run of list) {
    const decision = run && run.result && run.result.policy ? run.result.policy.decision : undefined;
    if (Object.prototype.hasOwnProperty.call(byDecision, decision)) byDecision[decision] += 1;
    if (decision !== 'MERGE') flagged.push({ slug: run ? run.slug : undefined, decision });
  }
  return { total: list.length, byDecision, flagged };
}

/**
 * CONTRACT: scripts/lib/audit-pr.mjs
 * ROLE: orchestrates the PR audit — API inputs → envelope + policy → advisory comment and status check
 * EXPORTS:
 *   STATUS_CONTEXT — the status-check context shared by the CLI and the workflow
 *   normalizePrFiles — GitHub PR-file objects → [{filename,status}] with string fields
 *   authorSignalsFromApi — GitHub user + pulls → the envelope's author signals
 *   runAudit — the full deterministic audit of one PR (shadow: always MANUAL)
 * CONSUMES:
 *   ./audit-detectors.mjs — structuralChannel (Layer-1 over the PR patch text)
 *   ./audit-envelope.mjs — checkDiffShape, checkAuthorSignals, evaluateEnvelope
 *   ./audit-policy.mjs — evaluatePolicy
 *   ./audit-report.mjs — renderAuditComment
 * INVARIANTS:
 *   — pure and deterministic: it performs no I/O and reads no environment
 *   — the shadow phase asserts no merge authority: the rendered class is always MANUAL
 *   — no numeric score ever reaches the comment or the status description
 */
import { checkDiffShape, checkAuthorSignals, evaluateEnvelope } from './audit-envelope.mjs';
import { structuralChannel } from './audit-detectors.mjs';
import { evaluatePolicy } from './audit-policy.mjs';
import { renderAuditComment } from './audit-report.mjs';

// The one status-check context the whole pipeline shares (branch protection can
// later require exactly this name; the CLI and the runbook read it from here).
export const STATUS_CONTEXT = 'pr-audit';

const MS_PER_HOUR = 3600000;
const DEFAULT_WINDOW_HOURS = 24;

// normalizePrFiles(apiFiles) → [{filename,status}]. Order is preserved and every
// field is a string; a missing piece becomes '' rather than throwing.
export function normalizePrFiles(apiFiles) {
  const list = Array.isArray(apiFiles) ? apiFiles : [];
  return list.map((f) => ({
    filename: f && typeof f.filename === 'string' ? f.filename : '',
    status: f && typeof f.status === 'string' ? f.status : '',
  }));
}

// authorSignalsFromApi({user,pulls,isFork,currentNumber},{now,windowHours}) →
// {createdAt,prsToday,hasMergedPr,isFork}. prsToday counts the author's OTHER
// PRs created inside the window; hasMergedPr counts any other author PR with a
// non-null merged_at. A missing piece simply does not count — never a throw.
export function authorSignalsFromApi(
  { user, pulls, isFork, currentNumber } = {},
  { now = new Date(), windowHours = DEFAULT_WINDOW_HOURS } = {},
) {
  const login = user && typeof user.login === 'string' && user.login ? user.login : null;
  const list = Array.isArray(pulls) ? pulls : [];
  const cutoff = now.getTime() - windowHours * MS_PER_HOUR;
  let prsToday = 0;
  let hasMergedPr = false;

  for (const pr of list) {
    if (!pr || typeof pr !== 'object' || login === null) continue;
    if (!pr.user || pr.user.login !== login) continue;
    if (pr.number !== undefined && currentNumber !== undefined && pr.number === currentNumber) continue;
    const created = new Date(pr.created_at);
    if (pr.created_at && !Number.isNaN(created.getTime()) && created.getTime() >= cutoff) prsToday += 1;
    if (pr.merged_at !== null && pr.merged_at !== undefined) hasMergedPr = true;
  }

  return {
    createdAt: user && typeof user === 'object' ? user.created_at ?? null : null,
    prsToday,
    hasMergedPr,
    isFork: isFork === true,
  };
}

// runAudit({prFiles,scanFiles,authorSignals,contentGate,facts,policyConfig,extraChannels}) →
// {diffShape,channel,envelope,policy,comment,status}. The deterministic pipeline
// in one call: diff shape + Layer-1 structure → the §4.1 envelope → the policy
// → the advisory comment and the status check. `extraChannels` are pre-built
// channel results (e.g. the LLM channels) appended to the Layer-1 channel; this
// module never builds them itself (it stays I/O- and env-free). Shadow phase: a
// MERGE decision is still rendered as MANUAL and a human decides.
export function runAudit({
  prFiles = [],
  scanFiles = [],
  authorSignals = {},
  contentGate = {},
  facts = {},
  policyConfig = {},
  extraChannels = [],
} = {}) {
  const diffShape = checkDiffShape(prFiles);
  const channel = structuralChannel(scanFiles);
  const signalCheck = checkAuthorSignals(authorSignals);
  const envelope = evaluateEnvelope({
    diffShape,
    authorSignals: signalCheck,
    contentGate,
    layer1Clean: channel.verdict === 'pass',
  });

  const policy = evaluatePolicy({
    envelope: envelope.conditions,
    channels: [channel, ...extraChannels],
    author: { class: 'MANUAL' },
    facts,
    config: policyConfig,
  });

  const comment = renderAuditComment({
    decision: policy.decision,
    actionClass: 'MANUAL',
    findings: policy.findings,
    conflict: policy.conflict,
  });

  const status = {
    context: STATUS_CONTEXT,
    state: envelope.ok && policy.decision === 'MERGE' ? 'success' : 'failure',
    description: 'audit: ' + policy.decision,
  };

  return { diffShape, channel, envelope, policy, comment, status };
}

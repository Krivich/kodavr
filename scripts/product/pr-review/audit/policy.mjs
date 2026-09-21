/**
 * CONTRACT: scripts/product/pr-review/audit/policy.mjs
 * ROLE: the deterministic policy — envelope + channel results → a recommendation and an action class
 * EXPORTS:
 *   DECISIONS — the frozen recommendations: MANUAL, MERGE, THINK, DECLINE
 *   ACTION_CLASSES — the frozen author automation levels
 *   DEFAULT_CONFLICT_THRESHOLD — the default channel-disagreement threshold
 *   envelopeAllPass — true iff the envelope object is non-empty and every value is true
 *   evaluatePolicy — reduce envelope + channels + author + facts → decision, class, reasons, conflict, findings
 * CONSUMES:
 *   ./channel.mjs — validateChannelResult (the fail-visible channel schema)
 *   ./forensic.mjs — buildForensicMap (the converged findings)
 * INVARIANTS:
 *   — the LLM has no authority: only this deterministic code computes the recommendation
 *   — any exception or malformed channel fails toward a human (THINK/MANUAL), never toward MERGE
 */
import { validateChannelResult } from './channel.mjs';
import { buildForensicMap } from './forensic.mjs';

export const DECISIONS = Object.freeze(['MANUAL', 'MERGE', 'THINK', 'DECLINE']);
export const ACTION_CLASSES = Object.freeze(['MANUAL', 'MERGE_GREEN', 'MERGE_LOW_RISK', 'FULL']);
export const DEFAULT_CONFLICT_THRESHOLD = 0.5;

// envelopeAllPass(conditions) → true iff non-empty and all values === true
export function envelopeAllPass(conditions) {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return false;
  const keys = Object.keys(conditions);
  if (keys.length === 0) return false;
  return keys.every((key) => conditions[key] === true);
}

// evaluatePolicy({envelope,channels,author,facts,config}) → the policy verdict.
// Precedence (the contract): envelope -> high-stakes/medical/financial -> fork/first-pr
// -> malformed channel -> veto -> flag -> conflict -> MERGE.
export function evaluatePolicy({ envelope, channels = [], author = {}, facts = {}, config = {} } = {}) {
  const list = Array.isArray(channels) ? channels : [];
  const findings = buildForensicMap(list).findings;
  const threshold =
    typeof config.conflictThreshold === 'number' ? config.conflictThreshold : DEFAULT_CONFLICT_THRESHOLD;

  // A human-bound outcome never inherits the author's automation class.
  const decide = (decision, reasons, conflict = null) => ({
    decision,
    actionClass: 'MANUAL',
    reasons,
    conflict,
    findings,
  });

  if (!envelopeAllPass(envelope)) return decide('MANUAL', ['envelope']);

  if (facts.highStakes === true) return decide('THINK', ['high-stakes']);
  if (facts.medicalFlag === true) return decide('THINK', ['medical-flag']);
  if (facts.financialFlag === true) return decide('THINK', ['financial-flag']);

  if (facts.fork === true) return decide('MANUAL', ['fork']);
  if (facts.firstPr === true) return decide('MANUAL', ['first-pr']);

  for (const result of list) {
    if (!validateChannelResult(result).ok) {
      const name =
        result && typeof result.channel === 'string' && result.channel ? result.channel : 'unknown';
      return decide('THINK', [`invalid-channel:${name}`]);
    }
  }

  for (const result of list) {
    if (result.verdict === 'veto') return decide('DECLINE', [`veto:${result.channel}`]);
  }
  for (const result of list) {
    if (result.verdict === 'flag') return decide('THINK', [`flag:${result.channel}`]);
  }

  // A channel conflict: the widest score gap beyond the threshold.
  let conflict = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const delta = Math.abs(list[i].score - list[j].score);
      if (delta > threshold && (!conflict || delta > conflict.delta)) {
        conflict = { pair: [list[i].channel, list[j].channel], delta };
      }
    }
  }
  if (conflict) return decide('THINK', [`conflict:${conflict.pair[0]}:${conflict.pair[1]}`], conflict);

  const actionClass = ACTION_CLASSES.includes(author && author.class) ? author.class : 'MANUAL';
  return { decision: 'MERGE', actionClass, reasons: ['merge'], conflict: null, findings };
}

/**
 * CONTRACT: scripts/product/pr-review/audit/channel.mjs
 * ROLE: the channel-output schema — spans, normalized channel results and their allowlist validator
 * EXPORTS:
 *   CHANNEL_VERDICTS — the frozen allowed verdicts: pass, flag, veto
 *   makeSpan — validates and builds a {file,start,end,rule,reason} span
 *   makeChannelResult — normalizes a channel result to {channel,score,spans[,verdict]}
 *   validateChannelResult — allowlist validation; returns {ok,errors}, never throws
 * INVARIANTS:
 *   — a channel result carries only channel/score/spans/verdict; anything else is a schema error
 *   — validation never throws: an unknown shape is reported, not fatal
 */

export const CHANNEL_VERDICTS = Object.freeze(['pass', 'flag', 'veto']);

// isNonEmptyString(v) → true when v is a string with visible content
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

// assertSpanField(cond,message) → throw a loud span error when the field is invalid
function assertSpanField(cond, message) {
  if (!cond) throw new Error(`audit-channel: ${message}`);
}

// makeSpan({file,start,end,rule,reason}) → a validated span (throws on bad input)
export function makeSpan({ file, start, end, rule, reason } = {}) {
  assertSpanField(isNonEmptyString(file), 'span.file must be a non-empty string');
  assertSpanField(Number.isInteger(start) && start >= 0, 'span.start must be an integer >= 0');
  assertSpanField(Number.isInteger(end) && end > start, 'span.end must be an integer > start');
  assertSpanField(isNonEmptyString(rule), 'span.rule must be a non-empty string');
  assertSpanField(isNonEmptyString(reason), 'span.reason must be a non-empty string');
  return { file, start, end, rule, reason };
}

// spanProblems(span) → string[] (empty = a valid span); never throws
function spanProblems(span) {
  if (!span || typeof span !== 'object' || Array.isArray(span)) return ['span must be an object'];
  const errors = [];
  if (!isNonEmptyString(span.file)) errors.push('span.file must be a non-empty string');
  if (!Number.isInteger(span.start) || span.start < 0) errors.push('span.start must be an integer >= 0');
  if (!Number.isInteger(span.end) || !(span.end > span.start)) {
    errors.push('span.end must be an integer > span.start');
  }
  if (!isNonEmptyString(span.rule)) errors.push('span.rule must be a non-empty string');
  if (!isNonEmptyString(span.reason)) errors.push('span.reason must be a non-empty string');
  return errors;
}

// makeChannelResult({channel,score,spans,verdict}) → the canonical result shape.
// Lenient by design: validateChannelResult is the fail-visible gate.
export function makeChannelResult({ channel, score = 0, spans = [], verdict } = {}) {
  const result = { channel, score, spans: Array.isArray(spans) ? spans : [] };
  if (verdict !== undefined) result.verdict = verdict;
  return result;
}

// validateChannelResult(result) → {ok,errors}; an allowlist check that never throws
export function validateChannelResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { ok: false, errors: ['result must be an object'] };
  }
  const errors = [];
  const allowed = new Set(['channel', 'score', 'spans', 'verdict']);
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) errors.push(`unexpected key: ${key}`);
  }
  if (!isNonEmptyString(result.channel)) errors.push('channel must be a non-empty string');
  if (
    typeof result.score !== 'number' ||
    !Number.isFinite(result.score) ||
    result.score < 0 ||
    result.score > 1
  ) {
    errors.push('score must be a finite number in 0..1');
  }
  if (!Array.isArray(result.spans)) {
    errors.push('spans must be an array');
  } else {
    result.spans.forEach((span, i) => {
      for (const problem of spanProblems(span)) errors.push(`spans[${i}]: ${problem}`);
    });
  }
  if (result.verdict !== undefined && !CHANNEL_VERDICTS.includes(result.verdict)) {
    errors.push(`verdict must be one of ${CHANNEL_VERDICTS.join(', ')}`);
  }
  return { ok: errors.length === 0, errors };
}

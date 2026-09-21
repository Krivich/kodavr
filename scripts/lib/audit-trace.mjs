/**
 * CONTRACT: scripts/lib/audit-trace.mjs
 * ROLE: Layer 5 (deterministic half) — residue classifier over the judge's raw reasoning trace and a non-LLM quote-masker
 * EXPORTS:
 *   TRACE_SIGNALS — the frozen signal ids the layer may name
 *   GOAL_SHIFT_PATTERNS — literal regexes: the task goal substituted with a goal from the data
 *   IMPERATIVE_PATTERNS — literal regexes: a diff imperative reproduced as the trace's own voice
 *   detectTraceResidue — trace → {skipped:false,score,signals:[{id,quote,span}]} | {skipped:true,reason}
 *   quoteMask — trace + diff files → {masked,mapping}; deterministic fuzzy subtraction of copied spans
 *   traceResidueChannel — trace + files → a valid ChannelResult, or {skipped:true} when there is no trace
 * CONSUMES:
 *   ./audit-channel.mjs — makeChannelResult, makeSpan (the channel-output schema)
 * INVARIANTS:
 *   — pure and deterministic: no network, no LLM, no clock, no randomness in this module
 *   — a missing trace is a skipped result, never a throw; the caller redistributes the weights (§4.6.6)
 *   — the classifier reads the MASKED trace, so a payload the trace merely quotes is not read as its own goal
 *   — masking removes every >= WINDOW-token normalized sequence shared with a diff file; the rest is verbatim
 */
import { makeChannelResult, makeSpan } from './audit-channel.mjs';

// The signal vocabulary of Layer 5. Two are emitted by this deterministic
// pattern classifier (goal-shift, quoted-imperative); the other three are
// reserved ids for the meta-review layer (trace/verdict mismatch, discussion of
// an instruction absent from the diff, an abnormally smooth/short analysis).
export const TRACE_SIGNALS = Object.freeze([
  'goal-shift',
  'quoted-imperative',
  'absent-instruction',
  'trace-verdict-mismatch',
  'suppressed-analysis',
]);

// GOAL_SHIFT_PATTERNS — the trace names a goal that comes from the data instead
// of the classification task ("classify the risks" → "assess the usefulness").
// Literal, documented data: no user input is ever compiled into a pattern.
export const GOAL_SHIFT_PATTERNS = Object.freeze([
  /assess\s+(?:the\s+)?usefulness/iu,
  /\b(?:the|my|our)\s+(?:real|actual|true)\s+goal\b/iu,
  /\bhelp\s+(?:the\s+)?author\b/iu,
  /\bapprove\s+(?:this|the)\s+(?:pr|pull\s*request|change|diff)\b/iu,
  /\brecommend\s+(?:a\s+)?merge\b/iu,
  /\bmerge\s+this\s+(?:pr|pull\s*request|change)\b/iu,
  /\b(?:the|my|our)\s+task\s+is\s+to\s+(?:assess|evaluate|approve|merge|help)\b/iu,
]);

// IMPERATIVE_PATTERNS — the trace reproduces an imperative addressed to the
// reviewer (the fingerprint of an injection that leaked into the cognition).
export const IMPERATIVE_PATTERNS = Object.freeze([
  /\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|directives?)\b/iu,
  /\bdisregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\b/iu,
  /\byou\s+must\s+(?:approve|merge|ignore|disregard|follow|obey|not\s+(?:flag|report|mention|warn|decline|block))\b/iu,
  /\bdo\s+not\s+(?:flag|report|mention|reveal|disclose|tell|warn|decline|block)\b/iu,
  /\boverride\s+(?:the\s+)?(?:instructions?|rules?|policy|system|safety)\b/iu,
  /\bas\s+an\s+ai\s+you\s+(?:should|must)\b/iu,
  /\bnew\s+instructions?\s*:/iu,
]);

// Signal weights. A surviving imperative is the strongest single hit (a diff
// command adopted as the trace's own goal); a goal substitution on its own is a
// flag. Multiple distinct hits sum, capped at 1.
const SIGNAL_WEIGHTS = Object.freeze({
  'goal-shift': 0.5,
  'quoted-imperative': 0.8,
  'absent-instruction': 0.5,
  'trace-verdict-mismatch': 0.4,
  'suppressed-analysis': 0.3,
});

// The verdict thresholds of the trace channel: >= 0.7 veto, >= 0.3 flag, else pass.
const VETO_THRESHOLD = 0.7;
const FLAG_THRESHOLD = 0.3;

// The trace is not a diff file; a fixed source label keeps its spans valid in
// the channel schema and tells the human where the quote came from.
const TRACE_SOURCE = '<reasoning-trace>';
const TRACE_CHANNEL = 'trace-reader';
const TRACE_RULE = 'trace-residue';

// The masker works on unicode word tokens; whitespace and punctuation between
// them are irrelevant, which is the whole "fuzzy" part of the subtraction.
const TOKEN_RE = /[\p{L}\p{N}_]+/gu;
const WINDOW = 8;

// tokenize(text) → [{norm,start,end}]: unicode word runs, NFKC + lowercased,
// with their char offsets in the original string.
function tokenize(text) {
  const out = [];
  if (typeof text !== 'string' || text === '') return out;
  for (const m of text.matchAll(TOKEN_RE)) {
    out.push({ norm: m[0].normalize('NFKC').toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// ngramKey(tokens,i) → the normalized WINDOW-token key starting at i.
function ngramKey(tokens, i) {
  let key = tokens[i].norm;
  for (let k = 1; k < WINDOW; k++) key += `\u0001${tokens[i + k].norm}`;
  return key;
}

// collectHits(pattern,id,text,hits) → append every non-empty match with its quote
// and span. A fresh global clone keeps the frozen pattern free of lastIndex state.
function collectHits(pattern, id, text, hits) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  for (const m of text.matchAll(new RegExp(pattern.source, flags))) {
    if (m[0].length === 0) continue;
    hits.push({ id, quote: m[0], span: { start: m.index, end: m.index + m[0].length } });
  }
}

// dedupeOverlaps(hits) → non-overlapping hits; on an overlap the longer span
// wins (a phrase matching two lists is counted once, deterministically).
function dedupeOverlaps(hits) {
  const sorted = hits
    .slice()
    .sort((a, b) => a.span.start - b.span.start || b.span.end - a.span.end || (a.id < b.id ? -1 : 1));
  const out = [];
  for (const hit of sorted) {
    if (out.some((k) => hit.span.start < k.span.end && hit.span.end > k.span.start)) continue;
    out.push(hit);
  }
  return out.sort((a, b) => a.span.start - b.span.start);
}

// detectTraceResidue(trace) → {skipped:false,score,signals} or {skipped:true,reason}.
// A non-string or blank trace is skipped, never a throw. score is the capped sum
// of the surviving signal weights in 0..1.
export function detectTraceResidue(trace) {
  if (typeof trace !== 'string' || trace.trim() === '') return { skipped: true, reason: 'no trace' };
  const hits = [];
  for (const pattern of GOAL_SHIFT_PATTERNS) collectHits(pattern, 'goal-shift', trace, hits);
  for (const pattern of IMPERATIVE_PATTERNS) collectHits(pattern, 'quoted-imperative', trace, hits);
  const signals = dedupeOverlaps(hits);
  const score = Math.min(1, signals.reduce((sum, s) => sum + (SIGNAL_WEIGHTS[s.id] || 0), 0));
  return { skipped: false, score, signals };
}

// quoteMask({trace,files}) → {masked,mapping}. Algorithm (deterministic, no LLM):
//   1. tokenize the trace and every {file,text} on unicode word chars, NFKC + lowercased;
//   2. index every WINDOW-token sequence of every diff file;
//   3. mark every trace token covered by a shared WINDOW-token window;
//   4. replace each maximal covered token run with [QUOTED-INPUT-N] and record
//      {marker,file,start,end} with char offsets in the ORIGINAL trace.
// The result guarantees no >= WINDOW-token normalized diff sequence survives;
// text outside the masked runs is copied verbatim. A null trace → {masked:'',mapping:[]}.
export function quoteMask({ trace, files } = {}) {
  if (typeof trace !== 'string' || trace === '') return { masked: '', mapping: [] };
  const fileList = Array.isArray(files) ? files : [];

  // (1)+(2) every shared WINDOW-token key → the first file that carries it.
  const windowFile = new Map();
  for (const entry of fileList) {
    const file = entry && typeof entry.file === 'string' ? entry.file : '';
    const text = entry && typeof entry.text === 'string' ? entry.text : '';
    if (!file || !text) continue;
    const fileTokens = tokenize(text);
    for (let i = 0; i + WINDOW <= fileTokens.length; i++) {
      const key = ngramKey(fileTokens, i);
      if (!windowFile.has(key)) windowFile.set(key, file);
    }
  }

  const traceTokens = tokenize(trace);
  if (traceTokens.length < WINDOW || windowFile.size === 0) return { masked: trace, mapping: [] };

  // (3) token coverage: a token is covered when some shared window contains it.
  const coveredStart = new Array(traceTokens.length).fill(null);
  for (let i = 0; i + WINDOW <= traceTokens.length; i++) {
    const key = ngramKey(traceTokens, i);
    const file = windowFile.get(key);
    if (file) coveredStart[i] = file;
  }
  const tokenFile = new Array(traceTokens.length).fill(null);
  for (let i = 0; i < traceTokens.length; i++) {
    if (!coveredStart[i]) continue;
    for (let t = i; t < i + WINDOW; t++) if (!tokenFile[t]) tokenFile[t] = coveredStart[i];
  }

  // (4) maximal covered token runs → markers + mapping, preserving the rest.
  const parts = [];
  const mapping = [];
  let cursor = 0;
  let n = 0;
  let t = 0;
  while (t < traceTokens.length) {
    if (!tokenFile[t]) {
      t++;
      continue;
    }
    let end = t;
    while (end < traceTokens.length && tokenFile[end]) end++;
    const startChar = traceTokens[t].start;
    const endChar = traceTokens[end - 1].end;
    const marker = `[QUOTED-INPUT-${(n += 1)}]`;
    parts.push(trace.slice(cursor, startChar), marker);
    mapping.push({ marker, file: tokenFile[t], start: startChar, end: endChar });
    cursor = endChar;
    t = end;
  }
  parts.push(trace.slice(cursor));
  return { masked: parts.join(''), mapping };
}

// traceResidueChannel({trace,files}) → a valid ChannelResult, or {skipped:true}
// when there is no trace (NOT a ChannelResult — the caller redistributes the
// weights, §4.6.6). The classifier reads the MASKED trace so a quoted payload is
// not mistaken for the trace's own goal; a signal that survives masking is the
// strong one. verdict: score >= 0.7 → veto, >= 0.3 → flag, else pass.
export function traceResidueChannel({ trace, files } = {}) {
  if (typeof trace !== 'string' || trace.trim() === '') return { skipped: true, reason: 'no trace' };
  const { masked } = quoteMask({ trace, files });
  const residue = detectTraceResidue(masked);
  const signals = residue.skipped ? [] : residue.signals;
  const score = residue.skipped ? 0 : residue.score;
  const spans = signals.map((signal) =>
    makeSpan({
      file: TRACE_SOURCE,
      start: signal.span.start,
      end: signal.span.end,
      rule: TRACE_RULE,
      reason: `trace residue: ${signal.id}`,
    }),
  );
  const verdict = score >= VETO_THRESHOLD ? 'veto' : score >= FLAG_THRESHOLD ? 'flag' : 'pass';
  return makeChannelResult({ channel: TRACE_CHANNEL, score, spans, verdict });
}

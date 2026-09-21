/**
 * CONTRACT: scripts/product/pr-review/audit/forensic.mjs
 * ROLE: converges channel spans into the top-N forensic map a human sees
 * EXPORTS:
 *   MAX_FORENSIC_FINDINGS — the default top-N cap for the forensic map
 *   buildForensicMap — ChannelResult[] → {findings} of converged, ordered spans
 * INVARIANTS:
 *   — overlapping spans in one file converge into one finding; no numeric score leaks
 *   — ordering is deterministic: convergence count desc, span length desc, then position
 */

export const MAX_FORENSIC_FINDINGS = 10;

// isSpan(s) → true for a usable {file,start,end} span
const isSpan = (s) =>
  s &&
  typeof s === 'object' &&
  typeof s.file === 'string' &&
  typeof s.start === 'number' &&
  typeof s.end === 'number';

// overlaps(a,b) → true when two half-open intervals on the same file intersect
const overlaps = (a, b) => a.file === b.file && a.start < b.end && b.start < a.end;

// buildForensicMap(channelResults,{topN}) → {findings:[{file,start,end,reasons,channels}]}.
// Spans overlapping in the same file (transitively, across channels) merge into one
// finding; the output carries reasons and channel ids, never a score.
export function buildForensicMap(channelResults = [], { topN = MAX_FORENSIC_FINDINGS } = {}) {
  const raw = [];
  for (const result of channelResults) {
    if (!result || !Array.isArray(result.spans)) continue;
    const channel = typeof result.channel === 'string' ? result.channel : '';
    for (const s of result.spans) if (isSpan(s)) raw.push({ ...s, channel });
  }

  const groups = [];
  for (const span of raw) {
    const overlapping = groups.filter((g) => !g.merged && overlaps(g, span));
    if (!overlapping.length) {
      groups.push({
        file: span.file,
        start: span.start,
        end: span.end,
        channels: new Set([span.channel]),
        reasons: new Set(span.reason ? [span.reason] : []),
      });
      continue;
    }
    const target = overlapping[0];
    for (const g of overlapping) {
      if (g === target) continue;
      target.start = Math.min(target.start, g.start);
      target.end = Math.max(target.end, g.end);
      for (const c of g.channels) target.channels.add(c);
      for (const r of g.reasons) target.reasons.add(r);
      g.merged = true;
    }
    target.start = Math.min(target.start, span.start);
    target.end = Math.max(target.end, span.end);
    target.channels.add(span.channel);
    if (span.reason) target.reasons.add(span.reason);
  }

  const findings = groups
    .filter((g) => !g.merged)
    .map((g) => ({
      file: g.file,
      start: g.start,
      end: g.end,
      reasons: [...g.reasons],
      channels: [...g.channels],
    }))
    .sort(
      (a, b) =>
        b.channels.length - a.channels.length ||
        b.end - b.start - (a.end - a.start) ||
        (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
        a.start - b.start,
    )
    .slice(0, topN);

  return { findings };
}

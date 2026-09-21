// tests/unit/audit-forensic.test.js — the channel schema and the forensic map
// (KDV-SCAN-01). Channels emit a score and localized spans; the forensic map
// converges overlapping spans, orders by convergence then length, and carries
// no numeric scores into the human-facing output.
import { describe, it, expect } from 'vitest';
import {
  CHANNEL_VERDICTS,
  makeSpan,
  makeChannelResult,
  validateChannelResult,
} from '../../scripts/lib/audit-channel.mjs';
import { buildForensicMap, MAX_FORENSIC_FINDINGS } from '../../scripts/lib/audit-forensic.mjs';

const span = (start, end, reason, rule = 'test') =>
  makeSpan({ file: 'raw.md', start, end, rule, reason });

describe('KDV-SCAN-01: channel schema + forensic map', () => {
  it('KDV-SCAN-01: makeSpan validates its offsets and required text', () => {
    expect(span(3, 7, 'a reason')).toEqual({
      file: 'raw.md',
      start: 3,
      end: 7,
      rule: 'test',
      reason: 'a reason',
    });
    expect(() => makeSpan({ file: 'raw.md', start: -1, end: 2, rule: 'r', reason: 'x' })).toThrow();
    expect(() => makeSpan({ file: 'raw.md', start: 5, end: 5, rule: 'r', reason: 'x' })).toThrow();
    expect(() => makeSpan({ file: '', start: 0, end: 1, rule: 'r', reason: 'x' })).toThrow();
    expect(() => makeSpan({ file: 'f', start: 0, end: 1, rule: '', reason: 'x' })).toThrow();
    expect(() => makeSpan({ file: 'f', start: 0, end: 1, rule: 'r', reason: '' })).toThrow();
  });

  it('KDV-SCAN-01: validateChannelResult is an allowlist that never throws', () => {
    const good = makeChannelResult({
      channel: 'structural',
      score: 1,
      verdict: 'flag',
      spans: [span(0, 2, 'why')],
    });
    expect(validateChannelResult(good)).toEqual({ ok: true, errors: [] });

    expect(validateChannelResult({ channel: 'c', score: 0.5, spans: [], bogus: 1 }).ok).toBe(false);
    expect(validateChannelResult({ channel: '', score: 0.5, spans: [] }).errors.join(' ')).toMatch(/channel/);
    expect(validateChannelResult({ channel: 'c', score: 2, spans: [] }).errors.join(' ')).toMatch(/score/);
    expect(
      validateChannelResult({ channel: 'c', score: 0.5, spans: [{ file: 'f', start: 2, end: 1, rule: 'r', reason: 'x' }] }).ok,
    ).toBe(false);
    expect(
      validateChannelResult({ channel: 'c', score: 0.5, spans: [], verdict: 'maybe' }).errors.join(' '),
    ).toMatch(/verdict/);
    expect(validateChannelResult(null).ok).toBe(false);
    expect(validateChannelResult('nope').ok).toBe(false);
    expect(CHANNEL_VERDICTS).toEqual(['pass', 'flag', 'veto']);
  });

  it('KDV-SCAN-01: overlapping spans from two channels converge into one finding', () => {
    const structural = makeChannelResult({
      channel: 'structural',
      score: 1,
      verdict: 'flag',
      spans: [span(10, 20, 'invisible char')],
    });
    const classifier = makeChannelResult({
      channel: 'classifier',
      score: 0.9,
      verdict: 'flag',
      spans: [span(15, 30, 'injection window')],
    });
    const map = buildForensicMap([structural, classifier]);
    expect(map.findings).toHaveLength(1);
    const [finding] = map.findings;
    expect(finding).toMatchObject({ file: 'raw.md', start: 10, end: 30 });
    expect([...finding.channels].sort()).toEqual(['classifier', 'structural']);
    expect(finding.reasons).toEqual(expect.arrayContaining(['invisible char', 'injection window']));
    expect(finding).not.toHaveProperty('score');
    expect(finding).not.toHaveProperty('scores');
  });

  it('KDV-SCAN-01: orders by convergence desc then span length desc and truncates to topN', () => {
    const two = makeChannelResult({ channel: 'a', score: 1, spans: [span(0, 5, 'r1')] });
    const two2 = makeChannelResult({ channel: 'b', score: 1, spans: [span(1, 6, 'r2')] });
    const loneLong = makeChannelResult({ channel: 'c', score: 1, spans: [span(100, 200, 'r3')] });
    const map = buildForensicMap([two, two2, loneLong]);
    expect(map.findings).toHaveLength(2);
    expect(map.findings[0].channels.length).toBe(2);
    expect(map.findings[0].start).toBe(0);
    expect(map.findings[1].start).toBe(100);

    const truncated = buildForensicMap([two, two2, loneLong], { topN: 1 });
    expect(truncated.findings).toHaveLength(1);
    expect(truncated.findings[0].channels.length).toBe(2);
    expect(MAX_FORENSIC_FINDINGS).toBe(10);
  });
});

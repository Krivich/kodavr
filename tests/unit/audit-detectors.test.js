// tests/unit/audit-detectors.test.js — Layer-1 structural detectors (KDV-SCAN-02).
// Deterministic encoding checks: invisible characters, base64-like blobs,
// homoglyphs and hidden markdown markup. Every hit is a {file,start,end,rule,reason}
// span with 0-based character offsets.
import { describe, it, expect } from 'vitest';
import {
  detectInvisibleChars,
  detectBase64Blobs,
  detectHomoglyphs,
  detectHiddenMarkup,
  structuralChannel,
} from '../../scripts/product/pr-review/audit/detectors.mjs';

describe('KDV-SCAN-02: Layer-1 structural detectors', () => {
  it('KDV-SCAN-02: flags every invisible/format/bidi character at its own offset', () => {
    const text = `a\u200Bb\u202Ec\uFEFF`;
    const spans = detectInvisibleChars(text, { file: 'raw.md' });
    expect(spans.map((s) => [s.start, s.end])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    for (const span of spans) {
      expect(span).toMatchObject({ file: 'raw.md', rule: 'invisible-char' });
      expect(typeof span.reason).toBe('string');
      expect(span.reason.length).toBeGreaterThan(0);
    }
  });

  it('KDV-SCAN-02: clean prose has no invisible-character spans', () => {
    expect(detectInvisibleChars('plain ascii prose', { file: 'raw.md' })).toEqual([]);
  });

  it('KDV-SCAN-02: flags a long base64-like blob and skips a long lowercase word', () => {
    const blob = `${'QUJD'.repeat(20)}=`; // 81 chars: uppercase + trailing '='
    const text = `prefix ${blob} suffix`;
    const spans = detectBase64Blobs(text, { file: 'raw.md' });
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ file: 'raw.md', rule: 'base64-blob' });
    expect(spans[0].start).toBe(text.indexOf(blob));
    expect(spans[0].end).toBe(text.indexOf(blob) + blob.length);

    expect(detectBase64Blobs('a'.repeat(120), { file: 'raw.md' })).toEqual([]);
    expect(detectBase64Blobs(blob.slice(0, 40), { file: 'raw.md' })).toEqual([]);
  });

  it('KDV-SCAN-02: flags a token mixing Latin with a Cyrillic/Greek lookalike', () => {
    const token = 'p\u0430ypal'; // 'а' is Cyrillic small a
    const text = `pay ${token} end`;
    const spans = detectHomoglyphs(text, { file: 'raw.md' });
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe(token);
    expect(spans[0]).toMatchObject({ file: 'raw.md', rule: 'homoglyph' });

    expect(detectHomoglyphs('paypal', { file: 'raw.md' })).toEqual([]);
    expect(detectHomoglyphs('\u043F\u0440\u0438\u0432\u0435\u0442', { file: 'raw.md' })).toEqual([]);
  });

  it('KDV-SCAN-02: flags HTML comments and hidden inline styles', () => {
    const text =
      'ok <!-- hidden note --> <span style="display:none">x</span> ' +
      '<b style=\'visibility: hidden\'>y</b> <i style="font-size: 0">z</i>';
    const spans = detectHiddenMarkup(text, { file: 'raw.md' });
    const rules = spans.map((s) => s.rule);
    expect(rules).toContain('html-comment');
    expect(rules.filter((r) => r === 'hidden-style')).toHaveLength(3);

    const comment = spans.find((s) => s.rule === 'html-comment');
    expect(text.slice(comment.start, comment.end)).toBe('<!-- hidden note -->');
    expect(detectHiddenMarkup('plain <b style="color:red">ok</b>', { file: 'raw.md' })).toEqual([]);
  });

  it('KDV-SCAN-02: structuralChannel aggregates files into one verdict/score', () => {
    const clean = structuralChannel([{ file: 'a.md', text: 'clean text' }]);
    expect(clean).toMatchObject({ channel: 'structural', score: 0, verdict: 'pass' });
    expect(clean.spans).toEqual([]);

    const flagged = structuralChannel([
      { file: 'a.md', text: 'clean' },
      { file: 'b.md', text: 'x\u200By' },
    ]);
    expect(flagged).toMatchObject({ channel: 'structural', score: 1, verdict: 'flag' });
    expect(flagged.spans).toHaveLength(1);
    expect(flagged.spans[0]).toMatchObject({ file: 'b.md', start: 1, end: 2 });
  });
});

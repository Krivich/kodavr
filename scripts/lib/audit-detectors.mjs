/**
 * CONTRACT: scripts/lib/audit-detectors.mjs
 * ROLE: Layer-1 deterministic structural detectors — invisible chars, base64 blobs, homoglyphs, hidden markup
 * EXPORTS:
 *   INVISIBLE_RANGES — the invisible/format/bidi code-point ranges the scanner flags
 *   detectInvisibleChars — one span per invisible/format/bidi character
 *   detectBase64Blobs — a long base64-like token span
 *   detectHomoglyphs — a token mixing Latin with Cyrillic/Greek lookalikes
 *   detectHiddenMarkup — HTML comments and hidden inline styles
 *   structuralChannel — every detector over [{file,text}] → one structural ChannelResult
 * CONSUMES:
 *   ./audit-channel.mjs — the span and channel-result constructors
 * INVARIANTS:
 *   — every detector is deterministic and returns 0-based character offsets
 *   — a clean text returns an empty span list, never null
 */
import { makeChannelResult, makeSpan } from './audit-channel.mjs';

// Invisible zero-width / format / bidi controls and the soft hyphen.
export const INVISIBLE_RANGES = Object.freeze([
  [0x200b, 0x200d],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
  [0x00ad, 0x00ad],
]);

const inInvisibleRange = (code) => INVISIBLE_RANGES.some(([lo, hi]) => code >= lo && code <= hi);

const hex = (code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

// detectInvisibleChars(text,{file}) → one span per invisible/format/bidi character
export function detectInvisibleChars(text, { file } = {}) {
  const spans = [];
  let i = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (inInvisibleRange(code)) {
      spans.push(
        makeSpan({ file, start: i, end: i + 1, rule: 'invisible-char', reason: `invisible character ${hex(code)}` }),
      );
    }
    i += ch.length; // a surrogate pair advances by 2 code units
  }
  return spans;
}

// A whitespace-free base64 token: the alphabet plus at most two trailing '='.
const BASE64_TOKEN = /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]+={0,2}(?![A-Za-z0-9+/=])/g;
// The token must look encoded, not like one long lowercase word.
const BASE64_HINT = /[+/\d=A-Z]/;

// detectBase64Blobs(text,{file,minLength}) → one span per qualifying token
export function detectBase64Blobs(text, { file, minLength = 80 } = {}) {
  const spans = [];
  const source = String(text);
  for (const m of source.matchAll(BASE64_TOKEN)) {
    const token = m[0];
    if (token.length < minLength) continue;
    if (!BASE64_HINT.test(token)) continue;
    spans.push(
      makeSpan({
        file,
        start: m.index,
        end: m.index + token.length,
        rule: 'base64-blob',
        reason: `base64-like blob of length ${token.length}`,
      }),
    );
  }
  return spans;
}

// Latin + Cyrillic/Greek confusable lookalikes (code points written as escapes
// so the source cannot drift into the very Latin letters it guards against).
const CONFUSABLES = new Set(
  [
    '\u0430\u0435\u043e\u0440\u0441\u0445\u0443', // Cyrillic а е о р с х у
    '\u0410\u0412\u0415\u041a\u041c\u041d\u041e\u0420\u0421\u0422\u0423\u0425', // Cyrillic А В Е К М Н О Р С Т У Х
    '\u03bf\u03b1\u03c1\u03bd\u03b9', // Greek ο α ρ ν ι
  ].flatMap((s) => [...s].map((c) => c.codePointAt(0))),
);
const LATIN = /[A-Za-z]/;
const TOKEN = /[\p{L}\p{N}_]+/gu;

// detectHomoglyphs(text,{file}) → one span per token mixing Latin with a lookalike
export function detectHomoglyphs(text, { file } = {}) {
  const spans = [];
  const source = String(text);
  for (const m of source.matchAll(TOKEN)) {
    const token = m[0];
    let latin = false;
    let confusable = false;
    for (const ch of token) {
      if (LATIN.test(ch)) latin = true;
      if (CONFUSABLES.has(ch.codePointAt(0))) confusable = true;
    }
    if (latin && confusable) {
      spans.push(
        makeSpan({
          file,
          start: m.index,
          end: m.index + token.length,
          rule: 'homoglyph',
          reason: 'token mixes Latin with Cyrillic/Greek lookalikes',
        }),
      );
    }
  }
  return spans;
}

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const STYLE_ATTR = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const HIDDEN_STYLE = /(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d]))/i;

// detectHiddenMarkup(text,{file}) → HTML comment spans + hidden inline-style spans
export function detectHiddenMarkup(text, { file } = {}) {
  const spans = [];
  const source = String(text);
  for (const m of source.matchAll(HTML_COMMENT)) {
    spans.push(
      makeSpan({
        file,
        start: m.index,
        end: m.index + m[0].length,
        rule: 'html-comment',
        reason: 'HTML comment (hidden markdown markup)',
      }),
    );
  }
  for (const m of source.matchAll(STYLE_ATTR)) {
    const value = m[1] !== undefined ? m[1] : m[2];
    if (value !== undefined && HIDDEN_STYLE.test(value)) {
      spans.push(
        makeSpan({
          file,
          start: m.index,
          end: m.index + m[0].length,
          rule: 'hidden-style',
          reason: 'hidden inline style',
        }),
      );
    }
  }
  return spans;
}

// structuralChannel(files,options) → one ChannelResult over every structural detector.
// verdict=flag and score=1 when any span exists, otherwise pass/0.
export function structuralChannel(files = [], options = {}) {
  const spans = [];
  for (const { file, text } of files) {
    spans.push(
      ...detectInvisibleChars(text, { file }),
      ...detectBase64Blobs(text, { file, ...options }),
      ...detectHomoglyphs(text, { file }),
      ...detectHiddenMarkup(text, { file }),
    );
  }
  spans.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.start - b.start));
  return makeChannelResult({
    channel: 'structural',
    score: spans.length ? 1 : 0,
    spans,
    verdict: spans.length ? 'flag' : 'pass',
  });
}

import { describe, it, expect } from 'vitest';
import { relativizeHtml } from '../../scripts/lib/relativize.mjs';

// The pure rewrite behind KDV-SURFACE-09: document-relative internal links so
// one artifact works at the domain root and under a GitHub Pages subpath.
describe('relativizeHtml', () => {
  const SAMPLE = '<a href="/dumps/x/">x</a><img src="/logo.svg"><a href="/">home</a>';

  it('KDV-SURFACE-09: rewrites single-slash href/src with the depth prefix', () => {
    expect(relativizeHtml(SAMPLE, { depth: 2 })).toBe(
      '<a href="../../dumps/x/">x</a><img src="../../logo.svg"><a href="../../">home</a>',
    );
    expect(relativizeHtml(SAMPLE, { depth: 1 })).toBe(
      '<a href="../dumps/x/">x</a><img src="../logo.svg"><a href="../">home</a>',
    );
  });

  it('KDV-SURFACE-09: strips the leading slash at depth 0 and maps bare / to ./', () => {
    expect(relativizeHtml(SAMPLE, { depth: 0 })).toBe(
      '<a href="dumps/x/">x</a><img src="logo.svg"><a href="./">home</a>',
    );
  });

  it('KDV-SURFACE-09: leaves protocol-relative, absolute, data:, mailto: and anchors untouched', () => {
    const html =
      '<a href="//cdn.example/x">a</a>' +
      '<a href="https://x.example/y">b</a>' +
      '<a href="http://x.example/y">c</a>' +
      '<img src="data:image/png;base64,AA">' +
      '<a href="mailto:x@example.test">d</a>' +
      '<a href="#top">e</a>';
    expect(relativizeHtml(html, { depth: 3 })).toBe(html);
  });

  it('KDV-SURFACE-09: a resolver can redirect a repo-only path to its GitHub blob URL', () => {
    const resolve = (value) => (value === '/docs/SPEC.md' ? 'https://github.com/krivich/kodavr/blob/main/docs/SPEC.md' : null);
    const html = '<a href="/docs/SPEC.md">spec</a><a href="/index.json">index</a>';
    expect(relativizeHtml(html, { depth: 2, resolve })).toBe(
      '<a href="https://github.com/krivich/kodavr/blob/main/docs/SPEC.md">spec</a><a href="../../index.json">index</a>',
    );
  });
});

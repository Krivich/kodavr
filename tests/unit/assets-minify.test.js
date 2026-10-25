// tests/unit/assets-minify.test.js — KDV-SURFACE-36: what leaves the server is
// smaller than what we read; the readable sources in static/ are untouched.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minifyCss, minifyJs } from '../../scripts/lib/build.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const css = readFileSync(join(ROOT, 'static', 'assets', 'styles.css'), 'utf8');
const js = readFileSync(join(ROOT, 'static', 'assets', 'site.js'), 'utf8');

describe('KDV-SURFACE-36: author-owned assets are published minified', () => {
  it('CSS drops comments and keeps strings, custom properties and calc() spacing', () => {
    const out = minifyCss(css);
    expect(out).not.toContain('/*');
    expect(out.length).toBeLessThan(css.length * 0.9);
    expect(out).toContain('--muted:#67635C');
    // a declared string is content, never syntax: it survives verbatim
    expect(css).toContain('content:"· "');
    expect(out).toContain('content:"· "');
    // calc() needs spaces around `+`/`-`; the minifier must not eat them
    expect(out).toContain('calc(-1 * var(--rail))');
    // the tokens still parse as a block
    expect(out).toMatch(/:root\{--fg:#161513;--bg:#F6F5F1;/);
  });

  it('JS drops full-line comments and indentation without joining lines', () => {
    const out = minifyJs(js);
    expect(out.split('\n').some((line) => line.trimStart().startsWith('//'))).toBe(false);
    expect(out.length).toBeLessThan(js.length * 0.9);
    expect(out).toContain('window.Kodavr');
    // code that looks like prose in a comment survives: the attribute is real
    expect(out).toContain("getAttribute('data-lang-label')");
    // the line count only shrinks (no joining), so ASI cannot change meaning
    expect(out.split('\n').length).toBeLessThan(js.split(/\r?\n/).length);
  });

  it('leaves the readable sources alone (minification is a publish step)', () => {
    expect(css).toContain('/*');
    expect(js.split('\n').some((line) => line.trimStart().startsWith('//'))).toBe(true);
  });
});

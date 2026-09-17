// tests/unit/design-system.test.js — the design-system guard (KDV-SURFACE-22).
//
// The stylesheet is a system, not a pile of page CSS. Three invariants keep it
// that way: the doc names every token, every component class selector is backed
// by a shipped hook (template/controller/page script/test), and no selector is
// declared twice at the top level. The contract lives in docs/design-system.md.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Comments carry prose about classes — blank them out (keeping newlines) so a
// class mentioned in a comment is not mistaken for a selector.
const CSS = read('static/assets/styles.css').replace(/\/\*[\s\S]*?\*\//g, (c) =>
  c.replace(/[^\n]/g, ' '),
);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'output', 'test-results'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const HOOKS = ['input/templates', 'input/controllers', 'static/assets', 'tests']
  .flatMap((dir) => walk(join(ROOT, dir)))
  .filter((p) => /\.(hbs|js|mjs)$/.test(p))
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

function classSelectors(css) {
  const found = new Set();
  const re = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;
  let m;
  while ((m = re.exec(css)) !== null) found.add(m[1]);
  return found;
}

function topLevelSelectors(css) {
  const list = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const before = css.slice(0, m.index);
    const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length;
    if (depth !== 0) continue;
    const selector = m[1].trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@')) continue;
    list.push(selector);
  }
  return list;
}

describe('design system (KDV-SURFACE-22)', () => {
  it('docs/design-system.md names every token declared on :root', () => {
    const doc = read('docs/design-system.md');
    const root = CSS.match(/:root\{([^}]*)\}/)?.[1] ?? '';
    const tokens = [...root.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.filter((t) => !doc.includes(t))).toEqual([]);
  });

  it('every class selector in the stylesheet is backed by a shipped hook', () => {
    const dead = [...classSelectors(CSS)].filter((c) => !HOOKS.includes(c)).sort();
    expect(dead, 'dead component selectors (no template/controller/test hook)').toEqual([]);
  });

  it('no selector is declared twice at the top level', () => {
    const seen = new Set();
    const duplicates = new Set();
    for (const selector of topLevelSelectors(CSS)) {
      if (seen.has(selector)) duplicates.add(selector);
      seen.add(selector);
    }
    expect([...duplicates], 'duplicate top-level selectors').toEqual([]);
  });
});

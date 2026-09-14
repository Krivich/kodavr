// tests/unit/content-starters.test.js — the mandatory starter dump (§10).
// `2026-09-14-kodavr-manifesto` is the platform manifesto (type=case,
// self-referential to the spec) and doubles as the worked example of the format.
// The second starter slot is intentionally deferred to a real community PR
// (§10.2): no filler dump is shipped.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT_URL = new URL('../../', import.meta.url);
const ROOT = fileURLToPath(ROOT_URL);
const read = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, ROOT_URL)), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => existsSync(fileURLToPath(new URL(rel, ROOT_URL)));

const MANIFESTO = 'content/dumps/2026-09-14-kodavr-manifesto';

const manifestOf = (dir) => JSON.parse(read(`${dir}/manifest.json`));

// A dump-local link target resolves against the dump directory OR the repo root
// (the same rule validate.mjs KDV-CI-06 applies); scheme/`//`/`#` are external.
function resolves(dir, target) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return true;
  const clean = target.split('#')[0].split('?')[0];
  return existsSync(resolve(ROOT, dir, clean)) || existsSync(resolve(ROOT, clean));
}

describe('starter content (§10)', () => {
  it('KDV-CONTENT-01: dump #1 has the six §10.1 sections and the §10.1 meta', () => {
    expect(exists(`${MANIFESTO}/raw.md`)).toBe(true);
    const body = read(`${MANIFESTO}/raw.md`);

    const sections = body.split('\n').filter((line) => /^##\s+\d\.\s/.test(line));
    expect(sections).toHaveLength(6);
    for (const term of ['asymmetry', 'machine-readable', 'cadaver', 'docs/SPEC.md']) {
      expect(body, `body mentions ${term}`).toContain(term);
    }
    expect(/^#\s+\S/m.test(body)).toBe(true);
    expect(body.split('\n').filter((line) => /^#\s+\S/.test(line))).toHaveLength(1);

    const man = manifestOf(MANIFESTO);
    expect(man).toMatchObject({
      slug: '2026-09-14-kodavr-manifesto',
      type: 'case',
      domain: 'engineering',
      date: '2026-09-14',
      stakes: 'low',
      generated_by: 'hybrid',
      human_review: 'attested',
      trust_level: 'self-tested',
      content_flags: ['opinion'],
    });
  });

  it('KDV-CONTENT-02: dump #1 references docs/SPEC.md and every artifact resolves', () => {
    const body = read(`${MANIFESTO}/raw.md`);
    expect(body).toContain('docs/SPEC.md');

    const man = manifestOf(MANIFESTO);
    expect(Array.isArray(man.artifacts)).toBe(true);
    expect(man.artifacts.length).toBeGreaterThan(0);
    expect(man.artifacts.some((a) => a.path_or_url === 'docs/SPEC.md')).toBe(true);
    expect(man.artifacts.some((a) => a.path_or_url === 'static/logo.svg')).toBe(true);
    for (const artifact of man.artifacts) {
      expect(resolves(MANIFESTO, artifact.path_or_url), artifact.path_or_url).toBe(true);
    }
  });

  it('KDV-CONTENT-03: only the manifesto ships — the second starter slot is deferred to a community PR (§10.2)', () => {
    const entries = readdirSync(fileURLToPath(new URL('content/dumps', ROOT_URL)), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(entries).toEqual(['2026-09-14-kodavr-manifesto']);
  });
});

// tests/unit/content-starters.test.js — the starter dump and the anti-filler
// guard (§10). `2026-09-14-kodavr-manifesto` is the platform manifesto
// (type=case, self-referential to the spec) and doubles as the worked example
// of the format. Later dumps arrive through the normal community PR flow
// (§10.2): the guard checks that every shipped dump is a real, §4.1-valid dump
// instead of pinning the set to a fixed count.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateManifest } from '../../scripts/validate.mjs';

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

  it('KDV-CONTENT-03: no fabricated filler — the manifesto is present and every shipped dump is a real, §4.1-valid dump (§10.2)', () => {
    const slugs = readdirSync(fileURLToPath(new URL('content/dumps', ROOT_URL)), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    // The launch starter is present; the second slot fills through the normal
    // PR flow, so the set is not pinned to a count (a count check would red-flag
    // every real dump PR).
    expect(slugs).toContain('2026-09-14-kodavr-manifesto');

    // Every directory under content/dumps/ must be a real dump: manifest + raw
    // layer present, slug equals the directory name, and the manifest is
    // §4.1-valid — checked through the real validator, never a hardcoded list.
    for (const slug of slugs) {
      const dir = `content/dumps/${slug}`;
      expect(exists(`${dir}/manifest.json`), `${dir}/manifest.json`).toBe(true);
      expect(exists(`${dir}/raw.md`), `${dir}/raw.md`).toBe(true);
      const man = manifestOf(dir);
      expect(man.slug, `${slug}: manifest slug must equal the directory name`).toBe(slug);
      const errors = [];
      validateManifest(man, dir, errors);
      expect(errors, `${slug}: ${errors.join('; ')}`).toEqual([]);
    }
  });
});

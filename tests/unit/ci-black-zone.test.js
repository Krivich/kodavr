// tests/unit/ci-black-zone.test.js — black-zone heuristics plus the owner manual
// gate (§2.5, KDV-CI-08). The heuristic is best-effort and anchored on the
// category names in config/black-zone.json; a hit is never a verdict, it is a
// BLOCK that hands the PR to the owner. A missing/broken config must fail visible.
import { describe, it, expect, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { validateContent } from '../../scripts/validate.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function manifest(slug, overrides = {}) {
  return {
    slug,
    type: 'case',
    title: 'Sample Dump',
    date: '2026-01-05',
    domain: 'engineering',
    tags: ['sample'],
    stakes: 'low',
    content_flags: [],
    trust_level: 'self-tested',
    generated_by: 'human',
    human_review: 'minimal',
    license: 'CC-BY-4.0',
    summary: 'A sample dump for black-zone tests.',
    artifacts: [],
    ...overrides,
  };
}

async function writeDump(root, slug, files = {}, { raw = '# Sample\n\nBody text.\n' } = {}) {
  const dir = join(root, 'content', 'dumps', slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest(slug), null, 2));
  await writeFile(join(dir, 'raw.md'), raw);
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  return dir;
}

// Only the errors this requirement owns.
const blocks = (res) => res.errors.filter((e) => e.startsWith('KDV-CI-08'));

describe('black zones, KDV-CI-08 (§2.5)', () => {
  let root;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it('KDV-CI-08: black-zone content is a BLOCK that names the file and category and demands owner review', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-black-'));
    await writeDump(root, '2026-01-05-blackzone', {
      'raw.md': '# Marker\n\nCategory anchor: child sexual abuse material.\n',
    });
    const res = await validateContent({ root });
    const hits = blocks(res);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.join(' ')).toContain('2026-01-05-blackzone/raw.md');
    expect(hits.join(' ')).toMatch(/manual|review/i);
    expect(hits.join(' ')).toMatch(/csam|child sexual abuse/i);
  });

  it('KDV-CI-08: a clean dump produces no black-zone error', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-black-'));
    await writeDump(root, '2026-01-05-clean', {
      'raw.md': '# Clean\n\nA neutral engineering note about build pipelines.\n',
    });
    const res = await validateContent({ root });
    expect(blocks(res)).toEqual([]);
  });

  it('KDV-CI-08: a missing or corrupt heuristic config fails visible instead of silently skipping', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-black-'));
    await writeDump(root, '2026-01-05-config');

    // Missing config: the scan cannot run, so the validator must say so.
    let res = await validateContent({ root, blackZoneConfig: join(root, 'config', 'missing.json') });
    expect(blocks(res).length).toBeGreaterThan(0);
    expect(blocks(res).join(' ')).toMatch(/config/i);

    // Corrupt config: same — a visible error, never a silent pass.
    const cfg = join(root, 'config', 'black-zone.json');
    await mkdir(dirname(cfg), { recursive: true });
    await writeFile(cfg, '{ not json');
    res = await validateContent({ root, blackZoneConfig: cfg });
    expect(blocks(res).length).toBeGreaterThan(0);
    expect(blocks(res).join(' ')).toMatch(/config/i);
  });
});

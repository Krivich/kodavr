// tests/unit/struct.test.js — repository-structure rules (§3), KDV-STRUCT-01..07.
//
// The rules themselves live in scripts/tooling/quality-gates/validate.mjs (enforced in CI under the
// KDV-CI-* IDs); this file pins each STRUCT requirement to its own assertion so
// the registry can close the rows without duplicating the implementation.
import { describe, it, expect, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { validateContent } from '../../scripts/tooling/quality-gates/validate.mjs';
import { readDumps, buildLayers } from '../../scripts/lib/dumps.mjs';
import { resolveAuthorMeta, injectBuildMeta } from '../../scripts/lib/machine.mjs';

// A schema-valid §4.1 manifest; overrides let each test break exactly one rule.
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
    summary: 'A sample dump for validator tests.',
    artifacts: [],
    ...overrides,
  };
}

// Writes content/dumps/<slug>/<files>; pass manifest === null to omit it.
async function writeDump(root, slug, files = {}, { manifest: man = manifest(slug), raw = '# Sample\n\nBody text.\n' } = {}) {
  const dir = join(root, 'content', 'dumps', slug);
  await mkdir(dir, { recursive: true });
  if (man !== null) {
    await writeFile(join(dir, 'manifest.json'), typeof man === 'string' ? man : JSON.stringify(man, null, 2));
  }
  if (raw !== null) await writeFile(join(dir, 'raw.md'), raw);
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  return dir;
}

function hasError(res, needle) {
  return res.errors.some((e) => e.includes(needle));
}

describe('repository structure (§3)', () => {
  const roots = [];

  async function tempRoot() {
    const root = await mkdtemp(join(tmpdir(), 'kodavr-struct-'));
    roots.push(root);
    return root;
  }

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it('KDV-STRUCT-01: dumps are discovered under content/dumps/<slug>/ and nowhere else', async () => {
    const root = await tempRoot();
    // A schema-broken dump inside the canonical tree must be reported…
    await writeDump(root, '2026-01-05-inside', {}, { manifest: manifest('2026-01-05-inside', { type: 'blog' }) });
    // …while the same broken dump outside content/dumps/ is not scanned at all.
    const stray = join(root, 'elsewhere', '2026-01-05-outside');
    await mkdir(stray, { recursive: true });
    await writeFile(join(stray, 'manifest.json'), JSON.stringify(manifest('2026-01-05-outside', { type: 'blog' })));
    await writeFile(join(stray, 'raw.md'), '# Stray\n');

    const res = await validateContent({ root });
    expect(hasError(res, '2026-01-05-inside')).toBe(true);
    expect(res.errors.some((e) => e.includes('outside'))).toBe(false);
  });

  it('KDV-STRUCT-02: manifest.json is mandatory and raw.md is the only mandatory body layer', async () => {
    const root = await tempRoot();
    // manifest + raw only is a complete dump (refined/summary are optional)…
    await writeDump(root, '2026-01-05-rawonly');
    expect((await validateContent({ root })).errors).toEqual([]);
    // …and the layer builder reflects exactly the files on disk.
    expect(buildLayers(new Set(['raw.md'])).map((l) => l.name)).toEqual(['raw']);
    expect(buildLayers(new Set(['raw.md', 'refined.md'])).map((l) => l.name)).toEqual(['raw', 'refined']);

    // A missing manifest is a validator BLOCK.
    await writeDump(root, '2026-01-05-nomanifest', {}, { manifest: null });
    expect(hasError(await validateContent({ root }), 'manifest.json is missing')).toBe(true);

    // A missing body is a build-time failure (readDumps owns that contract).
    const root2 = await tempRoot();
    await mkdir(join(root2, '2026-01-05-noraw'), { recursive: true });
    await writeFile(join(root2, '2026-01-05-noraw', 'manifest.json'), JSON.stringify(manifest('2026-01-05-noraw')));
    await expect(readDumps(root2)).rejects.toThrow(/raw/i);
  });

  it('KDV-STRUCT-03: type=pack requires SETUP_AGENT.md, START_HERE.md, files/ and checks/', async () => {
    const root = await tempRoot();
    await writeDump(root, '2026-01-05-pack', {}, { manifest: manifest('2026-01-05-pack', { type: 'pack' }) });
    const missing = await validateContent({ root });
    for (const needle of ['SETUP_AGENT.md', 'START_HERE.md', 'files/', 'checks/']) {
      expect(hasError(missing, needle), needle).toBe(true);
    }

    const root2 = await tempRoot();
    await writeDump(
      root2,
      '2026-01-05-packok',
      {
        'SETUP_AGENT.md': '# Setup\n',
        'START_HERE.md': '# Start\n',
        'files/README.md': '# Files\n',
        'checks/verify.md': '# Checks\n',
      },
      { manifest: manifest('2026-01-05-packok', { type: 'pack' }) },
    );
    const valid = await validateContent({ root: root2 });
    expect(valid.errors).toEqual([]);
  });

  it('KDV-STRUCT-04: REDACTIONS.md is required when sources include chat/correspondence', async () => {
    const root = await tempRoot();
    await writeDump(root, '2026-01-05-chat', {}, { manifest: manifest('2026-01-05-chat', { sources: ['chat-log'] }) });
    expect(hasError(await validateContent({ root }), 'REDACTIONS.md')).toBe(true);

    const root2 = await tempRoot();
    await writeDump(
      root2,
      '2026-01-05-chat-redacted',
      { 'REDACTIONS.md': '# Redactions\n' },
      { manifest: manifest('2026-01-05-chat-redacted', { sources: ['chat-log'] }) },
    );
    // A non-chat source never needs redactions.
    await writeDump(root2, '2026-01-05-code', {}, { manifest: manifest('2026-01-05-code', { sources: ['source-code'] }) });
    expect((await validateContent({ root: root2 })).errors).toEqual([]);
  });

  it('KDV-STRUCT-05: assets/*.png|svg|puml under 1 MB are allowed; other binaries/heavy files are not', async () => {
    // Legitimate lightweight assets under <dump>/assets/ are permitted (§3, §8.1).
    const okRoot = await tempRoot();
    await writeDump(okRoot, '2026-01-05-assetok', {
      'assets/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'assets/diagram.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    });
    expect((await validateContent({ root: okRoot })).errors).toEqual([]);

    const root = await tempRoot();
    await writeDump(root, '2026-01-05-assets', {
      'assets/big.png': 'x'.repeat(1024 * 1024 + 1),
      'screenshot.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'pack.zip': Buffer.from([0x50, 0x4b]),
    });
    const res = await validateContent({ root });
    expect(hasError(res, '1 MB cap')).toBe(true);
    expect(hasError(res, 'big.png')).toBe(true);
    expect(hasError(res, 'screenshot.png')).toBe(true); // binary outside assets/
    expect(hasError(res, 'pack.zip')).toBe(true);

    // Heavy artifacts legitimately point at a GitHub Release instead.
    const root2 = await tempRoot();
    await writeDump(root2, '2026-01-05-release', {}, {
      manifest: manifest('2026-01-05-release', {
        artifacts: [
          {
            kind: 'release',
            path_or_url: 'https://github.com/krivich/kodavr/releases/download/dump-2026-01-05-release-v1/pack.zip',
          },
        ],
      }),
    });
    expect((await validateContent({ root: root2 })).errors).toEqual([]);
  });

  it('KDV-STRUCT-06: a slug is date-shaped, unique, and equals its directory and manifest field', async () => {
    const root = await tempRoot();
    await writeDump(root, 'sample-dump', {}, { manifest: manifest('sample-dump') }); // no date prefix
    await writeDump(root, '2026-01-05-mismatch', {}, { manifest: manifest('2026-01-05-other') });
    await writeDump(root, '2026-01-05-dup', {}, { manifest: manifest('2026-01-05-dup') });
    await writeDump(root, '2026-01-05-dup-two', {}, { manifest: manifest('2026-01-05-dup') });

    const res = await validateContent({ root });
    expect(hasError(res, 'must match YYYY-MM-DD')).toBe(true);
    expect(hasError(res, 'must equal the directory name')).toBe(true);
    expect(hasError(res, 'duplicate slug')).toBe(true);
  });

  it('KDV-STRUCT-07: author.* is extracted from the merged-PR payload, never hand-filled (live metadata needs a remote)', () => {
    const event = {
      pull_request: {
        user: { login: 'octocat' },
        html_url: 'https://github.com/krivich/kodavr/pull/7',
        merged_at: '2026-09-14T10:00:00Z',
      },
    };
    const author = resolveAuthorMeta({ env: { GITHUB_ACTOR: 'fallback' }, event });
    expect(author).toEqual({
      github: 'octocat',
      pr_url: 'https://github.com/krivich/kodavr/pull/7',
      merged_at: '2026-09-14T10:00:00Z',
    });

    const emitted = injectBuildMeta({ slug: '2026-09-14-x' }, { commitSha: 'abc', builtAt: 't', author });
    expect(emitted.author.github).toBe('octocat');
    // No PR context: the block is absent, never fabricated from thin air.
    expect('author' in injectBuildMeta({ slug: 'x' }, { commitSha: 'abc', builtAt: 't' })).toBe(false);
  });

  it('KDV-STRUCT-01..06: the real repository content satisfies every structure rule', async () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const res = await validateContent({ root });
    expect(res.errors).toEqual([]);
  });
});

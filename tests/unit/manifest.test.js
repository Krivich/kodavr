import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';
import {
  injectBuildMeta,
  resolveAuthorMeta,
  DEFAULT_LICENSE,
  CONSUMPTION_CONTRACT_SEE,
  CONTENT_FLAGS_VOCABULARY,
} from '../../scripts/lib/machine.mjs';
import { validateManifest } from '../../scripts/validate.mjs';
import { HIGH_STAKES_DISCLAIMER } from '../../scripts/lib/copy.mjs';

const EXAMPLES = fileURLToPath(new URL('../manifest-examples', import.meta.url));

// A complete §4.1 manifest; overrides let each test isolate one concern.
function fullManifest(overrides = {}) {
  return {
    slug: '2026-09-14-sample',
    type: 'case',
    title: 'Sample',
    date: '2026-09-14',
    domain: 'engineering',
    tags: ['sample'],
    stakes: 'low',
    content_flags: ['opinion'],
    trust_level: 'self-tested',
    generated_by: 'hybrid',
    human_review: 'attested',
    license: 'CC-BY-4.0',
    summary: 'A sample dump for tests.',
    sources: ['chat-log', 'source-code'],
    layers: [{ name: 'raw', file: 'raw.md', fact_checked: false, author_voice: true }],
    artifacts: [{ kind: 'file', path_or_url: 'raw.md', note: 'body' }],
    derived_from: null,
    ...overrides,
  };
}

const MANDATORY = [
  'slug', 'type', 'title', 'date', 'domain', 'tags', 'stakes', 'content_flags',
  'trust_level', 'generated_by', 'human_review', 'license', 'summary',
];

const ENUMS = {
  type: ['note', 'case', 'pack'],
  domain: ['engineering', 'finance', 'art', 'law', 'science', 'education', 'other'],
  stakes: ['low', 'medium', 'high'],
  trust_level: ['raw', 'self-tested', 'community-tested', 'adapted', 'library'],
  generated_by: ['human', 'agent', 'hybrid'],
  human_review: ['none', 'minimal', 'attested'],
};

async function writeDir(root, slug, files) {
  const dir = join(root, slug);
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
}

describe('manifest generation and defaults (§4.1)', () => {
  let root;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it('KDV-MANIFEST-01: the emitted manifest carries every §4.1 mandatory field and an ISO, non-future date', () => {
    const emitted = injectBuildMeta(fullManifest(), { commitSha: 'abc', builtAt: '2026-09-14T00:00:00.000Z' });
    for (const field of MANDATORY) {
      expect(field in emitted, `missing ${field}`).toBe(true);
    }
    expect(emitted.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(emitted.date <= new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it('KDV-MANIFEST-02: the emitted manifest keeps only §4.1 enum values', () => {
    const emitted = injectBuildMeta(fullManifest(), { commitSha: 'abc', builtAt: 't' });
    for (const [field, allowed] of Object.entries(ENUMS)) {
      expect(allowed, `${field}=${emitted[field]}`).toContain(emitted[field]);
    }
  });

  it('KDV-MANIFEST-03: the emitted manifest carries lowercase tags', () => {
    const emitted = injectBuildMeta(fullManifest({ tags: ['agents', 'static-site'] }), { commitSha: 'abc', builtAt: 't' });
    expect(Array.isArray(emitted.tags)).toBe(true);
    expect(emitted.tags.every((tag) => tag === tag.toLowerCase())).toBe(true);
  });

  it('KDV-MANIFEST-04: the emitted manifest draws content_flags from the §2.4 vocabulary', () => {
    const emitted = injectBuildMeta(fullManifest({ content_flags: ['contains_code', 'opinion'] }), { commitSha: 'abc', builtAt: 't' });
    expect(emitted.content_flags.every((flag) => CONTENT_FLAGS_VOCABULARY.includes(flag))).toBe(true);
  });

  it('KDV-MANIFEST-05: a stakes=high dump yields the §7.9 disclaimer in the rendered body', () => {
    const manifest = fullManifest({ stakes: 'high', content_flags: ['financial_advice'] });
    const dataset = toDataset({ slug: manifest.slug, manifest, raw: '# Body\n\ntext\n' });
    expect(dataset.body_html).toContain(HIGH_STAKES_DISCLAIMER);
    expect(dataset.body_html.indexOf(HIGH_STAKES_DISCLAIMER)).toBeLessThan(dataset.body_html.indexOf('<h1>Body</h1>'));

    const low = toDataset({ slug: 's', manifest: fullManifest(), raw: '# Body\n' });
    expect(low.body_html).not.toContain(HIGH_STAKES_DISCLAIMER);
  });

  it('KDV-MANIFEST-06: license defaults to CC-BY-4.0 and an explicit author licence is never dropped', () => {
    const without = fullManifest();
    delete without.license;
    expect(injectBuildMeta(without, { commitSha: 'abc', builtAt: 't' }).license).toBe(DEFAULT_LICENSE);
    expect(injectBuildMeta(fullManifest({ license: 'MIT' }), { commitSha: 'abc', builtAt: 't' }).license).toBe('MIT');
  });

  it('KDV-MANIFEST-08: sources/derived_from/consumption_contract are emitted with §4.1 defaults', () => {
    const without = fullManifest();
    delete without.derived_from;
    delete without.consumption_contract;
    const emitted = injectBuildMeta(without, { commitSha: 'abc', builtAt: 't' });
    expect(emitted.sources).toEqual(['chat-log', 'source-code']);
    expect(emitted.derived_from).toBeNull();
    expect(emitted.consumption_contract).toEqual({ see: CONSUMPTION_CONTRACT_SEE });

    const derived = injectBuildMeta(fullManifest({ derived_from: '2026-09-01-parent' }), { commitSha: 'abc', builtAt: 't' });
    expect(derived.derived_from).toBe('2026-09-01-parent');
  });

  it('KDV-MANIFEST-09: layers always list raw and only add refined/summary that exist on disk', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-manifest-'));
    await writeDir(root, '2026-09-14-raw-only', {
      'manifest.json': JSON.stringify(fullManifest({ slug: '2026-09-14-raw-only' })),
      'raw.md': '# Raw\n',
    });
    await writeDir(root, '2026-09-14-layered', {
      'manifest.json': JSON.stringify(fullManifest({ slug: '2026-09-14-layered' })),
      'raw.md': '# Raw\n',
      'refined.md': '# Refined\n',
      'summary.md': '# Summary\n',
    });

    const dumps = await readDumps(root);
    const rawOnly = dumps.find((d) => d.slug === '2026-09-14-raw-only');
    const layered = dumps.find((d) => d.slug === '2026-09-14-layered');

    expect(rawOnly.layers.map((l) => l.name)).toEqual(['raw']);
    expect(layered.layers.map((l) => l.name)).toEqual(['raw', 'refined', 'summary']);
    for (const layer of layered.layers) {
      expect(layer).toMatchObject({ file: `${layer.name}.md`, fact_checked: false });
      expect(typeof layer.author_voice).toBe('boolean');
    }
    expect(layered.layers.find((l) => l.name === 'raw').author_voice).toBe(true);

    const emitted = injectBuildMeta(layered.manifest, {
      commitSha: 'abc',
      builtAt: 't',
      layers: layered.layers,
    });
    expect(emitted.layers.map((l) => l.name)).toEqual(['raw', 'refined', 'summary']);
    expect(emitted.artifacts).toEqual([{ kind: 'file', path_or_url: 'raw.md', note: 'body' }]);
  });

  it('KDV-MANIFEST-10: injects commit_sha/built_at and author.* from CI metadata without overwriting', () => {
    const event = {
      pull_request: {
        user: { login: 'octocat' },
        html_url: 'https://github.com/owner/kodavr/pull/7',
        merged_at: '2026-09-14T10:00:00Z',
      },
    };
    expect(resolveAuthorMeta({ env: { GITHUB_ACTOR: 'fallback' }, event })).toEqual({
      github: 'octocat',
      pr_url: 'https://github.com/owner/kodavr/pull/7',
      merged_at: '2026-09-14T10:00:00Z',
    });
    // No PR payload: the actor is a documented fallback for `github`, the rest is null.
    expect(resolveAuthorMeta({ env: { GITHUB_ACTOR: 'fallback' } })).toEqual({
      github: 'fallback',
      pr_url: null,
      merged_at: null,
    });
    expect(resolveAuthorMeta({})).toEqual({ github: null, pr_url: null, merged_at: null });

    const author = resolveAuthorMeta({ event });
    const emitted = injectBuildMeta(fullManifest({ author: { github: 'already' } }), {
      commitSha: 'abc',
      builtAt: '2026-09-14T10:00:00.000Z',
      author,
    });
    expect(emitted.commit_sha).toBe('abc');
    expect(emitted.built_at).toBe('2026-09-14T10:00:00.000Z');
    // An existing field is never overwritten; the missing ones are filled in.
    expect(emitted.author).toEqual({
      github: 'already',
      pr_url: 'https://github.com/owner/kodavr/pull/7',
      merged_at: '2026-09-14T10:00:00Z',
    });

    // Without PR context the author block is absent, not fabricated.
    expect('author' in injectBuildMeta(fullManifest(), { commitSha: 'abc', builtAt: 't' })).toBe(false);
    expect(
      'author' in
        injectBuildMeta(fullManifest(), {
          commitSha: 'abc',
          builtAt: 't',
          author: { github: null, pr_url: null, merged_at: null },
        }),
    ).toBe(false);
  });

  it('KDV-MANIFEST-11: the §4.2 and §4.3 example manifests validate against the schema', async () => {
    for (const file of ['manifest-4.2.json', 'manifest-4.3.json']) {
      const manifest = JSON.parse(await readFile(join(EXAMPLES, file), 'utf8'));
      const errors = [];
      validateManifest(manifest, file, errors);
      expect(errors, file).toEqual([]);
    }
  });
});

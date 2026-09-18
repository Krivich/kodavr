import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';
import { ISSUES_URL, REPOSITORY } from '../../scripts/lib/machine.mjs';

const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));

describe('dumps controller', () => {
  it('KDV-BUILD-07: readDumps reads manifest and raw body for each dump directory', async () => {
    const dumps = await readDumps(FIXTURES);
    expect(dumps).toHaveLength(2);

    const dump = dumps.find((d) => d.slug === 'sample-dump');
    expect(dump).toBeDefined();
    expect(dump.manifest.title).toBe('Sample Dump');
    expect(dump.raw).toContain('Sample Heading');

    const second = dumps.find((d) => d.slug === 'sample-dump-two');
    expect(second).toBeDefined();
    expect(second.manifest.title).toBe('Sample Dump Two');
    expect(second.raw).toContain('Second Sample Heading');
  });

  it('KDV-BUILD-07 + KDV-BUILD-01: toDataset shapes a dump and renders its markdown body', async () => {
    const dumps = await readDumps(FIXTURES);
    const dump = dumps.find((d) => d.slug === 'sample-dump');
    const dataset = toDataset(dump, { baseUrl: 'https://example.test' });
    expect(dataset).toMatchObject({
      slug: 'sample-dump',
      title: 'Sample Dump',
      type: 'case',
      domain: 'engineering',
      date: '2026-09-14',
      stakes: 'low',
      trust_level: 'self-tested',
      content_flags: ['opinion'],
      summary: 'A fixture dump for tests.',
      manifest_url: 'https://example.test/dumps/sample-dump/manifest.json',
      body_url: 'https://example.test/dumps/sample-dump/raw.md',
      index_url: 'https://example.test/index.json',
    });
    // §7.11: the dump page prompt is a bare boot address to the manifest, whose
    // embedded schema describes the `raw` layer to download.
    expect(dataset.copy.prompt).toBe(
      'Download https://example.test/dumps/sample-dump/manifest.json and follow its schema.',
    );
    expect(dataset.body_html).toContain('<h1>Sample Heading</h1>');
    expect(dataset.body_html).toContain('<strong>bold</strong>');
    expect(dataset.body_html).not.toContain('<pre class="raw">');
  });

  it('KDV-STRUCT-02: the optional summary.md brief is read and rendered to brief_html; absent -> falsy', async () => {
    const dumps = await readDumps(FIXTURES);
    const withBrief = dumps.find((d) => d.slug === 'sample-dump');
    const withoutBrief = dumps.find((d) => d.slug === 'sample-dump-two');

    // The optional layer is on disk: its markdown is read, listed in `layers`
    // and rendered to HTML through the shared sanitized markdown pipeline.
    expect(withBrief.summary).toContain('Sample Dump brief');
    expect(withBrief.layers.map((l) => l.name)).toEqual(['raw', 'summary']);
    const rendered = toDataset(withBrief).brief_html;
    // §6.3/KDV-SURFACE-10: the brief's own `#` heading is demoted below the
    // reception block's own <h2>/<h3>, so an author can never break the outline.
    expect(rendered).toContain('<h4>Sample Dump brief</h4>');
    expect(rendered).not.toMatch(/<h[1-3]\b/);
    expect(rendered).toContain('<strong>brief</strong>');

    // The demotion rule across the heading levels: h1->h4, h2->h5, h3->h6;
    // h4..h6 are already safe under the reception block and stay unchanged.
    const demoted = toDataset({
      ...withBrief,
      summary: '# one\n\n## two\n\n### three\n\n#### four\n',
    }).brief_html;
    expect(demoted).toContain('<h4>one</h4>');
    expect(demoted).toContain('<h5>two</h5>');
    expect(demoted).toContain('<h6>three</h6>');
    expect(demoted).toContain('<h4>four</h4>');

    // No layer on disk: the dataset value is falsy, never invented.
    expect(withoutBrief.summary).toBeNull();
    expect(withoutBrief.layers.map((l) => l.name)).toEqual(['raw']);
    expect(toDataset(withoutBrief).brief_html).toBeFalsy();
  });

  it('KDV-BUILD-02 + KDV-BUILD-09: sanitized body cannot inject executable markup', async () => {
    const dumps = await readDumps(FIXTURES);
    const dump = dumps.find((d) => d.slug === 'sample-dump');
    const { body_html } = toDataset(dump);
    expect(body_html).not.toContain('<script');
    expect(body_html).not.toContain('onerror');
    expect(body_html).not.toContain('javascript:');
    expect(body_html).not.toMatch(/\son\w+=/i);
  });

  it('KDV-SURFACE-10: toDataset flags a body that opens with its own H1', async () => {
    const dumps = await readDumps(FIXTURES);
    const dump = dumps.find((d) => d.slug === 'sample-dump');
    expect(toDataset(dump).body_has_title).toBe(true);

    expect(toDataset({ ...dump, raw: 'Body without a heading.\n' }).body_has_title).toBe(false);
    expect(toDataset({ ...dump, raw: '\n\n# Spaced Title\n\nbody' }).body_has_title).toBe(true);
  });

  it('KDV-MOD-02: a withdrawn dump renders the stub (with the reason) instead of the body', async () => {
    const dumps = await readDumps(FIXTURES);
    const dump = dumps.find((d) => d.slug === 'sample-dump');
    const dataset = toDataset(
      { ...dump, manifest: { ...dump.manifest, status: 'withdrawn', withdrawal_reason: 'Stakes were underestimated.' } },
      { baseUrl: 'https://example.test' },
    );
    expect(dataset.withdrawn).toBe(true);
    expect(dataset.body_html).toContain('<h1>This dump has been withdrawn.</h1>');
    expect(dataset.body_html).toContain('Reason: Stakes were underestimated.');
    expect(dataset.body_html).not.toContain('Sample Heading');
    expect(dataset.body_has_title).toBe(true);
  });

  it('KDV-MOD-01: the dump dataset links to the repository GitHub Issues', async () => {
    const dumps = await readDumps(FIXTURES);
    const dataset = toDataset(dumps[0], { baseUrl: 'https://example.test' });
    expect(dataset.issues_url).toBe(ISSUES_URL);
    expect(dataset.issues_url).toBe('https://github.com/krivich/kodavr/issues');
    expect(dataset.copy.discuss_label).toBe('Issues / discuss');
  });

  it('KDV-SURFACE-09: artifact links resolve to a repo blob, a dump-local file, an external URL or the raw fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kodavr-artifacts-'));
    try {
      const dumpDir = join(root, 'content', 'dumps', 'sample-dump');
      await mkdir(join(root, 'docs'), { recursive: true });
      await mkdir(dumpDir, { recursive: true });
      await writeFile(join(root, 'docs', 'SPEC.md'), '# spec');
      await writeFile(join(dumpDir, 'manifest.schema.json'), '{}');

      const dump = {
        slug: 'sample-dump',
        dir: dumpDir,
        raw: '# Body\n',
        manifest: {
          slug: 'sample-dump',
          title: 'Sample Dump',
          type: 'case',
          domain: 'engineering',
          date: '2026-09-14',
          stakes: 'low',
          trust_level: 'raw',
          content_flags: [],
          summary: 'Fixture.',
          artifacts: [
            { kind: 'file', path_or_url: 'docs/SPEC.md' },
            { kind: 'file', path_or_url: 'manifest.schema.json' },
            { kind: 'url', path_or_url: 'https://example.test/doc' },
            { kind: 'file', path_or_url: 'missing.txt' },
          ],
        },
      };

      const { artifacts } = toDataset(dump, { repoRoot: root, repoUrl: REPOSITORY });
      expect(artifacts.map((a) => a.href)).toEqual([
        `${REPOSITORY}/blob/main/docs/SPEC.md`,
        `${REPOSITORY}/blob/main/content/dumps/sample-dump/manifest.schema.json`,
        'https://example.test/doc',
        'missing.txt',
      ]);
      // `path_or_url` is left untouched — CI resolves it against the repo.
      expect(artifacts.map((a) => a.path_or_url)).toEqual([
        'docs/SPEC.md',
        'manifest.schema.json',
        'https://example.test/doc',
        'missing.txt',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('KDV-BUILD-07: readDumps fails visibly when a manifest is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kodavr-dumps-'));
    try {
      await mkdir(join(root, 'broken'), { recursive: true });
      await writeFile(join(root, 'broken', 'raw.md'), 'body');
      await expect(readDumps(root)).rejects.toThrow(/manifest/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

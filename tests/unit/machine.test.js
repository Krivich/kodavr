import { describe, it, expect } from 'vitest';
import { XMLValidator } from 'fast-xml-parser';
import { ROBOTS_TXT, HUMANS_TXT } from '../../scripts/lib/verbatim.mjs';
import {
  buildIndexEntry,
  buildIndex,
  buildTagGraph,
  buildWellKnown,
  buildAtom,
  injectBuildMeta,
  resolveRepository,
  REPOSITORY,
  ISSUES_URL,
} from '../../scripts/lib/machine.mjs';

const BASE_URL = 'https://kodavr.xyz';

const DUMPS = [
  {
    slug: 'sample-dump',
    manifest: {
      slug: 'sample-dump',
      title: 'Sample Dump',
      type: 'case',
      domain: 'engineering',
      date: '2026-09-14',
      stakes: 'low',
      trust_level: 'self-tested',
      content_flags: ['opinion'],
      generated_by: 'hybrid',
      human_review: 'attested',
      summary: 'A fixture dump for tests.',
      artifacts: [{ kind: 'file', path_or_url: 'a.md' }],
      derived_from: null,
    },
  },
  {
    slug: 'sample-dump-two',
    manifest: {
      slug: 'sample-dump-two',
      title: 'Sample Dump Two',
      type: 'pack',
      domain: 'finance',
      date: '2026-09-20',
      stakes: 'medium',
      trust_level: 'raw',
      content_flags: ['professional_advice'],
      generated_by: 'human',
      human_review: 'minimal',
      summary: 'A second fixture.',
      artifacts: [],
      derived_from: 'sample-dump',
    },
  },
];

// Three dumps across three tags so co-occurrence weights are non-trivial:
// alpha+beta (one, three), beta+gamma (two, three), alpha+gamma (three).
const TAGGED_DUMPS = [
  { slug: 'graph-one', manifest: { slug: 'graph-one', tags: ['alpha', 'beta'] } },
  { slug: 'graph-two', manifest: { slug: 'graph-two', tags: ['beta', 'gamma'] } },
  { slug: 'graph-three', manifest: { slug: 'graph-three', tags: ['alpha', 'beta', 'gamma'] } },
];

// Independent copies of the §5.4/§5.5 spec text, kept out of the implementation.
const SPEC_ROBOTS = [
  '# Agents, you are home here.',
  '# Index: /index.json',
  '# Protocol: /.well-known/kodavr.json',
  'User-agent: *',
  'Allow: /',
  'Sitemap: https://kodavr.xyz/sitemap.xml',
  '',
].join('\n');

const SPEC_HUMANS = [
  '/* HUMANS */',
  'Direct access to content is closed not out of malice, but out of care:',
  'it is not adapted for human perception.',
  'Your route: reception → prompt → your agent → digest.',
  'Pressing 0 is not a hack, it is perjury: machine duties',
  'will reach you in full.',
  'View-source does not count as hacking. It counts as reading',
  'the contract before signing. Signed.',
  'Age labelling for humans is intentionally absent:',
  'your agent performs it. No agent — there is button "1"',
  'and the 18+ category.',
  '',
].join('\n');

describe('verbatim platform texts', () => {
  it('KDV-CONTRACT-07: robots.txt matches §5.4 byte-for-byte', () => {
    expect(ROBOTS_TXT).toBe(SPEC_ROBOTS);
  });

  it('KDV-CONTRACT-07: humans.txt matches §5.5 byte-for-byte', () => {
    expect(HUMANS_TXT).toBe(SPEC_HUMANS);
  });
});

describe('index.json builder', () => {
  it('KDV-CONTRACT-01 + KDV-CONTRACT-03: buildIndexEntry carries the §5.1 fields and stable URLs', () => {
    const entry = buildIndexEntry(DUMPS[0], { baseUrl: BASE_URL });
    expect(entry).toEqual({
      slug: 'sample-dump',
      url: 'https://kodavr.xyz/dumps/sample-dump/',
      manifest_url: 'https://kodavr.xyz/dumps/sample-dump/manifest.json',
      title: 'Sample Dump',
      type: 'case',
      domain: 'engineering',
      tags: [],
      stakes: 'low',
      content_flags: ['opinion'],
      trust_level: 'self-tested',
      date: '2026-09-14',
      generated_by: 'hybrid',
      human_review: 'attested',
      summary: 'A fixture dump for tests.',
      artifacts_count: 1,
      derived_from: null,
    });
  });

  it('KDV-CONTRACT-01: buildIndex carries platform metadata and the per-dump entries', () => {
    const index = buildIndex(DUMPS, { baseUrl: BASE_URL, generatedAt: '2026-09-14T00:00:00.000Z' });
    expect(index).toMatchObject({
      platform: 'kodavr',
      version: '1.0',
      generated_at: '2026-09-14T00:00:00.000Z',
      base_url: BASE_URL,
      total: 2,
    });
    expect(index.dumps).toHaveLength(2);
    expect(index.dumps[0]).toMatchObject({ slug: 'sample-dump-two' });
  });

  it('KDV-CONTRACT-02: buildIndex sorts dumps by date descending', () => {
    const index = buildIndex(DUMPS, { baseUrl: BASE_URL, generatedAt: '2026-09-14T00:00:00.000Z' });
    expect(index.dumps.map((d) => d.date)).toEqual(['2026-09-20', '2026-09-14']);
  });

  it('KDV-CONTRACT-08 + KDV-MOD-02: a withdrawn dump keeps its URLs and carries its status into index.json', () => {
    const withdrawn = {
      slug: '2026-09-01-withdrawn',
      manifest: {
        ...DUMPS[0].manifest,
        slug: '2026-09-01-withdrawn',
        date: '2026-09-01',
        status: 'withdrawn',
        withdrawal_reason: 'Stakes were underestimated.',
      },
    };
    const entry = buildIndexEntry(withdrawn, { baseUrl: BASE_URL });
    // §5.6: URLs are immutable for life — the same path, never a tombstone.
    expect(entry.url).toBe('https://kodavr.xyz/dumps/2026-09-01-withdrawn/');
    expect(entry.manifest_url).toBe('https://kodavr.xyz/dumps/2026-09-01-withdrawn/manifest.json');
    expect(entry.status).toBe('withdrawn');

    const index = buildIndex([...DUMPS, withdrawn], {
      baseUrl: BASE_URL,
      generatedAt: '2026-09-14T00:00:00.000Z',
    });
    expect(index.dumps.find((d) => d.slug === '2026-09-01-withdrawn').status).toBe('withdrawn');
    // A published dump is not annotated: §5.1 defines no `status` field.
    expect(index.dumps.find((d) => d.slug === 'sample-dump').status).toBeUndefined();
  });
});

describe('tag graph builder', () => {
  it('KDV-CONTRACT-09: buildTagGraph counts tags, lists dumps and weights co-occurrence deterministically', () => {
    const graph = buildTagGraph(TAGGED_DUMPS, { baseUrl: BASE_URL, generatedAt: '2026-09-14T00:00:00.000Z' });
    expect(graph).toMatchObject({
      generated_at: '2026-09-14T00:00:00.000Z',
      base_url: BASE_URL,
      total_tags: 3,
      total_dumps: 3,
    });
    // Tags ordered by count desc, then name asc: beta(3), alpha(2), gamma(2).
    expect(graph.tags.map((t) => t.tag)).toEqual(['beta', 'alpha', 'gamma']);
    const byTag = Object.fromEntries(graph.tags.map((t) => [t.tag, t]));
    expect(byTag.beta).toMatchObject({ count: 3, dumps: ['graph-one', 'graph-three', 'graph-two'] });
    expect(byTag.beta.related).toEqual([
      { tag: 'alpha', weight: 2 },
      { tag: 'gamma', weight: 2 },
    ]);
    expect(byTag.alpha).toMatchObject({ count: 2, dumps: ['graph-one', 'graph-three'] });
    expect(byTag.alpha.related).toEqual([
      { tag: 'beta', weight: 2 },
      { tag: 'gamma', weight: 1 },
    ]);
    expect(byTag.gamma.related).toEqual([
      { tag: 'beta', weight: 2 },
      { tag: 'alpha', weight: 1 },
    ]);
  });

  it('KDV-CONTRACT-09: buildTagGraph is deterministic for identical input', () => {
    const a = buildTagGraph(TAGGED_DUMPS, { baseUrl: BASE_URL, generatedAt: 'T' });
    const b = buildTagGraph(TAGGED_DUMPS, { baseUrl: BASE_URL, generatedAt: 'T' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('KDV-CONTRACT-09: an empty collection yields empty tags and zero totals', () => {
    const graph = buildTagGraph([], { baseUrl: BASE_URL, generatedAt: 'T' });
    expect(graph).toMatchObject({ total_tags: 0, total_dumps: 0, tags: [] });
  });
});

describe('moderation discovery', () => {
  it('KDV-MOD-01: the repository constant is the single source for Issues and discovery', () => {
    expect(REPOSITORY).toBe('https://github.com/krivich/kodavr');
    expect(ISSUES_URL).toBe('https://github.com/krivich/kodavr/issues');
    expect(buildWellKnown().submission.repository).toBe(REPOSITORY);
  });

  it('KDV-SURFACE-09: the repository URL is overridable via KODAVR_REPOSITORY and defaults to the canonical constant', () => {
    expect(resolveRepository({})).toBe(REPOSITORY);
    expect(resolveRepository({ KODAVR_REPOSITORY: '' })).toBe(REPOSITORY);
    expect(resolveRepository({ KODAVR_REPOSITORY: 'https://github.com/fork/kodavr/' })).toBe(
      'https://github.com/fork/kodavr',
    );
  });
});

describe('well-known discovery document', () => {
  it('KDV-CONTRACT-05: buildWellKnown reproduces the §5.2 object', () => {
    const wk = buildWellKnown();
    expect(wk.platform).toBe('kodavr');
    expect(wk.version).toBe('1.0');
    expect(wk.description).toContain('machine-readable contracts');
    expect(wk.endpoints).toEqual({
      index: '/index.json',
      manifest_pattern: '/dumps/{slug}/manifest.json',
      dump_pattern: '/dumps/{slug}/',
      feeds: ['/feeds/all.atom', '/feeds/{domain}.atom'],
      sitemap: '/sitemap.xml',
      tags: '/tags.json',
    });
    expect(wk.submission).toEqual({
      method: 'pull-request',
      repository: 'https://github.com/krivich/kodavr',
      rules: '/CONTRIBUTING.md',
    });
    expect(wk.consumption_contract.agent_duties).toEqual([
      'filter_for_user',
      'adapt_to_user_context',
      'attribute_source',
      'honor_stakes_and_flags',
    ]);
    expect(wk.trust_levels).toEqual(['raw', 'self-tested', 'community-tested', 'adapted', 'library']);
    expect(wk.stakes_vocabulary).toEqual(['low', 'medium', 'high']);
    expect(wk.content_flags_vocabulary).toContain('requires_expert_review');
  });
});

describe('Atom feed builder', () => {
  it('KDV-CONTRACT-06: buildAtom produces valid XML whose entries link to manifests', () => {
    const xml = buildAtom(DUMPS, {
      baseUrl: BASE_URL,
      generatedAt: '2026-09-14T00:00:00.000Z',
    });
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('<feed');
    expect(xml).toContain('https://kodavr.xyz/dumps/sample-dump/manifest.json');
    expect(xml).toContain('https://kodavr.xyz/dumps/sample-dump-two/manifest.json');
    expect(xml).not.toMatch(/href="[^"]*\.html"/);
  });

  it('KDV-CONTRACT-06: buildAtom filters by domain for a per-domain feed', () => {
    const xml = buildAtom(DUMPS, {
      baseUrl: BASE_URL,
      generatedAt: '2026-09-14T00:00:00.000Z',
      domain: 'finance',
    });
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('sample-dump-two');
    expect(xml).not.toContain('dumps/sample-dump/manifest.json');
  });

  it('KDV-CONTRACT-06: buildAtom XML-escapes text and attributes', () => {
    const tricky = [
      {
        slug: 'tricky',
        manifest: {
          slug: 'tricky',
          title: 'A & B <script>',
          type: 'note',
          domain: 'other',
          date: '2026-01-01',
          stakes: 'low',
          trust_level: 'raw',
          content_flags: [],
          summary: 'Quotes " and apostrophe \' and & amp',
          artifacts: [],
        },
      },
    ];
    const xml = buildAtom(tricky, { baseUrl: BASE_URL, generatedAt: '2026-01-01T00:00:00.000Z' });
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('A &amp; B &lt;script&gt;');
    expect(xml).not.toContain('<script>');
  });
});

describe('build metadata injection', () => {
  it('KDV-CONTRACT-04 + KDV-BUILD-10: injectBuildMeta adds commit_sha and built_at without dropping fields', () => {
    const manifest = DUMPS[0].manifest;
    const result = injectBuildMeta(manifest, { commitSha: 'abc123', builtAt: '2026-09-14T10:00:00.000Z' });
    expect(result).toMatchObject({
      commit_sha: 'abc123',
      built_at: '2026-09-14T10:00:00.000Z',
      slug: 'sample-dump',
      title: 'Sample Dump',
    });
    expect(manifest.commit_sha).toBeUndefined();
  });

  it('KDV-BUILD-10: injectBuildMeta tolerates a null commit_sha', () => {
    const result = injectBuildMeta(DUMPS[0].manifest, { commitSha: null, builtAt: '2026-09-14T10:00:00.000Z' });
    expect(result.commit_sha).toBeNull();
    expect(result.built_at).toBe('2026-09-14T10:00:00.000Z');
  });
});

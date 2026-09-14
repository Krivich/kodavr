import { describe, it, expect, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { validateContent } from '../../scripts/validate.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WORKFLOW = join(ROOT, '.github', 'workflows', 'validate.yml');

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
  await writeFile(join(dir, 'raw.md'), raw);
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
function hasWarning(res, needle) {
  return res.warnings.some((w) => w.includes(needle));
}

describe('content validator', () => {
  let root;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it('KDV-CI-01: validate.yml runs on PR and push to main over the watched paths and runs validator + tests', async () => {
    const yml = await readFile(WORKFLOW, 'utf8');
    expect(yml).toMatch(/^on:/m);
    expect(yml).toMatch(/pull_request:/);
    expect(yml).toMatch(/push:/);
    expect(yml).toMatch(/branches:\s*\[\s*main\s*\]/);
    for (const p of ['content/**', 'scripts/**', 'input/**', '.github/**']) {
      expect(yml, `path ${p}`).toContain(p);
    }
    expect(yml).toMatch(/actions\/checkout@/);
    expect(yml).toMatch(/actions\/setup-node@/);
    expect(yml).toContain('npm ci');
    expect(yml).toContain('node scripts/validate.mjs');
    expect(yml).toContain('npm test');
  });

  it('KDV-CI-02: a schema-valid dump with an explicit licence is error-free', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-sample');
    const res = await validateContent({ root });
    expect(res.errors).toEqual([]);
  });

  it('KDV-CI-02: a missing or unparsable manifest is a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    // Only raw.md, no manifest.json.
    const dir = join(root, 'content', 'dumps', '2026-01-05-nomanifest');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'raw.md'), '# No manifest\n');
    await writeDump(root, '2026-01-05-badjson', {}, { manifest: '{ not json' });
    const res = await validateContent({ root });
    expect(hasError(res, '2026-01-05-nomanifest')).toBe(true);
    expect(hasError(res, 'manifest.json')).toBe(true);
    expect(hasError(res, '2026-01-05-badjson')).toBe(true);
  });

  it('KDV-CI-02: missing required fields and invalid enums are a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-badenum', {}, {
      manifest: manifest('2026-01-05-badenum', { type: 'blog', stakes: 'critical' }),
    });
    const bad = manifest('2026-01-05-missing', {});
    delete bad.tags;
    delete bad.generated_by;
    delete bad.human_review;
    await writeDump(root, '2026-01-05-missing', {}, { manifest: bad });
    const res = await validateContent({ root });
    expect(hasError(res, 'type')).toBe(true);
    expect(hasError(res, 'stakes')).toBe(true);
    expect(hasError(res, 'tags')).toBe(true);
    expect(hasError(res, 'generated_by')).toBe(true);
    expect(hasError(res, 'human_review')).toBe(true);
  });

  it('KDV-CI-02: type=pack requires SETUP_AGENT.md, START_HERE.md, files/ and checks/', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-pack', {}, {
      manifest: manifest('2026-01-05-pack', { type: 'pack' }),
    });
    const res = await validateContent({ root });
    for (const needle of ['SETUP_AGENT.md', 'START_HERE.md', 'files/', 'checks/']) {
      expect(hasError(res, needle), needle).toBe(true);
    }
  });

  it('KDV-CI-02: chat-log sources require REDACTIONS.md and stakes=high requires content_flags', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-chatlog', {}, {
      manifest: manifest('2026-01-05-chatlog', { sources: ['chat-log'] }),
    });
    await writeDump(root, '2026-01-05-high', {}, {
      manifest: manifest('2026-01-05-high', { stakes: 'high', content_flags: [] }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'REDACTIONS.md')).toBe(true);
    expect(hasError(res, '2026-01-05-high')).toBe(true);
    expect(hasError(res, 'content_flags')).toBe(true);
  });

  it('KDV-CI-02: a licence must come from the manifest or a root LICENSE file', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    const noLicense = manifest('2026-01-05-nolicense', {});
    delete noLicense.license;
    await writeDump(root, '2026-01-05-nolicense', {}, { manifest: noLicense });
    let res = await validateContent({ root });
    expect(hasError(res, 'licen')).toBe(true);

    await writeFile(join(root, 'LICENSE-CONTENT.md'), 'CC-BY-4.0');
    res = await validateContent({ root });
    expect(res.errors).toEqual([]);
  });

  it('KDV-CI-03: slug must be unique, date-shaped, equal the directory and the manifest field', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, 'sample-dump', {}, { manifest: manifest('sample-dump') }); // no date prefix
    await writeDump(root, '2026-01-05-mismatch', {}, { manifest: manifest('2026-01-05-other') });
    await writeDump(root, '2026-01-05-dup', {}, { manifest: manifest('2026-01-05-dup') });
    await writeDump(root, '2026-01-05-dup-two', {}, { manifest: manifest('2026-01-05-dup') });
    const res = await validateContent({ root });
    expect(hasError(res, 'slug')).toBe(true);
    expect(hasError(res, 'mismatch')).toBe(true);
    expect(hasError(res, 'duplicate')).toBe(true);
  });

  it('KDV-CI-03: date must be ISO and not in the future', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-baddate', {}, {
      manifest: manifest('2026-01-05-baddate', { date: '05/01/2026' }),
    });
    await writeDump(root, '2026-01-05-future', {}, {
      manifest: manifest('2026-01-05-future', { date: '2999-01-01' }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, '2999-01-01')).toBe(true);
    expect(hasError(res, '2026-01-05-baddate')).toBe(true);
  });

  it('KDV-CI-04: secret scan blocks PEM keys, .env payloads, cloud tokens and long entropy strings', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-secrets', {
      'raw.md': [
        '# Secrets',
        '-----BEGIN RSA PRIVATE KEY-----',
        'MIIEowIBAAKCAQEA...',
        '-----END RSA PRIVATE KEY-----',
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
        'GITHUB_TOKEN=ghp_0123456789abcdefghijklmnopqrstuvwxyz',
        'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz0123456789',
        'token: aB3xK9mQ2pR7sT1vW4yZ6cD8fG0hJ5kL9nM2bV4xC6z',
        'digest: 3f7a9c2e51b8d4067af1c3e95b2d8064f7a1c9e2',
      ].join('\n'),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'PRIVATE KEY')).toBe(true);
    expect(hasError(res, '2026-01-05-secrets')).toBe(true);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('KDV-CI-04: ordinary prose and code identifiers are not flagged as secrets', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-clean', {
      'raw.md': [
        '# Clean',
        'if (inStr) {',
        '  lastLevel = "crit";',
        '  lastKnownContext = 0;',
        '}',
        'This is an exceptionally long ordinary English sentence without any tokens.',
      ].join('\n'),
    });
    const res = await validateContent({ root });
    expect(res.errors).toEqual([]);
  });

  it('KDV-CI-05: emails, phones and document numbers require a justification or REDACTIONS.md', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    const body = ['# Contact', 'Email alice@corp.example, phone +1 (555) 123-4567, SSN 123-45-6789.'].join('\n');
    await writeDump(root, '2026-01-05-pii', { 'raw.md': body });
    let res = await validateContent({ root });
    expect(res.errors.length).toBeGreaterThan(0);

    await writeDump(root, '2026-01-05-pii', { 'raw.md': body, 'REDACTIONS.md': '# Redactions\n' });
    res = await validateContent({ root });
    expect(res.errors).toEqual([]);
  });

  it('KDV-CI-06: broken internal links and artifact paths are a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-links', {
      'raw.md': '# Links\n\n[good](raw.md) and [bad](missing-doc.md)\n',
    }, {
      manifest: manifest('2026-01-05-links', {
        artifacts: [{ kind: 'file', path_or_url: 'static/logo.svg' }, { kind: 'file', path_or_url: 'nope.txt' }],
      }),
    });
    await mkdir(join(root, 'static'), { recursive: true });
    await writeFile(join(root, 'static', 'logo.svg'), '<svg/>');
    const res = await validateContent({ root });
    expect(hasError(res, 'missing-doc.md')).toBe(true);
    expect(hasError(res, 'nope.txt')).toBe(true);
    expect(res.errors.some((e) => e.includes('logo.svg'))).toBe(false);
  });

  it('KDV-CI-06: file size cap and binary placement are enforced', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-size', {
      'big.txt': 'x'.repeat(1024 * 1024 + 1),
      'screenshot.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
      'assets/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'big.txt')).toBe(true);
    expect(res.errors.some((e) => e.includes('screenshot.png'))).toBe(true);
    expect(res.errors.some((e) => e.includes('assets/logo.png'))).toBe(false);
  });

  it('KDV-CI-06: the dump total size cap of 20 MB is enforced', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    const files = {};
    for (let i = 0; i < 21; i += 1) files[`part-${i}.bin.txt`] = 'x'.repeat(1024 * 1024);
    await writeDump(root, '2026-01-05-huge', files);
    const res = await validateContent({ root });
    expect(hasError(res, 'dump')).toBe(true);
  });

  it('KDV-CI-07: duplicate H1 and broken in-page links are warnings, not errors', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-lint', {
      'raw.md': ['# First', '', '## Present', '', '# Second', '', '[go](#missing-anchor)'].join('\n'),
    });
    const res = await validateContent({ root });
    expect(res.errors).toEqual([]);
    expect(hasWarning(res, 'H1')).toBe(true);
    expect(hasWarning(res, 'missing-anchor')).toBe(true);
  });

  it('KDV-MANIFEST-01: missing §4.1 mandatory fields or a future date is a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    const missing = manifest('2026-01-05-missing2', {});
    delete missing.title;
    delete missing.summary;
    await writeDump(root, '2026-01-05-missing2', {}, { manifest: missing });
    await writeDump(root, '2026-01-05-future2', {}, {
      manifest: manifest('2026-01-05-future2', { date: '2999-01-01' }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'title')).toBe(true);
    expect(hasError(res, 'summary')).toBe(true);
    expect(hasError(res, '2999-01-01')).toBe(true);
  });

  it('KDV-MANIFEST-02: values outside the §4.1 enums are a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-enums', {}, {
      manifest: manifest('2026-01-05-enums', {
        type: 'blog',
        domain: 'cooking',
        stakes: 'critical',
        trust_level: 'trusted',
        generated_by: 'robot',
        human_review: 'yes',
      }),
    });
    const res = await validateContent({ root });
    for (const field of ['type', 'domain', 'stakes', 'trust_level', 'generated_by', 'human_review']) {
      expect(hasError(res, field), field).toBe(true);
    }
  });

  it('KDV-MANIFEST-03: tags that are not lowercase strings are a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-tags', {}, {
      manifest: manifest('2026-01-05-tags', { tags: ['MixedCase'] }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'tags')).toBe(true);
  });

  it('KDV-MANIFEST-04: content_flags outside the §2.4 vocabulary are a BLOCK, [] is allowed', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-flags', {}, {
      manifest: manifest('2026-01-05-flags', { content_flags: ['made_up_flag'] }),
    });
    await writeDump(root, '2026-01-05-noflags', {}, {
      manifest: manifest('2026-01-05-noflags', { content_flags: [] }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'content_flags')).toBe(true);
    expect(res.errors.some((e) => e.includes('2026-01-05-noflags'))).toBe(false);
  });

  it('KDV-MANIFEST-05: stakes=high with empty content_flags is a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-high2', {}, {
      manifest: manifest('2026-01-05-high2', { stakes: 'high', content_flags: [] }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'content_flags')).toBe(true);
  });

  it('KDV-MANIFEST-07: a summary outside 1–3 sentences is a BLOCK', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-long', {}, {
      manifest: manifest('2026-01-05-long', { summary: 'One. Two. Three. Four.' }),
    });
    await writeDump(root, '2026-01-05-short', {}, {
      manifest: manifest('2026-01-05-short', { summary: 'One. Two. Three.' }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, '2026-01-05-long')).toBe(true);
    expect(res.errors.some((e) => e.includes('2026-01-05-short'))).toBe(false);
  });

  it('KDV-MANIFEST-08: derived_from and consumption_contract.see are schema-checked', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-derived', {}, {
      manifest: manifest('2026-01-05-derived', { derived_from: 'Not A Slug' }),
    });
    await writeDump(root, '2026-01-05-contract', {}, {
      manifest: manifest('2026-01-05-contract', { consumption_contract: { see: '/wrong.json' } }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'derived_from')).toBe(true);
    expect(hasError(res, 'consumption_contract')).toBe(true);
  });

  it('KDV-MANIFEST-09: layers must include raw with the §4.1 fields, artifacts need kind+path_or_url', async () => {
    root = await mkdtemp(join(tmpdir(), 'kodavr-validate-'));
    await writeDump(root, '2026-01-05-badlayers', {}, {
      manifest: manifest('2026-01-05-badlayers', { layers: [{ name: 'refined', file: 'refined.md' }] }),
    });
    await writeDump(root, '2026-01-05-noraw', {}, {
      manifest: manifest('2026-01-05-noraw', {
        layers: [{ name: 'refined', file: 'refined.md', fact_checked: false, author_voice: false }],
      }),
    });
    await writeDump(root, '2026-01-05-badartifacts', {}, {
      manifest: manifest('2026-01-05-badartifacts', { artifacts: [{ path_or_url: 'raw.md' }] }),
    });
    const res = await validateContent({ root });
    expect(hasError(res, 'layers')).toBe(true);
    expect(hasError(res, 'raw')).toBe(true);
    expect(hasError(res, 'artifacts')).toBe(true);
  });

  it('KDV-CI-02..07: the real repository content validates with no BLOCK errors', async () => {
    const res = await validateContent({ root: ROOT });
    expect(res.errors).toEqual([]);
    expect(Array.isArray(res.warnings)).toBe(true);
  });
});

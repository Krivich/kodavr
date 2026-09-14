import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, cp, readFile, readdir, stat, rm, writeFile } from 'node:fs/promises';
import { XMLValidator } from 'fast-xml-parser';
import { buildProject } from '../../scripts/lib/build.mjs';
import { ROUTE_PAGES } from '../../scripts/lib/pages.mjs';
import { ROBOTS_TXT, HUMANS_TXT } from '../../scripts/lib/verbatim.mjs';
import {
  GATE_TEXT,
  GATE_TITLE,
  GATE_MACHINE_LABEL,
  GATE_HUMAN_LABEL,
  RECEPTION_TEXT,
  PROMPT_TEXT,
  FOOTER_TEXT,
  NOT_FOUND_TEXT,
  HIGH_STAKES_DISCLAIMER,
  AGENT_HOOK,
} from '../../scripts/lib/copy.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const BASE_URL = 'https://example.test';

// Handlebars escapes the copydeck prose (`'` → &#x27;, `<`/`>` → &lt;/&gt;);
// decoding the rendered source lets the tests compare against the raw §7 text.
function decodeEntities(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function setupProject(slugs, inlineDumps = [], { repoFiles = [] } = {}) {
  const tmpBase = join(ROOT, 'tmp');
  await mkdir(tmpBase, { recursive: true });
  const tmpRoot = await mkdtemp(join(tmpBase, 'build-'));

  for (const slug of slugs) {
    // Fixtures are the norm; a real content dump (e.g. the manifesto) is used
    // as-is so a regression test can pin its actual links.
    const fixture = join(FIXTURES, slug);
    const source = (await exists(fixture)) ? fixture : join(ROOT, 'content', 'dumps', slug);
    await cp(source, join(tmpRoot, 'content', 'dumps', slug), { recursive: true });
  }
  // Repo-only files a dump links (e.g. docs/SPEC.md) are mirrored from the real
  // checkout so the repo-fallback sees exactly what production sees.
  for (const file of repoFiles) {
    await cp(join(ROOT, file), join(tmpRoot, file), { recursive: true });
  }
  // Inline dumps (e.g. a withdrawn manifest) are written directly — the shared
  // fixture dirs stay exactly two so the load-bearing tests are not perturbed.
  for (const dump of inlineDumps) {
    const dir = join(tmpRoot, 'content', 'dumps', dump.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(dump.manifest, null, 2));
    await writeFile(join(dir, 'raw.md'), dump.raw);
  }
  // The build renders every human route, so the whole templates tree (layouts
  // + shared site/ partials), the controllers (they make dump/reception pages
  // live) and the static asset tree must be present.
  await cp(join(ROOT, 'input', 'templates'), join(tmpRoot, 'input', 'templates'), { recursive: true });
  await cp(join(ROOT, 'input', 'controllers'), join(tmpRoot, 'input', 'controllers'), { recursive: true });
  await cp(join(ROOT, 'static'), join(tmpRoot, 'static'), { recursive: true });

  await buildProject({
    root: tmpRoot,
    contentDir: 'content/dumps',
    sourceDir: 'input',
    outputDir: 'output',
    domain: BASE_URL,
    commitSha: 'deadbeef',
  });

  return tmpRoot;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// The `<url>` block of a sitemap for one `<loc>`, for per-URL assertions.
function urlBlock(sitemap, loc) {
  const at = sitemap.indexOf(`<loc>${loc}</loc>`);
  expect(at, `sitemap is missing ${loc}`).toBeGreaterThan(-1);
  const start = sitemap.lastIndexOf('<url>', at);
  const end = sitemap.indexOf('</url>', at);
  return sitemap.slice(start, end);
}

// Collect every published file (relative path) under the public root.
async function listFiles(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(join(dir, entry.name), rel)));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

describe('build controller (integration)', () => {
  let tmpRoot;

  afterEach(async () => {
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  it('KDV-BUILD-01 + KDV-BUILD-02 + KDV-BUILD-08: renders each dump as sanitized markdown HTML and publishes client assets', async () => {
    tmpRoot = await setupProject(['sample-dump']);

    const publicDir = join(tmpRoot, 'output', 'public');
    const prettyPath = join(publicDir, 'dumps', 'sample-dump', 'index.html');
    expect((await stat(prettyPath)).isFile()).toBe(true);
    expect(await exists(join(publicDir, 'dumps', 'sample-dump.html'))).toBe(false);

    const html = await readFile(prettyPath, 'utf8');
    expect(html).toContain('<title>Sample Dump · Kodavr</title>');
    // KDV-SURFACE-10: exactly one page H1 — the body's own title; the manifest
    // title is metadata (it stays in <title>, og-tags and the manifest card).
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('<h1>Sample Heading</h1>');
    expect(html).not.toMatch(/<h1[^>]*>Sample Dump<\/h1>/);
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('href="https://example.test/source"');
    expect(html).toContain('rel="noopener noreferrer"');

    // The page now carries engine <script> tags, so the sanitization check is
    // precise: the body's injected markup (`<script>alert(1)</script>`,
    // `onerror`, `javascript:`) must not survive into the rendered document.
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');

    // The client runtime required for the gate (P2b) must be published.
    expect(await exists(join(publicDir, 'assets', 'handlebars.min.js'))).toBe(true);
    expect(await exists(join(publicDir, 'assets', 'ignition-runtime.js'))).toBe(true);
  });

  it('KDV-CONTRACT-01..07 + KDV-BUILD-05: publishes machine contracts and pretty-URL manifests', async () => {
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // Pretty URL and per-dump full manifest.
    expect(await exists(join(publicDir, 'dumps', 'sample-dump', 'index.html'))).toBe(true);
    expect(await exists(join(publicDir, 'dumps', 'sample-dump-two', 'index.html'))).toBe(true);
    expect(await exists(join(publicDir, 'dumps', 'sample-dump', 'manifest.json'))).toBe(true);
    expect(await exists(join(publicDir, 'dumps', 'sample-dump-two', 'manifest.json'))).toBe(true);
    expect(await exists(join(publicDir, 'dumps', 'sample-dump.html'))).toBe(false);

    const manifest = JSON.parse(await readFile(join(publicDir, 'dumps', 'sample-dump', 'manifest.json'), 'utf8'));
    expect(manifest.commit_sha).toBe('deadbeef');
    expect(typeof manifest.built_at).toBe('string');
    expect(manifest.title).toBe('Sample Dump');

    // index.json — valid, both dumps, sorted by date descending.
    const index = JSON.parse(await readFile(join(publicDir, 'index.json'), 'utf8'));
    expect(index).toMatchObject({ platform: 'kodavr', version: '1.0', base_url: BASE_URL, total: 2 });
    expect(index.dumps.map((d) => d.slug)).toEqual(['sample-dump-two', 'sample-dump']);
    expect(index.dumps[0].manifest_url).toBe(`${BASE_URL}/dumps/sample-dump-two/manifest.json`);

    // .well-known/kodavr.json
    const wellKnown = JSON.parse(await readFile(join(publicDir, '.well-known', 'kodavr.json'), 'utf8'));
    expect(wellKnown.endpoints.index).toBe('/index.json');
    expect(wellKnown.trust_levels).toContain('library');

    // Feeds — valid XML, one all-feed plus one per represented domain.
    const allFeed = await readFile(join(publicDir, 'feeds', 'all.atom'), 'utf8');
    const engineeringFeed = await readFile(join(publicDir, 'feeds', 'engineering.atom'), 'utf8');
    const financeFeed = await readFile(join(publicDir, 'feeds', 'finance.atom'), 'utf8');
    expect(XMLValidator.validate(allFeed)).toBe(true);
    expect(XMLValidator.validate(engineeringFeed)).toBe(true);
    expect(XMLValidator.validate(financeFeed)).toBe(true);
    expect(allFeed).toContain(`${BASE_URL}/dumps/sample-dump/manifest.json`);
    expect(allFeed).toContain(`${BASE_URL}/dumps/sample-dump-two/manifest.json`);
    expect(financeFeed).toContain(`${BASE_URL}/dumps/sample-dump-two/manifest.json`);

    // Verbatim robots.txt / humans.txt overwriting the engine's defaults.
    expect(await readFile(join(publicDir, 'robots.txt'), 'utf8')).toBe(ROBOTS_TXT);
    expect(await readFile(join(publicDir, 'humans.txt'), 'utf8')).toBe(HUMANS_TXT);

    // Regenerated sitemap points at pretty URLs, never at the old .html.
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(XMLValidator.validate(sitemap)).toBe(true);
    expect(sitemap).toContain(`${BASE_URL}/dumps/sample-dump/`);
    expect(sitemap).toContain(`${BASE_URL}/dumps/sample-dump-two/`);
    expect(sitemap).not.toContain('dumps/sample-dump.html');
  });

  it('KDV-CONTRACT-09: publishes a deterministic machine-readable tag graph at /tags.json, advertised in .well-known, with no tag/domain pages', async () => {
    const make = (slug, date, tags) => ({
      slug,
      manifest: {
        slug,
        type: 'note',
        title: slug,
        date,
        domain: 'engineering',
        tags,
        stakes: 'low',
        content_flags: [],
        trust_level: 'raw',
        generated_by: 'human',
        human_review: 'none',
        summary: `Fixture ${slug}.`,
      },
      raw: `# ${slug}\n\nbody\n`,
    });
    tmpRoot = await setupProject([], [
      make('graph-one', '2026-01-01', ['alpha', 'beta']),
      make('graph-two', '2026-01-02', ['beta', 'gamma']),
      make('graph-three', '2026-01-03', ['alpha', 'beta', 'gamma']),
    ]);
    const publicDir = join(tmpRoot, 'output', 'public');

    // The machine file is published at the root and parses as JSON.
    const graph = JSON.parse(await readFile(join(publicDir, 'tags.json'), 'utf8'));
    expect(graph).toMatchObject({ base_url: BASE_URL, total_tags: 3, total_dumps: 3 });
    expect(typeof graph.generated_at).toBe('string');

    // Deterministic ordering: tags by count desc, then name asc.
    expect(graph.tags.map((t) => t.tag)).toEqual(['beta', 'alpha', 'gamma']);
    const byTag = Object.fromEntries(graph.tags.map((t) => [t.tag, t]));
    // Per-tag dump slugs, sorted.
    expect(byTag.beta).toMatchObject({
      count: 3,
      dumps: ['graph-one', 'graph-three', 'graph-two'],
    });
    // Co-occurrence weights = number of dumps carrying both tags.
    expect(byTag.beta.related).toEqual([
      { tag: 'alpha', weight: 2 },
      { tag: 'gamma', weight: 2 },
    ]);
    expect(byTag.alpha.related).toEqual([
      { tag: 'beta', weight: 2 },
      { tag: 'gamma', weight: 1 },
    ]);

    // The discovery document advertises the new endpoint.
    const wellKnown = JSON.parse(await readFile(join(publicDir, '.well-known', 'kodavr.json'), 'utf8'));
    expect(wellKnown.endpoints.tags).toBe('/tags.json');

    // It is a machine file, NOT a tag/domain HTML page (§11).
    expect(await exists(join(publicDir, 'tags'))).toBe(false);
    expect(await exists(join(publicDir, 'domains'))).toBe(false);
  });

  it('KDV-MANIFEST-06 + KDV-MANIFEST-08 + KDV-MANIFEST-09: the published manifest carries the §4.1 shape', async () => {
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const manifest = JSON.parse(await readFile(join(publicDir, 'dumps', 'sample-dump', 'manifest.json'), 'utf8'));
    // §4.1 license default when the author omitted it.
    expect(manifest.license).toBe('CC-BY-4.0');
    // §4.1 layers: raw always listed, derived from raw.md; optional layers only if on disk.
    expect(manifest.layers).toEqual([
      { name: 'raw', file: 'raw.md', fact_checked: false, author_voice: true },
    ]);
    // §4.1 provenance/contract defaults.
    expect(manifest.derived_from).toBeNull();
    expect(manifest.consumption_contract).toEqual({ see: '/.well-known/kodavr.json' });
    expect(manifest.commit_sha).toBe('deadbeef');
    expect(typeof manifest.built_at).toBe('string');
  });

  it('KDV-SURFACE-01 + KDV-COPY-03 + KDV-COPY-05: publishes every §6.1 route with the verbatim footer and 404 copy', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const routes = [
      'index.html',
      'reception/index.html',
      'about/index.html',
      'contribute/index.html',
      '404.html',
      'dumps/sample-dump/index.html',
    ];
    for (const route of routes) {
      expect(await exists(join(publicDir, ...route.split('/')))).toBe(true);
    }

    // The engine layout dirs for moved single-page routes are cleaned up. The
    // paginated `home` route keeps its `main/page/` files (KDV-MOBILE-05), so
    // only the moved `main.html` must be gone.
    expect(await exists(join(publicDir, 'home', 'main.html'))).toBe(false);
    expect(await exists(join(publicDir, 'home', 'main', 'page', '1.html'))).toBe(true);
    expect(await exists(join(publicDir, 'notfound'))).toBe(false);

    // §7.3 footer is on every page.
    for (const route of routes) {
      const html = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      expect(html).toContain(FOOTER_TEXT);
    }

    // §7.6 404 copy on /404.
    expect(await readFile(join(publicDir, '404.html'), 'utf8')).toContain(NOT_FOUND_TEXT);

    // Home: machine-quickstart, human-quickstart and trust-level legend.
    // Human links are document-relative after the P2c pass (KDV-SURFACE-09);
    // the machine quickstart keeps the absolute canonical URL.
    const home = decodeEntities(await readFile(join(publicDir, 'index.html'), 'utf8'));
    expect(home).toContain('href="index.json"');
    expect(home).toContain('href=".well-known/kodavr.json"');
    expect(home).toContain('href="feeds/all.atom"');
    expect(home).toContain('href="reception/"');
    expect(home).toContain(`${BASE_URL}/index.json`);
    for (const level of ['raw', 'self-tested', 'community-tested', 'adapted', 'library']) {
      expect(home).toContain(level);
    }

    // Sitemap now lists the human routes too (KDV-SURFACE-08). The 404 page is
    // served for arbitrary missing paths, so it is not a canonical page and is
    // deliberately excluded.
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain(`${BASE_URL}/reception/`);
    expect(sitemap).toContain(`${BASE_URL}/about/`);
    expect(sitemap).toContain(`${BASE_URL}/contribute/`);
    expect(sitemap).not.toContain(`${BASE_URL}/404`);
  });

  it('KDV-SURFACE-03 + KDV-COPY-01 + KDV-COPY-02: the dump page carries the full body in SSR behind a hidden gate with reception, manifest card and og-tags', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    const text = decodeEntities(html);

    // Full body is present in the server-rendered markup (no JS execution).
    expect(html).toContain('<h1>Sample Heading</h1>');
    expect(html).toContain('Body text with');

    // The gate ships hidden with the §7.1 copy and the 0/1 buttons.
    expect(html).toMatch(/<dialog id="gate"[^>]*hidden/);
    expect(text).toContain(GATE_TEXT);
    expect(html).toContain('data-gate-choice="machine"');
    expect(html).toContain('data-gate-choice="human"');
    // The dump page is now live: the runtime and the page controller are wired
    // (SSR still ships the full body and the hidden gate, per §6.2).
    expect(html).toContain('src="../../assets/ignition-runtime.js"');
    expect(html).toContain('src="../../assets/controllers/dumps.js"');
    expect(html).toContain('src="../../assets/site.js"');

    // Reception block: §7.2 text, §7.4 prompt and a copy button.
    expect(text).toContain(RECEPTION_TEXT);
    expect(text).toContain(PROMPT_TEXT);
    expect(html).toContain('class="copy-prompt"');

    // Manifest card links to the manifest and to index.json — document-relative
    // after the P2c pass (KDV-SURFACE-09).
    expect(html).toContain('href="../../dumps/sample-dump/manifest.json"');
    expect(html).toContain('href="../../index.json"');

    // §6.4 og-tags.
    expect(html).toContain('<meta property="og:title" content="Sample Dump · low">');
    expect(html).toContain('<meta property="og:image" content="https://example.test/assets/og-default.png">');
    expect(html).toContain('<meta property="og:url" content="https://example.test/dumps/sample-dump/">');
  });

  it('KDV-A11Y-02 + KDV-A11Y-03: the dump SSR ships a named gate modal, a status region and a named reception block', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    const text = decodeEntities(html);

    // The gate is a modal with an accessible name (the §7.1 statement) and a
    // description pointing at the gate text (KDV-A11Y-02).
    expect(html).toMatch(/<dialog id="gate"[^>]*hidden/);
    expect(html).toContain('aria-labelledby="gate-title"');
    expect(html).toContain('aria-describedby="gate-text"');
    expect(html).toMatch(/<pre class="gate-text" id="gate-text">/);
    expect(text).toContain(GATE_TITLE);

    // The bare digits stay visible; the accessible names are descriptive.
    expect(html).toContain('>0</button>');
    expect(html).toContain('>1</button>');
    for (const label of [GATE_MACHINE_LABEL, GATE_HUMAN_LABEL]) {
      expect(html).toContain(`aria-label="${label}"`);
    }

    // No-navigation announcements: an SSR-present role="status" region wired to
    // the copydeck, and a named reception region (KDV-A11Y-03).
    expect(html).toMatch(/<p id="a11y-status"[^>]*role="status"[^>]*aria-live="polite"/);
    expect(html).toContain('data-hall-announcement=');
    expect(html).toContain('data-reception-announcement=');
    expect(html).toContain('aria-labelledby="reception-title"');
    expect(html).toContain('data-copied-announcement=');
  });

  it('KDV-SURFACE-08: dump pages carry canonical + article og/twitter meta and a real PNG card; 404 is noindex and out of the sitemap', async () => {
    const TAGGED = '2026-09-10-tagged';
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two'], [
      {
        slug: TAGGED,
        manifest: {
          slug: TAGGED,
          type: 'note',
          title: 'Tagged Dump',
          date: '2026-09-10',
          domain: 'engineering',
          tags: ['alpha', 'beta'],
          stakes: 'low',
          content_flags: [],
          trust_level: 'raw',
          generated_by: 'human',
          human_review: 'none',
          summary: 'A tagged fixture dump.',
        },
        raw: '# Tagged\n\nbody\n',
      },
    ]);
    const publicDir = join(tmpRoot, 'output', 'public');

    // The social card is a real published PNG, not a vector favicon.
    const png = await stat(join(publicDir, 'assets', 'og-default.png'));
    expect(png.isFile()).toBe(true);
    expect(png.size).toBeGreaterThan(0);

    const html = await readFile(join(publicDir, 'dumps', TAGGED, 'index.html'), 'utf8');
    // §6.4 canonical + feed autodiscovery.
    expect(html).toContain(`<link rel="canonical" href="${BASE_URL}/dumps/${TAGGED}/">`);
    expect(html).toContain('type="application/atom+xml"');
    expect(html).toContain('title="Kodavr dumps"');
    expect(html).toContain('feeds/all.atom');

    // §6.4 OpenGraph site/locale + the 1200x630 PNG with its dimensions.
    expect(html).toContain('<meta property="og:site_name" content="Kodavr">');
    expect(html).toContain('<meta property="og:locale" content="en_US">');
    expect(html).toContain(`<meta property="og:image" content="${BASE_URL}/assets/og-default.png">`);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toContain('<meta property="og:image:type" content="image/png">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
    // The old vector og:image is gone even though the favicon still uses it.
    expect(html).not.toContain(`<meta property="og:image" content="${BASE_URL}/logo.svg">`);

    // Dumps are articles; the card is summary_large_image.
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`<meta name="twitter:image" content="${BASE_URL}/assets/og-default.png">`);
    expect(html).toContain('<meta name="twitter:title"');
    expect(html).toContain('<meta name="twitter:description"');

    // Article meta is dump-only: one <meta> per tag plus the section/date.
    expect(html).toContain('<meta property="article:published_time" content="2026-09-10T00:00:00Z">');
    expect(html).toMatch(/<meta property="article:modified_time" content="[^"]+">/);
    expect(html).toContain('<meta property="article:section" content="engineering">');
    expect(html).toContain('<meta property="article:tag" content="alpha">');
    expect(html).toContain('<meta property="article:tag" content="beta">');

    // The 404 page must never be indexed and is not an article.
    const notFound = await readFile(join(publicDir, '404.html'), 'utf8');
    expect(notFound).toContain('<meta name="robots" content="noindex,follow">');
    expect(notFound).toContain(`<link rel="canonical" href="${BASE_URL}/404">`);
    expect(notFound).not.toContain('article:published_time');
    expect(notFound).toContain('<meta property="og:type" content="website">');

    // Sitemap hygiene: no 404, and each dump's lastmod is its own manifest date.
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(XMLValidator.validate(sitemap)).toBe(true);
    expect(sitemap).not.toContain(`${BASE_URL}/404`);
    expect(sitemap).not.toContain('dumps/sample-dump.html');
    expect(urlBlock(sitemap, `${BASE_URL}/dumps/sample-dump/`)).toContain('<lastmod>2026-09-14</lastmod>');
    expect(urlBlock(sitemap, `${BASE_URL}/dumps/sample-dump-two/`)).toContain('<lastmod>2026-09-20</lastmod>');
  });

  it('KDV-SURFACE-12: every page carries a canonical URL, a summary-large-image card and an Atom autodiscovery link; sitemap priorities are sensible', async () => {
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const routes = [
      ['index.html', `${BASE_URL}/`],
      ['reception/index.html', `${BASE_URL}/reception/`],
      ['about/index.html', `${BASE_URL}/about/`],
      ['contribute/index.html', `${BASE_URL}/contribute/`],
      ['404.html', `${BASE_URL}/404`],
      ['dumps/sample-dump/index.html', `${BASE_URL}/dumps/sample-dump/`],
    ];
    for (const [route, canonical] of routes) {
      const html = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      expect(html, route).toContain(`<link rel="canonical" href="${canonical}">`);
      expect(html, route).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(html, route).toContain('type="application/atom+xml"');
      expect(html, route).toContain('<meta property="og:site_name" content="Kodavr">');
      expect(html, route).toContain('<meta property="og:locale" content="en_US">');
      // Only the 404 opt out of indexing; pages and dumps stay indexable.
      const robots = route === '404.html' ? 'noindex,follow' : 'index,follow';
      expect(html, route).toContain(`<meta name="robots" content="${robots}">`);
    }

    // Sitemap: home outranks dumps, which outrank the auxiliary routes; the 404
    // is absent and every dump date is its own.
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(XMLValidator.validate(sitemap)).toBe(true);
    expect(urlBlock(sitemap, `${BASE_URL}/`)).toContain('<priority>1.0</priority>');
    expect(urlBlock(sitemap, `${BASE_URL}/dumps/sample-dump/`)).toContain('<priority>0.8</priority>');
    expect(urlBlock(sitemap, `${BASE_URL}/reception/`)).toContain('<priority>0.5</priority>');
    expect(sitemap).not.toContain('/404</loc>');
  });

  it('KDV-SURFACE-11: every page ships server-rendered JSON-LD (@graph); dump previews carry the platform agent hook', async () => {
    const TAGGED = '2026-09-10-jsonld-dump';
    const summary = 'A summonable fixture dump </script> for JSON-LD.';
    tmpRoot = await setupProject(['sample-dump'], [
      {
        slug: TAGGED,
        manifest: {
          slug: TAGGED,
          type: 'note',
          title: 'JSON-LD Dump',
          date: '2026-09-10',
          domain: 'engineering',
          tags: ['alpha', 'beta'],
          stakes: 'low',
          content_flags: [],
          trust_level: 'raw',
          generated_by: 'human',
          human_review: 'none',
          license: 'CC-BY-4.0',
          summary,
        },
        raw: '# JSON-LD\n\nbody\n',
      },
    ]);
    const publicDir = join(tmpRoot, 'output', 'public');

    // Exactly one JSON-LD script per page, and it must parse as JSON.
    const scriptsOf = (html) =>
      [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const graphOf = (html) => {
      const scripts = scriptsOf(html);
      expect(scripts).toHaveLength(1);
      const parsed = JSON.parse(scripts[0]);
      expect(parsed['@context']).toBe('https://schema.org');
      return parsed['@graph'];
    };
    const nodeOf = (graph, type) => graph.find((node) => node['@type'] === type);

    // P5b pins the platform hook verbatim.
    expect(AGENT_HOOK).toBe(
      'A raw dump for your agent, not for you. Hand it over — it comes back tailored to your context.',
    );

    // Home: WebSite + WebPage + CollectionPage + ItemList of the feed.
    const homeGraph = graphOf(await readFile(join(publicDir, 'index.html'), 'utf8'));
    expect(nodeOf(homeGraph, 'WebSite')).toBeDefined();
    expect(nodeOf(homeGraph, 'WebPage')).toBeDefined();
    expect(nodeOf(homeGraph, 'CollectionPage')).toBeDefined();
    const itemList = nodeOf(homeGraph, 'ItemList');
    const item = itemList.itemListElement.find((entry) => entry.url === `${BASE_URL}/dumps/${TAGGED}/`);
    expect(item).toMatchObject({ position: expect.any(Number), name: 'JSON-LD Dump' });

    // A dump page: WebSite + WebPage + Article + BreadcrumbList.
    const dumpHtml = await readFile(join(publicDir, 'dumps', TAGGED, 'index.html'), 'utf8');
    const dumpScripts = scriptsOf(dumpHtml);
    expect(dumpScripts).toHaveLength(1);
    // Safe serialization: a literal `</script>` in a manifest value is escaped.
    expect(dumpScripts[0]).toContain('\\u003c/script>');
    const dumpGraph = JSON.parse(dumpScripts[0])['@graph'];
    for (const type of ['WebSite', 'WebPage', 'Article', 'BreadcrumbList']) {
      expect(nodeOf(dumpGraph, type), type).toBeDefined();
    }
    const article = nodeOf(dumpGraph, 'Article');
    expect(article).toMatchObject({
      headline: 'JSON-LD Dump',
      description: summary,
      abstract: AGENT_HOOK,
      license: 'CC-BY-4.0',
      articleSection: 'engineering',
      datePublished: '2026-09-10T00:00:00Z',
      isAccessibleForFree: true,
      inLanguage: 'en',
      keywords: ['alpha', 'beta'],
      mainEntityOfPage: `${BASE_URL}/dumps/${TAGGED}/`,
    });
    // No author.github on the fixture -> the publisher Organization stands in.
    expect(article.author['@type']).toBe('Organization');
    expect(article.dateModified).toMatch(/T/);
    const breadcrumb = nodeOf(dumpGraph, 'BreadcrumbList');
    expect(breadcrumb.itemListElement.map((entry) => entry.name)).toEqual(['Home', 'JSON-LD Dump']);

    // Dump previews carry the agent hook, not the article summary.
    expect(dumpHtml).toContain(`<meta name="description" content="${AGENT_HOOK}">`);
    expect(dumpHtml).toContain(`<meta property="og:description" content="${AGENT_HOOK}">`);
    expect(dumpHtml).toContain(`<meta name="twitter:description" content="${AGENT_HOOK}">`);

    // The 404 is noindex and carries no JSON-LD.
    const notFound = await readFile(join(publicDir, '404.html'), 'utf8');
    expect(scriptsOf(notFound)).toHaveLength(0);
  });

  it('KDV-SURFACE-09: internal links are document-relative so one artifact works at the root or under a project subpath', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // Home (depth 0): the feed link is relative and slash-free; the machine
    // quickstart keeps the absolute canonical URL.
    const home = await readFile(join(publicDir, 'index.html'), 'utf8');
    expect(home).toContain('href="dumps/sample-dump/"');
    expect(home).not.toContain('href="/dumps/sample-dump/"');
    expect(home).toContain(`${BASE_URL}/index.json`);

    // Dump page (depth 2): assets, data preload, manifest and index climb out of
    // dumps/<slug>/; the home link is exactly `../../`.
    const dump = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(dump).toContain('href="../../assets/styles.css"');
    expect(dump).toContain('src="../../assets/site.js"');
    expect(dump).toContain('src="../../assets/ignition-runtime.js"');
    expect(dump).toContain('href="../../data/dumps/sample-dump.json"');
    expect(dump).toContain('href="../../dumps/sample-dump/manifest.json"');
    expect(dump).toContain('href="../../index.json"');
    expect(dump).toContain('href="../../"');
    // og:* metadata stays absolute — it is consumed out of context.
    expect(dump).toContain(`content="${BASE_URL}/assets/og-default.png"`);
    expect(dump).toContain(`content="${BASE_URL}/dumps/sample-dump/"`);

    // No page except 404.html may keep a root-relative href/src.
    const pages = [
      'index.html',
      'reception/index.html',
      'about/index.html',
      'contribute/index.html',
      'dumps/sample-dump/index.html',
    ];
    for (const page of pages) {
      const html = await readFile(join(publicDir, ...page.split('/')), 'utf8');
      expect(html, `${page} must not keep a root-relative href`).not.toMatch(/href="\//);
      expect(html, `${page} must not keep a root-relative src`).not.toMatch(/src="\//);
    }
    // 404.html is the deliberate exception: it is served for arbitrary missing
    // paths, so a document-relative link would resolve against the bogus URL.
    expect(await readFile(join(publicDir, '404.html'), 'utf8')).toMatch(/href="\/"/);
  });

  it('KDV-SURFACE-09: repo files absent from the site link to GitHub blobs; published files stay document-relative', async () => {
    const slug = '2026-09-14-kodavr-manifesto';
    tmpRoot = await setupProject([slug], [], { repoFiles: ['docs/SPEC.md'] });
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', slug, 'index.html'), 'utf8');
    const blob = 'https://github.com/krivich/kodavr/blob/main';

    // The dead-link class: repo files (body prose links AND artifact cards) must
    // resolve to a GitHub blob URL, never a page-relative path that 404s.
    expect(html).toContain(`href="${blob}/docs/SPEC.md"`);
    expect(html).toContain(`href="${blob}/static/logo.svg"`);
    expect(html).toContain(`href="${blob}/content/dumps/${slug}/manifest.schema.json"`);
    expect(html).not.toContain('href="../../../docs/SPEC.md"');
    expect(html).not.toContain('href="../../../static/logo.svg"');
    expect(html).not.toContain('href="docs/SPEC.md"');
    expect(html).not.toContain('href="static/logo.svg"');
    expect(html).not.toContain('href="manifest.schema.json"');

    // Published files keep the document-relative rewrite (P2c, KDV-SURFACE-09).
    expect(html).toContain('href="../../"');
    expect(html).toContain('href="../../logo.svg"');
    expect(html).toContain(`href="../../dumps/${slug}/manifest.json"`);
    expect(html).toContain('href="../../index.json"');
  });

  it('KDV-COPY-06: stakes:high dumps get the §7.9 disclaimer prepended to the SSR body', async () => {
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const high = await readFile(join(publicDir, 'dumps', 'sample-dump-two', 'index.html'), 'utf8');
    const low = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');

    expect(high).toContain(HIGH_STAKES_DISCLAIMER);
    expect(high).toContain('high-stakes');
    expect(high.indexOf(HIGH_STAKES_DISCLAIMER)).toBeLessThan(high.indexOf('Second Sample Heading'));
    expect(low).not.toContain(HIGH_STAKES_DISCLAIMER);
  });

  it('KDV-ARCH-01: the published site is static — .nojekyll present, .well-known reachable, no server code shipped', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // GitHub Pages runs Jekyll by default, which drops dot-files/dirs — without
    // .nojekyll the /.well-known/kodavr.json contract would 404 in production.
    expect(await exists(join(publicDir, '.nojekyll'))).toBe(true);
    expect(await exists(join(publicDir, '.well-known', 'kodavr.json'))).toBe(true);

    // KDV-CI-10: the custom-domain file is copied verbatim into the public root.
    expect(await readFile(join(publicDir, 'CNAME'), 'utf8')).toContain('kodavr.xyz');

    // Nothing server-side leaks into the deploy artifact: only static files, and
    // no emitted file spins up an HTTP server.
    const files = await listFiles(publicDir);
    expect(files.some((f) => /\.(mjs|cjs)$/.test(f))).toBe(false);
    expect(files.some((f) => f.startsWith('scripts/') || f.startsWith('input/'))).toBe(false);

    const textLike = /\.(html|js|json|xml|atom|txt|css|svg)$/;
    for (const file of files.filter((f) => textLike.test(f))) {
      const content = await readFile(join(publicDir, ...file.split('/')), 'utf8');
      expect(content, `${file} must not contain server code`).not.toMatch(/createServer\(|node:http|require\(['"]express['"]\)/);
    }
  });

  it('KDV-CONTRACT-08 + KDV-MOD-02 + KDV-MOD-01: a withdrawn dump stays at its URL (200) with a stub, a withdrawn status in manifest + index, and an Issues link', async () => {
    const WITHDRAWN = '2026-09-01-withdrawn';
    tmpRoot = await setupProject(['sample-dump'], [
      {
        slug: WITHDRAWN,
        manifest: {
          slug: WITHDRAWN,
          type: 'case',
          title: 'Withdrawn Dump',
          date: '2026-09-01',
          domain: 'engineering',
          tags: ['sample'],
          stakes: 'low',
          content_flags: [],
          trust_level: 'raw',
          generated_by: 'human',
          human_review: 'minimal',
          summary: 'A withdrawn fixture dump.',
          status: 'withdrawn',
          withdrawal_reason: 'Stakes were underestimated.',
          artifacts: [],
        },
        raw: '# Secret Body\n\nThis body must not be published.\n',
      },
    ]);
    const publicDir = join(tmpRoot, 'output', 'public');
    const dumpDir = join(publicDir, 'dumps', WITHDRAWN);

    // §5.6: HTTP 200 — the URL is immutable; the page exists, never a 404.
    expect(await exists(join(dumpDir, 'index.html'))).toBe(true);
    expect(await exists(join(dumpDir, 'manifest.json'))).toBe(true);
    expect(await exists(join(publicDir, 'dumps', `${WITHDRAWN}.html`))).toBe(false);

    const html = await readFile(join(dumpDir, 'index.html'), 'utf8');
    expect(html).toContain('This dump has been withdrawn.');
    expect(html).toContain('Reason: Stakes were underestimated.');
    expect(html).not.toContain('Secret Body');
    expect(html).not.toContain('This body must not be published');
    // The manifest card survives the body replacement.
    expect(html).toContain('class="manifest-card"');
    // §9/§A3: the dump page links to the repository's GitHub Issues.
    expect(html).toContain('https://github.com/krivich/kodavr/issues');
    expect(html).toContain('Issues / discuss');

    const manifest = JSON.parse(await readFile(join(dumpDir, 'manifest.json'), 'utf8'));
    expect(manifest.status).toBe('withdrawn');
    expect(manifest.withdrawal_reason).toBe('Stakes were underestimated.');

    // §5.6/§5.1: the status is carried into index.json; URLs stay stable.
    const index = JSON.parse(await readFile(join(publicDir, 'index.json'), 'utf8'));
    const entry = index.dumps.find((d) => d.slug === WITHDRAWN);
    expect(entry.status).toBe('withdrawn');
    expect(entry.url).toBe(`${BASE_URL}/dumps/${WITHDRAWN}/`);
    expect(entry.manifest_url).toBe(`${BASE_URL}/dumps/${WITHDRAWN}/manifest.json`);

    // The published dump is unaffected: no forced status, original URL and body.
    const published = index.dumps.find((d) => d.slug === 'sample-dump');
    expect(published.status).toBeUndefined();
    expect(published.url).toBe(`${BASE_URL}/dumps/sample-dump/`);
    const publishedHtml = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(publishedHtml).not.toContain('This dump has been withdrawn.');
    expect(publishedHtml).toContain('Sample Heading');
  });

  it('KDV-BUILD-03: the controller emits JSON datasets in Ignition input convention (dumps, routes, feed)', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const dataDir = join(tmpRoot, 'input', 'data');

    // Per-dump dataset: input/data/dumps/<slug>.json.
    const dumpData = JSON.parse(await readFile(join(dataDir, 'dumps', 'sample-dump.json'), 'utf8'));
    expect(dumpData.slug).toBe('sample-dump');
    expect(dumpData.body_html).toContain('<h1>Sample Heading</h1>');

    // One route dataset per layout: input/data/<layout>/main.json.
    for (const layout of ['home', 'reception', 'about', 'contribute', 'notfound']) {
      expect(await exists(join(dataDir, layout, 'main.json')), layout).toBe(true);
    }

    // The home dataset carries the feed list (built from index entries)…
    const home = JSON.parse(await readFile(join(dataDir, 'home', 'main.json'), 'utf8'));
    expect(Array.isArray(home.dumps)).toBe(true);
    expect(home.dumps[0].slug).toBe('sample-dump');
    expect(home.dumps[0].manifest_url).toBe(`${BASE_URL}/dumps/sample-dump/manifest.json`);

    // …and the reception dataset carries the prompt/human copy.
    const reception = JSON.parse(await readFile(join(dataDir, 'reception', 'main.json'), 'utf8'));
    expect(typeof reception.copy.reception).toBe('string');
    expect(typeof reception.copy.prompt).toBe('string');
  });

  it('KDV-ARCH-03: machine files are the interface and the HTML is their projection', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // The machine interface is published at its stable URLs.
    for (const file of ['index.json', 'sitemap.xml', 'feeds/all.atom', '.well-known/kodavr.json', 'dumps/sample-dump/manifest.json']) {
      expect(await exists(join(publicDir, ...file.split('/'))), file).toBe(true);
    }

    // The HTML page is generated from the same dataset: it preloads the data and
    // server-renders the body, so it is a projection of the machine source.
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(html).toContain('href="../../data/dumps/sample-dump.json"');
    expect(html).toContain('<h1>Sample Heading</h1>');
  });

  it('KDV-ARCH-04: the full body is in the SSR HTML and the gate is declarative only', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');

    // View-source is not blocked: the whole body ships in the server markup.
    expect(html).toContain('<h1>Sample Heading</h1>');
    expect(html).toContain('Body text with');
    // The gate is a plain hidden <dialog>, not a server-side withhold.
    expect(html).toMatch(/<dialog id="gate"[^>]*hidden/);
    expect(html).toContain('class="dump-body"');
    // No user-agent branching in the emitted page.
    expect(html).not.toMatch(/User-Agent|navigator\.userAgent/);
  });

  it('KDV-ARCH-05: the blanket 18+ line is rendered on every route', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const routes = [
      'index.html',
      'reception/index.html',
      'about/index.html',
      'contribute/index.html',
      '404.html',
      'dumps/sample-dump/index.html',
    ];
    for (const route of routes) {
      const html = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      expect(html, route).toContain('18+');
      expect(html, route).toContain(FOOTER_TEXT);
    }
  });

  it('KDV-MOBILE-06: the fixture dump page stays under the gzip budget, ships a system font stack and inlines the header logo', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');

    // §6.5 performance budget on the representative fixture dump. The real
    // 180KB context-machine article is a known content outlier and is NOT
    // size-limited here (its body is the author's, not the platform's).
    const gzipped = gzipSync(Buffer.from(html, 'utf8'));
    expect(gzipped.length).toBeLessThan(100 * 1024);

    // System font stack only — no external font stylesheet/origin/FOUT.
    const css = await readFile(join(publicDir, 'assets', 'styles.css'), 'utf8');
    expect(css).toMatch(/body\s*\{[^}]*system-ui/);
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    // No external stylesheet/font — the absolute canonical/og URLs are meta, not resources.
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https?:\/\//);
    expect(html).not.toMatch(/@font-face|@import\s+url\(/);

    // §6.5 the header logo is inlined as trusted SVG, not a separate request.
    expect(html).toContain('<svg');
    expect(html).toContain('aria-label="Kodavr"');
    expect(html).not.toMatch(/<img[^>]+logo\.svg/);
  });

  it('KDV-MOBILE-07: the 192x192 touch icon is published and head carries theme-color plus the apple-touch-icon', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // §6.5 platform hook: the rasterized icon is a real static asset.
    const png = join(publicDir, 'assets', 'touch-icon-192.png');
    expect((await stat(png)).isFile()).toBe(true);

    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(html).toContain('name="theme-color" content="#111111"');
    // The SVG favicon is kept; the touch icon is the 192x192 PNG.
    expect(html).toMatch(/rel="icon"[^>]*logo\.svg/);
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*sizes="192x192"/);
    expect(html).toMatch(/apple-touch-icon[^>]*href="[^"]*assets\/touch-icon-192\.png"/);
  });

  it('KDV-MOBILE-05: feed pagination emits engine page files, SSR-renders page 1 at the root and ships 44px arrows', async () => {
    // A fixture with more items than one page (perPage=10) so the declarative
    // pagination machinery is actually exercised (the live feed has 3 dumps).
    const inline = Array.from({ length: 12 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      const slug = `2026-01-01-feed-dump-${n}`;
      return {
        slug,
        manifest: {
          slug,
          type: 'note',
          title: `Feed Dump ${n}`,
          date: '2026-01-01',
          domain: 'engineering',
          tags: ['fixture'],
          stakes: 'low',
          content_flags: [],
          trust_level: 'raw',
          generated_by: 'human',
          human_review: 'none',
          summary: `Synthetic feed fixture number ${n}.`,
        },
        raw: `# Feed Dump ${n}\n\nSynthetic body ${n}.\n`,
      };
    });
    tmpRoot = await setupProject([], inline);
    const publicDir = join(tmpRoot, 'output', 'public');

    // The inline client state carries the full collection; assert on the
    // server-rendered feed region, not on that JSON payload.
    const feedOf = (html) => html.match(/<section class="dump-feed">([\s\S]*?)<\/section>/)[1];

    // §6.4 SEO: page 1 stays at the site root with the dump cards in the SSR HTML.
    const home = await readFile(join(publicDir, 'index.html'), 'utf8');
    const feed1 = feedOf(home);
    expect(feed1).toContain('Feed Dump 01');
    expect(feed1).toContain('Feed Dump 10');
    expect(feed1).not.toContain('Feed Dump 11');
    expect(feed1).toContain('data-page="2"');

    // The engine's separate page files resolve and carry the remaining items.
    expect(await exists(join(publicDir, 'home', 'main', 'page', '1.html'))).toBe(true);
    const page2 = await readFile(join(publicDir, 'home', 'main', 'page', '2.html'), 'utf8');
    const feed2 = feedOf(page2);
    expect(feed2).toContain('Feed Dump 11');
    expect(feed2).toContain('Feed Dump 12');
    expect(feed2).not.toContain('Feed Dump 10');

    // 44px touch arrows (§6.5): markup carries the class, the stylesheet pins
    // it to the shared --tap token.
    expect(feed1).toContain('class="pagination-arrow"');
    const css = await readFile(join(publicDir, 'assets', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.pagination-arrow\s*\{[^}]*min-height:\s*var\(--tap\)/);
    expect(css).toMatch(/\.pagination-arrow\s*\{[^}]*min-width:\s*var\(--tap\)/);
  });

  it('KDV-SURFACE-02: no tag or domain routes/pages are built in the MVP', async () => {
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // §6.1/§A12: tag/domain pages are deferred (§13); no directory exists.
    expect(await exists(join(publicDir, 'tags'))).toBe(false);
    expect(await exists(join(publicDir, 'domains'))).toBe(false);

    // The route table has no tag/domain entry either.
    for (const page of ROUTE_PAGES) {
      expect(page.layout, 'route layout').not.toMatch(/tag|domain/i);
      expect(page.to, 'route target').not.toMatch(/tag|domain/i);
    }
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, cp, readFile, readdir, stat, rm, writeFile } from 'node:fs/promises';
import { XMLValidator } from 'fast-xml-parser';
import { buildProject } from '../../scripts/lib/build.mjs';
import { ROUTE_PAGES, FOOTER_REPORT_URL } from '../../scripts/lib/pages.mjs';
import { t } from '../../scripts/lib/i18n.mjs';
import { ROBOTS_TXT, HUMANS_TXT } from '../../scripts/lib/verbatim.mjs';
import { CONTRACT_VERSION, TRUST_LEGEND_LEAD, TRUST_LEVEL_MEANINGS } from '../../scripts/lib/machine.mjs';
import {
  GATE_KICKER,
  GATE_TITLE,
  GATE_HOOK,
  GATE_DUTIES_LEAD,
  GATE_DUTIES,
  GATE_REST,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  RESET_HUMAN_LABEL,
  DECLARATION_TOAST,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_CTA,
  BRIEF_REPORT,
  BRIEF_FALLBACK,
  BRAND_SLOGAN_LEAD,
  BRAND_SLOGANS_MUTED,
  dumpPrompt,
  FOOTER_TEXT,
  FOOTER_REPORT_LABEL,
  NOT_FOUND_TEXT,
  HIGH_STAKES_DISCLAIMER,
  CHIP_MACHINE_TEMPLATE,
  CHIP_HUMAN_LABEL,
  CHIP_TITLE_TEMPLATE,
  CHIP_WITHDRAW_LABEL,
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

// The engine inlines the whole dataset and the registered template sources as
// `<script>` JSON blobs (`__IGNITION_INITIAL_DATA__` / `__IGNITION_TEMPLATES__`).
// Their `<`/`>` are escaped (`\u003c`), but plain author prose still rides in
// them verbatim: a substring count over the whole file would double-count it
// (e.g. the brief heading text appears in both the DOM and the dataset). This
// drops the blobs so counts and matches describe the rendered DOM only.
function stripInlineBoot(html) {
  return html.replace(
    /<script>window\.__IGNITION_(?:INITIAL_DATA|TEMPLATES)__[\s\S]*?<\/script>/g,
    '',
  );
}

// Human Surface v4/KDV-SURFACE-28: the article plates live in the `dumps.hbs`
// LAYOUT (not a partial), and the engine's compiler projects a bare
// `<tag class="…">{{simplePath}}</tag>` into the same markup plus a reactive
// `data-ignition-text="path"` wiring sticker. The sticker is client wiring, not
// content, so strip it before exact-text comparisons.
function stripStickers(html) {
  return html.replace(/ data-ignition-text="[^"]*"/g, '');
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
    // Counted on the rendered DOM (the inlined dataset is stripped), never over
    // raw substrings of the whole file.
    expect(stripInlineBoot(html).match(/<h1\b/g) ?? []).toHaveLength(1);
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

    // §5.1/KDV-CONTRACT-03: every layer file is published beside the manifest, so
    // a machine downloads raw markdown instead of scraping the HTML page.
    expect(await exists(join(publicDir, 'dumps', 'sample-dump', 'raw.md'))).toBe(true);
    expect(await exists(join(publicDir, 'dumps', 'sample-dump', 'summary.md'))).toBe(true);

    const manifest = JSON.parse(await readFile(join(publicDir, 'dumps', 'sample-dump', 'manifest.json'), 'utf8'));
    expect(manifest.commit_sha).toBe('deadbeef');
    expect(typeof manifest.built_at).toBe('string');
    expect(manifest.title).toBe('Sample Dump');

    // index.json — valid, both dumps, sorted by date descending.
    const index = JSON.parse(await readFile(join(publicDir, 'index.json'), 'utf8'));
    expect(index).toMatchObject({
      platform: 'kodavr',
      version: '1.0',
      base_url: BASE_URL,
      total: 2,
    });
    expect(index.dumps.map((d) => d.slug)).toEqual(['sample-dump-two', 'sample-dump']);
    expect(index.dumps[0].manifest_url).toBe(`${BASE_URL}/dumps/sample-dump-two/manifest.json`);
    // §5.1: the index names the very field a machine downloads the dump from.
    expect(index.dumps[0].body_url).toBe(`${BASE_URL}/dumps/sample-dump-two/raw.md`);
    // §5.1: the index is self-describing and the same schema is served beside it.
    expect(index.$schema).toBe(`${BASE_URL}/schemas/index.schema.json`);
    const servedIndexSchema = JSON.parse(await readFile(join(publicDir, 'schemas', 'index.schema.json'), 'utf8'));
    expect(index.schema).toEqual(servedIndexSchema);
    expect(await exists(join(publicDir, 'schemas'))).toBe(true);
    // §4.1: the published manifest carries its own schema, served identically.
    expect(manifest.$schema).toBe(`${BASE_URL}/schemas/manifest.schema.json`);
    const servedManifestSchema = JSON.parse(await readFile(join(publicDir, 'schemas', 'manifest.schema.json'), 'utf8'));
    expect(manifest.schema).toEqual(servedManifestSchema);

    // .well-known/kodavr.json stays the standalone platform OS the schemas point to.
    const wellKnown = JSON.parse(await readFile(join(publicDir, '.well-known', 'kodavr.json'), 'utf8'));
    expect(wellKnown.endpoints.index).toBe('/index.json');
    expect(wellKnown.endpoints.body_pattern).toBe('/dumps/{slug}/{file}');
    expect(wellKnown.trust_levels).toContain('library');
    expect(wellKnown.about).toContain('raw');
    expect(wellKnown.interpret).toMatch(/stakes/i);
    expect(wellKnown.index_url).toBe(`${BASE_URL}/index.json`);

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
    // §5.1: each entry carries the published URL of its file.
    expect(manifest.layers).toEqual([
      { name: 'raw', file: 'raw.md', fact_checked: false, author_voice: true, url: `${BASE_URL}/dumps/sample-dump/raw.md` },
      { name: 'summary', file: 'summary.md', fact_checked: false, author_voice: false, url: `${BASE_URL}/dumps/sample-dump/summary.md` },
    ]);
    // §4.1/§5.1: the published manifest carries its own JSON Schema inline
    // (`$schema` URL + `schema`), served at /schemas/manifest.schema.json.
    expect(manifest.$schema).toBe(`${BASE_URL}/schemas/manifest.schema.json`);
    expect(manifest.schema.$id).toBe(`${BASE_URL}/schemas/manifest.schema.json`);
    expect(manifest.schema.description).toContain('/.well-known/kodavr.json');
    // §4.1 provenance/contract defaults.
    expect(manifest.derived_from).toBeNull();
    expect(manifest.consumption_contract).toEqual({ see: '/.well-known/kodavr.json' });
    expect(manifest.commit_sha).toBe('deadbeef');
    expect(typeof manifest.built_at).toBe('string');

    // §6.3/KDV-STRUCT-02: only the dump that ships the optional summary.md
    // layer carries a rendered brief in its dataset; the other stays falsy.
    const withBrief = JSON.parse(await readFile(join(tmpRoot, 'input', 'data', 'dumps', 'sample-dump.json'), 'utf8'));
    const withoutBrief = JSON.parse(await readFile(join(tmpRoot, 'input', 'data', 'dumps', 'sample-dump-two.json'), 'utf8'));
    expect(withBrief.brief_html).toContain('<h4>Sample Dump brief</h4>');
    expect(withoutBrief.brief_html).toBeFalsy();
  });

  it('KDV-SURFACE-01 + KDV-SURFACE-18 + KDV-SURFACE-20 + KDV-COPY-03 + KDV-COPY-05: publishes every §6.1 route with the verbatim footer, report link and 404 copy', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const routes = [
      'index.html',

      'about/index.html',
      'contribute/index.html',
      '404.html',
      'dumps/sample-dump/index.html',
    ];
    for (const route of routes) {
      expect(await exists(join(publicDir, ...route.split('/')))).toBe(true);
    }
    // Human Surface v4: the reception route is removed and 404s.
    expect(await exists(join(publicDir, 'reception', 'index.html'))).toBe(false);

    // The engine layout dirs for moved single-page routes are cleaned up. The
    // paginated `home` route keeps its `main/page/` files (KDV-MOBILE-05), so
    // only the moved `main.html` must be gone.
    expect(await exists(join(publicDir, 'home', 'main.html'))).toBe(false);
    expect(await exists(join(publicDir, 'home', 'main', 'page', '1.html'))).toBe(true);
    expect(await exists(join(publicDir, 'notfound'))).toBe(false);

    // §7.3 footer is on every page; §7.3/§9 adds a real, JS-free report link.
    // The href is HTML-escaped in the attribute, so decode before comparing.
    for (const route of routes) {
      const raw = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      expect(raw).toContain(FOOTER_TEXT);
      const html = decodeEntities(raw);
      expect(html, route).toContain('class="footer-report"');
      expect(html, route).toContain(`href="${FOOTER_REPORT_URL}"`);
      expect(html, route).toContain(`>${FOOTER_REPORT_LABEL}</a>`);
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
    expect(home).toContain(`${BASE_URL}/index.json`);
    // §2.2/§6.1 KDV-SURFACE-20: the trust legend is a definition list — the lead
    // plus every level as a monospace token with its prose meaning. The engine
    // injects a data-ignition-text binding into <dt>/<dd>, so compare the inner
    // text (`>token</dt>`), not the bare tag. The old `<ol class="trust-levels">`
    // token list is gone.
    expect(home).toContain(TRUST_LEGEND_LEAD);
    expect(home).toContain('class="trust-legend"');
    expect(home).not.toContain('class="trust-levels"');
    for (const { level, meaning } of TRUST_LEVEL_MEANINGS) {
      expect(home).toContain(`>${level}</dt>`);
      expect(home).toContain(`>${meaning}</dd>`);
    }

    // §7.15/KDV-COPY-11: /about/ carries all three slogans from one source —
    // the lead as-is, the other two muted.
    const about = decodeEntities(await readFile(join(publicDir, 'about', 'index.html'), 'utf8'));
    expect(about).toContain('class="slogan"');
    expect(about).toContain(`>${BRAND_SLOGAN_LEAD}</p>`);
    expect(about).toContain('class="slogan-muted"');
    expect(about).toContain(`>${BRAND_SLOGANS_MUTED}</p>`);

    // Sitemap now lists the human routes too (KDV-SURFACE-08). The 404 page is
    // served for arbitrary missing paths, so it is not a canonical page and is
    // deliberately excluded.
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain(`${BASE_URL}/about/`);
    expect(sitemap).toContain(`${BASE_URL}/contribute/`);
    expect(sitemap).not.toContain(`${BASE_URL}/404`);
  });

  it('KDV-I18N-01 + KDV-I18N-03: the ru, zh-Hans and es bundles emit fully localized pages, while English stays English', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // Every UI route plus the dump page is emitted under the ru prefix (SSR).
    const ruRoutes = [
      'ru/index.html',

      'ru/about/index.html',
      'ru/contribute/index.html',
      'ru/dumps/sample-dump/index.html',
    ];
    for (const route of ruRoutes) {
      expect(await exists(join(publicDir, ...route.split('/'))), route).toBe(true);
    }
    // The 404 stays single (deferred per-locale): no /ru/404.html.
    expect(await exists(join(publicDir, 'ru', '404.html'))).toBe(false);

    // The frame is Russian and the document language is ru.
    const ruAbout = await readFile(join(publicDir, 'ru', 'about', 'index.html'), 'utf8');
    expect(ruAbout).toContain('<html lang="ru">');
    expect(ruAbout).toContain('>Зачем существует Kodavr</h1>');
    expect(ruAbout).toContain(t('ABOUT_FOR_AUTHORS_HEADING', 'ru'));
    expect(ruAbout).not.toContain('>Why Kodavr exists</h1>');

    const ruDump = await readFile(join(publicDir, 'ru', 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(ruDump).toContain('<html lang="ru">');
    expect(decodeEntities(ruDump)).toContain(t('GATE_TITLE', 'ru'));
    // The dump body is content, not frame: it is never translated.
    expect(ruDump).toContain('<h1>Sample Heading</h1>');

    // §11/KDV-I18N-09: the ru frame's internal PAGE links are locale-aware — the
    // plates come from the catalog and the About/Reception CTAs, the feed item
    // link, the logo and the dump FAB stay inside /ru/. The machine quickstart
    // (`/index.json`) stays canonical. `locale_prefix` is on every dataset.
    const ruHome = await readFile(join(publicDir, 'ru', 'index.html'), 'utf8');
    expect(ruHome).toContain('<html lang="ru">');
    // §6.1 v4: the plate labels are localized now (the hero is a literal KODAVR
    // wordmark), so use the ru HUMANS plate label and the lane lead as the
    // locale signal.
    expect(ruHome).toContain(`data-plate="${t('HOME_PLATE_HUMANS', 'ru')}"`);
    expect(ruHome).toContain(t('HOME_HUMANS_LEAD', 'ru'));
    expect(ruHome).toContain('href="../ru/about/"');
    expect(ruHome).toContain('../ru/dumps/');
    expect(ruAbout).toContain('data-plate="01 · манифест"');
    expect(ruDump).toMatch(/<a class="fab" href="\.\.\/\.\.\/\.\.\/ru\/"/);
    expect(ruDump).toContain('data-plate="06 · артефакты"');

    // The extra locale-frame `href` must never leak into the canonical machine
    // index (KDV-I18N-08): `/index.json` entries keep their absolute `url` only.
    const index = JSON.parse(await readFile(join(publicDir, 'index.json'), 'utf8'));
    expect(index.dumps.every((entry) => !('href' in entry))).toBe(true);
    const manifest = JSON.parse(await readFile(join(publicDir, 'dumps', 'sample-dump', 'manifest.json'), 'utf8'));
    expect('href' in manifest).toBe(false);

    // §11/KDV-I18N-01 phase 7a: the zh-Hans bundle activates the whole /zh/
    // product; the frame is Chinese and `<html lang>` is zh-Hans.
    const zhRoutes = [
      'zh/index.html',

      'zh/about/index.html',
      'zh/contribute/index.html',
      'zh/dumps/sample-dump/index.html',
    ];
    for (const route of zhRoutes) {
      expect(await exists(join(publicDir, ...route.split('/'))), route).toBe(true);
    }
    // The 404 stays single (deferred per-locale): no /zh/404.html.
    expect(await exists(join(publicDir, 'zh', '404.html'))).toBe(false);

    const zhAbout = await readFile(join(publicDir, 'zh', 'about', 'index.html'), 'utf8');
    expect(zhAbout).toContain('<html lang="zh-Hans">');
    expect(zhAbout).toContain(`>${t('ABOUT_PAGE_TITLE', 'zh-Hans')}</h1>`);
    expect(zhAbout).toContain(t('ABOUT_FOR_AUTHORS_HEADING', 'zh-Hans'));
    expect(zhAbout).not.toContain('>Why Kodavr exists</h1>');

    const zhDump = await readFile(join(publicDir, 'zh', 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(zhDump).toContain('<html lang="zh-Hans">');
    expect(decodeEntities(zhDump)).toContain(t('GATE_TITLE', 'zh-Hans'));
    // The dump body is content, not frame: it is never translated.
    expect(zhDump).toContain('<h1>Sample Heading</h1>');

    // §11/KDV-I18N-01 phase 7b: the es bundle activates the whole /es/ product;
    // the frame is Spanish and `<html lang>` is es. This completes wave 1.
    const esRoutes = [
      'es/index.html',

      'es/about/index.html',
      'es/contribute/index.html',
      'es/dumps/sample-dump/index.html',
    ];
    for (const route of esRoutes) {
      expect(await exists(join(publicDir, ...route.split('/'))), route).toBe(true);
    }
    // The 404 stays single (deferred per-locale): no /es/404.html.
    expect(await exists(join(publicDir, 'es', '404.html'))).toBe(false);

    const esAbout = await readFile(join(publicDir, 'es', 'about', 'index.html'), 'utf8');
    expect(esAbout).toContain('<html lang="es">');
    expect(esAbout).toContain(`>${t('ABOUT_PAGE_TITLE', 'es')}</h1>`);
    expect(esAbout).toContain(t('ABOUT_FOR_AUTHORS_HEADING', 'es'));
    expect(esAbout).not.toContain('>Why Kodavr exists</h1>');

    const esDump = await readFile(join(publicDir, 'es', 'dumps', 'sample-dump', 'index.html'), 'utf8');
    expect(esDump).toContain('<html lang="es">');
    expect(decodeEntities(esDump)).toContain(t('GATE_TITLE', 'es'));
    // The dump body is content, not frame: it is never translated.
    expect(esDump).toContain('<h1>Sample Heading</h1>');

    // The English pages stay English (no visible English change from phase 4b).
    const enAbout = await readFile(join(publicDir, 'about', 'index.html'), 'utf8');
    expect(enAbout).toContain('<html lang="en">');
    expect(enAbout).toContain('>Why Kodavr exists</h1>');
    expect(enAbout).not.toContain('Зачем существует Kodavr');
    expect(enAbout).not.toContain('Kodavr 为何存在');

    // The sitemap lists the localized URLs too (hreflang arrives in phase 5).
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(XMLValidator.validate(sitemap)).toBe(true);
    expect(sitemap).toContain(`${BASE_URL}/ru/about/`);
    expect(sitemap).toContain(`${BASE_URL}/ru/dumps/sample-dump/`);
    expect(sitemap).toContain(`${BASE_URL}/zh/about/`);
    expect(sitemap).toContain(`${BASE_URL}/zh/dumps/sample-dump/`);
    expect(sitemap).toContain(`${BASE_URL}/es/about/`);
    expect(sitemap).toContain(`${BASE_URL}/es/dumps/sample-dump/`);

    // The per-locale page counts are surfaced in the message so a drift is visible.
    const ruPages = (await listFiles(publicDir)).filter((f) => f.startsWith('ru/') && f.endsWith('.html'));
    expect(ruPages.length, `ru html pages: ${ruPages.join(', ')}`).toBeGreaterThanOrEqual(4);
    const zhPages = (await listFiles(publicDir)).filter((f) => f.startsWith('zh/') && f.endsWith('.html'));
    expect(zhPages.length, `zh html pages: ${zhPages.join(', ')}`).toBeGreaterThanOrEqual(4);
    const esPages = (await listFiles(publicDir)).filter((f) => f.startsWith('es/') && f.endsWith('.html'));
    expect(esPages.length, `es html pages: ${esPages.join(', ')}`).toBeGreaterThanOrEqual(4);
  });

  it('KDV-I18N-04: every built page carries the alternate-locale cluster (hreflang + x-default) and the sitemap mirrors it as xhtml:link', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // The English home: self-canonical, the en/ru/zh-Hans/es cluster over the
    // built locales, x-default → the default (en) variant, one og:locale:alternate
    // per other built locale.
    const enHome = await readFile(join(publicDir, 'index.html'), 'utf8');
    expect(enHome).toContain(`<link rel="canonical" href="${BASE_URL}/">`);
    expect(enHome).toContain(`<link rel="alternate" hreflang="en" href="${BASE_URL}/">`);
    expect(enHome).toContain(`<link rel="alternate" hreflang="ru" href="${BASE_URL}/ru/">`);
    expect(enHome).toContain(`<link rel="alternate" hreflang="zh-Hans" href="${BASE_URL}/zh/">`);
    expect(enHome).toContain(`<link rel="alternate" hreflang="es" href="${BASE_URL}/es/">`);
    expect(enHome).toContain(`<link rel="alternate" hreflang="x-default" href="${BASE_URL}/">`);
    expect(enHome).toContain('<meta property="og:locale" content="en_US">');
    expect(enHome).toContain('<meta property="og:locale:alternate" content="ru_RU">');
    expect(enHome).toContain('<meta property="og:locale:alternate" content="zh_CN">');
    expect(enHome).toContain('<meta property="og:locale:alternate" content="es_ES">');

    // The Russian variants carry the same cluster, their own og:locale, and an
    // x-default that still points at the default-locale variant.
    const ruRoutes = [
      ['ru/index.html', `${BASE_URL}/`],
      ['ru/about/index.html', `${BASE_URL}/about/`],
      ['ru/dumps/sample-dump/index.html', `${BASE_URL}/dumps/sample-dump/`],
    ];
    for (const [route, xDefault] of ruRoutes) {
      const html = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      expect(html, route).toContain('<html lang="ru">');
      expect(html, route).toContain(`<link rel="alternate" hreflang="en" href="${BASE_URL}/`);
      expect(html, route).toContain(`<link rel="alternate" hreflang="ru" href="${BASE_URL}/ru/`);
      expect(html, route).toContain(`<link rel="alternate" hreflang="x-default" href="${xDefault}">`);
      expect(html, route).toContain('<meta property="og:locale" content="ru_RU">');
      expect(html, route).toContain('<meta property="og:locale:alternate" content="en_US">');
    }
    // Canonical stays self-referential per locale.
    expect(await readFile(join(publicDir, 'ru', 'about', 'index.html'), 'utf8')).toContain(
      `<link rel="canonical" href="${BASE_URL}/ru/about/">`,
    );
    expect(await readFile(join(publicDir, 'ru', 'dumps', 'sample-dump', 'index.html'), 'utf8')).toContain(
      `<link rel="canonical" href="${BASE_URL}/ru/dumps/sample-dump/">`,
    );

    // The sitemap declares the xhtml namespace and mirrors each page's cluster.
    const sitemap = await readFile(join(publicDir, 'sitemap.xml'), 'utf8');
    expect(XMLValidator.validate(sitemap)).toBe(true);
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    const enAbout = urlBlock(sitemap, `${BASE_URL}/about/`);
    expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/about/"/>`);
    expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="ru" href="${BASE_URL}/ru/about/"/>`);
    expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="zh-Hans" href="${BASE_URL}/zh/about/"/>`);
    expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="es" href="${BASE_URL}/es/about/"/>`);
    expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/about/"/>`);
    expect(urlBlock(sitemap, `${BASE_URL}/ru/about/`)).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/about/"/>`,
    );
    expect(urlBlock(sitemap, `${BASE_URL}/zh/about/`)).toContain(
      `<xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/about/"/>`,
    );
    expect(urlBlock(sitemap, `${BASE_URL}/es/about/`)).toContain(
      `<xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/about/"/>`,
    );
  });

  it('KDV-COPY-12: /about/ is a six-plate sheet in the home design language — manifesto, authors, readers, mechanism, architecture, colophon', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const about = decodeEntities(await readFile(join(publicDir, 'about', 'index.html'), 'utf8'));

    // The header contract (KDV-SURFACE-23) still opens the page. The kicker is
    // now a dataset binding, so match the class and text (ignition may add its
    // data-ignition-text attribute before the `>`).
    expect(about).toMatch(/<p class="kicker"[^>]*>about the platform<\/p>/);
    expect(about).toContain('>Why Kodavr exists</h1>');
    expect(about).toContain('class="lead"');

    // Six numbered plates, in order, under the sheet's design roles.
    const plates = [...about.matchAll(/data-plate="([^"]+)"/g)].map((m) => m[1]);
    expect(plates).toEqual([
      '01 · manifesto',
      '02 · authors',
      '03 · readers',
      '04 · mechanism',
      '05 · architecture',
      '06 · colophon',
    ]);

    for (const heading of ['For authors', 'For readers', 'How it works', 'Architecture decisions']) {
      expect(about, heading).toContain(`>${heading}</h2>`);
    }

    // The mechanism is the design system's ordered `.steps`, not a pile of cards.
    expect(about).toContain('<ol class="steps">');
    // The §7.10 story (KDV-COPY-08) and the 1x/10x thesis still reach /about/.
    expect(about).toContain('A dump is a field report written by your agent in one prompt.');
    expect(about).toContain('Packaging it so someone else can reuse it costs 10x');
    // The §1.4 slogan colophon closes the page (KDV-COPY-11).
    expect(about).toContain('class="slogan"');
    expect(about).toContain('class="slogan-muted"');
  });

  it('KDV-SURFACE-24: the home hero is the KODAVR wordmark over a lead and the home_explainer explainer — no kicker, no plate label, no §7.10 card — with two CTAs', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    // The explainer is a pure text binding, so the engine stamps it with a
    // data-ignition-text sticker and the inlined boot dataset repeats the raw
    // copy — strip both so pins and the DOM order describe the visible page.
    const home = stripStickers(stripInlineBoot(decodeEntities(await readFile(join(publicDir, 'index.html'), 'utf8'))));
    // §6.1 v4: the literal brand wordmark over the positioning sentence as a
    // lead, with the term `a dump` emphasized. The plain HOME_TITLE feeds
    // <title>/JSON-LD.
    expect(home).toMatch(/<h1 class="home-wordmark"[^>]*>KODAVR<\/h1>/);
    expect(home).toMatch(
      /<p class="home-lead"[^>]*>Writers share raw experience — <strong[^>]*>a dump<\/strong> — the reader's agent adapts it to their needs\.<\/p>/,
    );
    // feedback-marketing item 3 (owner copy 2026-09-24): one explainer paragraph
    // sits between the lead and the CTAs — the reader-benefit value prop.
    const explainer =
      'Kodavr is a registry of raw experience: code, workflows, and field reports. Your AI agent reads them and adapts to your problem — your task, your stack, your style.';
    expect(home).toContain(`<p>${explainer}</p>`);
    expect(home).not.toContain('class="kicker"');
    // The storefront hero plate carries no numbered label.
    expect(home).not.toContain('data-plate="01 · KODAVR"');
    // §7.10 left the storefront (KDV-COPY-08 keeps it on /about/).
    expect(home).not.toContain('class="block-statement"');
    // Two design system CTAs: understand it, or publish.
    expect(home).toMatch(/<a class="cta" href="about\/"[^>]*>About the platform<\/a>/);
    expect(home).toMatch(/<a class="cta" href="contribute\/"[^>]*>How to contribute<\/a>/);
    // DOM order: wordmark → lead → explainer → CTAs. Match the paragraph, not
    // the bare string — the shared HOME_TAGLINE meta description in <head>
    // carries the same value proposition (KDV-SURFACE-24) and would match first.
    const wordmark = home.indexOf('class="home-wordmark"');
    const lead = home.indexOf('class="home-lead"');
    const body = home.indexOf(`<p>${explainer}</p>`);
    const cta = home.indexOf('class="cta"');
    expect(wordmark).toBeGreaterThanOrEqual(0);
    expect(lead).toBeGreaterThan(wordmark);
    expect(body).toBeGreaterThan(lead);
    expect(cta).toBeGreaterThan(body);
  });

  it('KDV-SURFACE-27: the home 01 · HUMANS plate carries the universal prompt and the agent lane above the feed', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const home = decodeEntities(await readFile(join(publicDir, 'index.html'), 'utf8'));

    // Plates, in the v4 order (KDV-I18N-09 data-plate bindings); the hero plate
    // carries no label, so HUMANS is the first.
    const plates = [...home.matchAll(/data-plate="([^"]+)"/g)].map((m) => m[1]);
    expect(plates).toEqual([
      '01 · HUMANS',
      '02 · LATEST',
      '03 · MACHINES',
      '04 · TRUST',
    ]);

    // The lane lead is the home variant (catalog), with the wired jump links.
    expect(home).toContain(t('HOME_HUMANS_LEAD', 'en'));
    expect(home).toContain('class="agent-lane"');
    expect(home).toContain('class="agent-link"');
    expect(home).toContain('class="copy-prompt"');
    // The universal §7.4 prompt renders exactly once in the DOM, on its own id,
    // above the feed. The raw string also rides verbatim in the inlined
    // `__IGNITION_INITIAL_DATA__` boot blob (the whole home dataset is embedded),
    // so count the rendered DOM — `stripInlineBoot` drops the blobs — never the
    // raw file, or the boot copy double-counts (v4/KDV-SURFACE-27).
    const prompt = t('PROMPT_TEXT', 'en');
    expect(stripInlineBoot(home).split(prompt).length - 1).toBe(1);
    expect(home).toContain('id="home-prompt"');
    expect(home.indexOf('id="home-prompt"')).toBeLessThan(home.indexOf('class="dump-feed"'));
    // The reception link is gone from the storefront (Human Surface v4).
    expect(home).not.toMatch(/href="[^"]*reception/);
  });

  it('KDV-SURFACE-29: /contribute/ leads 02 · flow with the contribute-lane — lead, one copy button, prompt, hint, secondary link — and no chat links', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const page = stripStickers(
      stripInlineBoot(decodeEntities(await readFile(join(publicDir, 'contribute', 'index.html'), 'utf8'))),
    );

    // feedback-contribute_skill items 01/03: the lane is the plate's FIRST
    // element, above the demoted manual path (heading + the three steps).
    const flowPlate = page.slice(
      page.indexOf('data-plate="02 · flow"'),
      page.indexOf('data-plate="03 · schema"'),
    );
    const laneAt = flowPlate.indexOf('class="contribute-lane"');
    const headingAt = flowPlate.indexOf('>Manual path (if you prefer)<');
    const stepsAt = flowPlate.indexOf('<ol class="steps"');
    expect(laneAt, 'contribute-lane in 02 · flow').toBeGreaterThanOrEqual(0);
    expect(headingAt, 'demoted manual-path heading').toBeGreaterThanOrEqual(0);
    expect(stepsAt, 'manual-path steps').toBeGreaterThanOrEqual(0);
    expect(laneAt).toBeLessThan(headingAt);
    expect(headingAt).toBeLessThan(stepsAt);

    // The lane: lead, ONE copy control wired to the prompt below it, hint, and
    // the plain secondary link to the skill dump page (D3, document-relative
    // after the P2c pass — KDV-SURFACE-09).
    expect(flowPlate).toContain(t('CONTRIBUTE_LANE_LEAD', 'en'));
    expect(flowPlate).toContain('data-copy-target="contribute-prompt"');
    expect(flowPlate).toContain('data-copied-label="Copied ✓"');
    expect(flowPlate).toContain('data-copied-announcement="Copied to the clipboard."');
    expect(flowPlate).toContain('id="contribute-prompt"');
    expect(flowPlate).toContain(t('CONTRIBUTE_LANE_HINT', 'en'));
    expect(flowPlate).toContain(t('CONTRIBUTE_LANE_BUTTON', 'en'));
    // Depth-1 page → the P2c pass relativizes the root-absolute template href.
    expect(flowPlate).toContain('href="../dumps/2026-09-18-kodavr-dump-skill/"');
    expect(flowPlate).toContain(t('CONTRIBUTE_LANE_SECONDARY', 'en'));
    expect(flowPlate).toContain('>Manual path (if you prefer)</h2>');
    expect(flowPlate.match(/<li>/g) ?? []).toHaveLength(3);

    // Exactly one copy control on the page; the §7.16 prompt renders exactly
    // once in the DOM (the inline boot blobs are stripped, so counts are honest).
    expect(page.match(/data-copy-target=/g) ?? []).toHaveLength(1);
    const prompt = t('CONTRIBUTE_PROMPT', 'en');
    expect(page.split(prompt).length - 1).toBe(1);

    // Publishing is a coding agent's job: NO chat links anywhere on /contribute/.
    expect(page).not.toContain('class="agent-link"');
    expect(page).not.toContain('class="agent-links"');
    expect(page).not.toContain('class="agent-lane"');
  });

  it('KDV-SURFACE-23: /contribute/ plate 01 renders the three-paragraph lead in order — P1 with the lead class, P2/P3 plain', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const page = stripStickers(
      stripInlineBoot(decodeEntities(await readFile(join(publicDir, 'contribute', 'index.html'), 'utf8'))),
    );
    const authors = page.slice(
      page.indexOf('data-plate="01 · authors"'),
      page.indexOf('data-plate="02 · flow"'),
    );

    // kicker → H1 → three paragraphs, in order; P1 alone carries the lead role.
    expect(authors).toMatch(/<p class="kicker"[^>]*>for authors<\/p>/);
    expect(authors).toContain('>Contribute</h1>');
    const lead1 = t('CONTRIBUTE_LEAD', 'en');
    const lead2 = t('CONTRIBUTE_LEAD_2', 'en');
    const lead3 = t('CONTRIBUTE_LEAD_3', 'en');
    const m = authors.match(
      /<p class="lead"[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/,
    );
    expect(m, 'lead + two plain sibling paragraphs').not.toBeNull();
    expect(m[1]).toBe(lead1);
    expect(m[2]).toBe(lead2);
    expect(m[3]).toBe(lead3);
    // DOM order after the H1: P1 → P2 → P3, exactly three paragraphs.
    const afterH1 = authors.slice(authors.indexOf('</h1>'));
    expect(afterH1.match(/<p\b/g) ?? []).toHaveLength(3);
    expect(afterH1.indexOf(lead1)).toBeLessThan(afterH1.indexOf(lead2));
    expect(afterH1.indexOf(lead2)).toBeLessThan(afterH1.indexOf(lead3));
    // The superseded lead is gone from the built page.
    expect(page).not.toContain('One pull request = one dump');
  });

  it('KDV-SURFACE-26 + KDV-SURFACE-28: the 01 · PREVIEW plate names the dump above the declaration, and a non-dump page carries no dump context', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const dump = stripStickers(
      decodeEntities(await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8')),
    );
    // Human Surface v4/KDV-SURFACE-26: the preview plate names the dump — the
    // manifest title, summary and the same metadata tokens the card carries —
    // inside `01 · PREVIEW`, above the `02` invitation and `03` declaration.
    expect(dump).toContain('id="plate-preview"');
    expect(dump).toContain('data-plate="01 · PREVIEW"');
    expect(dump).toContain('data-plate="02 · INTERESTING?"');
    expect(dump).toContain('data-plate="03 · DECLARATION"');
    expect(dump).toContain('data-plate="01 · DUMP"');
    expect(dump).toContain('class="gate-dump"');
    expect(dump).toContain('<p class="gate-dump-title">Sample Dump</p>');
    expect(dump).toContain('A fixture dump for tests.');
    expect(dump).toContain('2026-09-14 · engineering · low · self-tested');
    // §7.2 v4/Step 5b: the explainer leads the plate (the statement role's bold
    // left rule), then the dump is named, then the brief card sits directly under
    // the summary — the rendered DOM order, not the engine's boot blob.
    const dom = stripInlineBoot(dump);
    const iExplainer = dom.indexOf('class="block-statement reception-brief-section"');
    const iGateDump = dom.indexOf('class="gate-dump"');
    const iBrief = dom.indexOf('<div class="reception-brief">');
    expect(iExplainer).toBeGreaterThan(-1);
    expect(iGateDump).toBeGreaterThan(-1);
    expect(iBrief).toBeGreaterThan(-1);
    expect(iExplainer).toBeLessThan(iGateDump);
    expect(iGateDump).toBeLessThan(iBrief);
    // The block is dump-only: the home storefront (no dump) never carries it.
    const home = decodeEntities(await readFile(join(publicDir, 'index.html'), 'utf8'));
    expect(home).not.toContain('class="gate-dump"');
  });

  it('KDV-SURFACE-25: every built page ships the hardening CSP meta with its three independent directives and no default-src', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const csp =
      `<meta http-equiv="Content-Security-Policy" content="object-src 'none'; base-uri 'self'; form-action 'none'">`;

    const routes = [
      'index.html',

      'about/index.html',
      'contribute/index.html',
      '404.html',
      'dumps/sample-dump/index.html',
    ];
    for (const route of routes) {
      const html = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      // The meta lives inside <head>.
      const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));
      expect(head, route).toContain(csp);
      // The three directives are independent: the shipped meta sets no
      // default-src / script-src, which would block the engine's inline
      // bootstrap scripts. (Checked on the meta element alone: the engine also
      // inlines the template SOURCES, comments included, elsewhere in the body.)
      const metas = head.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/g) ?? [];
      expect(metas, route).toHaveLength(1);
      expect(metas[0], route).not.toContain('default-src');
      expect(metas[0], route).not.toContain('script-src');
    }
  });

  it('KDV-SURFACE-04: every page ships the current consumption-contract version in <head> as a meta tag (sourced from machine.mjs)', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const routes = [
      'index.html',

      'about/index.html',
      'contribute/index.html',
      '404.html',
      'dumps/sample-dump/index.html',
    ];
    for (const route of routes) {
      const html = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      expect(html, route).toContain(
        `<meta name="kodavr-contract-version" content="${CONTRACT_VERSION}">`,
      );
    }
  });

  it('KDV-SURFACE-03 + KDV-SURFACE-15 + KDV-COPY-01 + KDV-SURFACE-28 + KDV-SURFACE-08 + KDV-SURFACE-32: the dump page carries the full body in SSR behind inline plates with the declaration, manifest card and og-tags', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    const text = decodeEntities(html);

    // Full body is present in the server-rendered markup (no JS execution).
    expect(html).toContain('<h1>Sample Heading</h1>');
    expect(html).toContain('Body text with');

    // §6.2 v4/KDV-SURFACE-28: no modal — the declaration is the inline
    // `03 · DECLARATION` plate, with `01 · PREVIEW` and `02 · INTERESTING?` above
    // it. The three state-0 plates ship hidden in SSR and the raw body plate is
    // what a no-JS reader sees (the "no JS = machine" fiction).
    expect(html).not.toMatch(/<dialog/);
    expect(html).toMatch(/<section class="plate" id="plate-preview"[^>]*hidden/);
    expect(html).toMatch(/<section class="plate" id="plate-want"[^>]*hidden/);
    expect(html).toMatch(/<section class="plate" id="plate-declaration"[^>]*hidden/);
    expect(html).toMatch(/<section class="plate" id="plate-dump"[^>]*>/);
    // §7.1 verbatim (KDV-COPY-01): kicker, statement, hook, duties and the long
    // declaration, plus the 0/1 buttons.
    expect(text).toContain(GATE_KICKER);
    expect(text).toContain(GATE_TITLE);
    expect(text).toContain(GATE_HOOK);
    expect(text).toContain(GATE_DUTIES_LEAD);
    expect(text).toContain(GATE_DUTIES);
    expect(text).toContain(GATE_REST);
    expect(html).toContain('data-gate-choice="machine"');
    expect(html).toContain('data-gate-choice="human"');
    // §6.2 KDV-SURFACE-15: the machine panel ships hidden with the gate warning,
    // the pinned prompt and the §7.12 lane; the single human reset (v4) moved to
    // the page bottom.
    expect(html).toMatch(/<section class="card" id="machine-panel" hidden>/);
    expect(html).toContain('id="machine-prompt"');
    expect(html).toContain('data-reset-human');
    expect(html).toContain('id="article-reset"');
    expect(text).toContain(RESET_HUMAN_LABEL);
    // The prompt is rendered exactly once per surface: the §7.11 dump prompt on
    // the `02 · INTERESTING?` plate and the machine panel's own pin.
    expect(html).toContain('id="article-prompt"');
    expect(html).toContain('id="machine-panel"');
    // The dump page is now live: the runtime and the page controller are wired.
    expect(html).toContain('src="../../assets/ignition-runtime.js"');
    expect(html).toContain('src="../../assets/controllers/dumps.js"');
    expect(html).toContain('src="../../assets/site.js"');

    // §7.2 v4 is absorbed: the reception wall is NOT migrated (its concern
    // already lives on /about/), while the author brief tier stays in the
    // `01 · PREVIEW` plate. Item 8: the 18+ rating line is gone from the
    // plate — neither the markup nor the boot dataset carries the token (the
    // rating's home is the footer, pinned by KDV-ARCH-05). Rendered DOM only —
    // the boot blob carries the copy.
    const dom = decodeEntities(stripInlineBoot(html));
    expect(dom).not.toContain('YOU ARE HUMAN. THIS IS NOT A DIAGNOSIS');
    expect(dom).toContain(BRIEF_HEADING);
    expect(html).not.toContain('reception_rating');
    expect(html).not.toContain('class="reception-rating"');
    expect(dom).toContain(dumpPrompt('https://example.test/dumps/sample-dump/manifest.json'));
    expect(html).toContain('class="agent-lane"');
    expect(html).toContain('class="copy-prompt"');
    expect(text).not.toContain('[ 0 ]');
    // KDV-SURFACE-32: the `02 · INTERESTING?` plate opens with the owner's
    // heading (EN build), between the section open and the §7.12 lane — same
    // heading grammar as the home HUMANS plate. Sticker-stripped like the
    // brief-tier assertions above, so the comparison is content, not wiring.
    const wantDom = stripStickers(dom);
    const wantStart = wantDom.indexOf('id="plate-want"');
    const wantEnd = wantDom.indexOf('id="plate-declaration"');
    expect(wantStart).toBeGreaterThanOrEqual(0);
    expect(wantEnd).toBeGreaterThan(wantStart);
    const wantPlate = wantDom.slice(wantStart, wantEnd);
    expect(wantPlate).toContain('<h2>Read through your agent</h2>');
    expect(wantPlate.indexOf('<h2')).toBeLessThan(wantPlate.indexOf('class="agent-lane"'));

    // Manifest card links to the manifest and to index.json — document-relative
    // after the P2c pass (KDV-SURFACE-09).
    expect(html).toContain('href="../../dumps/sample-dump/manifest.json"');
    expect(html).toContain('href="../../index.json"');

    // §6.4 og-tags. og:title is the title only — stakes/trust stay in meta tags
    // and visible cards, never in the title tag or og:title (KDV-SURFACE-08).
    expect(html).toContain('<meta property="og:title" content="Sample Dump">');
    expect(html).toContain('<meta property="og:image" content="https://example.test/assets/og-default.png">');
    expect(html).toContain('<meta property="og:url" content="https://example.test/dumps/sample-dump/">');
  });

  it('KDV-A11Y-02 + KDV-A11Y-03: the dump SSR ships a named inline declaration plate and the no-navigation status regions', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    const text = decodeEntities(html);

    // Human Surface v4/KDV-A11Y-02: the declaration is an inline NAMED region,
    // not a modal — `#plate-declaration` borrows its accessible name from the
    // §7.1 statement; the hook keeps its id so the name/description still point
    // at real text (amended from the `aria-labelledby/describedby` dialog pair).
    expect(html).not.toMatch(/<dialog/);
    expect(html).toMatch(
      /<section class="plate" id="plate-declaration"[^>]*aria-labelledby="gate-title"/,
    );
    expect(html).toMatch(/<p class="gate-kicker" id="gate-kicker">/);
    expect(html).toMatch(/<h2 id="gate-title" class="gate-title">/);
    expect(html).toMatch(/<p class="gate-hook" id="gate-hook">/);
    // §7.1 v2/items 6-7: the heading is the plain declaration; the kicker is a
    // plain reading instruction (the region's accessible name is the declaration).
    expect(text).toContain(GATE_TITLE);

    // §6.5 P0-1: the doors are real buttons carrying their visible §7.1 labels
    // (the bare digit stays a separate aria-hidden badge), so the accessible name
    // comes from the label text itself, never from an `aria-label` on a digit.
    expect(html).toMatch(/<button type="button" class="door" data-gate-choice="machine">/);
    expect(html).toMatch(/<button type="button" class="door" data-gate-choice="human">/);
    expect(html).toContain('class="door-digit" aria-hidden="true">0</span>');
    expect(html).toContain('class="door-digit" aria-hidden="true">1</span>');
    expect(text).toContain(GATE_MACHINE_DOOR);
    expect(text).toContain(GATE_HUMAN_DOOR);
    expect(html).not.toMatch(/aria-label="0 — I am a machine/);

    // No-navigation announcements (KDV-A11Y-03): the SSR role="status" region is
    // wired to the copydeck for the in-place transitions — 0 → hall, 1 → the
    // human lane, the bottom reset → the declaration again.
    expect(html).toMatch(/<p id="a11y-status"[^>]*role="status"[^>]*aria-live="polite"/);
    expect(html).toContain('data-hall-announcement=');
    expect(html).toContain('data-reception-announcement=');
    expect(html).toContain('data-declaration-announcement=');
    expect(html).toContain('data-copied-announcement=');
  });

  it('KDV-SURFACE-28: the 01 · PREVIEW plate renders the author brief tier (or the honest fallback) as real elements', async () => {
    tmpRoot = await setupProject(['sample-dump', 'sample-dump-two']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // §6.3: the brief tier now lives inside the `01 · PREVIEW` plate (the
    // reception block dissolved in v4); heading/note/CTA/report are real elements
    // from the copydeck and the §7.2 monospace wall is not migrated.
    const withBrief = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');
    const briefText = stripStickers(decodeEntities(withBrief));
    expect(withBrief).toContain('id="plate-preview"');
    // Item 8: the rating line is not part of the plate's legal group anymore —
    // the group closes the brief tier with the report line alone.
    expect(briefText).not.toContain('reception-rating');
    // The brief heading is exactly one DOM element, not one substring of the
    // file: the inlined dataset also carries the raw copy text, so count the
    // rendered element on the boot-stripped markup.
    const briefHeadingElements =
      stripStickers(stripInlineBoot(withBrief)).match(/<p class="reception-brief-heading">/g) ?? [];
    expect(briefHeadingElements).toHaveLength(1);
    expect(briefText).toContain(`<p class="reception-brief-heading">${BRIEF_HEADING}</p>`);
    expect(briefText).toContain(`<p class="reception-brief-note">${BRIEF_NOTE}</p>`);
    expect(briefText).toContain(`<p class="reception-brief-cta">${BRIEF_CTA}</p>`);
    expect(briefText).toContain(`<p class="reception-brief-report">${BRIEF_REPORT}</p>`);
    // §7.2 v4/Step 5b: the explainer is the statement role's left-rule block and
    // it leads the plate; the brief card follows the summary it explains.
    expect(briefText).toContain('class="block-statement reception-brief-section"');
    const domOrder = stripStickers(stripInlineBoot(withBrief));
    expect(domOrder.indexOf('class="block-statement reception-brief-section"')).toBeLessThan(
      domOrder.indexOf('class="gate-dump"'),
    );
    expect(domOrder.indexOf('class="gate-dump"')).toBeLessThan(
      domOrder.indexOf('<div class="reception-brief">'),
    );
    // The dump that ships summary.md shows the rendered brief, never the fallback.
    expect(withBrief).toContain('<div class="reception-brief"><h4>Sample Dump brief</h4>');
    expect(withBrief).not.toContain('class="reception-brief-missing"');

    // §6.3/KDV-SURFACE-10: an author's brief can never smuggle a top-level
    // heading into the page — the rendered DOM keeps exactly one <h1> (the body
    // title) and the brief block carries no <h1>/<h2>/<h3> of its own.
    const domPage = stripInlineBoot(withBrief);
    expect(domPage.match(/<h1\b/g) ?? []).toHaveLength(1);
    const briefBlock = domPage.match(/<div class="reception-brief">([\s\S]*?)<\/div>/);
    expect(briefBlock, 'reception-brief block').not.toBeNull();
    expect(briefBlock[1]).not.toMatch(/<h[1-3]\b/);
    expect(briefBlock[1]).toContain('<h4>Sample Dump brief</h4>');

    // The dump without the layer tells the truth instead of leaving an empty slot.
    const withoutBrief = stripStickers(
      decodeEntities(await readFile(join(publicDir, 'dumps', 'sample-dump-two', 'index.html'), 'utf8')),
    );
    expect(withoutBrief).toContain(`<p class="reception-brief-heading">${BRIEF_HEADING}</p>`);
    expect(withoutBrief).toContain(`<p class="reception-brief-missing">${BRIEF_FALLBACK}</p>`);
  });

  it('KDV-SURFACE-19: the dump SSR ships the one-shot declaration toast as a hidden, dataset-wired live region', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const html = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');

    // §6.2/§6.6: a separate role="status" region, hidden in SSR, with its text
    // carried through the dataset (a pre-filled region would not announce).
    const toast = html.match(/<p class="declaration-toast"[^>]*>/);
    expect(toast, 'declaration toast element').not.toBeNull();
    expect(toast[0]).toContain('hidden');
    expect(toast[0]).toContain('role="status"');
    expect(decodeEntities(toast[0])).toContain(`data-toast-text="${DECLARATION_TOAST}"`);
    // It is not the pre-existing announcement region — that one keeps its ids.
    expect(toast[0]).not.toContain('a11y-status');
    expect(html).toMatch(/<p id="a11y-status"[^>]*role="status"/);
  });

  it('KDV-SURFACE-17: every built route ships the hidden species chip with its copy bindings', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    const routes = [
      'index.html',

      'about/index.html',
      'contribute/index.html',
      '404.html',
      'dumps/sample-dump/index.html',
    ];
    for (const route of routes) {
      const raw = await readFile(join(publicDir, ...route.split('/')), 'utf8');
      // §7.13: the chip lives in the shared header, so every route carries it.
      expect(raw, route).toContain('class="species-chip"');
      expect(raw, route).toContain('id="species-chip"');
      // §7.13: the status pill renders only the status text — the withdraw
      // action is a separate link outside it, not a control inside the pill.
      const pill = raw.match(/<span class="species-chip"[\s\S]*?<\/span><\/span>/);
      expect(pill, route).not.toBeNull();
      expect(pill[0], route).not.toMatch(/<(a|button|input|select|textarea)\b/);
      expect(raw, route).toMatch(
        new RegExp(
          `<a class="species-chip-withdraw"[^>]*data-withdraw[^>]*hidden[^>]*>${CHIP_WITHDRAW_LABEL}</a>`,
        ),
      );
      // The copydeck labels reach the client through the dataset (Handlebars
      // escapes the `<version>`/`<declared-at>` placeholders — decode first).
      const html = decodeEntities(raw);
      expect(html, route).toContain(`data-machine-label="${CHIP_MACHINE_TEMPLATE}"`);
      expect(html, route).toContain(`data-human-label="${CHIP_HUMAN_LABEL}"`);
      expect(html, route).toContain(`data-title-template="${CHIP_TITLE_TEMPLATE}"`);
    }
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

    expect(sitemap).not.toContain('/404</loc>');
  });

  it('KDV-SURFACE-11: every page ships server-rendered JSON-LD (@graph); dump previews carry the article summary plus the agent suffix', async () => {
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

    // The preview line is the manifest summary composed with the agent suffix —
    // the article's essence plus the agent-onboarding hook (feedback-marketing #1).
    const composed = `${summary} And a prompt to make your agent explain it to you.`;

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
    expect(nodeOf(dumpGraph, 'WebPage').description).toBe(composed);
    const article = nodeOf(dumpGraph, 'Article');
    expect(article).toMatchObject({
      headline: 'JSON-LD Dump',
      description: summary,
      abstract: composed,
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

    // Dump previews carry the article's essence plus the agent suffix — the
    // composed description (summary + suffix), never a static hook.
    const decoded = decodeEntities(dumpHtml);
    expect(decoded).toContain(`<meta name="description" content="${composed}">`);
    expect(decoded).toContain(`<meta property="og:description" content="${composed}">`);
    expect(decoded).toContain(`<meta name="twitter:description" content="${composed}">`);

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
    expect(html).toContain('<details class="card">');
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
    // §6.3: the optional summary.md brief is rendered into the dataset.
    expect(dumpData.brief_html).toContain('<h4>Sample Dump brief</h4>');
    expect(dumpData.brief_html).toContain('<strong>brief</strong>');

    // One route dataset per layout: input/data/<layout>/main.json.
    for (const layout of ['home', 'about', 'contribute', 'notfound']) {
      expect(await exists(join(dataDir, layout, 'main.json')), layout).toBe(true);
    }

    // The home dataset carries the feed list (built from index entries)…
    const home = JSON.parse(await readFile(join(dataDir, 'home', 'main.json'), 'utf8'));
    expect(Array.isArray(home.dumps)).toBe(true);
    expect(home.dumps[0].slug).toBe('sample-dump');
    expect(home.dumps[0].manifest_url).toBe(`${BASE_URL}/dumps/sample-dump/manifest.json`);
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
    // The declaration is inline and declarative only — the state-0 plates ship
    // hidden and the raw body plate is present, never a server-side withhold.
    expect(html).toMatch(/<section class="plate" id="plate-declaration"[^>]*hidden/);
    expect(html).toMatch(/<section class="plate" id="plate-dump"[^>]*>/);
    expect(html).toContain('class="hall"');
    // No user-agent branching in the emitted page.
    expect(html).not.toMatch(/User-Agent|navigator\.userAgent/);
  });

  it('KDV-ARCH-05: the blanket 18+ line is rendered on every route', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');
    const routes = [
      'index.html',

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

  it('KDV-MOBILE-10: the home feed and a dump page stay under the §6.5 gzip budget and pull no external resource', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // §6.5 performance budget: "dump page HTML size < 100KB gzipped (critical
    // for 3G)". The dump page's own ceiling, the system font stack and the
    // inlined logo are pinned by KDV-MOBILE-06 above; the reviewer's checklist
    // (docs/ideas/feedback-human_surface_v2_1.md §4 item 14) asks for the same
    // budget on `/`, so both page classes are measured here, against the
    // artifacts the build really emits.
    const pages = [
      ['index.html', '/'],
      ['dumps/sample-dump/index.html', '/dumps/<slug>/'],
    ];
    const built = [];
    for (const [file, label] of pages) {
      const html = await readFile(join(publicDir, ...file.split('/')), 'utf8');
      const gzipped = gzipSync(Buffer.from(html, 'utf8'));
      // Same zlib defaults as the KDV-MOBILE-06 measurement above.
      expect(gzipped.length, `${label} gzipped bytes`).toBeLessThan(100 * 1024);
      built.push({ label, html });
    }

    // §6.5 no external fonts / §6.4 no foreign origins. Two neighbouring legs
    // already exist and are NOT restated here: the served-page crawl over HTTP
    // (tests/e2e/seo.e2e.js, KDV-SURFACE-12 — cross-origin <link>, Google Fonts
    // and real font requests) and the stylesheet's system font stack plus the
    // absence of @font-face (tests/unit/a11y.test.js, KDV-MOBILE-06). This leg
    // is the build-artifact one: every absolute `<link>` on every page class
    // stays on the site's own origin, whatever resource it names — Google Fonts
    // or any other CDN. Same-origin absolutes (canonical, feed) are legitimate.
    const baseOrigin = new URL(BASE_URL).origin;
    for (const page of built) {
      for (const link of page.html.match(/<link\b[^>]*>/g) ?? []) {
        const href = (link.match(/\shref="([^"]*)"/) || [])[1];
        if (href && /^https?:\/\//i.test(href)) {
          expect(new URL(href).origin, `${page.label}: cross-origin <link> ${link}`).toBe(baseOrigin);
        }
      }
    }

    // §6.5/§6.4: the single shipped stylesheet (KDV-MOBILE-08) must not pull a
    // second sheet — or a font — through `@import`; a web font can arrive from
    // inside the CSS, not only as a `<link>`. Read as shipped, from the build.
    const css = await readFile(join(publicDir, 'assets', 'styles.css'), 'utf8');
    expect(css).not.toMatch(/@import\b/);

    // A comment body must never carry a nested `/*` (e.g. a glob such as
    // `templates/**/*.hbs`): its trailing `*/` closes the comment early and the
    // browser silently drops the next rule. Found live — the v2 legacy
    // `.species-declaration` rule vanished this way. The class is pinned here
    // rather than the one symptom.
    for (const comment of css.match(/\/\*[\s\S]*?\*\//g) ?? []) {
      expect(comment.slice(2, -2), comment.slice(0, 40)).not.toContain('/*');
    }
  });

  it('KDV-MOBILE-11: the hero CTA pair sits in a wrapping .cta-row flex container, on the home page and the 404', async () => {
    tmpRoot = await setupProject(['sample-dump']);
    const publicDir = join(tmpRoot, 'output', 'public');

    // §6.5: the two stamped doors are ONE flex row with the agent lane's wrap
    // gap — on a narrow screen they stack with an 8px row gap, never flush
    // against each other. The base rule covers every width (no media query).
    const css = await readFile(join(publicDir, 'assets', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.cta-row\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*gap:\s*var\(--sp-2\)/);

    // The same markup carries the class on both pages that render a `.cta`.
    const home = stripStickers(stripInlineBoot(decodeEntities(await readFile(join(publicDir, 'index.html'), 'utf8'))));
    expect(home).toContain('<p class="cta-row">');
    const notFound = stripStickers(
      stripInlineBoot(decodeEntities(await readFile(join(publicDir, '404.html'), 'utf8'))),
    );
    expect(notFound).toContain('<p class="cta-row">');
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
    // Building a 12-dump fixture now renders four locales (KDV-I18N-01); the
    // heavier build needs more than the 5s default when the suite runs in parallel.
  }, 30000);

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

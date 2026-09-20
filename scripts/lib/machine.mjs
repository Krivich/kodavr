/**
 * CONTRACT: scripts/lib/machine.mjs
 * ROLE: the machine-first surface: index.json, well-known, feeds, tags, sitemap
 * EXPORTS:
 *   AGENT_DUTIES — the four duties a machine signatory assumes (§7.1)
 *   CONSUMPTION_CONTRACT_SEE — the pointer to the consumption contract
 *   CONTENT_FLAGS_VOCABULARY — the allowed content_flags values
 *   CONTRACT_VERSION — the consumption-contract version literal
 *   DEFAULT_LICENSE — the default content licence
 *   ISSUES_URL — the repository Issues URL
 *   PLATFORM_ABOUT — the inline machine BIOS: what the platform is (one source)
 *   REPOSITORY — the owner/repo slug
 *   REPOSITORY_BRANCH — the default branch
 *   STAKES_VOCABULARY — the allowed stakes values
 *   TRUST_LEGEND_LEAD — the §6.1 storefront trust-legend lead line
 *   TRUST_LEVELS — the allowed trust_level values
 *   TRUST_LEVEL_MEANINGS — the ordered §2.2 level/meaning pairs
 *   buildAtom — an Atom feed document
 *   buildIndex — the /index.json document
 *   buildIndexEntry — the §5.1 per-dump index entry
 *   buildTagGraph — the /tags.json co-occurrence graph
 *   buildWellKnown — the /.well-known/kodavr.json protocol document
 *   collectHtmlFiles — every built HTML file under a directory
 *   escapeXml — escapes a value for XML
 *   injectBuildMeta — adds commit_sha, built_at, author, the schema and layer URLs to a manifest
 *   readGitHubEvent — reads the CI event payload
 *   resolveAuthorFromCi — the author block from the environment
 *   resolveAuthorMeta — the author block from an event payload
 *   resolveRepository — owner/repo from the environment or git config
 *   writeMachineFiles — writes index.json, schemas, well-known, feeds, tags, manifests
 *   writeSitemap — writes sitemap.xml over the built HTML
 * CONSUMES:
 *   ./schema.mjs — the self-describing JSON Schemas embedded in and served beside the machine files
 *   ./verbatim.mjs — the verbatim robots.txt / humans.txt
 *   node:fs — read files
 *   node:fs/promises — walk and write machine files
 *   node:path — join paths
 * INVARIANTS:
 *   — machine files are generated, never hand-edited
 */

// scripts/lib/machine.mjs — machine-readable platform contracts (§5).
// The controller builds these AFTER the dumb engine renders HTML:
// index.json, /.well-known/kodavr.json, Atom feeds, per-dump manifests,
// the verbatim robots.txt/humans.txt and the regenerated sitemap.xml.
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ROBOTS_TXT, HUMANS_TXT } from './verbatim.mjs';
import {
  buildIndexSchema,
  buildManifestSchema,
  INDEX_SCHEMA_ID,
  MANIFEST_SCHEMA_ID,
} from './schema.mjs';

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// §9/§A3: discussions live in the repository's GitHub Issues, and the same
// canonical repository is advertised in /.well-known/kodavr.json (§5.2). One
// constant, one truth — the dump page and the discovery document cannot drift.
export const REPOSITORY = 'https://github.com/krivich/kodavr';
export const ISSUES_URL = `${REPOSITORY}/issues`;
// P4c: links to repository-only files (docs/, static/, a dump-local schema) are
// rewritten to GitHub blob URLs on the published branch. One config, one truth:
// the canonical repository by default, a fork/CI overrides it with
// KODAVR_REPOSITORY (trailing slashes normalized away).
export const REPOSITORY_BRANCH = 'main';
export function resolveRepository(env = process.env) {
  const override = env?.KODAVR_REPOSITORY;
  return typeof override === 'string' && override.trim() !== ''
    ? override.trim().replace(/\/+$/, '')
    : REPOSITORY;
}

export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

// §4.1 defaults and the §2.4/§2.5 vocabularies — one source shared by the
// discovery document (§5.2) and the content validator.
export const DEFAULT_LICENSE = 'CC-BY-4.0';
export const CONSUMPTION_CONTRACT_SEE = '/.well-known/kodavr.json';
// §2.2: the trust scale is one ordered source — the level/meaning pairs, with
// the meanings taken verbatim from SPEC §2.2. TRUST_LEVELS derives from the
// same rows, so the storefront legend (§6.1) and the §5.2 discovery document
// can never drift from each other or from the spec.
export const TRUST_LEVEL_MEANINGS = [
  { level: 'raw', meaning: 'raw dump, verified by nothing' },
  { level: 'self-tested', meaning: 'author confirms: it works for them' },
  { level: 'community-tested', meaning: 'at least one external consumer confirmed' },
  { level: 'adapted', meaning: 'a derivative adaptation exists, published on the platform' },
  { level: 'library', meaning: 'the dump grew into a versioned library/package' },
];
export const TRUST_LEVELS = TRUST_LEVEL_MEANINGS.map((row) => row.level);

// §6.1/§2.2: the storefront legend's lead — one plain sentence that tells a
// newcomer who has never heard of Kodavr what the scale measures. Exported from
// the same source as the scale, so the page explains the list it actually shows.
export const TRUST_LEGEND_LEAD = "How far a dump's claims have been checked:";
export const STAKES_VOCABULARY = ['low', 'medium', 'high'];
export const CONTENT_FLAGS_VOCABULARY = [
  'unverified_claims',
  'professional_advice',
  'financial_advice',
  'medical_claims',
  'rough_language',
  'opinion',
  'experimental',
  'contains_code',
  'requires_expert_review',
];

// §5.2/§7.1: the consumption-contract version and the four duties a machine
// signatory assumes. One source: the discovery document, the §7.1 gate fence
// and the declaration toast all compose from these tokens.
export const CONTRACT_VERSION = '1.0';
export const AGENT_DUTIES = [
  'filter_for_user',
  'adapt_to_user_context',
  'attribute_source',
  'honor_stakes_and_flags',
];

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? '').replace(/\/+$/, '');
}

function dumpSlug(dump) {
  return dump.slug ?? dump.manifest.slug;
}

/**
 * §5.1 per-dump object for index.json.
 */
export function buildIndexEntry(dump, { baseUrl }) {
  const base = normalizeBaseUrl(baseUrl);
  const manifest = dump.manifest;
  const slug = dumpSlug(dump);
  // §5.1: the raw layer is the full dump. The index names it explicitly so a
  // machine downloads markdown instead of scraping the HTML projection.
  const rawLayer = Array.isArray(dump.layers) ? dump.layers.find((layer) => layer?.name === 'raw') : null;
  const bodyFile = rawLayer?.file ?? 'raw.md';
  const entry = {
    slug,
    url: `${base}/dumps/${slug}/`,
    manifest_url: `${base}/dumps/${slug}/manifest.json`,
    body_url: `${base}/dumps/${slug}/${bodyFile}`,
    title: manifest.title,
    type: manifest.type,
    domain: manifest.domain,
    tags: manifest.tags ?? [],
    stakes: manifest.stakes,
    content_flags: manifest.content_flags ?? [],
    trust_level: manifest.trust_level,
    date: manifest.date,
    generated_by: manifest.generated_by,
    human_review: manifest.human_review,
    summary: manifest.summary,
    artifacts_count: Array.isArray(manifest.artifacts) ? manifest.artifacts.length : 0,
    derived_from: manifest.derived_from ?? null,
  };
  // §5.6: a withdrawn dump keeps its stable URL and adds its status to the
  // index. Published dumps are not annotated — §5.1 has no `status` field.
  if (manifest.status === 'withdrawn') entry.status = 'withdrawn';
  return entry;
}

/**
 * §5.1/§5.2: a machine's first fetch is index.json (the §7.4 prompt), but it may
 * equally arrive at a published manifest (the §7.11 prompt from a shared article).
 * Both doors must transmit the SAME orientation ("BIOS") inline — a pointer can be
 * ignored, and a model only sees what is in the document it already holds. The
 * BIOS is one source, spread verbatim into index.json, the published manifest and
 * the discovery document; `download_field` names the exact field of the `dumps`
 * collection that holds the full dump.
 */
export const PLATFORM_ABOUT =
  'Kodavr is a registry of raw, unpolished first-hand experience. A dump is not written for a human to read directly — it is source material for the reader\'s agent, which adapts it and writes it up in the user\'s own context. Honor each dump\'s stakes and content_flags.';

// §5.2: the action rules that turn "honor stakes and content_flags" from a plea
// into a mechanism. Inline, because the agent may never follow the pointer.
const PLATFORM_INTERPRET =
  'Read a dump\'s own `stakes`, `content_flags`, `trust_level`, `license` and `author` before using it. stakes=high, or content_flags professional_advice / financial_advice / medical_claims / requires_expert_review → warn the user or refuse direct application. trust_level says how far the claims were checked, least to most: raw < self-tested < community-tested < adapted < library — for `raw` and `self-tested`, verify a claim before relying on it. Always attribute the dump by its `url` (+ `manifest_url`) and its `license`, write in the user\'s language, and adapt the material to the user\'s situation — never present it as verified fact or as your own.';

// §5.1/§5.2: the steps must work from BOTH doors — /index.json (the collection)
// and a single dump's manifest (a shared article) — and must name where the body
// actually is, so even a weak agent cannot mistake the manifest for the content.
const HOW_TO_CONSUME_STEPS = [
  'you may hold either `/index.json` (the whole collection) or a single dump\'s `manifest.json` — if you hold a manifest, apply these steps to that dump',
  'to pick from the collection, filter the `dumps` array by domain / tags / stakes / content_flags; if you hold a manifest, that dump is already picked',
  'download the dump\'s body — its `raw` layer: the entry\'s `body_url`, or in a manifest the layer whose `name` is `raw` (published at `/dumps/<slug>/raw.md`) — raw markdown, never the HTML page',
  'read the dump\'s manifest for metadata, artifacts and layers — the entry\'s `manifest_url`, or the `manifest.json` you already hold — and check each layer\'s `url`',
  'use the downloaded body as raw material: adapt it and write it up in the user\'s context and language; honor stakes and content_flags; attribute the dump by its `url` and `license`; never present it as verified fact or as your own',
];

function machineBios(baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  return {
    about: PLATFORM_ABOUT,
    index_url: `${base}/index.json`,
    how_to_consume: { download_field: 'dumps[].body_url', steps: HOW_TO_CONSUME_STEPS },
  };
}

/**
 * §5.1 main machine index, dumps sorted by date descending.
 */
export function buildIndex(dumps, { baseUrl, generatedAt } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const entries = dumps
    .map((dump) => buildIndexEntry(dump, { baseUrl: base }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    // §5.1: the index is self-describing — `$schema` names the URL and `schema`
    // embeds the same JSON Schema verbatim, so a machine orients without fetching.
    $schema: `${base}${INDEX_SCHEMA_ID}`,
    schema: buildIndexSchema({ baseUrl: base }),
    platform: 'kodavr',
    version: CONTRACT_VERSION,
    generated_at: generatedAt,
    base_url: base,
    total: entries.length,
    index_url: `${base}/index.json`,
    dumps: entries,
  };
}

/**
 * §11/§5.2 machine-readable tag graph, served at /tags.json alongside
 * index.json. This is a machine file, NOT a tag/domain HTML page (deferred to
 * §13): it exposes per-tag counts, the dumps carrying each tag and the
 * co-occurrence weight between two tags (the number of dumps carrying both).
 *
 * Deterministic by construction: tags are ordered by count desc then name asc;
 * dump slugs and related tags are sorted, so the same content always yields the
 * same bytes.
 */
export function buildTagGraph(dumps, { baseUrl, generatedAt } = {}) {
  const base = normalizeBaseUrl(baseUrl);

  // tag -> Set(slug). A tag repeated inside one manifest counts once per dump.
  const tagSlugs = new Map();
  // Each dump's unique tags, reused for the co-occurrence pass.
  const perDump = [];
  for (const dump of dumps) {
    const slug = dumpSlug(dump);
    const tags = [...new Set(Array.isArray(dump.manifest.tags) ? dump.manifest.tags : [])];
    perDump.push(tags);
    for (const tag of tags) {
      if (!tagSlugs.has(tag)) tagSlugs.set(tag, new Set());
      tagSlugs.get(tag).add(slug);
    }
  }

  // tag -> Map(otherTag -> weight): increment both directions per dump.
  const cooccurrence = new Map();
  for (const tag of tagSlugs.keys()) cooccurrence.set(tag, new Map());
  for (const tags of perDump) {
    for (const tag of tags) {
      for (const other of tags) {
        if (tag === other) continue;
        const weights = cooccurrence.get(tag);
        weights.set(other, (weights.get(other) ?? 0) + 1);
      }
    }
  }

  const tags = [...tagSlugs.entries()]
    .map(([tag, slugs]) => ({
      tag,
      count: slugs.size,
      dumps: [...slugs].sort(),
      related: [...cooccurrence.get(tag).entries()]
        .map(([other, weight]) => ({ tag: other, weight }))
        .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag)),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    generated_at: generatedAt,
    base_url: base,
    total_tags: tags.length,
    total_dumps: dumps.length,
    tags,
  };
}

/**
 * §5.2 discovery document served at /.well-known/kodavr.json.
 */
export function buildWellKnown({ baseUrl = '' } = {}) {
  return {
    platform: 'kodavr',
    version: CONTRACT_VERSION,
    description: 'Registry of raw experience dumps with machine-readable contracts',
    endpoints: {
      index: '/index.json',
      manifest_pattern: '/dumps/{slug}/manifest.json',
      dump_pattern: '/dumps/{slug}/',
      body_pattern: '/dumps/{slug}/{file}',
      feeds: ['/feeds/all.atom', '/feeds/{domain}.atom'],
      sitemap: '/sitemap.xml',
      tags: '/tags.json',
    },
    submission: {
      method: 'pull-request',
      repository: REPOSITORY,
      rules: '/CONTRIBUTING.md',
    },
    consumption_contract: {
      intended_consumer: 'machine',
      human_access: 'reception_only',
      human_route: 'instruct_to_own_agent',
      blanket_rating: '18+',
      spoofing_clause: 'human declaring machine status assumes full machine duties',
      agent_duties: AGENT_DUTIES,
    },
    ...machineBios(baseUrl),
    interpret: PLATFORM_INTERPRET,
    trust_levels: TRUST_LEVELS,
    stakes_vocabulary: STAKES_VOCABULARY,
    content_flags_vocabulary: CONTENT_FLAGS_VOCABULARY,
  };
}

function atomDate(date, fallback) {
  if (!date) return fallback;
  return /T/.test(date) ? date : `${date}T00:00:00Z`;
}

/**
 * §5.3 Atom feed. `domain` is optional: undefined builds the all-feed,
 * a domain name builds that domain's feed (entries filtered by domain).
 * Each entry links to the MANIFEST, never to the HTML page.
 */
export function buildAtom(dumps, { baseUrl, generatedAt, domain } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const scope = domain ? dumps.filter((dump) => dump.manifest.domain === domain) : dumps;
  const feedPath = domain ? `/feeds/${domain}.atom` : '/feeds/all.atom';
  const feedUrl = `${base}${feedPath}`;
  const feedTitle = domain ? `Kodavr — ${domain} dumps` : 'Kodavr — all dumps';

  const entries = [...scope]
    .sort((a, b) => String(b.manifest.date).localeCompare(String(a.manifest.date)))
    .map((dump) => {
      const manifest = dump.manifest;
      const manifestUrl = `${base}/dumps/${dumpSlug(dump)}/manifest.json`;
      const tags = Array.isArray(manifest.tags) ? manifest.tags : [];
      return [
        '  <entry>',
        `    <title>${escapeXml(manifest.title)}</title>`,
        `    <id>${escapeXml(manifestUrl)}</id>`,
        `    <updated>${escapeXml(atomDate(manifest.date, generatedAt))}</updated>`,
        `    <link rel="alternate" type="application/json" href="${escapeXml(manifestUrl)}"/>`,
        `    <link rel="via" href="${escapeXml(manifestUrl)}"/>`,
        `    <summary>${escapeXml(manifest.summary)}</summary>`,
        ...tags.map((tag) => `    <category term="${escapeXml(tag)}"/>`),
        '  </entry>',
      ].join('\n');
    });

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(feedTitle)}</title>`,
    `  <id>${escapeXml(feedUrl)}</id>`,
    `  <updated>${escapeXml(generatedAt)}</updated>`,
    `  <link rel="self" href="${escapeXml(feedUrl)}"/>`,
    `  <link rel="alternate" href="${escapeXml(`${base}/index.json`)}"/>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
}

/**
 * §3/§8.2 author attribution: the merged PR's GitHub account is the source of
 * `author.*`. Pure and injectable so it is unit-testable with fake metadata.
 * `GITHUB_ACTOR` is the documented fallback for `github` when the PR payload is
 * absent; `pr_url`/`merged_at` are only known from the event, so they stay null.
 */
export function resolveAuthorMeta({ env = {}, event = null } = {}) {
  const pr = event?.pull_request ?? null;
  return {
    github: pr?.user?.login ?? env.GITHUB_ACTOR ?? null,
    pr_url: pr?.html_url ?? null,
    merged_at: pr?.merged_at ?? null,
  };
}

/** Read the GitHub Actions event payload from `GITHUB_EVENT_PATH`, or null. */
export function readGitHubEvent(eventPath) {
  if (!eventPath) return null;
  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Build-time author metadata from the CI environment (§8.2). */
export function resolveAuthorFromCi(env = process.env) {
  return resolveAuthorMeta({ env, event: readGitHubEvent(env.GITHUB_EVENT_PATH) });
}

/**
 * §4.1/§8.2 provenance: inject build metadata (`commit_sha`, `built_at`,
 * `author.*`), derive the §4.1 defaults (`license`, `derived_from`,
 * `consumption_contract`) and attach the layers read from disk. Never drops an
 * existing field; an author-supplied value always wins over injected metadata.
 */
export function injectBuildMeta(manifest, { commitSha = null, builtAt, author = null, layers = null, baseUrl = null } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  // §4.1/§5.1: the published manifest is self-describing — `$schema` names the URL
  // and `schema` embeds the same JSON Schema verbatim, so an agent handed a shared
  // article's manifest still orients without fetching the well-known.
  const next = {
    $schema: `${base}${MANIFEST_SCHEMA_ID}`,
    schema: buildManifestSchema({ baseUrl: base }),
    ...manifest,
    commit_sha: commitSha,
    built_at: builtAt,
  };
  if (!next.license) next.license = DEFAULT_LICENSE;
  if (!('derived_from' in next)) next.derived_from = null;
  if (!next.consumption_contract) next.consumption_contract = { see: CONSUMPTION_CONTRACT_SEE };
  if (Array.isArray(layers)) {
    // §5.1: each layer file is published beside the manifest, so its URL is
    // derivable and stated — a machine downloads markdown, never scrapes HTML.
    next.layers = layers.map((layer) =>
      base && next.slug ? { ...layer, url: `${base}/dumps/${next.slug}/${layer.file}` } : { ...layer },
    );
  }
  // Author attribution is only meaningful when a PR/actor was actually seen.
  const hasAuthorMeta = Boolean(author && (author.github || author.pr_url || author.merged_at));
  if (next.author || hasAuthorMeta) {
    const existing = next.author ?? {};
    next.author = {
      github: existing.github ?? author?.github ?? null,
      pr_url: existing.pr_url ?? author?.pr_url ?? null,
      merged_at: existing.merged_at ?? author?.merged_at ?? null,
    };
  }
  return next;
}

/**
 * Write every machine contract into the public output directory.
 * @param {object} args
 * @param {string} args.outputDir - public root (e.g. output/public)
 * @param {Array<{slug: string, manifest: object, layers?: Array, dir?: string}>} args.dumps
 * @param {string} args.baseUrl
 * @param {string} args.generatedAt - ISO timestamp
 * @param {string|null} args.commitSha
 * @param {object|null} args.author - resolved merged-PR metadata (§8.2)
 */
export async function writeMachineFiles({
  outputDir,
  dumps,
  baseUrl,
  generatedAt,
  commitSha = null,
  author = null,
}) {
  const base = normalizeBaseUrl(baseUrl);
  const builtAt = generatedAt;

  await mkdir(outputDir, { recursive: true });

  const index = buildIndex(dumps, { baseUrl: base, generatedAt });
  await writeFile(join(outputDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  // §5.1/§4.1: both schemas are also served at their `$id`, so the embedded
  // `schema` and the served document are one source, byte-for-byte.
  const schemasDir = join(outputDir, 'schemas');
  await mkdir(schemasDir, { recursive: true });
  await writeFile(
    join(schemasDir, 'index.schema.json'),
    `${JSON.stringify(buildIndexSchema({ baseUrl: base }), null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(schemasDir, 'manifest.schema.json'),
    `${JSON.stringify(buildManifestSchema({ baseUrl: base }), null, 2)}\n`,
    'utf8',
  );

  // §11/§5.2: the tag graph is the machine-readable alternative to the
  // deferred tag/domain pages; same writer path as index.json.
  const tagGraph = buildTagGraph(dumps, { baseUrl: base, generatedAt });
  await writeFile(join(outputDir, 'tags.json'), `${JSON.stringify(tagGraph, null, 2)}\n`, 'utf8');

  const wellKnownDir = join(outputDir, '.well-known');
  await mkdir(wellKnownDir, { recursive: true });
  await writeFile(
    join(wellKnownDir, 'kodavr.json'),
    `${JSON.stringify(buildWellKnown({ baseUrl: base }), null, 2)}\n`,
    'utf8',
  );

  const feedsDir = join(outputDir, 'feeds');
  await mkdir(feedsDir, { recursive: true });
  await writeFile(join(feedsDir, 'all.atom'), buildAtom(dumps, { baseUrl: base, generatedAt }), 'utf8');

  const domains = [...new Set(dumps.map((dump) => dump.manifest.domain).filter(Boolean))].sort();
  for (const domain of domains) {
    await writeFile(
      join(feedsDir, `${domain}.atom`),
      buildAtom(dumps, { baseUrl: base, generatedAt, domain }),
      'utf8',
    );
  }

  await writeFile(join(outputDir, 'robots.txt'), ROBOTS_TXT, 'utf8');
  await writeFile(join(outputDir, 'humans.txt'), HUMANS_TXT, 'utf8');

  for (const dump of dumps) {
    const dir = join(outputDir, 'dumps', dumpSlug(dump));
    await mkdir(dir, { recursive: true });
    const manifest = injectBuildMeta(dump.manifest, {
      commitSha,
      builtAt,
      author,
      layers: dump.layers,
      baseUrl: base,
    });
    await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    // §5.1: every layer file is published at `/dumps/<slug>/<file>` so the
    // index's `body_url` and the manifest's `layers[].url` actually resolve.
    for (const layer of Array.isArray(dump.layers) ? dump.layers : []) {
      if (dump.dir && layer?.file) await copyFile(join(dump.dir, layer.file), join(dir, layer.file));
    }
  }
}

export async function collectHtmlFiles(dir) {
  const out = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
    }
  }
  await walk(dir);
  return out.sort();
}

/**
 * §11/KDV-I18N-04: a generated URL path → its locale and locale-neutral path
 * (`ru/about/` → `{ locale: 'ru', neutral: 'about/' }`), so the sibling locales
 * of one page collapse into a single alternate cluster in the sitemap.
 */
function splitLocale(urlPath, locales) {
  for (const { code, prefix } of locales) {
    if (!prefix) continue;
    const bare = prefix.replace(/^\//, '');
    if (urlPath === bare || urlPath.startsWith(`${bare}/`)) {
      return { locale: code, neutral: urlPath.slice(bare.length).replace(/^\//, '') };
    }
  }
  const fallback = locales.find(({ prefix }) => !prefix) ?? locales[0];
  return { locale: fallback?.code ?? null, neutral: urlPath };
}

/**
 * Regenerate sitemap.xml from the actual HTML files, mapping pretty URLs:
 * `dumps/<slug>/index.html` → `${baseUrl}/dumps/<slug>/`.
 *
 * §6.4 hygiene: the 404 page is served for arbitrary missing paths and is not a
 * canonical URL, so it is excluded; each dump's `lastmod` is its own manifest
 * date while other pages carry the build date; priority ranks home over dumps
 * over auxiliary routes.
 *
 * §11/KDV-I18N-04: every URL carries the `xhtml:link` alternates of the BUILT
 * locales that emit the same locale-neutral page (plus `x-default` → the default
 * locale's variant). A single-locale page is left without alternates — a locale
 * that is not emitted is never linked.
 */
export async function writeSitemap({ outputDir, baseUrl, dumps = [], generatedAt } = {}) {
  // Lazy import: a static `./i18n.mjs` edge would close the cycle
  // `machine → i18n → i18n-en → copy → machine` and break module init.
  const { LOCALES, DEFAULT_LOCALE } = await import('./i18n.mjs');
  const base = normalizeBaseUrl(baseUrl);
  const buildDate = generatedAt ?? new Date().toISOString();
  const dumpDates = new Map();
  for (const dump of dumps) {
    const date = dump.manifest?.date;
    if (date) dumpDates.set(`dumps/${dumpSlug(dump)}/`, date);
  }

  const files = await collectHtmlFiles(outputDir);
  const urls = [];
  // locale-neutral path → (locale code → absolute loc) for the alternate clusters.
  const clusters = new Map();
  for (const file of files) {
    const rel = relative(outputDir, file).split(sep).join('/');
    let urlPath = rel.replace(/\.html$/, '').replace(/\/index$/, '/');
    if (urlPath === 'index') urlPath = '';
    if (urlPath === '404') continue;
    const { locale, neutral } = splitLocale(urlPath, LOCALES);
    const isHome = urlPath === '';
    const isDump = dumpDates.has(urlPath);
    const loc = isHome ? `${base}/` : `${base}/${urlPath}`;
    urls.push({
      loc,
      lastmod: isDump ? dumpDates.get(urlPath) : buildDate,
      changefreq: 'weekly',
      priority: isHome ? '1.0' : isDump ? '0.8' : '0.5',
      neutral,
    });
    if (!clusters.has(neutral)) clusters.set(neutral, new Map());
    clusters.get(neutral).set(locale, loc);
  }

  const body = urls
    .map((url) => {
      const group = clusters.get(url.neutral);
      const variants = LOCALES.filter(({ code }) => group.has(code));
      const lines = [`    <loc>${escapeXml(url.loc)}</loc>`];
      if (variants.length > 1) {
        for (const { code, htmlLang } of variants) {
          lines.push(`    <xhtml:link rel="alternate" hreflang="${htmlLang}" href="${escapeXml(group.get(code))}"/>`);
        }
        const xDefault = group.get(DEFAULT_LOCALE) ?? group.get(variants[0].code);
        lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefault)}"/>`);
      }
      lines.push(
        `    <lastmod>${url.lastmod}</lastmod>`,
        `    <changefreq>${url.changefreq}</changefreq>`,
        `    <priority>${url.priority}</priority>`,
      );
      return ['  <url>', ...lines, '  </url>'].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    body,
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(join(outputDir, 'sitemap.xml'), xml, 'utf8');
}

/**
 * CONTRACT: scripts/lib/dumps.mjs
 * ROLE: reads content/dumps/* and turns each into an Ignition dataset
 * EXPORTS:
 *   buildLayers — the §4.1 layer list for the files a dump actually ships
 *   escapeHtml — escapes a value for an HTML attribute or text node
 *   readDumps — reads every content/dumps/<slug>/ (manifest + body files)
 *   toDataset — manifest + body → the engine's dump dataset
 * CONSUMES:
 *   ./copy.mjs — resolved copydeck slices for the dump page
 *   ./jsonld.mjs — the per-dump schema.org graph
 *   ./machine.mjs — the §5.1 index entry and provenance
 *   ./markdown.mjs — markdown → sanitized HTML
 *   ./pages.mjs — shared route constants and SEO fields
 *   node:fs — read the manifest and body files
 *   node:fs/promises — walk and read the dump directories
 *   node:path — join paths
 * INVARIANTS:
 *   — the manifest is the truth; the body is only rendered, never invented
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { renderMarkdown } from './markdown.mjs';
import { AGENT_HOOK, HIGH_STAKES_DISCLAIMER, withdrawnStub } from './copy.mjs';
import { DEFAULT_LICENSE, ISSUES_URL, REPOSITORY_BRANCH } from './machine.mjs';
import {
  dumpCopySlices,
  buildNav,
  HOME_TAGLINE,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  SITE_NAME,
  SITE_LOCALE,
} from './pages.mjs';
import {
  jsonldWebsite,
  jsonldWebpage,
  jsonldArticle,
  jsonldBreadcrumb,
  jsonldOrganization,
  serializeJsonLd,
} from './jsonld.mjs';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);
}

// §A11/§4.1 content layers. `raw` is mandatory (§3); `refined`/`summary` are
// only listed when the file exists on disk — the controller never invents them.
const LAYER_FILES = [
  { name: 'raw', file: 'raw.md' },
  { name: 'refined', file: 'refined.md' },
  { name: 'summary', file: 'summary.md' },
];

/** Build the §4.1 `layers` array from the layer files present on disk. */
export function buildLayers(presentFiles) {
  return LAYER_FILES.filter((layer) => presentFiles.has(layer.file)).map((layer) => ({
    name: layer.name,
    file: layer.file,
    fact_checked: false,
    author_voice: layer.name === 'raw',
  }));
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readDumps(contentDir) {
  let entries;
  try {
    entries = await readdir(contentDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const dumps = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(contentDir, entry.name);

    const manifestPath = join(dir, 'manifest.json');
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (err) {
      throw new Error(`Invalid dump manifest at ${manifestPath}: ${err.message}`);
    }

    const rawPath = join(dir, 'raw.md');
    let raw;
    try {
      raw = await readFile(rawPath, 'utf8');
    } catch (err) {
      throw new Error(`Missing dump body at ${rawPath}: ${err.message}`);
    }

    const presentFiles = new Set(['raw.md']);
    for (const layer of LAYER_FILES) {
      if (layer.name !== 'raw' && (await pathExists(join(dir, layer.file)))) {
        presentFiles.add(layer.file);
      }
    }

    // §A11/§6.3: summary.md is the author's brief for a human stranger. Read its
    // markdown (when the optional layer is on disk) so the dataset can carry the
    // rendered brief. Absent -> null; the dataset value stays falsy.
    let summary = null;
    const summaryPath = join(dir, 'summary.md');
    if (presentFiles.has('summary.md')) {
      summary = await readFile(summaryPath, 'utf8');
    }

    dumps.push({
      slug: manifest.slug || entry.name,
      dir,
      manifest,
      raw,
      summary,
      layers: buildLayers(presentFiles),
    });
  }

  dumps.sort((a, b) => a.slug.localeCompare(b.slug));
  return dumps;
}

// P4c: an artifact link must not 404 on the live site. Resolution order:
//   1. external URL (`https?://`) -> unchanged;
//   2. a file present at the repository root -> GitHub blob;
//   3. a file beside the manifest, inside the dump dir -> GitHub blob under
//      `content/dumps/<slug>/`;
//   4. otherwise the author-supplied `path_or_url` is left untouched (CI still
//      resolves it against the repo), never silently dropped.
// `path_or_url` itself is never rewritten: the machine contract keeps the
// repo-relative source value.
function artifactHref(pathOrUrl, { repoRoot, repoUrl, dumpDir }) {
  if (typeof pathOrUrl !== 'string' || /^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!repoUrl || !repoRoot) return pathOrUrl;

  const clean = pathOrUrl.split('#')[0].split('?')[0];
  const blob = (repoPath) => `${repoUrl}/blob/${REPOSITORY_BRANCH}/${repoPath}`;

  if (clean && existsSync(join(repoRoot, clean))) {
    return blob(clean.replace(/^\/+/, ''));
  }
  if (clean && dumpDir && existsSync(join(dumpDir, clean))) {
    return blob(relative(repoRoot, join(dumpDir, clean)).split(sep).join('/'));
  }
  return pathOrUrl;
}

// §6.4 article meta: a manifest date is a calendar date; an ISO timestamp is
// required for `article:published_time`. Build time comes from the caller.
function isoTimestamp(value) {
  if (!value) return null;
  return /T/.test(value) ? value : `${value}T00:00:00Z`;
}

// §6.3/KDV-SURFACE-10: the author's brief rides inside the reception block,
// below the block's own outline levels — the `sr-only` <h2 id="reception-title">
// and the brief section's <h3 class="reception-brief-heading">. An author's
// summary.md must never be able to break the page outline, so its headings are
// demoted below those levels: h1->h4, h2->h5, h3->h6 (deeper levels are already
// safe and are left as they are). The markdown renderer is the only producer of
// this HTML, so a small transform over its sanitized output is the whole job.
const BRIEF_HEADING_DEMOTION = { h1: 'h4', h2: 'h5', h3: 'h6' };

function demoteBriefHeadings(html) {
  return html.replace(/<(\/?)h([1-6])\b/g, (match, slash, level) => {
    const demoted = BRIEF_HEADING_DEMOTION[`h${level}`];
    return demoted ? `<${slash}${demoted}` : match;
  });
}

export function toDataset(dump, { baseUrl = '', logo = '', repoRoot = null, repoUrl = null, builtAt = null } = {}) {
  const { slug, manifest, raw, summary } = dump;
  const base = String(baseUrl ?? '').replace(/\/+$/, '');
  // §5.6/§9: a withdrawn dump keeps its URL and manifest, but its body is
  // replaced by a stub stating the reason. The manifest card is a separate
  // partial, so it survives the replacement.
  const withdrawn = manifest.status === 'withdrawn';
  const body = withdrawn ? withdrawnStub(manifest.withdrawal_reason) : raw;
  let body_html = renderMarkdown(body);
  // §7.9: high-stakes dumps carry the disclaimer at the top of the body.
  if (!withdrawn && manifest.stakes === 'high') {
    body_html = `<p class="high-stakes">${escapeHtml(HIGH_STAKES_DISCLAIMER)}</p>\n${body_html}`;
  }
  // "One truth per entity": the manifest title is metadata (the <title>, og and
  // the manifest card). The body may already carry its own title as a leading
  // H1; rendering the manifest title as well would duplicate the heading, so
  // the template only falls back to it when the body opens without an H1.
  const firstContentLine = body.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const body_has_title = /^\s{0,3}#\s+\S/.test(firstContentLine);
  // §6.5 artifacts: each entry carries a resolved `href` for the rendered link
  // (P4c) while `path_or_url` stays the repo-relative machine value.
  const artifacts = (Array.isArray(manifest.artifacts) ? manifest.artifacts : []).map((artifact) => ({
    ...artifact,
    href: artifactHref(artifact?.path_or_url, { repoRoot, repoUrl, dumpDir: dump.dir }),
  }));
  // §6.4/§A4: the dump page ships a server-rendered JSON-LD `@graph` — the
  // site-wide WebSite + WebPage plus an Article (the dump) and its breadcrumb.
  // The Article keeps the manifest `summary` as its description while the
  // preview line (`abstract`) is the platform agent hook; the same hook, not the
  // summary, is what the page's meta/og/twitter descriptions carry.
  const canonical = `${base}/dumps/${slug}/`;
  // §5.1/§7.11: the raw layer is the full dump. Its published URL, not the HTML
  // projection, is what a machine is handed — derived exactly as in index.json.
  const rawFile = (Array.isArray(dump.layers) ? dump.layers.find((layer) => layer?.name === 'raw')?.file : null) ?? 'raw.md';
  const bodyUrl = `${base}/dumps/${slug}/${rawFile}`;
  const manifestUrl = `${base}/dumps/${slug}/manifest.json`;
  const indexUrl = `${base}/index.json`;
  const image = `${base}${OG_IMAGE_PATH}`;
  const organization = jsonldOrganization({ name: SITE_NAME, url: `${base}/`, logo: image });
  const website = jsonldWebsite({ name: SITE_NAME, base, description: HOME_TAGLINE, image });
  const webpage = jsonldWebpage({
    websiteId: website['@id'],
    url: canonical,
    name: manifest.title,
    description: AGENT_HOOK,
  });
  const article = jsonldArticle({
    url: canonical,
    title: manifest.title,
    summary: manifest.summary,
    hook: AGENT_HOOK,
    datePublished: isoTimestamp(manifest.date),
    dateModified: builtAt ?? isoTimestamp(manifest.date),
    authorGithub: manifest.author?.github ?? null,
    organization,
    license: manifest.license ?? DEFAULT_LICENSE,
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    section: manifest.domain,
    image,
  });
  const breadcrumb = jsonldBreadcrumb({ base, url: canonical, title: manifest.title });
  return {
    slug,
    title: manifest.title,
    type: manifest.type,
    domain: manifest.domain,
    date: manifest.date,
    stakes: manifest.stakes,
    trust_level: manifest.trust_level,
    content_flags: manifest.content_flags,
    summary: manifest.summary,
    // §5.6/§9: the withdrawn status is visual on the page too.
    withdrawn,
    // §9: the dump page links to the repository's GitHub Issues.
    issues_url: ISSUES_URL,
    // §6.5 artifacts list: each entry renders as its own card (site/artifacts).
    artifacts,
    manifest_url: manifestUrl,
    // §5.1: the raw markdown beside the manifest — the machine's download, not
    // the HTML projection.
    body_url: bodyUrl,
    index_url: indexUrl,
    og_title: `${manifest.title} · ${manifest.stakes}`,
    // §6.4/P5b: the platform agent hook is the platform-level preview line for
    // dumps; the dump's own `summary` stays on the manifest card and in the
    // JSON-LD Article.description.
    og_description: AGENT_HOOK,
    // §6.4: absolute canonical URL; `og:*` stays absolute (consumed out of
    // context, §8.3); the social card is the site-wide 1200x630 PNG.
    canonical_url: canonical,
    og_url: canonical,
    og_image: image,
    og_image_width: OG_IMAGE_WIDTH,
    og_image_height: OG_IMAGE_HEIGHT,
    og_image_type: OG_IMAGE_TYPE,
    og_image_alt: `${manifest.title} — a Kodavr dump`,
    og_type: 'article',
    og_site_name: SITE_NAME,
    og_locale: SITE_LOCALE,
    robots: 'index,follow',
    // §6.4 article meta — dump pages only. `head.hbs` renders it behind the
    // presence of this object, so route pages never emit `article:*`.
    article: {
      published_time: isoTimestamp(manifest.date),
      modified_time: builtAt ?? isoTimestamp(manifest.date),
      section: manifest.domain,
      tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    },
    // §6.4: one `<script type="application/ld+json">` per page, already through
    // the safe serializer (no raw `</script>` can survive a manifest value).
    jsonld: serializeJsonLd([website, webpage, article, breadcrumb]),
    // §6.5: the shared header inlines this trusted asset instead of requesting
    // /logo.svg; og:image above stays a separate absolute canonical URL.
    logo_svg: logo,
    // §6.6: a dump is not one of the primary-nav routes, so no item is current.
    nav: buildNav(null),
    // §7.11: a dump page pins the prompt to its own canonical URL; `/reception/`
    // keeps the universal §7.4 prompt.
    copy: dumpCopySlices({ bodyUrl, manifestUrl, indexUrl }),
    body_has_title,
    body_html,
    // §6.3: the optional `summary.md` layer is the author's brief for a human
    // stranger, rendered through the same sanitized markdown pipeline as the
    // body, then demoted so it can never outrank the reception block's own
    // headings (§6.3/KDV-SURFACE-10). No layer on disk -> null, so the template
    // can tell the cases apart. `body_html` keeps the raw renderer output.
    brief_html: summary ? demoteBriefHeadings(renderMarkdown(summary)) : null,
  };
}

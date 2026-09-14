/**
 * CONTRACT: scripts/lib/pages.mjs
 * ROLE: datasets for the static human-surface routes (§6.1)
 * EXPORTS:
 *   HOME_TAGLINE — the home storefront tagline (SEO description)
 *   MANIFEST_LABELS — field labels for the human-readable manifest card
 *   OG_IMAGE_ALT — the OG image alt text
 *   OG_IMAGE_HEIGHT — the OG image height
 *   OG_IMAGE_PATH — the OG image path
 *   OG_IMAGE_TYPE — the OG image MIME type
 *   OG_IMAGE_WIDTH — the OG image width
 *   OG_TAGLINE — the social-card tagline (agent-facing framing)
 *   ROUTE_PAGES — the single-page routes the build moves to spec URLs
 *   SITE_LOCALE — the og:locale value
 *   SITE_NAME — the site name
 *   SITE_NAV — the primary navigation links
 *   buildNav — the nav array for a page whose path is current
 *   buildRouteDatasets — one dataset per layout route
 *   dumpCopySlices — the §7.10 copydeck slices a dump page needs
 *   readLogoSvg — reads the trusted wordmark for inlining
 * CONSUMES:
 *   ./copy.mjs — every human string (single source of truth)
 *   ./jsonld.mjs — the per-page schema.org graph
 *   ./machine.mjs — the §5.1 index entry and well-known document
 *   node:fs/promises — read the logo
 *   node:path — join paths
 * INVARIANTS:
 *   — templates never retype contract text: it comes from copy.mjs
 */

// scripts/lib/pages.mjs — datasets for the static human-surface routes (§6.1).
// The controller owns every route's data: prose that belongs to the copydeck is
// pulled from copy.mjs (single source of truth), the home feed reuses the §5.1
// index-entry shape, and SEO fields are assembled here — templates never retype
// contract text.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FOOTER_TEXT,
  GATE_TEXT,
  GATE_TITLE,
  GATE_MACHINE_LABEL,
  GATE_HUMAN_LABEL,
  RECEPTION_TEXT,
  RECEPTION_TITLE,
  PROMPT_TEXT,
  RECEPTION_COPY_LABEL,
  NOT_FOUND_TEXT,
  POST_GATE_LINE,
  COPIED_LABEL,
  COPIED_ANNOUNCEMENT,
  HALL_ANNOUNCEMENT,
  RECEPTION_ANNOUNCEMENT,
  RESET_LABEL,
  DISCUSS_LABEL,
  DUMP_DEFINITION,
  DUMP_LEAD,
  DUMP_PROMPT,
  DUMP_TAIL,
} from './copy.mjs';
import { buildIndexEntry, buildWellKnown } from './machine.mjs';
import {
  jsonldWebsite,
  jsonldWebpage,
  jsonldCollectionPage,
  jsonldItemList,
  serializeJsonLd,
} from './jsonld.mjs';

// Field labels for the human-readable manifest card (§6.3.3). Structural UI
// strings, not copydeck prose, so they live next to the route datasets.
export const MANIFEST_LABELS = Object.freeze({
  heading: 'Manifest',
  title: 'Title',
  type: 'Type',
  domain: 'Domain',
  date: 'Date',
  stakes: 'Stakes',
  content_flags: 'Content flags',
  trust_level: 'Trust level',
  summary: 'Summary',
  manifest: 'manifest.json',
  index: 'index.json',
});

export const HOME_TAGLINE =
  'A registry of raw experience — "dumps" — with a machine-readable contract. Share gears, not text.';

// §6.4: the social card speaks to the human who shares a dump, not to a crawler,
// so it leads with "read it through your agent" instead of the contract wording.
export const OG_TAGLINE =
  'A registry of raw experience — "dumps" — which you read through your favorite AI agent. Share gears, not text.';

// §6.6: the primary navigation is data, not markup. Every route dataset carries
// the same four links with at most one marked `current`; `site/header` renders
// the flag as `aria-current="page"`. Labels keep their pre-existing wording.
export const SITE_NAV = Object.freeze([
  { href: '/', label: 'home' },
  { href: '/reception/', label: 'reception' },
  { href: '/about/', label: 'about' },
  { href: '/contribute/', label: 'contribute' },
]);

/** The nav array for a page whose own path is `currentHref` (null = no match). */
export function buildNav(currentHref) {
  return SITE_NAV.map((item) => ({ ...item, current: item.href === currentHref }));
}

// §6.4: one social card for the whole site — a real 1200x630 PNG, published
// from `static/assets/og-default.png` (regenerate with `npm run og-image`).
// Exported so the dump dataset and the head partial cannot drift from it.
export const OG_IMAGE_PATH = '/assets/og-default.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = 'image/png';
export const OG_IMAGE_ALT = 'Kodavr — a registry of raw experience';
export const SITE_NAME = 'Kodavr';
export const SITE_LOCALE = 'en_US';

// Single-page routes: layout + dataset are always `main`; the engine writes
// `output/public/<layout>/main.html` and build.mjs moves it to the spec URL.
// `home` is the exception: it uses the engine's declarative pagination, which
// emits `<layout>/<dataset>/page/N.html` (no `<layout>/main.html`). build.mjs
// publishes page 1 to `/index.html` while the page files stay reachable.
export const ROUTE_PAGES = Object.freeze([
  { layout: 'home', to: 'index.html', dataset: 'main', paginated: true },
  { layout: 'reception', to: 'reception/index.html' },
  { layout: 'about', to: 'about/index.html' },
  { layout: 'contribute', to: 'contribute/index.html' },
  { layout: 'notfound', to: '404.html', cleanup: 'notfound' },
]);

// §6.5: the header logo ships inline (one less request, no FOUT). The source
// lives at `static/logo.svg`; the controller reads it at build time and every
// dataset carries it so the shared `site/header` partial can triple-stash it.
export async function readLogoSvg(staticDir) {
  return readFile(join(staticDir, 'logo.svg'), 'utf8');
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? '').replace(/\/+$/, '');
}

function commonPage({
  base,
  title,
  description,
  urlPath,
  logo,
  robots = 'index,follow',
  extraGraph = [],
  withJsonLd = true,
}) {
  const url = urlPath ? `${base}/${urlPath}` : `${base}/`;
  const image = `${base}${OG_IMAGE_PATH}`;
  // §6.6: `urlPath` is route-relative ('', 'reception/', '404'); the nav hrefs are
  // root-absolute, so normalize before matching the current item.
  const currentHref = urlPath ? `/${urlPath}` : '/';
  // §6.4/§A4: every indexable page ships a server-rendered JSON-LD `@graph`
  // (WebSite + WebPage) on top of the ordinary meta block. The 404 opts out.
  const website = jsonldWebsite({ name: SITE_NAME, base, description: HOME_TAGLINE, image });
  const webpage = jsonldWebpage({ websiteId: website['@id'], url, name: title, description });
  return {
    title,
    og_title: title,
    og_description: description,
    // §6.4: absolute canonical URL and social card. `og:*`/canonical stay
    // absolute on purpose (consumed out of context, §8.3) — the relativize pass
    // only touches HTML `href`/`src`.
    canonical_url: url,
    og_url: url,
    og_image: image,
    og_image_width: OG_IMAGE_WIDTH,
    og_image_height: OG_IMAGE_HEIGHT,
    og_image_type: OG_IMAGE_TYPE,
    og_image_alt: OG_IMAGE_ALT,
    og_type: 'website',
    og_site_name: SITE_NAME,
    og_locale: SITE_LOCALE,
    robots,
    logo_svg: logo,
    // §6.6: landmarks/nav are shared markup; the data says which route is current.
    nav: buildNav(currentHref),
    copy: { footer: FOOTER_TEXT },
    ...(withJsonLd ? { jsonld: serializeJsonLd([website, webpage, ...extraGraph]) } : {}),
  };
}

/**
 * Build the `home/main.json`, `reception/main.json`, `about/main.json`,
 * `contribute/main.json` and `notfound/main.json` datasets.
 *
 * @param {Array<{slug: string, manifest: object, raw: string}>} dumps
 * @param {{baseUrl?: string, logo?: string}} [options]
 * @returns {Record<string, object>} layout → dataset (dataset name is `main`)
 */
export function buildRouteDatasets(dumps, { baseUrl, logo } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const entries = dumps.map((dump) => buildIndexEntry(dump, { baseUrl: base }));
  const homeTitle = 'A registry for machines';
  const websiteId = `${base}/#website`;
  const itemListId = `${base}/#itemlist`;

  const home = {
    ...commonPage({
      base,
      title: homeTitle,
      description: HOME_TAGLINE,
      urlPath: '',
      logo,
      // §6.4: the storefront feed is a CollectionPage whose ItemList enumerates
      // the dumps (position, url, name) alongside the always-present WebPage.
      extraGraph: [
        jsonldCollectionPage({
          websiteId,
          url: `${base}/`,
          name: homeTitle,
          description: HOME_TAGLINE,
          itemListId,
        }),
        jsonldItemList({
          id: itemListId,
          items: entries.map((entry) => ({ url: entry.url, name: entry.title })),
        }),
      ],
    }),
    tagline: HOME_TAGLINE,
    // §7.10: the "what is a dump" story — the storefront's first thing after
    // the positioning line, laid out from its parts (definition/lead/prompt/tail).
    what_is_a_dump: {
      definition: DUMP_DEFINITION,
      lead: DUMP_LEAD,
      prompt: DUMP_PROMPT,
      tail: DUMP_TAIL,
    },
    index_url: `${base}/index.json`,
    well_known_url: `${base}/.well-known/kodavr.json`,
    feed_url: `${base}/feeds/all.atom`,
    trust_levels: buildWellKnown().trust_levels,
    dumps: entries,
  };

  const reception = {
    ...commonPage({
      base,
      title: 'Reception',
      description: 'How humans read Kodavr through their own agent.',
      urlPath: 'reception/',
      logo,
    }),
    copy: {
      footer: FOOTER_TEXT,
      reception: RECEPTION_TEXT,
      reception_title: RECEPTION_TITLE,
      prompt: PROMPT_TEXT,
      copy_label: RECEPTION_COPY_LABEL,
      copied_label: COPIED_LABEL,
      copied_announcement: COPIED_ANNOUNCEMENT,
      reset_label: RESET_LABEL,
    },
  };

  const about = {
    ...commonPage({
      base,
      title: 'About',
      description: 'The Kodavr manifesto, condensed.',
      urlPath: 'about/',
      logo,
    }),
    what_is_a_dump: {
      definition: DUMP_DEFINITION,
      lead: DUMP_LEAD,
      prompt: DUMP_PROMPT,
      tail: DUMP_TAIL,
    },
  };

  const contribute = {
    ...commonPage({
      base,
      title: 'Contribute',
      description: 'How to bring a dump to Kodavr.',
      urlPath: 'contribute/',
      logo,
    }),
  };

  const notfound = {
    ...commonPage({
      base,
      title: 'Dump not found',
      description: 'This dump does not exist.',
      urlPath: '404',
      logo,
      // §6.4: the 404 is served for arbitrary missing paths — never index it and
      // never advertise structured data for it.
      robots: 'noindex,follow',
      withJsonLd: false,
    }),
    copy: { footer: FOOTER_TEXT, notFound: NOT_FOUND_TEXT },
  };

  return { home, reception, about, contribute, notfound };
}

/**
 * Copy slices shared by dump pages: the §7 texts the hall must carry verbatim.
 */
export function dumpCopySlices() {
  return {
    // §6.6: the gate modal's accessible name/description and descriptive choice
    // names; the visible §7.1 digits and prose stay verbatim.
    gate: GATE_TEXT,
    gate_title: GATE_TITLE,
    gate_machine_label: GATE_MACHINE_LABEL,
    gate_human_label: GATE_HUMAN_LABEL,
    reception: RECEPTION_TEXT,
    reception_title: RECEPTION_TITLE,
    prompt: PROMPT_TEXT,
    copy_label: RECEPTION_COPY_LABEL,
    copied_label: COPIED_LABEL,
    copied_announcement: COPIED_ANNOUNCEMENT,
    // §6.6 announcements for the SSR role="status" region.
    hall_announcement: HALL_ANNOUNCEMENT,
    reception_announcement: RECEPTION_ANNOUNCEMENT,
    reset_label: RESET_LABEL,
    post_gate_line: POST_GATE_LINE,
    discuss_label: DISCUSS_LABEL,
    footer: FOOTER_TEXT,
    labels: MANIFEST_LABELS,
  };
}

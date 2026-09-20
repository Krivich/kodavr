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
 *   dumpCopySlices — the §7.1–7.12 copydeck slices a dump page needs
 *   FOOTER_REPORT_URL — the §7.3 report link (new Issue, risk template preselected)
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
  FOOTER_LICENCES,
  FOOTER_CONTRACT,
  FOOTER_REPORT_LABEL,
  GATE_TITLE,
  GATE_KICKER,
  GATE_HOOK,
  GATE_REST,
  GATE_DUTIES_LEAD,
  GATE_DUTIES,
  GATE_MACHINE_LABEL,
  GATE_HUMAN_LABEL,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  RECEPTION_RATING,
  RECEPTION_TITLE,
  RECEPTION_WALL,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_NOTE_PLATFORM,
  BRIEF_CTA,
  BRIEF_REPORT,
  BRIEF_FALLBACK,
  PROMPT_TEXT,
  LANE_COPY_LABEL,
  NOT_FOUND_TEXT,
  POST_GATE_LINE,
  COPIED_LABEL,
  CHIP_MACHINE_TEMPLATE,
  CHIP_HUMAN_LABEL,
  CHIP_TITLE_TEMPLATE,
  CHIP_WITHDRAW_LABEL,
  COPIED_ANNOUNCEMENT,
  DECLARATION_TOAST,
  HALL_ANNOUNCEMENT,
  RECEPTION_ANNOUNCEMENT,
  RESET_HUMAN_LABEL,
  RESET_LABEL,
  DISCUSS_LABEL,
  DUMP_DEFINITION,
  DUMP_LEAD,
  DUMP_PROMPT,
  DUMP_TAIL,
  HOME_HUMAN_LINE,
  BRAND_SLOGAN_LEAD,
  BRAND_SLOGANS_MUTED,
  AGENT_LANE_LEAD,
  AGENT_LANE_LEAD_KODAVR,
  AGENT_LANE_HINT,
  agentLinks,
  dumpPrompt,
} from './copy.mjs';
import {
  ISSUES_URL,
  CONTRACT_VERSION,
  TRUST_LEGEND_LEAD,
  TRUST_LEVEL_MEANINGS,
  buildIndexEntry,
  buildWellKnown,
} from './machine.mjs';
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

// §7.3/§9: the footer's visible report/takedown channel. GitHub's new-Issue form
// with the risk template preselected — reachable in one click from every page;
// the label is copy.mjs's one truth (`risk-report.md` matches the template file).
export const FOOTER_REPORT_URL = `${ISSUES_URL}/new?template=risk-report.md`;

// §7.3: the titleblock's four cells are ONE dataset slice carried by every route
// (the shared `commonPage`, the reception/404 overrides and the dump slices all
// spread it), so the footer cannot drift between surfaces. The cell values are
// the copydeck's one truth (copy.mjs); only the report URL is assembled here.
const FOOTER_COPY = Object.freeze({
  footer: FOOTER_TEXT,
  footer_licences: FOOTER_LICENCES,
  footer_contract: FOOTER_CONTRACT,
  footer_report_label: FOOTER_REPORT_LABEL,
  footer_report_url: FOOTER_REPORT_URL,
});

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

// §7.13: the header species status chip's copydeck strings. They ride with
// `copy.footer` so every route — including the 404 and the dump hall — renders
// the same hidden skeleton from the one source in copy.mjs.
const CHIP_COPY = {
  chip_machine_template: CHIP_MACHINE_TEMPLATE,
  chip_human_label: CHIP_HUMAN_LABEL,
  chip_title_template: CHIP_TITLE_TEMPLATE,
  chip_withdraw_label: CHIP_WITHDRAW_LABEL,
};

function commonPage({
  base,
  title,
  description,
  urlPath,
  logo,
  robots = 'index,follow',
  extraGraph = [],
  withJsonLd = true,
  extraCopy = {},
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
    copy: {
      // §6.2: the shipped contract version reaches head.hbs; site.js compares it
      // with the stored declaration record and re-asks after a bump.
      contract_version: CONTRACT_VERSION,
      // §7.13: the header chip's copydeck strings, on every route.
      ...CHIP_COPY,
      // §7.3: the titleblock's four cells, one source for every route.
      ...FOOTER_COPY,
      // Route-specific copydeck strings (e.g. the home human line, the About
      // slogans) ride in through `extraCopy`, so the shared skeleton stays one place.
      ...extraCopy,
    },
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
      // §7.14: the "For humans" block's quickstart line, from the copydeck.
      extraCopy: { home_human_line: HOME_HUMAN_LINE },
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
    // §2.2/§6.1: the storefront legend — one lead + the five level/meaning
    // pairs. The pairs are the same ordered table the §5.2 `trust_levels` list
    // derives from (machine.mjs), so the page cannot invent its own meanings.
    trust_legend: {
      lead: TRUST_LEGEND_LEAD,
      levels: TRUST_LEVEL_MEANINGS,
    },
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
      contract_version: CONTRACT_VERSION,
      ...CHIP_COPY,
      // §7.3: the titleblock's four cells (advisory · licences · contract · report).
      ...FOOTER_COPY,
      // §7.2 v2: the wall and the rating are separate from the brief tier, so
      // the template renders each exactly once (no text on screen twice).
      reception_wall: RECEPTION_WALL,
      reception_rating: RECEPTION_RATING,
      reception_title: RECEPTION_TITLE,
      // §6.3/§7.2 v2: the reception block's third tier. /reception/ has no dump
      // and no `brief_html`; its middle is the platform note, never the
      // dump-oriented fallback (which would promise a manifest not on the page).
      brief_heading: BRIEF_HEADING,
      brief_note_platform: BRIEF_NOTE_PLATFORM,
      brief_cta: BRIEF_CTA,
      brief_report: BRIEF_REPORT,
      prompt: PROMPT_TEXT,
      lane_lead: AGENT_LANE_LEAD_KODAVR,
      agent_lane_hint: AGENT_LANE_HINT,
      agent_links: agentLinks(PROMPT_TEXT),
      copy_label: LANE_COPY_LABEL,
      copied_label: COPIED_LABEL,
      copied_announcement: COPIED_ANNOUNCEMENT,
      reset_label: RESET_LABEL,
    },
  };

  const about = {
    ...commonPage({
      base,
      title: 'Why Kodavr exists',
      description: 'The Kodavr manifesto, condensed.',
      urlPath: 'about/',
      logo,
      // §7.15: all three brand slogans from one source — the lead renders as-is,
      // the other two as the muted tail.
      extraCopy: {
        brand_slogan_lead: BRAND_SLOGAN_LEAD,
        brand_slogans_muted: BRAND_SLOGANS_MUTED,
      },
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
    copy: {
      contract_version: CONTRACT_VERSION,
      ...CHIP_COPY,
      // §7.3: the titleblock's four cells (advisory · licences · contract · report).
      ...FOOTER_COPY,
      notFound: NOT_FOUND_TEXT,
    },
  };

  return { home, reception, about, contribute, notfound };
}

/**
 * Copy slices shared by dump pages: the §7 texts the hall must carry verbatim.
 * §7.11: with a manifest URL the prompt is the bare boot address to that dump's
 * manifest; without it, the universal §7.4 prompt.
 */
export function dumpCopySlices({ manifestUrl = null } = {}) {
  const prompt = manifestUrl ? dumpPrompt(manifestUrl) : PROMPT_TEXT;
  return {
    // §6.2: the shipped contract version reaches head.hbs on dump pages too;
    // site.js compares it with the stored declaration record and re-asks on a bump.
    contract_version: CONTRACT_VERSION,
    // §7.13: the dump hall's header chip uses the same copydeck skeleton.
    ...CHIP_COPY,
    // §6.6: the gate modal's accessible name/description; the visible §7.1 v2
    // prose stays verbatim — kicker, H1, hook and the duties line lead the
    // first screen, the full declaration sits below the fold. The machine panel
    // leads with the same hook.
    gate_kicker: GATE_KICKER,
    gate_title: GATE_TITLE,
    gate_hook: GATE_HOOK,
    gate_duties_lead: GATE_DUTIES_LEAD,
    gate_duties: GATE_DUTIES,
    gate_rest: GATE_REST,
    gate_machine_label: GATE_MACHINE_LABEL,
    gate_human_label: GATE_HUMAN_LABEL,
    // §6.5 P0-1: each door renders the §7.1 choice line as its visible label
    // (the digit is a separate badge), so the label needs its own copy key.
    gate_machine_door: GATE_MACHINE_DOOR,
    gate_human_door: GATE_HUMAN_DOOR,
    // §7.2 v2: the wall, the brief tier and the 18+ rating render as separate
    // elements, so the reception block never prints any line twice.
    reception_wall: RECEPTION_WALL,
    reception_rating: RECEPTION_RATING,
    reception_title: RECEPTION_TITLE,
    // §6.3/§7.2 v2: the reception block's brief tier — the rendered `summary.md`
    // (`brief_html`, wired by the dump dataset, falsy without the layer) is the
    // real payload; these are the surrounding heading/note/CTA/report and the
    // honest fallback for the missing layer.
    brief_heading: BRIEF_HEADING,
    brief_note: BRIEF_NOTE,
    brief_cta: BRIEF_CTA,
    brief_report: BRIEF_REPORT,
    brief_fallback: BRIEF_FALLBACK,
    prompt,
    // §7.12: the human fast lane renders once per surface (the gate dialog and
    // the reception block each pass their own copy target).
    lane_lead: AGENT_LANE_LEAD,
    agent_lane_hint: AGENT_LANE_HINT,
    agent_links: agentLinks(prompt),
    copy_label: LANE_COPY_LABEL,
    copied_label: COPIED_LABEL,
    copied_announcement: COPIED_ANNOUNCEMENT,
    // §6.6 announcements for the SSR role="status" region.
    hall_announcement: HALL_ANNOUNCEMENT,
    reception_announcement: RECEPTION_ANNOUNCEMENT,
    reset_label: RESET_LABEL,
    // §6.2: the machine panel's reset link (hall header, machine-declared).
    reset_human_label: RESET_HUMAN_LABEL,
    post_gate_line: POST_GATE_LINE,
    // §6.2/§6.6: the one-shot declaration toast, shown when the visitor enters
    // the hall by pressing "0". The text reaches the DOM through the dataset.
    declaration_toast: DECLARATION_TOAST,
    discuss_label: DISCUSS_LABEL,
    // §7.3: the titleblock's four cells, the same one source every route spreads.
    ...FOOTER_COPY,
    labels: MANIFEST_LABELS,
  };
}

/**
 * CONTRACT: scripts/lib/pages.mjs
 * ROLE: datasets for the static human-surface routes (§6.1)
 * EXPORTS:
 *   COPY_FIELDS — the dataset copy field groups the route and dump surfaces assemble
 *   FOOTER_REPORT_URL — the §7.3 report link (new Issue, risk template preselected)
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
 *   agentLinksFor — the §7.12 jump links with the localized prompt pre-filled
 *   buildNav — the nav array for a page whose path is current
 *   buildAlternates — the hreflang alternate cluster for a page's built locales
 *   buildLanguages — the header switcher entries (same page, each built locale)
 *   ogLocaleAlternates — the `og:locale:alternate` codes for a page's other locales
 *   buildRouteDatasets — one dataset per layout route
 *   catalogKeyFor — a dataset field name → its catalog key (null when not catalog-backed)
 *   routeOutputPath — a { locale, layout, key } coordinate → its public-relative path
 *   copyField — one dataset field resolved through `t` for a locale
 *   copyFields — a field list resolved into a `{ field: value }` object
 *   dumpCopySlices — the §7.1–7.12 copydeck slices a dump page needs
 *   promptFor — the universal or per-dump boot prompt for a locale
 *   readLogoSvg — reads the trusted wordmark for inlining
 * CONSUMES:
 *   ./i18n.mjs — the locale registry, the default locale and the translator
 *   ./i18n-en.mjs — the English copy catalog
 *   ./jsonld.mjs — the per-page schema.org graph
 *   ./machine.mjs — the §5.1 index entry and well-known document
 *   node:fs/promises — read the logo
 *   node:path — join paths
 * INVARIANTS:
 *   — templates never retype contract text: it comes from the locale catalog
 *   — a copy field is catalog-backed, or explicitly non-catalog
 */

// scripts/lib/pages.mjs — datasets for the static human-surface routes (§6.1).
// The controller owns every route's data: prose that belongs to the copydeck is
// resolved from the locale catalog (surface-copy.mjs), the home feed reuses the
// §5.1 index-entry shape, and SEO fields are assembled here — templates never
// retype contract text.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ISSUES_URL,
  CONTRACT_VERSION,
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
import { DEFAULT_LOCALE, getLocale, t, translatedLocales } from './i18n.mjs';
import { EN } from './i18n-en.mjs';

// §11/KDV-I18N-07 phase 4a: a dataset field's catalog key is its uppercased
// name (`gate_title` → `GATE_TITLE`); these few copydeck names differ.
const KEY_EXCEPTIONS = Object.freeze({
  footer: 'FOOTER_TEXT',
  notFound: 'NOT_FOUND_TEXT',
  copy_label: 'LANE_COPY_LABEL',
  prompt: 'PROMPT_TEXT',
  labels: 'MANIFEST_LABELS',
  agent_links: 'AGENT_LINKS',
  lane_lead: 'AGENT_LANE_LEAD',
});

// Fields that are not translated prose: the shipped contract version and the
// assembled report URL stay literal on every locale.
const NON_CATALOG = new Set(['contract_version', 'footer_report_url']);

// catalogKeyFor(field) → the catalog key backing a dataset field, or null for a
// non-catalog field. The key is derived once, never retyped per surface.
export function catalogKeyFor(field) {
  if (NON_CATALOG.has(field)) return null;
  return KEY_EXCEPTIONS[field] ?? field.toUpperCase();
}

// copyField(field, locale, params) → the localized value.
export function copyField(field, locale, params) {
  const key = catalogKeyFor(field);
  if (!key) throw new Error(`pages: dataset field "${field}" is not catalog-backed`);
  return t(key, locale, params);
}

// copyFields(fields, locale) → `{ field: value }` for a whole group, in order.
export function copyFields(fields, locale) {
  return Object.fromEntries(fields.map((field) => [field, copyField(field, locale)]));
}

// promptFor(locale, { manifestUrl }) → the universal §7.4 prompt, or the §7.11
// bare boot address to a dump's own manifest.
export function promptFor(locale, { manifestUrl = null } = {}) {
  return manifestUrl ? t('PROMPT_TEMPLATE', locale, { url: manifestUrl }) : copyField('prompt', locale);
}

// agentLinksFor(locale, prompt) → the §7.12 jump targets with the prompt
// pre-filled where the agent supports it (brand labels stay).
export function agentLinksFor(locale, prompt) {
  return t('AGENT_LINKS', locale).map((agent) => ({
    id: agent.id,
    label: agent.label,
    href: agent.prefill ? `${agent.href}?${agent.prefill}=${encodeURIComponent(prompt)}` : agent.href,
  }));
}

// The field groups the surfaces spread, in the order their objects carry them.
export const COPY_FIELDS = Object.freeze({
  ui: Object.freeze([
    'skip_to_content',
    'nav_primary',
    'feed_title',
    'back_to_feed',
    'footer_cell_advisory',
    'footer_cell_licences',
    'footer_cell_contract',
    'footer_cell_report',
    'gate_or',
    'gate_doors_label',
    'artifacts_heading',
    'artifacts_empty',
    'home_about_cta',
    'home_contribute_cta',
    'home_explainer',
    'home_for_machines',
    'home_humans_lead',
    'home_latest_lead',
    'home_latest_term',
    'home_trust_levels',
    'pagination_label',
    'pagination_prev',
    'pagination_next',
    'reception_kicker',
    'reception_lead',
    'not_found_kicker',
    'not_found_note',
    'not_found_cta',
    // §11/KDV-I18N-09: the numbered section-plate labels (`01 · humans`),
    // bound as `data-plate` attributes. They travel with every route/dump dataset
    // through this one UI group, so no template retypes a plate again.
    'home_plate_machines',
    'home_plate_humans',
    'home_plate_latest',
    'home_plate_trust',
    'about_plate_manifesto',
    'about_plate_authors',
    'about_plate_readers',
    'about_plate_mechanism',
    'about_plate_architecture',
    'about_plate_colophon',
    'contribute_plate_authors',
    'contribute_plate_flow',
    'contribute_plate_schema',
    'contribute_plate_licences',
    'reception_plate_checkin',
    'dumps_plate_artifacts',
    // §6.2 v4/KDV-SURFACE-28: the article page's inline-plate labels.
    'dumps_plate_preview',
    'dumps_plate_want',
    'dumps_plate_declaration',
    'dumps_plate_dump',
    'notfound_plate_void',
    // §11/KDV-I18N-06: the header language switcher and its intelligent hint.
    'lang_switch_label',
    'lang_hint',
  ]),
  chip: Object.freeze([
    'chip_machine_template',
    'chip_human_label',
    'chip_title_template',
    'chip_withdraw_label',
  ]),
  footer: Object.freeze(['footer', 'footer_licences', 'footer_contract', 'footer_report_label']),
  brand: Object.freeze(['brand_slogan_lead', 'brand_slogans_muted']),
  about: Object.freeze([
    'about_kicker',
    'about_lead',
    'about_no_fear',
    'about_for_authors_heading',
    'about_for_authors_lead',
    'about_authors_raw_title',
    'about_authors_raw_body',
    'about_authors_pr_title',
    'about_authors_pr_body',
    'about_authors_field_title',
    'about_authors_field_body',
    'about_authors_attribution_title',
    'about_authors_attribution_body',
    'about_for_readers_heading',
    'about_for_readers_lead',
    'about_readers_adaptation_title',
    'about_readers_adaptation_body',
    'about_readers_synthesis_title',
    'about_readers_synthesis_body',
    'about_readers_trust_title',
    'about_readers_trust_body',
    'about_readers_stream_title',
    'about_readers_stream_body',
    'about_mechanism_heading',
    'about_mechanism_step1',
    'about_mechanism_step2',
    'about_mechanism_step3',
    'about_arch_heading',
    'about_arch_raw_title',
    'about_arch_raw_body',
    'about_arch_contract_title',
    'about_arch_contract_body_lead',
    'about_arch_contract_body_tail',
    'about_arch_cheap_title',
    'about_arch_cheap_body',
    'about_arch_safety_title',
    'about_arch_safety_body',
    'about_arch_trust_title',
    'about_arch_trust_body',
    'about_decisions_label',
  ]),
  contribute: Object.freeze([
    'contribute_kicker',
    'contribute_lead',
    'contribute_bring_heading',
    'contribute_step_fork_lead',
    'contribute_step_fork_and',
    'contribute_step_pr',
    'contribute_step_ci',
    'contribute_schema_heading',
    'contribute_schema_required',
    'contribute_check_secrets',
    'contribute_check_examples',
    'contribute_check_redactions_lead',
    'contribute_check_redactions_tail',
    'contribute_check_stakes',
    'contribute_check_generated_by',
    'contribute_check_heavy',
    'contribute_licences_heading',
    'contribute_licences_lead',
    'contribute_house_rules_label',
    'contribute_issues_label',
  ]),
  gate: Object.freeze([
    'gate_kicker',
    'gate_title',
    'gate_dump_context_lead',
    'gate_hook',
    'gate_duties_lead',
    'gate_duties',
    'gate_rest',
    'gate_machine_label',
    'gate_human_label',
    'gate_machine_door',
    'gate_machine_note',
    'gate_human_door',
    'gate_human_note',
  ]),
  dumpBrief: Object.freeze([
    'brief_heading',
    'brief_note',
    'brief_cta',
    'brief_report',
    'brief_fallback',
  ]),
  notfound: Object.freeze(['notFound']),
});

// §6.3.3/§11: the human-readable manifest card labels. One source — the English
// bundle's `MANIFEST_LABELS` — so a locale switch localizes the card too.
export const MANIFEST_LABELS = EN.MANIFEST_LABELS;

// §11/KDV-I18N-07: the storefront and social taglines are catalog entries; these
// exports stay for the OG-image generator and the surface tests.
export const HOME_TAGLINE = EN.HOME_TAGLINE;

// §6.4: the social card speaks to the human who shares a dump, not to a crawler,
// so it leads with "read it through your agent" instead of the contract wording.
export const OG_TAGLINE = EN.OG_TAGLINE;

// §6.6: the primary navigation is data, not markup. Every route dataset carries
// the same four links with at most one marked `current`; `site/header` renders
// the flag as `aria-current="page"`. Labels keep their pre-existing wording.
export const SITE_NAV = Object.freeze([
  { href: '/', label: 'home' },
  { href: '/about/', label: 'about' },
  { href: '/contribute/', label: 'contribute' },
]);

// §11/KDV-I18N-07 phase 4a: the nav labels are catalog strings; the hrefs carry
// the locale prefix (phase 2). One mapping, never a retyped label.
const NAV_LABEL_KEYS = Object.freeze({
  home: 'NAV_HOME',
  about: 'NAV_ABOUT',
  contribute: 'NAV_CONTRIBUTE',
});

/** The nav array for a page whose own path is `currentHref` (null = no match). */
export function buildNav(currentHref, locale = DEFAULT_LOCALE) {
  const { prefix } = getLocale(locale);
  return SITE_NAV.map((item) => {
    const href = `${prefix}${item.href}`;
    return { ...item, label: t(NAV_LABEL_KEYS[item.label], locale), href, current: href === currentHref };
  });
}

// §7.3/§9: the footer's visible report/takedown channel. GitHub's new-Issue form
// with the risk template preselected — reachable in one click from every page;
// the label is copy.mjs's one truth (`risk-report.md` matches the template file).
export const FOOTER_REPORT_URL = `${ISSUES_URL}/new?template=risk-report.md`;

// §7.3: the titleblock's four cells are ONE dataset slice carried by every route
// (the shared `commonPage`, the 404 override and the dump slices all
// spread it), so the footer cannot drift between surfaces. The copydeck cells
// resolve through the locale catalog; only the report URL is assembled here.
function footerCopy(locale) {
  return { ...copyFields(COPY_FIELDS.footer, locale), footer_report_url: FOOTER_REPORT_URL };
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
  { layout: 'about', to: 'about/index.html' },
  { layout: 'contribute', to: 'contribute/index.html' },
  { layout: 'notfound', to: '404.html', cleanup: 'notfound' },
]);

// routeOutputPath({ locale, layout, key, paginated }) → the public-relative
// output path for a dataset coordinate. UI routes get the locale's URL prefix;
// a dump (`layout: 'dumps'`, `key` = slug) gets `<prefix>/dumps/<key>/`. The 404
// is single and default-locale only (per-locale 404 is deferred) — null elsewhere.
export function routeOutputPath({ locale, layout, key, paginated = false }) {
  const { prefix } = getLocale(locale);
  if (layout === 'dumps') {
    return prefix ? `${prefix}/dumps/${key}/index.html` : `dumps/${key}/index.html`;
  }
  const page = ROUTE_PAGES.find((route) => route.layout === layout);
  if (!page) throw new Error(`pages: no route for layout "${layout}"`);
  if (layout === 'notfound') return locale === DEFAULT_LOCALE ? page.to : null;
  return prefix ? `${prefix}/${page.to}` : page.to;
}

// §6.5: the header logo ships inline (one less request, no FOUT). The source
// lives at `static/logo.svg`; the controller reads it at build time and every
// dataset carries it so the shared `site/header` partial can triple-stash it.
export async function readLogoSvg(staticDir) {
  return readFile(join(staticDir, 'logo.svg'), 'utf8');
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? '').replace(/\/+$/, '');
}

// §11/KDV-I18N-04: the hreflang alternate cluster for a locale-neutral page path
// ('' for home, 'about/', 'dumps/<slug>/'). Only the BUILT locales enter the
// cluster — a locale that is not emitted is never linked. `x-default` names the
// default locale's variant; every href is an absolute canonical URL.
export function buildAlternates(urlPath, { base = '', locales = translatedLocales() } = {}) {
  const root = normalizeBaseUrl(base);
  const variants = locales.map((code) => {
    const { prefix, htmlLang } = getLocale(code);
    const path = prefix
      ? (urlPath ? `${prefix}/${urlPath}` : `${prefix}/`)
      : (urlPath ? `/${urlPath}` : '/');
    return { code, hreflang: htmlLang, href: `${root}${path}` };
  });
  if (!variants.length) return [];
  const xDefault = variants.find((variant) => variant.code === DEFAULT_LOCALE) ?? variants[0];
  return [
    ...variants.map(({ hreflang, href }) => ({ hreflang, href })),
    { hreflang: 'x-default', href: xDefault.href },
  ];
}

// §11/KDV-I18N-06: the header language-switcher entries for a locale-neutral page
// path — the SAME page in every BUILT locale, as root-relative hrefs (the P2c
// relativize pass turns them document-relative, so the switcher stays host-
// agnostic). `endonym` is the locale's own name; `current` marks the page's own
// locale (rendered as `aria-current="true"`); `hreflang` is the anchor's tag.
export function buildLanguages(urlPath, locale = DEFAULT_LOCALE, locales = translatedLocales()) {
  return locales.map((code) => {
    const { prefix, htmlLang, endonym } = getLocale(code);
    const path = prefix
      ? (urlPath ? `${prefix}/${urlPath}` : `${prefix}/`)
      : (urlPath ? `/${urlPath}` : '/');
    return { code, endonym, href: path, hreflang: htmlLang, current: code === locale };
  });
}

// §11/KDV-I18N-04: the `og:locale:alternate` values — every OTHER built locale's
// OG locale code, in registry order.
export function ogLocaleAlternates(locale = DEFAULT_LOCALE, locales = translatedLocales()) {
  return locales.filter((code) => code !== locale).map((code) => getLocale(code).ogLocale);
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
  extraCopy = {},
  locale = DEFAULT_LOCALE,
  seoLocales = translatedLocales(),
}) {
  const { prefix, code, htmlLang, dir, ogLocale } = getLocale(locale);
  // §11: a non-default locale lives under its URL prefix; the default stays bare.
  const localizedUrlPath = prefix
    ? (urlPath ? `${prefix}/${urlPath}` : `${prefix}/`)
    : (urlPath ? `/${urlPath}` : '/');
  const url = `${base}${localizedUrlPath}`;
  const image = `${base}${OG_IMAGE_PATH}`;
  // §6.6: `urlPath` is route-relative ('', 'about/', '404'); the nav hrefs are
  // root-absolute, so normalize before matching the current item.
  const navPath = urlPath ? `/${urlPath}` : '/';
  const currentHref = prefix ? `${prefix}${navPath}` : navPath;
  // §6.4/§A4: every indexable page ships a server-rendered JSON-LD `@graph`
  // (WebSite + WebPage) on top of the ordinary meta block. The 404 opts out.
  // §11/KDV-I18N-05: the frame speaks in the page's UI locale — the graph's
  // `inLanguage` is never the hardcoded English default.
  const website = jsonldWebsite({ name: SITE_NAME, base, description: t('HOME_TAGLINE', locale), image, inLanguage: htmlLang });
  const webpage = jsonldWebpage({ websiteId: website['@id'], url, name: title, description, inLanguage: htmlLang });
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
    og_locale: locale === DEFAULT_LOCALE ? SITE_LOCALE : ogLocale,
    // §11/KDV-I18N-04: the alternate-locale SEO cluster — hreflang variants over
    // the built locales (plus x-default) and one og:locale:alternate per other
    // built locale. Absolute, so the P2c relativize pass leaves them alone.
    alternates: buildAlternates(urlPath, { base, locales: seoLocales }),
    // §11/KDV-I18N-06: the header switcher — the same page in each built locale.
    languages: buildLanguages(urlPath, locale, seoLocales),
    og_locale_alternates: ogLocaleAlternates(locale, seoLocales),
    robots,
    logo_svg: logo,
    // §6.6: landmarks/nav are shared markup; the data says which route is current.
    nav: buildNav(currentHref, locale),
    // §11/KDV-I18N-01: every layout reads its document language from the dataset
    // (`lang` always, `dir` only when a locale is RTL) — never a literal.
    lang: htmlLang,
    rtl: dir === 'rtl',
    // §11/KDV-I18N-09: the built locale's URL prefix ('' for en, '/ru', '/zh',
    // '/es'). Internal PAGE links in the frame bind `{{locale_prefix}}/…` so the
    // ru frame never links the English page. Assets/machine files stay canonical.
    locale_prefix: prefix,
    // §11/KDV-I18N-06: the page's own locale is on EVERY dataset — the first-visit
    // offer compares it against `navigator.languages`. A non-default locale also
    // carries its raw `htmlLang`/`dir` for the templates.
    locale: code,
    ...(locale === DEFAULT_LOCALE ? {} : { htmlLang, dir }),
    copy: {
      // §6.2: the shipped contract version reaches head.hbs; site.js compares it
      // with the stored declaration record and re-asks after a bump.
      contract_version: CONTRACT_VERSION,
      // §7.13: the header chip's copydeck strings, on every route.
      ...copyFields(COPY_FIELDS.chip, locale),
      // §7.3: the titleblock's four cells, one source for every route.
      ...footerCopy(locale),
      // §11: the structural frame chrome (skip link, nav, pagination, kickers).
      ...copyFields(COPY_FIELDS.ui, locale),
      // Route-specific copydeck strings (e.g. the home human line, the About
      // slogans) ride in through `extraCopy`, so the shared skeleton stays one place.
      ...extraCopy,
    },
    ...(withJsonLd ? { jsonld: serializeJsonLd([website, webpage, ...extraGraph]) } : {}),
  };
}

/**
 * Build the `home/main.json`, `about/main.json`, `contribute/main.json` and
 * `notfound/main.json` datasets.
 *
 * @param {Array<{slug: string, manifest: object, raw: string}>} dumps
 * @param {{baseUrl?: string, logo?: string, locale?: string}} [options]
 * @returns {Record<string, object>} layout → dataset (dataset name is `main`)
 */
export function buildRouteDatasets(dumps, { baseUrl, logo, locale = DEFAULT_LOCALE } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const { prefix, htmlLang } = getLocale(locale);
  const entries = dumps.map((dump) => buildIndexEntry(dump, { baseUrl: base }));
  // §11/KDV-I18N-09: the home feed is paginated BOTH server-side and client-side
  // (`ignition/pagination` re-renders the page with only `items`/`pagination`, so
  // a top-level `locale_prefix` would not survive). The item link is therefore
  // baked as a root-relative, locale-prefixed `href` on each entry. A copy is
  // made so the canonical absolute-`url` entries keep feeding the JSON-LD
  // ItemList and never leak the extra field into `/index.json` or manifests.
  const feedItems = entries.map((entry) => ({ ...entry, href: `${prefix}/dumps/${entry.slug}/` }));
  // §11/KDV-I18N-07: the SEO fields and the storefront story resolve per locale,
  // so a non-default frame changes copy without touching a template.
  const homeTitle = t('HOME_TITLE', locale);
  const tagline = t('HOME_TAGLINE', locale);
  // §6.1 v4: the home `01 · HUMANS` plate carries the universal §7.4 prompt and
  // the §7.12 lane; both ride the home `copy` slice (mirrors the dump page's lane).
  const homePrompt = promptFor(locale);
  const whatIsADump = {
    definition: t('DUMP_DEFINITION', locale),
    lead: t('DUMP_LEAD', locale),
    prompt: t('DUMP_PROMPT', locale),
    tail: t('DUMP_TAIL', locale),
  };
  const websiteId = `${base}/#website`;
  const itemListId = `${base}/#itemlist`;

  const home = {
    ...commonPage({
      base,
      title: homeTitle,
      description: tagline,
      urlPath: '',
      logo,
      locale,
      // §6.1 v4/KDV-SURFACE-27: the home lane uses the storefront-variant lead
      // and the universal §7.4 prompt (`homePrompt`), with the same wired
      // agent_links/copy controls the dump page's lane uses.
      extraCopy: {
        lane_lead: copyField('home_humans_lead', locale),
        agent_lane_hint: copyField('agent_lane_hint', locale),
        agent_links: agentLinksFor(locale, homePrompt),
        prompt: homePrompt,
        copy_label: copyField('copy_label', locale),
        copied_label: copyField('copied_label', locale),
        copied_announcement: copyField('copied_announcement', locale),
      },
      // §6.4: the storefront feed is a CollectionPage whose ItemList enumerates
      // the dumps (position, url, name) alongside the always-present WebPage.
      extraGraph: [
        jsonldCollectionPage({
          websiteId,
          url: `${base}/`,
          name: homeTitle,
          description: tagline,
          itemListId,
          inLanguage: htmlLang,
        }),
        jsonldItemList({
          id: itemListId,
          items: entries.map((entry) => ({ url: entry.url, name: entry.title })),
        }),
      ],
    }),
    // §6.1 v4/KDV-SURFACE-24: the hero H1 is composed from its parts so the
    // template can emphasize the term `a dump`; `title` above stays the plain
    // SEO string. §7.10 left the storefront (it lives on /about/).
    home_title: {
      lead: t('HOME_TITLE_LEAD', locale),
      term: t('HOME_TITLE_TERM', locale),
      tail: t('HOME_TITLE_TAIL', locale),
    },
    index_url: `${base}/index.json`,
    well_known_url: `${base}/.well-known/kodavr.json`,
    feed_url: `${base}/feeds/all.atom`,
    trust_levels: buildWellKnown().trust_levels,
    // §2.2/§6.1: the storefront legend — one lead + the five level/meaning
    // pairs. The pairs are the same ordered table the §5.2 `trust_levels` list
    // derives from (machine.mjs); the dataset legend resolves through the locale
    // catalog while the machine files keep their canonical English (KDV-I18N-08).
    trust_legend: {
      lead: t('TRUST_LEGEND_LEAD', locale),
      levels: t('TRUST_LEVEL_MEANINGS', locale),
    },
    dumps: feedItems,
  };

  const about = {
    ...commonPage({
      base,
      title: t('ABOUT_PAGE_TITLE', locale),
      description: t('ABOUT_PAGE_DESCRIPTION', locale),
      urlPath: 'about/',
      logo,
      locale,
      // §7.15: all three brand slogans from one source — the lead renders as-is,
      // the other two as the muted tail.
      extraCopy: {
        ...copyFields(COPY_FIELDS.brand, locale),
        ...copyFields(COPY_FIELDS.about, locale),
      },
    }),
    what_is_a_dump: whatIsADump,
  };

  const contribute = {
    ...commonPage({
      base,
      title: t('CONTRIBUTE_PAGE_TITLE', locale),
      description: t('CONTRIBUTE_PAGE_DESCRIPTION', locale),
      urlPath: 'contribute/',
      logo,
      locale,
      extraCopy: copyFields(COPY_FIELDS.contribute, locale),
    }),
  };

  const notfound = {
    ...commonPage({
      base,
      title: t('NOT_FOUND_PAGE_TITLE', locale),
      description: t('NOT_FOUND_PAGE_DESCRIPTION', locale),
      urlPath: '404',
      logo,
      locale,
      // §6.4: the 404 is served for arbitrary missing paths — never index it and
      // never advertise structured data for it. It is emitted only for the
      // default locale (deferred per-locale 404), so its hreflang cluster must
      // not link a `/ru/404` that does not exist.
      robots: 'noindex,follow',
      withJsonLd: false,
      seoLocales: [DEFAULT_LOCALE],
    }),
    copy: {
      contract_version: CONTRACT_VERSION,
      ...copyFields(COPY_FIELDS.chip, locale),
      // §7.3: the titleblock's four cells (advisory · licences · contract · report).
      ...footerCopy(locale),
      // §11: the structural frame chrome (404 kicker/note/CTA, skip link).
      ...copyFields(COPY_FIELDS.ui, locale),
      notFound: copyField('notFound', locale),
    },
  };

  return { home, about, contribute, notfound };
}

/**
 * Copy slices shared by dump pages: the §7 texts the hall must carry verbatim.
 * §7.11: with a manifest URL the prompt is the bare boot address to that dump's
 * manifest; without it, the universal §7.4 prompt.
 */
export function dumpCopySlices({ manifestUrl = null, locale = DEFAULT_LOCALE } = {}) {
  const prompt = promptFor(locale, { manifestUrl });
  return {
    // §6.2: the shipped contract version reaches head.hbs on dump pages too;
    // site.js compares it with the stored declaration record and re-asks on a bump.
    contract_version: CONTRACT_VERSION,
    // §7.13: the dump hall's header chip uses the same copydeck skeleton.
    ...copyFields(COPY_FIELDS.chip, locale),
    // §11: the structural frame chrome (skip link, back-to-feed, footer names).
    ...copyFields(COPY_FIELDS.ui, locale),
    // §6.6: the gate modal's accessible name/description; the visible §7.1 v2
    // prose stays verbatim — kicker, H1, hook and the duties line lead the
    // first screen, the full declaration sits below the fold.
    ...copyFields(COPY_FIELDS.gate, locale),
    // §6.3/§7.2 v4: the `01 · PREVIEW` plate's brief tier — the rendered
    // `summary.md` (`brief_html`, wired by the dump dataset, falsy without the
    // layer) is the real payload; these are the surrounding heading/note/CTA/
    // report and the honest fallback for the missing layer.
    ...copyFields(COPY_FIELDS.dumpBrief, locale),
    prompt,
    // §7.12: the human fast lane renders once per surface (the gate dialog and
    // the reception block each pass their own copy target).
    lane_lead: copyField('lane_lead', locale),
    agent_lane_hint: copyField('agent_lane_hint', locale),
    agent_links: agentLinksFor(locale, prompt),
    copy_label: copyField('copy_label', locale),
    copied_label: copyField('copied_label', locale),
    copied_announcement: copyField('copied_announcement', locale),
    // §6.6 announcements for the SSR role="status" region.
    hall_announcement: copyField('hall_announcement', locale),
    reception_announcement: copyField('reception_announcement', locale),
    reset_label: copyField('reset_label', locale),
    // §6.2: the machine panel's reset link (hall header, machine-declared).
    reset_human_label: copyField('reset_human_label', locale),
    post_gate_line: copyField('post_gate_line', locale),
    // §6.2/§6.6: the one-shot declaration toast, shown when the visitor enters
    // the hall by pressing "0". The text reaches the DOM through the dataset.
    declaration_toast: copyField('declaration_toast', locale),
    discuss_label: copyField('discuss_label', locale),
    // §7.3: the titleblock's four cells, the same one source every route spreads.
    ...footerCopy(locale),
    labels: copyField('labels', locale),
  };
}

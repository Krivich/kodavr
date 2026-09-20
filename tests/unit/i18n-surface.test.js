// tests/unit/i18n-surface.test.js — KDV-I18N-01: the functional frame is
// locale-ready. Every human literal of the in-scope templates comes from the
// dataset, fed by the English catalog (copy.mjs + the explicit UI section), and
// every layout reads `<html lang>`/`dir` from the dataset — never a literal.
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EN } from '../../scripts/lib/i18n-en.mjs';
import { LOCALES, getLocale } from '../../scripts/lib/i18n.mjs';
import { GATE_TITLE, FOOTER_TEXT } from '../../scripts/lib/copy.mjs';
import { buildRouteDatasets, HOME_TAGLINE } from '../../scripts/lib/pages.mjs';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const template = (name) => readFileSync(join(ROOT, 'input/templates', name), 'utf8');

// The full layouts that carry `<html lang>` — the dump hall plus the UI routes.
const LAYOUTS = ['home.hbs', 'reception.hbs', 'notfound.hbs', 'dumps.hbs', 'about.hbs', 'contribute.hbs'];

// file → [binding markup, the old literal markup, catalog key, English value].
// The source must carry the binding and must not carry the literal.
const BINDINGS = {
  'home.hbs': [
    ['<a class="skip-link" href="#main">{{copy.skip_to_content}}</a>', '<a class="skip-link" href="#main">Skip to content</a>', 'SKIP_TO_CONTENT', 'Skip to content'],
    ['<p class="kicker">{{copy.home_kicker}}</p>', '<p class="kicker">registry of raw experience</p>', 'HOME_KICKER', 'registry of raw experience'],
    ['href="{{locale_prefix}}/about/">{{copy.home_about_cta}}</a>', 'href="/about/">About the platform</a>', 'HOME_ABOUT_CTA', 'About the platform'],
    ['<h2>{{copy.home_for_machines}}</h2>', '<h2>For machines</h2>', 'HOME_FOR_MACHINES', 'For machines'],
    ['<h2>{{copy.home_for_humans}}</h2>', '<h2>For humans</h2>', 'HOME_FOR_HUMANS', 'For humans'],
    ['href="{{locale_prefix}}/reception/">{{copy.home_check_in}}</a>', 'href="/reception/">Check in at reception</a>', 'HOME_CHECK_IN', 'Check in at reception'],
    ['<h2>{{copy.home_latest_dumps}}</h2>', '<h2>Latest dumps</h2>', 'HOME_LATEST_DUMPS', 'Latest dumps'],
    ['<h2>{{copy.home_trust_levels}}</h2>', '<h2>Trust levels</h2>', 'HOME_TRUST_LEVELS', 'Trust levels'],
    // §11/KDV-I18N-09: the numbered plates bind the catalog as a `data-plate` attribute.
    ['data-plate="{{copy.home_plate_registry}}"', 'data-plate="01 · registry"', 'HOME_PLATE_REGISTRY', '01 · registry'],
    ['data-plate="{{copy.home_plate_machines}}"', 'data-plate="02 · machines"', 'HOME_PLATE_MACHINES', '02 · machines'],
    ['data-plate="{{copy.home_plate_humans}}"', 'data-plate="03 · humans"', 'HOME_PLATE_HUMANS', '03 · humans'],
    ['data-plate="{{copy.home_plate_latest}}"', 'data-plate="04 · latest"', 'HOME_PLATE_LATEST', '04 · latest'],
    ['data-plate="{{copy.home_plate_trust}}"', 'data-plate="05 · trust"', 'HOME_PLATE_TRUST', '05 · trust'],
  ],
  'about.hbs': [
    ['data-plate="{{copy.about_plate_manifesto}}"', 'data-plate="01 · manifesto"', 'ABOUT_PLATE_MANIFESTO', '01 · manifesto'],
    ['data-plate="{{copy.about_plate_authors}}"', 'data-plate="02 · authors"', 'ABOUT_PLATE_AUTHORS', '02 · authors'],
    ['data-plate="{{copy.about_plate_readers}}"', 'data-plate="03 · readers"', 'ABOUT_PLATE_READERS', '03 · readers'],
    ['data-plate="{{copy.about_plate_mechanism}}"', 'data-plate="04 · mechanism"', 'ABOUT_PLATE_MECHANISM', '04 · mechanism'],
    ['data-plate="{{copy.about_plate_architecture}}"', 'data-plate="05 · architecture"', 'ABOUT_PLATE_ARCHITECTURE', '05 · architecture'],
    ['data-plate="{{copy.about_plate_colophon}}"', 'data-plate="06 · colophon"', 'ABOUT_PLATE_COLOPHON', '06 · colophon'],
  ],
  'contribute.hbs': [
    ['data-plate="{{copy.contribute_plate_authors}}"', 'data-plate="01 · authors"', 'CONTRIBUTE_PLATE_AUTHORS', '01 · authors'],
    ['data-plate="{{copy.contribute_plate_flow}}"', 'data-plate="02 · flow"', 'CONTRIBUTE_PLATE_FLOW', '02 · flow'],
    ['data-plate="{{copy.contribute_plate_schema}}"', 'data-plate="03 · schema"', 'CONTRIBUTE_PLATE_SCHEMA', '03 · schema'],
    ['data-plate="{{copy.contribute_plate_licences}}"', 'data-plate="04 · licences"', 'CONTRIBUTE_PLATE_LICENCES', '04 · licences'],
  ],
  'reception.hbs': [
    ['<a class="skip-link" href="#main">{{copy.skip_to_content}}</a>', '<a class="skip-link" href="#main">Skip to content</a>', 'SKIP_TO_CONTENT', 'Skip to content'],
    ['<p class="kicker">{{copy.reception_kicker}}</p>', '<p class="kicker">human surface · check-in</p>', 'RECEPTION_KICKER', 'human surface · check-in'],
    ['<p class="lead">{{copy.reception_lead}}</p>', '<p class="lead">You are at the human desk: instructions and metadata live here; the raw content stays machine-first.</p>', 'RECEPTION_LEAD', 'You are at the human desk: instructions and metadata live here; the raw content stays machine-first.'],
    ['data-plate="{{copy.reception_plate_checkin}}"', 'data-plate="01 · check-in"', 'RECEPTION_PLATE_CHECKIN', '01 · check-in'],
  ],
  'notfound.hbs': [
    ['<a class="skip-link" href="#main">{{copy.skip_to_content}}</a>', '<a class="skip-link" href="#main">Skip to content</a>', 'SKIP_TO_CONTENT', 'Skip to content'],
    ['<p class="kicker">{{copy.not_found_kicker}}</p>', '<p class="kicker">error sheet</p>', 'NOT_FOUND_KICKER', 'error sheet'],
    ['<p class="gate-hint">{{copy.not_found_note}}</p>', '<p class="gate-hint">(Attribution is one of the four machine duties. The agent forgot. The agent is sorry.)</p>', 'NOT_FOUND_NOTE', '(Attribution is one of the four machine duties. The agent forgot. The agent is sorry.)'],
    ['<a class="cta" href="{{locale_prefix}}/">{{copy.not_found_cta}}</a>', '<a class="cta" href="/">Return to the storefront</a>', 'NOT_FOUND_CTA', 'Return to the storefront'],
    ['data-plate="{{copy.notfound_plate_void}}"', 'data-plate="00 · void"', 'NOTFOUND_PLATE_VOID', '00 · void'],
  ],
  'dumps.hbs': [
    ['<a class="skip-link" href="#main">{{copy.skip_to_content}}</a>', '<a class="skip-link" href="#main">Skip to content</a>', 'SKIP_TO_CONTENT', 'Skip to content'],
    ['aria-label="{{copy.back_to_feed}}"', 'aria-label="Back to feed"', 'BACK_TO_FEED', 'Back to feed'],
    ['data-plate="{{copy.dumps_plate_artifacts}}"', 'data-plate="06 · artifacts"', 'DUMPS_PLATE_ARTIFACTS', '06 · artifacts'],
  ],
  'home/page.hbs': [
    ['aria-label="{{copy.pagination_label}}"', 'aria-label="Pagination"', 'PAGINATION_LABEL', 'Pagination'],
    ['aria-label="{{copy.pagination_prev}}"', 'aria-label="Previous page"', 'PAGINATION_PREV', 'Previous page'],
    ['aria-label="{{copy.pagination_next}}"', 'aria-label="Next page"', 'PAGINATION_NEXT', 'Next page'],
  ],
  'site/head.hbs': [
    ['title="{{copy.feed_title}}"', 'title="Kodavr dumps"', 'FEED_TITLE', 'Kodavr dumps'],
  ],
  'site/header.hbs': [
    ['aria-label="{{copy.nav_primary}}"', 'aria-label="Primary"', 'NAV_PRIMARY', 'Primary'],
  ],
  'site/footer.hbs': [
    ['<b>{{copy.footer_cell_advisory}}</b>', '<b>advisory</b>', 'FOOTER_CELL_ADVISORY', 'advisory'],
    ['<b>{{copy.footer_cell_licences}}</b>', '<b>licences</b>', 'FOOTER_CELL_LICENCES', 'licences'],
    ['<b>{{copy.footer_cell_contract}}</b>', '<b>contract</b>', 'FOOTER_CELL_CONTRACT', 'contract'],
    ['<b>{{copy.footer_cell_report}}</b>', '<b>report</b>', 'FOOTER_CELL_REPORT', 'report'],
  ],
  'site/gate.hbs': [
    ['aria-label="{{copy.gate_doors_label}}"', 'aria-label="Entry declaration"', 'GATE_DOORS_LABEL', 'Entry declaration'],
    ['<span class="gate-or" aria-hidden="true">{{copy.gate_or}}</span>', '<span class="gate-or" aria-hidden="true">or</span>', 'GATE_OR', 'or'],
  ],
  'site/artifacts.hbs': [
    ['<h2 class="card-h">{{copy.artifacts_heading}}</h2>', '<h2 class="card-h">Artifacts</h2>', 'ARTIFACTS_HEADING', 'Artifacts'],
    ['<p class="artifacts-empty">{{copy.artifacts_empty}}</p>', '<p class="artifacts-empty">No artifacts.</p>', 'ARTIFACTS_EMPTY', 'No artifacts.'],
  ],
};

describe('i18n surface: catalog (KDV-I18N-01)', () => {
  it('KDV-I18N-01: the UI catalog holds the migrated English strings', () => {
    for (const entries of Object.values(BINDINGS)) {
      for (const [, , key, english] of entries) {
        expect(EN[key], key).toBe(english);
      }
    }
  });

  it('KDV-I18N-01: the copy.mjs-derived part of the bundle stays verbatim', () => {
    expect(EN.GATE_TITLE).toBe(GATE_TITLE);
    expect(EN.FOOTER_TEXT).toBe(FOOTER_TEXT);
    expect(EN.HOME_HUMAN_LINE).toBeDefined();
    expect(HOME_TAGLINE.length).toBeGreaterThan(0);
  });
});

describe('i18n surface: templates bind from the dataset (KDV-I18N-01)', () => {
  for (const [file, entries] of Object.entries(BINDINGS)) {
    it(`KDV-I18N-01: ${file} carries no hardcoded English for the migrated literals`, () => {
      const src = template(file);
      for (const [binding, literal] of entries) {
        expect(src, `${file}: ${binding}`).toContain(binding);
        expect(src, `${file}: literal ${literal}`).not.toContain(literal);
      }
    });
  }

  it('KDV-I18N-01: head.hbs keeps the human <title> skeleton with the brand literal', () => {
    const head = template('site/head.hbs');
    expect(head).toContain('<title>{{title}} · Kodavr</title>');
  });

  it('KDV-I18N-01: every full layout reads lang from the dataset, dir gated on rtl, never ltr', () => {
    for (const file of LAYOUTS) {
      const src = template(file);
      expect(src, file).toMatch(/<html lang="\{\{lang\}\}"\{\{#if rtl\}\} dir="rtl"\{\{\/if\}\}>/);
      expect(src, `${file}: no literal lang`).not.toMatch(/<html lang="(?!\{\{lang\}\})/);
      expect(src, `${file}: no dir=ltr`).not.toContain('dir="ltr"');
    }
  });
});

describe('i18n surface: datasets carry lang/rtl and the frame copy (KDV-I18N-01)', () => {
  let routes;

  beforeAll(() => {
    routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
  });

  it('KDV-I18N-01: every route dataset is lang=en, rtl=false and has the UI copy', () => {
    for (const [name, dataset] of Object.entries(routes)) {
      expect(dataset.lang, name).toBe('en');
      expect(dataset.rtl, name).toBe(false);
      expect(dataset.copy.skip_to_content, name).toBe('Skip to content');
      expect(dataset.copy.nav_primary, name).toBe('Primary');
      expect(dataset.copy.footer_cell_advisory, name).toBe('advisory');
      expect(dataset.copy.footer_cell_licences, name).toBe('licences');
      expect(dataset.copy.footer_cell_contract, name).toBe('contract');
      expect(dataset.copy.footer_cell_report, name).toBe('report');
      expect(dataset.copy.feed_title, name).toBe('Kodavr dumps');
    }
  });

  it('KDV-I18N-01: the route-specific copy reaches the route that renders it', () => {
    expect(routes.home.copy.home_kicker).toBe('registry of raw experience');
    expect(routes.home.copy.home_about_cta).toBe('About the platform');
    expect(routes.home.copy.pagination_label).toBe('Pagination');
    expect(routes.home.copy.pagination_prev).toBe('Previous page');
    expect(routes.home.copy.pagination_next).toBe('Next page');
    expect(routes.reception.copy.reception_kicker).toBe('human surface · check-in');
    expect(routes.reception.copy.reception_lead).toContain('You are at the human desk');
    expect(routes.notfound.copy.not_found_kicker).toBe('error sheet');
    expect(routes.notfound.copy.not_found_cta).toBe('Return to the storefront');
  });

  it('KDV-I18N-01: a dump dataset is lang=en, rtl=false and carries the hall frame copy', async () => {
    const dumps = await readDumps(FIXTURES);
    const dataset = toDataset(dumps.find((dump) => dump.slug === 'sample-dump'), { baseUrl: '' });
    expect(dataset.lang).toBe('en');
    expect(dataset.rtl).toBe(false);
    expect(dataset.copy.skip_to_content).toBe('Skip to content');
    expect(dataset.copy.back_to_feed).toBe('Back to feed');
    expect(dataset.copy.gate_or).toBe('or');
    expect(dataset.copy.gate_doors_label).toBe('Entry declaration');
    expect(dataset.copy.artifacts_heading).toBe('Artifacts');
    expect(dataset.copy.artifacts_empty).toBe('No artifacts.');
    expect(dataset.copy.footer_cell_report).toBe('report');
  });

  it('KDV-I18N-01: rtl mirrors the locale dir (false for every LTR locale in the registry)', () => {
    for (const locale of LOCALES) {
      expect(getLocale(locale.code).dir === 'rtl', locale.code).toBe(false);
    }
    for (const [, dataset] of Object.entries(routes)) {
      expect(dataset.rtl).toBe(getLocale('en').dir === 'rtl');
    }
  });

  it('KDV-I18N-09: every route and dump dataset carries the built locale URL prefix', async () => {
    for (const [name, dataset] of Object.entries(routes)) {
      expect(dataset.locale_prefix, name).toBe('');
    }
    const ruRoutes = buildRouteDatasets([], { baseUrl: 'https://example.test', locale: 'ru' });
    for (const [name, dataset] of Object.entries(ruRoutes)) {
      expect(dataset.locale_prefix, name).toBe('/ru');
    }
    const dumps = await readDumps(FIXTURES);
    const fixture = dumps.find((entry) => entry.slug === 'sample-dump');
    expect(toDataset(fixture, { baseUrl: '' }).locale_prefix).toBe('');
    expect(toDataset(fixture, { baseUrl: '', locale: 'ru' }).locale_prefix).toBe('/ru');
    expect(toDataset(fixture, { baseUrl: '', locale: 'zh-Hans' }).locale_prefix).toBe('/zh');
    expect(toDataset(fixture, { baseUrl: '', locale: 'es' }).locale_prefix).toBe('/es');
  });

  it('KDV-I18N-09: the home feed bakes a locale-prefixed href on a copy of each index entry', async () => {
    const dumps = await readDumps(FIXTURES);
    const enRoutes = buildRouteDatasets(dumps, { baseUrl: 'https://example.test' });
    const ruRoutes = buildRouteDatasets(dumps, { baseUrl: 'https://example.test', locale: 'ru' });
    // The feed item link is root-relative and locale-prefixed (survives the
    // client-side pagination re-render, which only receives `items`/`pagination`).
    expect(enRoutes.home.dumps[0].href).toBe('/dumps/sample-dump/');
    expect(ruRoutes.home.dumps[0].href).toBe('/ru/dumps/sample-dump/');
    // The absolute canonical `url` is untouched on the same item.
    expect(ruRoutes.home.dumps[0].url).toBe('https://example.test/dumps/sample-dump/');
  });
});

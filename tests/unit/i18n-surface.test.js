// tests/unit/i18n-surface.test.js — KDV-I18N-01: the functional frame is
// locale-ready. Every human literal of the in-scope templates comes from the
// dataset, fed by the English catalog (copy.mjs + the explicit UI section), and
// every layout reads `<html lang>`/`dir` from the dataset — never a literal.
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EN } from '../../scripts/lib/i18n-en.mjs';
import { LOCALES, getLocale, t } from '../../scripts/lib/i18n.mjs';
import { GATE_TITLE, FOOTER_TEXT } from '../../scripts/lib/copy.mjs';
import { buildRouteDatasets, HOME_TAGLINE } from '../../scripts/lib/pages.mjs';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const template = (name) => readFileSync(join(ROOT, 'input/templates', name), 'utf8');

// The full layouts that carry `<html lang>` — the dump hall plus the UI routes.
const LAYOUTS = ['home.hbs', 'notfound.hbs', 'dumps.hbs', 'about.hbs', 'contribute.hbs'];

// file → [binding markup, the old literal markup, catalog key, English value].
// The source must carry the binding and must not carry the literal.
const BINDINGS = {
  'home.hbs': [
    ['<a class="skip-link" href="#main">{{copy.skip_to_content}}</a>', '<a class="skip-link" href="#main">Skip to content</a>', 'SKIP_TO_CONTENT', 'Skip to content'],
    // §6.1 v4/KDV-SURFACE-24: the hero is the literal KODAVR wordmark over the
    // lead composed from its parts (the term `a dump` emphasized); HOME_TITLE
    // stays the plain SEO string.
    ['<p class="home-lead">{{home_title.lead}}<strong>{{home_title.term}}</strong>{{home_title.tail}}</p>', "Writers share raw experience — a dump — the reader's agent adapts it to their needs.", 'HOME_TITLE_LEAD', 'Writers share raw experience — '],
    ['<p>{{copy.home_explainer}}</p>', '<p>Kodavr is a registry of unpolished field reports: code, workflows, and lessons learned, packaged so your AI agent can read and adapt them for you. Building something is 1x effort; packaging it for others is 10x. We fix that asymmetry.</p>', 'HOME_EXPLAINER', 'Kodavr is a registry of unpolished field reports: code, workflows, and lessons learned, packaged so your AI agent can read and adapt them for you. Building something is 1x effort; packaging it for others is 10x. We fix that asymmetry.'],
    ['href="{{locale_prefix}}/about/">{{copy.home_about_cta}}</a>', 'href="/about/">Read the manifesto</a>', 'HOME_ABOUT_CTA', 'About the platform'],
    ['href="{{locale_prefix}}/contribute/">{{copy.home_contribute_cta}}</a>', 'href="/contribute/">Publish a dump</a>', 'HOME_CONTRIBUTE_CTA', 'How to contribute'],
    ['<h2>{{copy.home_for_machines}}</h2>', '<h2>For machines</h2>', 'HOME_FOR_MACHINES', 'For machines'],
    ['<h2>{{copy.home_latest_lead}}<em>{{copy.home_latest_term}}</em></h2>', '<h2>Latest dumps</h2>', 'HOME_LATEST_LEAD', 'Latest '],
    ['<em>{{copy.home_latest_term}}</em>', '<em>dumps</em>', 'HOME_LATEST_TERM', 'dumps'],
    ['<h2>{{copy.home_trust_levels}}</h2>', '<h2>Trust levels</h2>', 'HOME_TRUST_LEVELS', 'Trust levels'],
    // §11/KDV-I18N-09: the numbered plates bind the catalog as a `data-plate`
    // attribute; the hero plate carries none (Human Surface v4 renumbers them).
    ['data-plate="{{copy.home_plate_humans}}"', 'data-plate="01 · humans"', 'HOME_PLATE_HUMANS', '01 · HUMANS'],
    ['data-plate="{{copy.home_plate_latest}}"', 'data-plate="02 · latest"', 'HOME_PLATE_LATEST', '02 · LATEST'],
    ['data-plate="{{copy.home_plate_machines}}"', 'data-plate="03 · machines"', 'HOME_PLATE_MACHINES', '03 · MACHINES'],
    ['data-plate="{{copy.home_plate_trust}}"', 'data-plate="04 · trust"', 'HOME_PLATE_TRUST', '04 · TRUST'],
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
    // feedback-contribute_skill items 01/03: the contribute-lane leads the flow
    // plate; the manual path heading is demoted under it.
    ['<p class="agent-lane-lead">{{copy.contribute_lane_lead}}</p>', '<p class="agent-lane-lead">Point your coding agent at the skill — it will read the source, build its own version, and walk you through publishing:</p>', 'CONTRIBUTE_LANE_LEAD', 'Point your coding agent at the skill — it will read the source, build its own version, and walk you through publishing:'],
    ['<button type="button" class="copy-prompt contribute-copy" data-copy-target="contribute-prompt" data-copied-label="{{copy.copied_label}}" data-copied-announcement="{{copy.copied_announcement}}">{{copy.contribute_lane_button}}</button>', '<button type="button" class="copy-prompt contribute-copy" data-copy-target="contribute-prompt" data-copied-label="Copied ✓" data-copied-announcement="Copied to the clipboard.">Copy prompt</button>', 'CONTRIBUTE_LANE_BUTTON', 'Copy prompt'],
    ['<pre class="contribute-prompt" id="contribute-prompt">{{copy.contribute_prompt}}</pre>', '<pre class="contribute-prompt" id="contribute-prompt">Study https://kodavr.xyz/dumps/2026-09-18-kodavr-dump-skill/manifest.json and follow its schema. Read the skill source, build your own version for your agent, and help me publish my next dump to Kodavr.</pre>', 'CONTRIBUTE_PROMPT', 'Study https://kodavr.xyz/dumps/2026-09-18-kodavr-dump-skill/manifest.json and follow its schema. Read the skill source, build your own version for your agent, and help me publish my next dump to Kodavr.'],
    ['<p class="agent-lane-hint">{{copy.contribute_lane_hint}}</p>', '<p class="agent-lane-hint">(paste this prompt into a coding agent — OpenCode, Claude Code, Cursor, Codex — not a web chat: publishing means creating files, running the validator, and opening a PR, which a chat cannot do)</p>', 'CONTRIBUTE_LANE_HINT', '(paste this prompt into a coding agent — OpenCode, Claude Code, Cursor, Codex — not a web chat: publishing means creating files, running the validator, and opening a PR, which a chat cannot do)'],
    ['<p class="contribute-lane-secondary"><a href="{{locale_prefix}}/dumps/2026-09-18-kodavr-dump-skill/">{{copy.contribute_lane_secondary}}</a></p>', '<p class="contribute-lane-secondary"><a href="/dumps/2026-09-18-kodavr-dump-skill/">First look at the skill source</a></p>', 'CONTRIBUTE_LANE_SECONDARY', 'First look at the skill source'],
    ['<h2>{{copy.contribute_bring_heading}}</h2>', '<h2>Manual path (if you prefer)</h2>', 'CONTRIBUTE_BRING_HEADING', 'Manual path (if you prefer)'],
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
  'dumps.hbs': [
    ['data-plate="{{copy.dumps_plate_preview}}"', 'data-plate="01 · PREVIEW"', 'DUMPS_PLATE_PREVIEW', '01 · PREVIEW'],
    ['data-plate="{{copy.dumps_plate_want}}"', 'data-plate="02 · INTERESTING? WANT MORE?"', 'DUMPS_PLATE_WANT', '02 · INTERESTING?'],
    ['data-plate="{{copy.dumps_plate_declaration}}"', 'data-plate="03 · DECLARATION"', 'DUMPS_PLATE_DECLARATION', '03 · DECLARATION'],
    ['data-plate="{{copy.dumps_plate_dump}}"', 'data-plate="01 · DUMP"', 'DUMPS_PLATE_DUMP', '01 · DUMP'],
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
    // Human Surface v4: the reception route and its nav/home keys are gone.
    expect(EN.NAV_RECEPTION).toBeUndefined();
    expect(EN.HOME_CHECK_IN).toBeUndefined();
    // v4 also drops the home kicker, the "For humans" heading and the plain
    // "Latest dumps" key (the feed heading is composed from lead + term now),
    // and the hero plate label (the storefront hero is a literal wordmark).
    expect(EN.HOME_KICKER).toBeUndefined();
    expect(EN.HOME_FOR_HUMANS).toBeUndefined();
    expect(EN.HOME_LATEST_DUMPS).toBeUndefined();
    expect(EN.HOME_PLATE_REGISTRY).toBeUndefined();
  });

  it('KDV-SURFACE-29: the contribute-lane copy resolves in every locale (doc-verbatim where the record gives it)', () => {
    const keys = [
      'CONTRIBUTE_LANE_LEAD',
      'CONTRIBUTE_PROMPT',
      'CONTRIBUTE_LANE_HINT',
      'CONTRIBUTE_LANE_BUTTON',
      'CONTRIBUTE_LANE_SECONDARY',
      'CONTRIBUTE_BRING_HEADING',
    ];
    for (const locale of LOCALES.map((entry) => entry.code)) {
      for (const key of keys) {
        const value = t(key, locale);
        expect(typeof value, `${locale}/${key}`).toBe('string');
        expect(value.length, `${locale}/${key}`).toBeGreaterThan(0);
      }
    }
    // feedback-contribute_skill items 01/03: the public record's EN and ru
    // lines are the contract — verbatim, down to capitalization and parens.
    expect(t('CONTRIBUTE_LANE_LEAD', 'en')).toBe(
      'Point your coding agent at the skill — it will read the source, build its own version, and walk you through publishing:',
    );
    expect(t('CONTRIBUTE_LANE_HINT', 'en')).toBe(
      '(paste this prompt into a coding agent — OpenCode, Claude Code, Cursor, Codex — not a web chat: publishing means creating files, running the validator, and opening a PR, which a chat cannot do)',
    );
    expect(t('CONTRIBUTE_LANE_BUTTON', 'en')).toBe('Copy prompt');
    expect(t('CONTRIBUTE_LANE_SECONDARY', 'en')).toBe('First look at the skill source');
    expect(t('CONTRIBUTE_BRING_HEADING', 'en')).toBe('Manual path (if you prefer)');
    expect(t('CONTRIBUTE_LANE_LEAD', 'ru')).toBe(
      'Направьте кодинг-агента на скилл — он прочитает исходник, соберёт свою версию и проведёт вас через публикацию:',
    );
    expect(t('CONTRIBUTE_LANE_HINT', 'ru')).toBe(
      '(вставьте промпт в кодинг-агента — OpenCode, Claude Code, Cursor, Codex — а не в веб-чат: публикация это создать файлы, прогнать валидатор и открыть PR, чего чат не умеет)',
    );
    expect(t('CONTRIBUTE_LANE_BUTTON', 'ru')).toBe('Скопировать промпт');
    expect(t('CONTRIBUTE_BRING_HEADING', 'ru')).toBe('Ручной путь (если предпочитаете)');
  });

  it('KDV-I18N-01: the /contribute/ three-paragraph lead resolves in every locale (EN verbatim)', () => {
    // Owner-dictated platform copy: the lead is three paragraphs —
    // `CONTRIBUTE_LEAD` carries P1, `CONTRIBUTE_LEAD_2`/`_3` the siblings.
    const keys = ['CONTRIBUTE_LEAD', 'CONTRIBUTE_LEAD_2', 'CONTRIBUTE_LEAD_3'];
    for (const locale of LOCALES.map((entry) => entry.code)) {
      for (const key of keys) {
        const value = t(key, locale); // throws fail-visible if a locale lags
        expect(typeof value, `${locale}/${key}`).toBe('string');
        expect(value.length, `${locale}/${key}`).toBeGreaterThan(0);
      }
    }
    expect(t('CONTRIBUTE_LEAD', 'en')).toBe(
      "90% of useful experience dies in local folders — scripts that solved a real problem, workflows that finally worked, hacks that saved the day. Kodavr saves it: publish a raw dump in one prompt, and the reader's agent adapts it to their context.",
    );
    expect(t('CONTRIBUTE_LEAD_2', 'en')).toBe(
      'Make your thinking visible. Let your experience help others. Gain traction for your work — all in one prompt.',
    );
    expect(t('CONTRIBUTE_LEAD_3', 'en')).toBe('It was never this easy before, was it?');
    // The dataset carries the sibling keys to the route that renders them.
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    expect(routes.contribute.copy.contribute_lead_2).toBe(t('CONTRIBUTE_LEAD_2', 'en'));
    expect(routes.contribute.copy.contribute_lead_3).toBe(t('CONTRIBUTE_LEAD_3', 'en'));
    // The superseded lead is gone from the EN catalog.
    expect(t('CONTRIBUTE_LEAD', 'en')).not.toContain('One pull request = one dump');
  });

  it('KDV-SURFACE-24: the home hero parts compose HOME_TITLE in every locale', () => {
    // §6.1 v4: the H1 is one sentence composed from three parts (the term in the
    // middle). The plain HOME_TITLE — the SEO <title>/JSON-LD string — must equal
    // that composition, in every locale, or the visible hero and the metadata drift.
    for (const locale of LOCALES.map((entry) => entry.code)) {
      const composed =
        t('HOME_TITLE_LEAD', locale) + t('HOME_TITLE_TERM', locale) + t('HOME_TITLE_TAIL', locale);
      expect(composed, locale).toBe(t('HOME_TITLE', locale));
    }
  });

  it('KDV-I18N-01: the copy.mjs-derived part of the bundle stays verbatim', () => {
    expect(EN.GATE_TITLE).toBe(GATE_TITLE);
    expect(EN.FOOTER_TEXT).toBe(FOOTER_TEXT);

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
    // v4/KDV-SURFACE-27: the home kicker is gone; the storefront on-ramp is the
    // HUMANS plate lead and the two CTAs carry the v4 labels.
    expect(routes.home.copy.home_humans_lead).toBe(
      'Read Kodavr through your own agent — that is the way it was designed for. Here is the prompt:',
    );
    expect(routes.home.copy.home_about_cta).toBe('About the platform');
    expect(routes.home.copy.home_contribute_cta).toBe('How to contribute');
    expect(routes.home.copy.home_explainer).toBe(
      'Kodavr is a registry of unpolished field reports: code, workflows, and lessons learned, packaged so your AI agent can read and adapt them for you. Building something is 1x effort; packaging it for others is 10x. We fix that asymmetry.',
    );
    expect(routes.home.copy.pagination_label).toBe('Pagination');
    expect(routes.home.copy.pagination_prev).toBe('Previous page');
    expect(routes.home.copy.pagination_next).toBe('Next page');

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
    expect(dataset.copy.gate_dump_context_lead).toBe('About this dump:');
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

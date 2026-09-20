// tests/unit/i18n-switcher.test.js — KDV-I18N-06: the header language switcher
// (native <details>, endonyms, aria-current, same-page links) and its intelligent
// hint hooks. UI only — the copydeck backing is asserted via the catalog.
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EN } from '../../scripts/lib/i18n-en.mjs';
import { buildLanguages, buildRouteDatasets } from '../../scripts/lib/pages.mjs';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const template = (name) => readFileSync(join(ROOT, 'input/templates', name), 'utf8');
const BASE = 'https://example.test';

describe('i18n language switcher markup (KDV-I18N-06)', () => {
  const header = template('site/header.hbs');

  it('KDV-I18N-06: the switcher is a native <details> with a labelled summary and an endonym loop', () => {
    expect(header).toMatch(/<details class="lang-switch"/);
    expect(header).toMatch(/<summary class="lang-switch-summary" aria-label="\{\{copy\.lang_switch_label\}\}">/);
    expect(header).toMatch(/class="lang-switch-current">\{\{#each languages\}\}/);
    expect(header).toMatch(/\{\{#each languages\}\}/);
    expect(header).toMatch(/hreflang="\{\{hreflang\}\}"/);
    expect(header).toMatch(/lang="\{\{hreflang\}\}"/);
    expect(header).toMatch(/data-lang-code="\{\{code\}\}"/);
    expect(header).toMatch(/aria-current="true"/);
    // The bilingual switcher must NOT use emoji (repo convention).
    expect(header).not.toContain('🌐');
  });

  it('KDV-I18N-06: the switcher carries the intelligent-hint hooks from the dataset', () => {
    expect(header).toContain('data-current-locale="{{locale}}"');
    expect(header).toContain('data-lang-hint-template="{{copy.lang_hint}}"');
  });

  it('KDV-I18N-06: the first-visit offer is gone', () => {
    expect(header).not.toContain('lang-offer');
    expect(header).not.toContain('data-offer-template');
    expect(header).not.toContain('data-cta-label');
  });

  it('KDV-I18N-06: the switcher/hint copy is catalog-backed', () => {
    expect(EN.LANG_SWITCH_LABEL).toBe('Language');
    expect(EN.LANG_HINT).toContain('{language}');
    // The retired offer keys are gone from the catalog.
    expect(EN.LANG_OFFER_TEXT).toBeUndefined();
    expect(EN.LANG_OFFER_CTA).toBeUndefined();
    expect(EN.LANG_OFFER_DISMISS).toBeUndefined();
  });
});

describe('buildLanguages (KDV-I18N-06)', () => {
  it('KDV-I18N-06: lists every built locale with the same page href and marks the current one', () => {
    const langs = buildLanguages('about/', 'ru', ['en', 'ru', 'zh-Hans', 'es']);
    expect(langs.map((entry) => entry.code)).toEqual(['en', 'ru', 'zh-Hans', 'es']);
    expect(langs.map((entry) => entry.endonym)).toEqual(['English', 'Русский', '中文', 'Español']);
    expect(langs.map((entry) => entry.hreflang)).toEqual(['en', 'ru', 'zh-Hans', 'es']);
    expect(langs.map((entry) => entry.href)).toEqual(['/about/', '/ru/about/', '/zh/about/', '/es/about/']);
    expect(langs.filter((entry) => entry.current).map((entry) => entry.code)).toEqual(['ru']);
  });

  it('KDV-I18N-06: hrefs are root-relative for the home and dump paths too', () => {
    expect(buildLanguages('', 'en', ['en', 'ru']).map((entry) => entry.href)).toEqual(['/', '/ru/']);
    expect(buildLanguages('dumps/sample-dump/', 'en', ['en', 'ru']).map((entry) => entry.href)).toEqual([
      '/dumps/sample-dump/',
      '/ru/dumps/sample-dump/',
    ]);
  });
});

describe('datasets carry languages + locale (KDV-I18N-06)', () => {
  let enRoutes;
  let ruRoutes;
  let dumpEn;
  let dumpRu;

  beforeAll(async () => {
    enRoutes = buildRouteDatasets([], { baseUrl: BASE, logo: '' });
    ruRoutes = buildRouteDatasets([], { baseUrl: BASE, logo: '', locale: 'ru' });
    const dumps = await readDumps(FIXTURES);
    const fixture = dumps.find((entry) => entry.slug === 'sample-dump');
    dumpEn = toDataset(fixture, { baseUrl: BASE });
    dumpRu = toDataset(fixture, { baseUrl: BASE, locale: 'ru' });
  });

  it('KDV-I18N-06: every route dataset carries `locale` and a `languages` array with one current', () => {
    for (const [name, dataset] of Object.entries(enRoutes)) {
      expect(dataset.locale, name).toBe('en');
      expect(Array.isArray(dataset.languages), name).toBe(true);
      expect(dataset.languages.filter((entry) => entry.current).length, name).toBe(1);
      expect(dataset.languages.find((entry) => entry.code === 'en').endonym, name).toBe('English');
    }
    // The 404 is default-locale only; it must not link a /ru/404 that is not emitted.
    expect(enRoutes.notfound.languages.map((entry) => entry.href)).toEqual(['/404']);
    expect(enRoutes.home.languages.map((entry) => entry.href)).toEqual(['/', '/ru/', '/zh/', '/es/']);
  });

  it('KDV-I18N-06: a non-default route dataset marks its own locale and links the default', () => {
    expect(ruRoutes.about.locale).toBe('ru');
    expect(ruRoutes.about.languages.find((entry) => entry.current).href).toBe('/ru/about/');
    expect(ruRoutes.about.languages.find((entry) => entry.code === 'en').href).toBe('/about/');
  });

  it('KDV-I18N-06: a dump dataset carries the switcher entries for the same dump', () => {
    expect(dumpEn.locale).toBe('en');
    expect(dumpEn.languages.map((entry) => entry.href)).toEqual([
      '/dumps/sample-dump/',
      '/ru/dumps/sample-dump/',
      '/zh/dumps/sample-dump/',
      '/es/dumps/sample-dump/',
    ]);
    expect(dumpEn.languages.find((entry) => entry.current).code).toBe('en');
    expect(dumpRu.locale).toBe('ru');
    expect(dumpRu.languages.find((entry) => entry.current).code).toBe('ru');
  });
});

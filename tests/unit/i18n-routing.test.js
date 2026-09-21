// tests/unit/i18n-routing.test.js — the per-locale dataset coordinate and the
// route → public-path mapping (phase 2: mechanism only, en stays bare-keyed).
import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCALE, datasetName, parseDataset } from '../../scripts/lib/i18n.mjs';
import { ROUTE_PAGES, routeOutputPath } from '../../scripts/lib/pages.mjs';

describe('i18n dataset routing (KDV-I18N-03)', () => {
  it('KDV-I18N-03: the default locale keeps the bare key, others are prefixed', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(datasetName(DEFAULT_LOCALE, 'main')).toBe('main');
    expect(datasetName('en', '2026-09-14-x')).toBe('2026-09-14-x');
    expect(datasetName('ru', 'main')).toBe('ru__main');
    expect(datasetName('ru', '2026-09-14-x')).toBe('ru__2026-09-14-x');
    expect(datasetName('zh-Hans', 'main')).toBe('zh-Hans__main');
    expect(datasetName('es', '2026-09-14-x')).toBe('es__2026-09-14-x');
  });

  it('KDV-I18N-03: parseDataset recovers the locale and the key', () => {
    expect(parseDataset('main')).toEqual({ locale: 'en', key: 'main' });
    expect(parseDataset('2026-09-14-x')).toEqual({ locale: 'en', key: '2026-09-14-x' });
    expect(parseDataset('ru__main')).toEqual({ locale: 'ru', key: 'main' });
    expect(parseDataset('ru__2026-09-14-x')).toEqual({ locale: 'ru', key: '2026-09-14-x' });
    expect(parseDataset('en__main')).toEqual({ locale: 'en', key: 'main' });
    // An unknown prefix is not a locale: the whole name is a default-locale key.
    expect(parseDataset('xx__main')).toEqual({ locale: 'en', key: 'xx__main' });
  });

  it('KDV-I18N-03: datasetName and parseDataset round-trip for every locale', () => {
    for (const locale of ['en', 'ru', 'zh-Hans', 'es']) {
      for (const key of ['main', '2026-09-14-x']) {
        expect(parseDataset(datasetName(locale, key))).toEqual({ locale, key });
      }
    }
  });

  it('KDV-I18N-03: the default locale maps to today’s unprefixed output paths', () => {
    expect(routeOutputPath({ locale: 'en', layout: 'home', key: 'main', paginated: true })).toBe('index.html');

    expect(routeOutputPath({ locale: 'en', layout: 'about', key: 'main' })).toBe('about/index.html');
    expect(routeOutputPath({ locale: 'en', layout: 'contribute', key: 'main' })).toBe('contribute/index.html');
    expect(routeOutputPath({ locale: 'en', layout: 'notfound', key: 'main' })).toBe('404.html');
    expect(routeOutputPath({ locale: 'en', layout: 'dumps', key: 'sample-dump' })).toBe('dumps/sample-dump/index.html');
  });

  it('KDV-I18N-03: a non-default locale maps under its URL prefix; the 404 is deferred', () => {
    expect(routeOutputPath({ locale: 'ru', layout: 'home', key: 'main', paginated: true })).toBe('/ru/index.html');

    expect(routeOutputPath({ locale: 'zh-Hans', layout: 'about', key: 'main' })).toBe('/zh/about/index.html');
    expect(routeOutputPath({ locale: 'es', layout: 'contribute', key: 'main' })).toBe('/es/contribute/index.html');
    expect(routeOutputPath({ locale: 'ru', layout: 'dumps', key: 'sample-dump' })).toBe('/ru/dumps/sample-dump/index.html');
    expect(routeOutputPath({ locale: 'ru', layout: 'notfound', key: 'main' })).toBeNull();
  });

  it('KDV-I18N-03: ROUTE_PAGES stays the route source of truth', () => {
    expect(ROUTE_PAGES.length).toBeGreaterThan(0);
    for (const page of ROUTE_PAGES) {
      expect(page.layout, 'route layout').toBeTruthy();
      expect(page.to, 'route target').toBeTruthy();
    }
  });
});

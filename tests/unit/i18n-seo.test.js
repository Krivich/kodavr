// tests/unit/i18n-seo.test.js — KDV-I18N-04: the alternate-locale SEO cluster.
// A built page carries the hreflang cluster over the BUILT locales plus
// x-default (→ the default locale's variant) and one og:locale:alternate per
// other built locale; the sitemap mirrors each page's alternates as xhtml:link
// entries. A locale that is not emitted is never linked.
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLValidator } from 'fast-xml-parser';
import { buildAlternates, ogLocaleAlternates, buildRouteDatasets } from '../../scripts/lib/pages.mjs';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';
import { writeSitemap } from '../../scripts/lib/machine.mjs';
import { LOCALES, translatedLocales } from '../../scripts/lib/i18n.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const BASE = 'https://example.test';
const BUILT = translatedLocales();

const htmlLang = (code) => LOCALES.find((locale) => locale.code === code).htmlLang;
const ogLocale = (code) => LOCALES.find((locale) => locale.code === code).ogLocale;

// The `<url>` block of a sitemap for one `<loc>` (same helper shape as the
// integration build test).
function urlBlock(sitemap, loc) {
  const at = sitemap.indexOf(`<loc>${loc}</loc>`);
  expect(at, `sitemap is missing ${loc}`).toBeGreaterThan(-1);
  return sitemap.slice(sitemap.lastIndexOf('<url>', at), sitemap.indexOf('</url>', at));
}

describe('i18n alternate-locale SEO cluster (KDV-I18N-04)', () => {
  it('KDV-I18N-04: buildAlternates covers every built locale, plus x-default → the default', () => {
    const alternates = buildAlternates('about/', { base: BASE });
    expect(alternates.map((entry) => entry.hreflang)).toEqual([...BUILT.map(htmlLang), 'x-default']);
    expect(alternates.find((entry) => entry.hreflang === 'en').href).toBe(`${BASE}/about/`);
    expect(alternates.find((entry) => entry.hreflang === 'ru').href).toBe(`${BASE}/ru/about/`);
    expect(alternates.find((entry) => entry.hreflang === 'x-default').href).toBe(`${BASE}/about/`);
    // A registered locale that is not emitted never enters the cluster.
    for (const code of ['zh-Hans', 'es']) {
      if (!BUILT.includes(code)) {
        expect(alternates.some((entry) => entry.hreflang === htmlLang(code)), code).toBe(false);
      }
    }
  });

  it('KDV-I18N-04: buildAlternates anchors the home path and a single-locale page', () => {
    const home = buildAlternates('', { base: BASE });
    expect(home.find((entry) => entry.hreflang === 'en').href).toBe(`${BASE}/`);
    expect(home.find((entry) => entry.hreflang === 'ru').href).toBe(`${BASE}/ru/`);
    // The deferred per-locale 404 links only the locale that is emitted.
    expect(buildAlternates('404', { base: BASE, locales: ['en'] })).toEqual([
      { hreflang: 'en', href: `${BASE}/404` },
      { hreflang: 'x-default', href: `${BASE}/404` },
    ]);
  });

  it('KDV-I18N-04: ogLocaleAlternates lists every OTHER built locale', () => {
    expect(ogLocaleAlternates('en')).toEqual(BUILT.filter((code) => code !== 'en').map(ogLocale));
    expect(ogLocaleAlternates('ru')).toEqual(BUILT.filter((code) => code !== 'ru').map(ogLocale));
    expect(ogLocaleAlternates('en', ['en'])).toEqual([]);
    expect(ogLocaleAlternates('en')).toContain('ru_RU');
  });

  it('KDV-I18N-04: route and dump datasets carry the cluster and the alternate OG locales', async () => {
    const en = buildRouteDatasets([], { baseUrl: BASE, logo: '', locale: 'en' });
    expect(en.home.alternates).toEqual(buildAlternates('', { base: BASE }));
    expect(en.home.og_locale_alternates).toEqual(BUILT.filter((code) => code !== 'en').map(ogLocale));
    expect(en.notfound.alternates).toEqual([
      { hreflang: 'en', href: `${BASE}/404` },
      { hreflang: 'x-default', href: `${BASE}/404` },
    ]);
    expect(en.notfound.og_locale_alternates).toEqual([]);

    const ru = buildRouteDatasets([], { baseUrl: BASE, logo: '', locale: 'ru' });
    expect(ru.home.alternates).toEqual(buildAlternates('', { base: BASE }));
    expect(ru.home.og_locale_alternates).toEqual(BUILT.filter((code) => code !== 'ru').map(ogLocale));

    const dumps = await readDumps(FIXTURES);
    const fixture = dumps.find((dump) => dump.slug === 'sample-dump');
    const enDump = toDataset(fixture, { baseUrl: BASE, locale: 'en' });
    expect(enDump.alternates).toEqual(buildAlternates('dumps/sample-dump/', { base: BASE }));
    expect(enDump.og_locale_alternates).toEqual(BUILT.filter((code) => code !== 'en').map(ogLocale));
    expect(enDump.og_locale_alternates).toContain('zh_CN');
    const ruDump = toDataset(fixture, { baseUrl: BASE, locale: 'ru' });
    expect(ruDump.alternates.find((entry) => entry.hreflang === 'ru').href).toBe(
      `${BASE}/ru/dumps/sample-dump/`,
    );
    expect(ruDump.og_locale_alternates).toEqual(BUILT.filter((code) => code !== 'ru').map(ogLocale));
    // A built locale joins the cluster over the dump path too.
    const zhDump = toDataset(fixture, { baseUrl: BASE, locale: 'zh-Hans' });
    expect(zhDump.alternates.find((entry) => entry.hreflang === 'zh-Hans').href).toBe(
      `${BASE}/zh/dumps/sample-dump/`,
    );
  });

  it('KDV-I18N-04: the sitemap mirrors the cluster as xhtml:link and declares the xhtml namespace', async () => {
    const tmpBase = join(ROOT, 'tmp');
    await mkdir(tmpBase, { recursive: true });
    const out = await mkdtemp(join(tmpBase, 'i18n-seo-'));
    try {
      for (const rel of [
        'index.html',
        'ru/index.html',
        'about/index.html',
        'ru/about/index.html',
        'dumps/sample-dump/index.html',
        'ru/dumps/sample-dump/index.html',
        'home/main/page/1.html', // a single-locale engine page
        '404.html',
      ]) {
        const parts = rel.split('/');
        await mkdir(join(out, ...parts.slice(0, -1)), { recursive: true });
        await writeFile(join(out, ...parts), '<html></html>', 'utf8');
      }
      const dumps = [{ slug: 'sample-dump', manifest: { slug: 'sample-dump', date: '2026-09-14' } }];
      await writeSitemap({ outputDir: out, baseUrl: BASE, dumps, generatedAt: '2026-01-01T00:00:00.000Z' });
      const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');

      expect(XMLValidator.validate(sitemap)).toBe(true);
      expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
      expect(sitemap).not.toContain('/404</loc>');

      const enAbout = urlBlock(sitemap, `${BASE}/about/`);
      expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${BASE}/about/"/>`);
      expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="ru" href="${BASE}/ru/about/"/>`);
      expect(enAbout).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/about/"/>`);
      expect(urlBlock(sitemap, `${BASE}/ru/about/`)).toContain(
        `<xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/about/"/>`,
      );
      // A single-locale page is not linked to a locale that is not emitted.
      expect(urlBlock(sitemap, `${BASE}/home/main/page/1`)).not.toContain('xhtml:link');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

// tests/unit/i18n-body-language.test.js — KDV-I18N-02/05: a dump body is never
// translated and its language is stated honestly on the page. The JSON-LD graph
// splits the frame's language (the page's UI locale) from the Article's language
// (the body's own `lang`), and the manifest schema gains an optional `lang`.
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';
import { buildRouteDatasets } from '../../scripts/lib/pages.mjs';
import { buildManifestSchema } from '../../scripts/lib/schema.mjs';
import { t, assertComplete } from '../../scripts/lib/i18n.mjs';

const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const BASE = 'https://example.test';

async function sampleDump() {
  return (await readDumps(FIXTURES)).find((dump) => dump.slug === 'sample-dump');
}

const graphOf = (dataset) => JSON.parse(dataset.jsonld)['@graph'];
const nodeOf = (graph, type) => graph.find((node) => node['@type'] === type);

describe('dump body language (KDV-I18N-02)', () => {
  it('KDV-I18N-02: an en frame around an en body has no note and the body is unchanged', async () => {
    const dump = await sampleDump();
    const en = toDataset(dump, { baseUrl: BASE, locale: 'en' });
    // A manifest without `lang` defaults to `en` — no note on an `en` frame.
    expect(en.body_lang_note).toBeNull();
    expect(en.body_html).toContain('<h1>Sample Heading</h1>');
    // The default locale output is byte-identical whether or not `lang` is set.
    const explicitEn = toDataset(
      { ...dump, manifest: { ...dump.manifest, lang: 'en' } },
      { baseUrl: BASE, locale: 'en' },
    );
    expect(explicitEn.body_html).toBe(en.body_html);
    expect(explicitEn.body_lang_note).toBeNull();
  });

  it('KDV-I18N-02: a ru frame around an en body shows the localized note, never a translation', async () => {
    const dump = await sampleDump();
    const ru = toDataset(dump, { baseUrl: BASE, locale: 'ru' });
    expect(ru.body_lang_note).toBe(
      t('BODY_LANGUAGE_NOTE', 'ru', { language: t('LANGUAGE_NAMES', 'ru').en }),
    );
    expect(ru.body_lang_note).toContain('английском');
    // The platform never translates the body: the rendered HTML is identical to
    // the English frame's render.
    const en = toDataset(dump, { baseUrl: BASE, locale: 'en' });
    expect(ru.body_html).toBe(en.body_html);
  });

  it('KDV-I18N-02: a body already in the frame language gets no note', async () => {
    const dump = await sampleDump();
    const ruBody = toDataset(
      { ...dump, manifest: { ...dump.manifest, lang: 'ru' } },
      { baseUrl: BASE, locale: 'ru' },
    );
    expect(ruBody.body_lang_note).toBeNull();
  });

  it('KDV-I18N-02: the language-name map is localized and the bundles stay complete', () => {
    expect(t('LANGUAGE_NAMES', 'en')).toMatchObject({ en: 'English', ru: 'Russian', 'zh-Hans': 'Simplified Chinese' });
    expect(t('LANGUAGE_NAMES', 'ru')).toMatchObject({ en: 'английском', ru: 'русском' });
    expect(t('LANGUAGE_NAMES', 'zh-Hans')).toMatchObject({ en: '英语', 'zh-Hans': '简体中文' });
    expect(t('LANGUAGE_NAMES', 'es')).toMatchObject({ en: 'inglés', es: 'español' });
    for (const locale of ['en', 'ru', 'zh-Hans', 'es']) {
      expect(() => assertComplete(locale), locale).not.toThrow();
    }
  });

  it('KDV-I18N-02: an unknown body language falls back to the raw code, never a wrong name', async () => {
    const dump = await sampleDump();
    const de = toDataset(
      { ...dump, manifest: { ...dump.manifest, lang: 'de' } },
      { baseUrl: BASE, locale: 'en' },
    );
    expect(de.body_lang_note).toBe(t('BODY_LANGUAGE_NOTE', 'en', { language: 'de' }));
    expect(de.body_lang_note).toContain('de');
  });
});

describe('JSON-LD language split (KDV-I18N-05)', () => {
  it('KDV-I18N-05: frame nodes carry the UI locale; the Article carries the body language', async () => {
    const dump = await sampleDump();

    const en = graphOf(toDataset(dump, { baseUrl: BASE, locale: 'en' }));
    expect(nodeOf(en, 'WebSite').inLanguage).toBe('en');
    expect(nodeOf(en, 'WebPage').inLanguage).toBe('en');
    expect(nodeOf(en, 'Article').inLanguage).toBe('en');

    // A ru frame around an en body: the frame is ru, the article is en.
    const ru = graphOf(toDataset(dump, { baseUrl: BASE, locale: 'ru' }));
    expect(nodeOf(ru, 'WebSite').inLanguage).toBe('ru');
    expect(nodeOf(ru, 'WebPage').inLanguage).toBe('ru');
    expect(nodeOf(ru, 'Article').inLanguage).toBe('en');

    // A ru body: the Article follows the body, the frame stays the UI locale.
    const ruBody = graphOf(
      toDataset({ ...dump, manifest: { ...dump.manifest, lang: 'ru' } }, { baseUrl: BASE, locale: 'ru' }),
    );
    expect(nodeOf(ruBody, 'Article').inLanguage).toBe('ru');
    expect(nodeOf(ruBody, 'WebPage').inLanguage).toBe('ru');
  });

  it('KDV-I18N-05: the home CollectionPage carries the UI locale', () => {
    const ru = buildRouteDatasets([], { baseUrl: BASE, logo: '', locale: 'ru' });
    const ruGraph = graphOf(ru.home);
    expect(nodeOf(ruGraph, 'CollectionPage').inLanguage).toBe('ru');
    expect(nodeOf(ruGraph, 'WebPage').inLanguage).toBe('ru');

    const en = buildRouteDatasets([], { baseUrl: BASE, logo: '', locale: 'en' });
    const enGraph = graphOf(en.home);
    expect(nodeOf(enGraph, 'WebSite').inLanguage).toBe('en');
    expect(nodeOf(enGraph, 'WebPage').inLanguage).toBe('en');
    expect(nodeOf(enGraph, 'CollectionPage').inLanguage).toBe('en');
  });

  it('KDV-I18N-05: the manifest schema gains an OPTIONAL BCP-47 `lang` for the body', () => {
    const schema = buildManifestSchema({ baseUrl: BASE });
    expect(schema.properties.lang).toMatchObject({ type: 'string' });
    expect(schema.properties.lang.description).toMatch(/body/i);
    expect(schema.properties.lang.description).toMatch(/BCP-47/i);
    expect(schema.properties.lang.description).toMatch(/default `en`/i);
    // Optional: no `required` list mentions it, so existing manifests validate.
    expect(schema.required ?? []).not.toContain('lang');
  });
});

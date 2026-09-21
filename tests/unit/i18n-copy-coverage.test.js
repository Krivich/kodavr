// tests/unit/i18n-copy-coverage.test.js — KDV-I18N-07 (phase 4a): the whole
// dataset `copy` object is locale-resolved. Every `copy.<field>` a template
// renders exists in the assembled English copy, and every catalog key is
// reachable from a template field, a top-level dataset field, or the copydeck.
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { t } from '../../scripts/lib/i18n.mjs';
import { EN } from '../../scripts/lib/i18n-en.mjs';
import * as copy from '../../scripts/lib/copy.mjs';
import { COPY_FIELDS, buildRouteDatasets, catalogKeyFor } from '../../scripts/lib/pages.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));

// Top-level dataset fields that resolve through the catalog but are not `copy.*`
// (page titles/descriptions, taglines, nav labels, the prompt template, the
// trust legend and the non-string structures).
const TOP_LEVEL_KEYS = new Set([
  'HOME_TITLE',
  'HOME_TAGLINE',
  'OG_TAGLINE',
  'RECEPTION_PAGE_TITLE',
  'RECEPTION_PAGE_DESCRIPTION',
  'ABOUT_PAGE_TITLE',
  'ABOUT_PAGE_DESCRIPTION',
  'CONTRIBUTE_PAGE_TITLE',
  'CONTRIBUTE_PAGE_DESCRIPTION',
  'NOT_FOUND_PAGE_TITLE',
  'NOT_FOUND_PAGE_DESCRIPTION',
  'NAV_HOME',
  'NAV_RECEPTION',
  'NAV_ABOUT',
  'NAV_CONTRIBUTE',
  'PROMPT_TEMPLATE',
  'TRUST_LEGEND_LEAD',
  'AGENT_LINKS',
  'MANIFEST_LABELS',
  'TRUST_LEVEL_MEANINGS',
  // §11/KDV-I18N-02: the body-language note and the language-name map resolve
  // through `t()` inside dumps.mjs (not a `copy.*` template field).
  'BODY_LANGUAGE_NOTE',
  'LANGUAGE_NAMES',
]);

function templateCopyFields(dir) {
  const fields = new Set();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const field of templateCopyFields(path)) fields.add(field);
    } else if (entry.name.endsWith('.hbs')) {
      for (const match of readFileSync(path, 'utf8').matchAll(/copy\.([a-zA-Z0-9_]+)/g)) {
        fields.add(match[1]);
      }
    }
  }
  return fields;
}

describe('i18n dataset copy coverage (KDV-I18N-07)', () => {
  let referenced;
  let union;
  let dump;

  beforeAll(async () => {
    referenced = templateCopyFields(join(ROOT, 'input/templates'));
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test', logo: '' });
    const { readDumps, toDataset } = await import('../../scripts/lib/dumps.mjs');
    const dumps = await readDumps(FIXTURES);
    dump = toDataset(dumps.find((entry) => entry.slug === 'sample-dump'), {
      baseUrl: 'https://example.test',
      logo: '',
      builtAt: '2026-01-01T00:00:00.000Z',
    });
    union = Object.assign({}, ...Object.values(routes).map((dataset) => dataset.copy), dump.copy);
  });

  it('KDV-I18N-07: every template copy field is present in the assembled English copy', () => {
    const missing = [...referenced].filter((field) => !(field in union)).sort();
    expect(missing, `uncovered copy fields: ${missing.join(', ')}`).toEqual([]);
    expect(referenced.size).toBeGreaterThan(100);
  });

  it('KDV-I18N-07: every catalog-backed field has a key that resolves', () => {
    for (const field of referenced) {
      const key = catalogKeyFor(field);
      if (key === null) continue; // contract_version / footer_report_url are literal
      expect(Object.prototype.hasOwnProperty.call(EN, key), `${field} -> ${key}`).toBe(true);
      expect(() => t(key, 'en'), key).not.toThrow();
    }
  });

  it('KDV-I18N-07: every catalog key is reachable (mapped field, top-level, or copydeck)', () => {
    const mapped = new Set();
    for (const field of referenced) {
      const key = catalogKeyFor(field);
      if (key) mapped.add(key);
    }
    for (const group of Object.values(COPY_FIELDS)) {
      for (const field of group) mapped.add(catalogKeyFor(field));
    }
    const copyStrings = new Set(Object.keys(copy).filter((key) => typeof copy[key] === 'string'));
    const unreachable = Object.keys(EN).filter(
      (key) => !mapped.has(key) && !TOP_LEVEL_KEYS.has(key) && !copyStrings.has(key),
    );
    expect(unreachable, `unreachable catalog keys: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('KDV-I18N-07: the assembled copy flows through the catalog, not a retyped literal', () => {
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test', logo: '' });
    expect(routes.home.copy.home_humans_lead).toBe(t('HOME_HUMANS_LEAD', 'en'));
    expect(routes.home.copy.footer).toBe(t('FOOTER_TEXT', 'en'));
    expect(routes.notfound.copy.notFound).toBe(t('NOT_FOUND_TEXT', 'en'));

    expect(routes.about.copy.about_kicker).toBe(t('ABOUT_KICKER', 'en'));
    expect(dump.copy.prompt).toBe(t('PROMPT_TEMPLATE', 'en', { url: dump.manifest_url }));
    expect(dump.copy.labels).toEqual(t('MANIFEST_LABELS', 'en'));
  });

  it('KDV-I18N-07: t passes non-string values through and never substitutes them', () => {
    expect(Array.isArray(t('AGENT_LINKS', 'en'))).toBe(true);
    expect(t('MANIFEST_LABELS', 'en')).toHaveProperty('heading', 'Manifest');
    expect(t('MANIFEST_LABELS', 'en', { heading: 'X' })).toEqual(t('MANIFEST_LABELS', 'en'));
    expect(t('TRUST_LEVEL_MEANINGS', 'en').length).toBeGreaterThan(0);
    expect(t('PROMPT_TEMPLATE', 'en', { url: 'https://example.test/manifest.json' })).toBe(
      'Study https://example.test/manifest.json and follow its schema. Read articles to me and act like a magazine I can talk to.',
    );
  });
});

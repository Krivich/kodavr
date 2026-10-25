// tests/unit/seo-budgets.test.js — the search-surface budgets (KDV-SURFACE-33/34,
// KDV-MANIFEST-13) and the honest-sitemap rules (KDV-SURFACE-30/35).
//
// Three contracts meet here:
//   — `<title>` and `<meta name="description">` are BUDGETED projections of the
//     authored strings: the brand suffix is dropped before the title is ever
//     shortened, the snippet is cut at a word boundary and never carries the
//     agent tail, and `og:*` keeps the full composed line;
//   — the sitemap carries only documents of their own (engine pagination files
//     canonicalize to the locale root, so they are not submitted) and a `lastmod`
//     only where it is honest (a dump's own content date; nowhere else);
//   — a manifest that would overflow the budgets is rejected at validation time,
//     so the ceiling is a mechanism, not advice.
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLValidator } from 'fast-xml-parser';
import {
  clampForSearch,
  titleTag,
  buildRouteDatasets,
  META_DESCRIPTION_MAX,
  TITLE_TAG_MAX,
} from '../../scripts/lib/pages.mjs';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';
import { writeSitemap } from '../../scripts/lib/machine.mjs';
import { validateManifest } from '../../scripts/tooling/quality-gates/validate.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const BASE = 'https://example.test';

// A manifest that satisfies every required field, so a budget failure is the only
// failure a case can produce.
function manifest(overrides = {}) {
  return {
    slug: '2026-01-01-budget-case',
    type: 'case',
    title: 'A title that fits the budget',
    date: '2026-01-01',
    domain: 'engineering',
    tags: ['budget'],
    stakes: 'low',
    content_flags: [],
    trust_level: 'raw',
    generated_by: 'human',
    human_review: 'none',
    summary: 'One sentence that fits the budget.',
    ...overrides,
  };
}

describe('search-surface budgets (KDV-SURFACE-33/34)', () => {
  it('KDV-SURFACE-33: titleTag keeps the brand suffix only when the tag stays inside the budget', () => {
    expect(titleTag('Short')).toBe('Short · Kodavr');
    // Exactly at the ceiling keeps the suffix.
    const exact = 'x'.repeat(TITLE_TAG_MAX - ' · Kodavr'.length);
    expect(titleTag(exact)).toBe(`${exact} · Kodavr`);
    expect(titleTag(exact).length).toBe(TITLE_TAG_MAX);
    // One character over: the suffix is what goes, never the authored title.
    const over = `${exact}y`;
    expect(titleTag(over)).toBe(over);
    expect(titleTag(over).length).toBeLessThanOrEqual(TITLE_TAG_MAX);
  });

  it('KDV-SURFACE-34: clampForSearch cuts at a word boundary, counts the ellipsis, and passes short text through', () => {
    expect(clampForSearch('Short line.')).toBe('Short line.');
    const long = 'word '.repeat(60).trim();
    const clamped = clampForSearch(long);
    expect(clamped.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(clamped.endsWith('…')).toBe(true);
    expect(clamped).not.toMatch(/wor…$/); // never mid-word
    // A single unbroken token is cut, not dropped.
    expect(clampForSearch('z'.repeat(400)).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
  });

  it('KDV-SURFACE-33/34: dump and route datasets carry budgeted title/description while og:* keeps the full line', async () => {
    const dumps = await readDumps(FIXTURES);
    const fixture = dumps.find((dump) => dump.slug === 'sample-dump');
    const dataset = toDataset(fixture, { baseUrl: BASE, locale: 'en' });
    expect(dataset.title_tag.length).toBeLessThanOrEqual(TITLE_TAG_MAX);
    expect(dataset.meta_description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(dataset.og_title).toBe(dataset.title);
    expect(dataset.og_description.length).toBeGreaterThan(dataset.meta_description.length);

    const routes = buildRouteDatasets([], { baseUrl: BASE, logo: '', locale: 'en' });
    for (const layout of Object.keys(routes)) {
      const page = routes[layout];
      // KDV-SURFACE-33: the copydeck's own title is the author's string — the
      // suffix is what may never push the tag over the budget. A title that leaves
      // no room keeps the suffix out (never a truncated H1); a dump, whose title is
      // data, is held to the budget by KDV-MANIFEST-13 instead.
      const withSuffix = `${page.title} · Kodavr`;
      expect([page.title, withSuffix], layout).toContain(page.title_tag);
      if (page.title_tag !== page.title) expect(page.title_tag.length, layout).toBeLessThanOrEqual(TITLE_TAG_MAX);
      expect(page.meta_description.length, layout).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
      expect(page.og_title, layout).toBe(page.title);
    }
  });
});

describe('sitemap honesty (KDV-SURFACE-30/35)', () => {
  it('KDV-SURFACE-35: engine pagination files are not submitted, and every locale of a dump carries its own date', async () => {
    const out = await mkdtemp(join(ROOT, 'tmp', 'seo-sitemap-'));
    try {
      for (const rel of [
        'index.html',
        'ru/index.html',
        'about/index.html',
        'dumps/sample-dump/index.html',
        'ru/dumps/sample-dump/index.html',
        'home/main/page/1.html',
        'home/main/page/2.html',
        'home/ru__main/page/2.html',
        '404.html',
      ]) {
        await mkdir(join(out, ...rel.split('/').slice(0, -1)), { recursive: true });
        await writeFile(join(out, ...rel.split('/')), '<html></html>', 'utf8');
      }
      const dumps = [{ slug: 'sample-dump', manifest: { slug: 'sample-dump', date: '2026-09-14' } }];
      await writeSitemap({ outputDir: out, baseUrl: BASE, dumps });
      const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');

      expect(XMLValidator.validate(sitemap)).toBe(true);
      // Pagination files canonicalize to the locale root — never documents of their own.
      expect(sitemap).not.toContain('/home/main/page/');
      expect(sitemap).not.toContain('/home/ru__main/page/');
      // The dump's date reaches every locale variant.
      const dumpBlock = (loc) => {
        const at = sitemap.indexOf(`<loc>${loc}</loc>`);
        expect(at, loc).toBeGreaterThan(-1);
        return sitemap.slice(sitemap.lastIndexOf('<url>', at), sitemap.indexOf('</url>', at));
      };
      expect(dumpBlock(`${BASE}/dumps/sample-dump/`)).toContain('<lastmod>2026-09-14</lastmod>');
      expect(dumpBlock(`${BASE}/ru/dumps/sample-dump/`)).toContain('<lastmod>2026-09-14</lastmod>');
      // A page whose content date is unknown publishes no lastmod instead of the build time.
      expect(dumpBlock(`${BASE}/about/`)).not.toContain('<lastmod>');
      expect(dumpBlock(`${BASE}/`)).not.toContain('<lastmod>');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('KDV-SURFACE-30: a dump edited after publication reports the later content date', async () => {
    const out = await mkdtemp(join(ROOT, 'tmp', 'seo-lastmod-'));
    try {
      await mkdir(join(out, 'dumps', 'sample-dump'), { recursive: true });
      await writeFile(join(out, 'dumps', 'sample-dump', 'index.html'), '<html></html>', 'utf8');
      const dumps = [
        {
          slug: 'sample-dump',
          manifest: { slug: 'sample-dump', date: '2026-09-14' },
          lastModified: '2026-10-24',
        },
      ];
      await writeSitemap({ outputDir: out, baseUrl: BASE, dumps });
      const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
      expect(sitemap).toContain('<lastmod>2026-10-24</lastmod>');
      expect(sitemap).not.toContain('2026-09-14');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe('manifest budgets are enforced (KDV-MANIFEST-13)', () => {
  it('KDV-MANIFEST-13: a title or summary over the ceiling is a validation error; the ceiling itself passes', () => {
    const errors = [];
    validateManifest(manifest({ title: 't'.repeat(60), summary: 's'.repeat(200) }), 'x', errors);
    expect(errors.filter((e) => /title|summary/.test(e) && /≤/.test(e))).toEqual([]);

    const over = [];
    validateManifest(manifest({ title: 't'.repeat(61), summary: 's'.repeat(201) }), 'x', over);
    expect(over.some((e) => e.includes('`title` must be ≤60'))).toBe(true);
    expect(over.some((e) => e.includes('`summary` must be ≤200'))).toBe(true);
  });
});

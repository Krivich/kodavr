// tests/unit/page-header.test.js — the page-header contract (KDV-SURFACE-23).
//
// Every human route opens with one header block: a muted kicker (what the page is),
// one H1 (its title) and a lead (the opening sentence). The 404 shares the kicker
// and keeps exactly one (screen-reader-only) H1. Structural only — no sizes, no
// pixel geometry; the visual grammar itself is docs/design-system.md.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EN } from '../../scripts/lib/i18n-en.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const template = (name) => readFileSync(join(ROOT, 'input/templates', name), 'utf8');

// Phase 3a/3b: every route kicker comes from the dataset (`copy.<field>`,
// catalog value asserted below); the template source carries the binding.
// §6.1 v4/KDV-SURFACE-23: the home storefront has no kicker and no numbered
// plate label — its hero is the literal `KODAVR` wordmark over a lead — so only
// /about/ and /contribute/ carry the kicker → H1 → lead opening block.
const ROUTES = [
  ['about.hbs', '{{copy.about_kicker}}', 'ABOUT_KICKER', 'about the platform'],
  ['contribute.hbs', '{{copy.contribute_kicker}}', 'CONTRIBUTE_KICKER', 'for authors'],
];

describe('page header: kicker + H1 + lead (KDV-SURFACE-23)', () => {
  it('KDV-SURFACE-23: the home storefront opens with the KODAVR wordmark and a lead, no kicker, no plate label', () => {
    const tpl = template('home.hbs');
    const start = tpl.indexOf('<main');
    const header = tpl.slice(start, tpl.indexOf('</section>', start));

    // The hero is the literal brand wordmark over the positioning lead; the
    // storefront carries no numbered plate label (Human Surface v4).
    expect(header).not.toContain('data-plate=');
    expect(header).toMatch(/<h1 class="home-wordmark">KODAVR<\/h1>/);
    expect(header).toMatch(
      /<p class="home-lead">\{\{home_title\.lead\}\}<strong>\{\{home_title\.term\}\}<\/strong>\{\{home_title\.tail\}\}<\/p>/,
    );
    expect(header).not.toContain('class="kicker"');
    expect(header).not.toContain('class="lead"');
    // exactly one H1 per page (KDV-SURFACE-10 owns the dump exception)
    expect(tpl.match(/<h1\b/g) ?? []).toHaveLength(1);
  });

  for (const [file, kicker, catalogKey, english] of ROUTES) {
    it(`KDV-SURFACE-23: ${file} opens with kicker, one H1 and a lead, in that order`, () => {
      const tpl = template(file);
      const start = tpl.indexOf('<main');
      const header = tpl.slice(start, tpl.indexOf('</section>', start));

      expect(header).toContain(`<p class="kicker">${kicker}</p>`);
      if (catalogKey) expect(EN[catalogKey], catalogKey).toBe(english);
      expect(header).toMatch(/<h1[^>]*>\{\{title\}\}<\/h1>/);
      expect(header).toMatch(/<p class="lead">/);
      expect(header.indexOf('class="kicker"')).toBeLessThan(header.indexOf('<h1'));
      expect(header.indexOf('<h1')).toBeLessThan(header.indexOf('class="lead"'));
      // exactly one H1 per page (KDV-SURFACE-10 owns the dump exception)
      expect(tpl.match(/<h1\b/g) ?? []).toHaveLength(1);
    });
  }

  it('KDV-SURFACE-23: the /contribute/ plate 01 lead is three paragraphs — P1 keeps the lead role, P2/P3 are plain siblings', () => {
    // Owner-dictated three-paragraph lead (D1): paragraph 1 keeps the `lead`
    // role the kicker→H1→lead header contract pins; paragraphs 2–3 render as
    // plain <p> siblings after it — no new classes, existing prose styling.
    const tpl = template('contribute.hbs');
    const start = tpl.indexOf('<main');
    const header = tpl.slice(start, tpl.indexOf('</section>', start));

    const p1 = '<p class="lead">{{copy.contribute_lead}}</p>';
    const p2 = '<p>{{copy.contribute_lead_2}}</p>';
    const p3 = '<p>{{copy.contribute_lead_3}}</p>';
    expect(header, 'P1 lead binding').toContain(p1);
    expect(header, 'P2 plain binding').toContain(p2);
    expect(header, 'P3 plain binding').toContain(p3);

    const h1 = header.indexOf('<h1');
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(header.indexOf(p1)).toBeGreaterThan(h1);
    expect(header.indexOf(p2)).toBeGreaterThan(header.indexOf(p1));
    expect(header.indexOf(p3)).toBeGreaterThan(header.indexOf(p2));
    // The plate carries exactly these three paragraphs after the H1 (the kicker
    // paragraph sits before it): no fourth paragraph, no extra prose.
    const afterH1 = header.slice(header.indexOf('</h1>'));
    expect(afterH1.match(/<p\b/g) ?? []).toHaveLength(3);
  });

  it('KDV-SURFACE-23: the 404 shares the kicker and keeps exactly one (sr-only) H1', () => {
    const tpl = template('notfound.hbs');
    expect(tpl).toContain('<p class="kicker">{{copy.not_found_kicker}}</p>');
    expect(EN.NOT_FOUND_KICKER).toBe('error sheet');
    expect(tpl.match(/<h1\b/g) ?? []).toHaveLength(1);
  });
});

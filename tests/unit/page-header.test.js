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
const ROUTES = [
  ['home.hbs', '{{copy.home_kicker}}', 'HOME_KICKER', 'registry of raw experience'],
  ['reception.hbs', '{{copy.reception_kicker}}', 'RECEPTION_KICKER', 'human surface · check-in'],
  ['about.hbs', '{{copy.about_kicker}}', 'ABOUT_KICKER', 'about the platform'],
  ['contribute.hbs', '{{copy.contribute_kicker}}', 'CONTRIBUTE_KICKER', 'for authors'],
];

describe('page header: kicker + H1 + lead (KDV-SURFACE-23)', () => {
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

  it('KDV-SURFACE-23: the 404 shares the kicker and keeps exactly one (sr-only) H1', () => {
    const tpl = template('notfound.hbs');
    expect(tpl).toContain('<p class="kicker">{{copy.not_found_kicker}}</p>');
    expect(EN.NOT_FOUND_KICKER).toBe('error sheet');
    expect(tpl.match(/<h1\b/g) ?? []).toHaveLength(1);
  });
});

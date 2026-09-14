// tests/unit/a11y.test.js — the static accessibility contract (§6.6, WCAG 2.1 AA).
//
// Four negative-free requirements: landmarks + skip link (KDV-A11Y-01), keyboard
// focus + current-state semantics (KDV-A11Y-04), per-scheme contrast (KDV-A11Y-05)
// and the media/sr-only rules (KDV-A11Y-06). The dynamic dialog/live-region work
// (P6b) is deliberately NOT asserted here.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { buildRouteDatasets } from '../../scripts/lib/pages.mjs';
import { readDumps, toDataset } from '../../scripts/lib/dumps.mjs';
import {
  GATE_MACHINE_LABEL,
  GATE_HUMAN_LABEL,
  RECEPTION_TITLE,
  HALL_ANNOUNCEMENT,
  RECEPTION_ANNOUNCEMENT,
  COPIED_ANNOUNCEMENT,
} from '../../scripts/lib/copy.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const template = (name) => read(join('input', 'templates', name));

// ---------------------------------------------------------------------------
// WCAG 2.1 relative luminance / contrast (no dependency — the test computes it).
// ---------------------------------------------------------------------------

function channel(value) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const clean = String(hex).trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Pull `--token: value;` declarations out of a CSS block.
function tokensOf(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

// ---------------------------------------------------------------------------
// KDV-A11Y-05: both schemes, declared per scheme, AA contrast.
// ---------------------------------------------------------------------------

describe('accessibility: colour contrast (KDV-A11Y-05)', () => {
  const css = read('static/assets/styles.css');
  const lightBlock = css.match(/(?:^|\n):root\s*\{([\s\S]*?)\}/)[1];
  const darkMatch = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\}/);
  const light = tokensOf(lightBlock);

  it('declares an explicit dark palette via prefers-color-scheme', () => {
    expect(darkMatch).not.toBeNull();
  });

  const dark = darkMatch ? tokensOf(darkMatch[1]) : {};

  for (const [scheme, tokens] of [
    ['light', light],
    ['dark', dark],
  ]) {
    it(`${scheme}: --fg and --muted clear 4.5:1 on --bg; --line clears 3:1`, () => {
      for (const key of ['fg', 'bg', 'muted', 'line', 'pre-bg']) {
        expect(tokens[key], `${scheme} --${key}`).toBeTruthy();
      }
      expect(contrast(tokens.fg, tokens.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.muted, tokens.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.line, tokens.bg)).toBeGreaterThanOrEqual(3);
    });
  }

  it('the dark scheme overrides the hardcoded light pre background', () => {
    expect(dark['pre-bg'].toLowerCase()).not.toBe('#f0f0f0');
    expect(light['pre-bg']).toBeTruthy();
    // `pre` reads the token, not a literal light grey.
    expect(css).toMatch(/pre\s*\{[^}]*background:\s*var\(--pre-bg\)/);
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-01: one landmark set per full layout, skip link first.
// ---------------------------------------------------------------------------

describe('accessibility: landmarks and skip link (KDV-A11Y-01)', () => {
  const layouts = readdirSync(join(ROOT, 'input', 'templates'))
    .filter((name) => name.endsWith('.hbs'))
    .map((name) => [name, template(name)])
    .filter(([, content]) => content.includes('<!DOCTYPE'));

  it('finds every full layout (DOCTYPE-bearing) and no fragment', () => {
    expect(layouts.length).toBeGreaterThanOrEqual(6);
    expect(layouts.map(([name]) => name)).not.toContain('home/page.hbs');
  });

  for (const [name, content] of layouts) {
    it(`${name}: skip link is the first body control and main is targetable`, () => {
      expect(content).toMatch(/<body>\s*<a class="skip-link" href="#main">Skip to content<\/a>/);
      expect(content).toMatch(/<main id="main" tabindex="-1"/);
      // The header/footer landmarks live in the shared partials the layout
      // includes, so assert both the include and the partial markup.
      expect(content).toMatch(/\{\{>\s*site\/header\s*\}\}/);
      expect(content).toMatch(/\{\{>\s*site\/footer\s*\}\}/);
      expect(template('site/header.hbs')).toMatch(/<header\b/);
      expect(template('site/footer.hbs')).toMatch(/<footer\b/);
    });
  }

  it('preserves the existing main classes', () => {
    expect(template('dumps.hbs')).toContain('<main id="main" tabindex="-1" class="dump-page">');
    expect(template('home.hbs')).toContain('<main id="main" tabindex="-1" class="home">');
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-04: labelled nav + aria-current + named pagination arrows.
// ---------------------------------------------------------------------------

describe('accessibility: keyboard and current state (KDV-A11Y-04)', () => {
  it('the header nav is labelled and renders the current item from data', () => {
    const header = template('site/header.hbs');
    expect(header).toMatch(/<nav class="site-nav" aria-label="Primary">/);
    expect(header).toMatch(/\{\{#each nav\}\}/);
    expect(header).toMatch(/aria-current="page"/);
  });

  it('route datasets mark exactly the current route; dumps mark none', async () => {
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    const currentOf = (dataset) => dataset.nav.filter((item) => item.current).map((item) => item.href);
    expect(currentOf(routes.home)).toEqual(['/']);
    expect(currentOf(routes.reception)).toEqual(['/reception/']);
    expect(currentOf(routes.about)).toEqual(['/about/']);
    expect(currentOf(routes.contribute)).toEqual(['/contribute/']);
    expect(currentOf(routes.notfound)).toEqual([]);

    const dumps = await readDumps(FIXTURES);
    const dump = toDataset(dumps.find((d) => d.slug === 'sample-dump'));
    expect(dump.nav).toHaveLength(4);
    expect(dump.nav.every((item) => item.current === false)).toBe(true);
  });

  it('the nav stays free of the MVP non-goals (KDV-SCOPE-01)', () => {
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    for (const item of routes.home.nav) {
      expect(item.href).not.toMatch(/tag|domain|search/);
      expect(item.label).not.toMatch(/tag|domain|search/);
    }
  });

  it('pagination is labelled and marks the current page with named arrows', () => {
    const page = template('home/page.hbs');
    expect(page).toMatch(/<nav class="pagination" aria-label="Pagination">/);
    expect(page).toMatch(/aria-current="page"/);
    expect(page).toMatch(/aria-label="Previous page"/);
    expect(page).toMatch(/aria-label="Next page"/);
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-06: decorative media hidden / informative named / sr-only utility.
// ---------------------------------------------------------------------------

describe('accessibility: media and sr-only (KDV-A11Y-06)', () => {
  it('ships an .sr-only utility and uses it as the hidden-text escape hatch', () => {
    const css = read('static/assets/styles.css');
    expect(css).toMatch(/\.sr-only\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.sr-only\s*\{[^}]*clip:\s*rect\(0, 0, 0, 0\)/);
  });

  it('every informative image has a name; the icon-only FAB keeps its label', () => {
    expect(template('about.hbs')).toMatch(/<img src="\/logo\.svg" alt="Kodavr"/);
    expect(template('site/header.hbs')).toMatch(/alt="Kodavr"/);
    expect(template('dumps.hbs')).toContain('aria-label="Back to feed"');
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-02: the gate is an accessible modal (dynamic half, P6b).
// ---------------------------------------------------------------------------

describe('accessibility: accessible gate modal (KDV-A11Y-02)', () => {
  const gate = template('site/gate.hbs');

  it('names the dialog from the §7.1 statement and describes it with the gate text', () => {
    expect(gate).toMatch(/<dialog id="gate"[^>]*hidden/);
    expect(gate).toMatch(/aria-labelledby="gate-title"/);
    expect(gate).toMatch(/aria-describedby="gate-text"/);
    expect(gate).toContain('id="gate-title"');
    expect(gate).toMatch(/<pre class="gate-text" id="gate-text">/);
    expect(gate).toContain('{{copy.gate_title}}');
  });

  it('gives both choices a descriptive, non-digit accessible name while keeping the digits visible', () => {
    expect(gate).toMatch(/data-gate-choice="machine"[^>]*aria-label="\{\{copy\.gate_machine_label\}\}"/);
    expect(gate).toMatch(/data-gate-choice="human"[^>]*aria-label="\{\{copy\.gate_human_label\}\}"/);
    // The visible labels stay the bare contract digits (§7.1).
    expect(gate).toContain('>0</button>');
    expect(gate).toContain('>1</button>');
    for (const label of [GATE_MACHINE_LABEL, GATE_HUMAN_LABEL]) {
      expect(label).not.toMatch(/^\d$/);
      expect(label.length).toBeGreaterThan(3);
    }
  });

  it('ships an SSR status region and a named reception region (KDV-A11Y-03)', () => {
    const dumps = template('dumps.hbs');
    expect(dumps).toMatch(/<p id="a11y-status"[^>]*role="status"/);
    expect(dumps).toMatch(/aria-live="polite"/);
    expect(template('site/reception-block.hbs')).toMatch(/aria-labelledby="reception-title"/);
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-03: no-navigation state changes are announced.
// ---------------------------------------------------------------------------

describe('accessibility: no-navigation announcements (KDV-A11Y-03)', () => {
  it('carries the copydeck announcements through the SSR status region and the reception block', () => {
    const dumps = template('dumps.hbs');
    expect(dumps).toContain('data-hall-announcement="{{copy.hall_announcement}}"');
    expect(dumps).toContain('data-reception-announcement="{{copy.reception_announcement}}"');
    expect(template('site/reception-block.hbs')).toContain(
      'data-copied-announcement="{{copy.copied_announcement}}"',
    );
    for (const text of [HALL_ANNOUNCEMENT, RECEPTION_ANNOUNCEMENT, COPIED_ANNOUNCEMENT, RECEPTION_TITLE]) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('updates the region from site.js (copy) and the dumps controller (gate transitions)', () => {
    const site = read('static/assets/site.js');
    expect(site).toMatch(/function announce\b/);
    expect(site).toContain('[role="status"]');
    expect(site).toContain('data-copied-announcement');
    expect(site).toContain('announce: announce');

    const controller = read('input/controllers/dumps.js');
    expect(controller).toContain("getElementById('a11y-status')");
    expect(controller).toContain('data-hall-announcement');
    expect(controller).toContain('data-reception-announcement');
    expect(controller).toMatch(/focusMain|getElementById\('main'\)/);
  });
});

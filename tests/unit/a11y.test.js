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
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  GATE_MACHINE_NOTE,
  GATE_HUMAN_NOTE,
  HALL_ANNOUNCEMENT,
  RECEPTION_ANNOUNCEMENT,
  COPIED_ANNOUNCEMENT,
} from '../../scripts/lib/copy.mjs';
import { EN } from '../../scripts/lib/i18n-en.mjs';

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
    expect(layouts.length).toBeGreaterThanOrEqual(5);
    expect(layouts.map(([name]) => name)).not.toContain('home/page.hbs');
  });

  for (const [name, content] of layouts) {
    it(`${name}: skip link is the first body control and main is targetable`, () => {
      // Phase 3a migrated the functional layouts to `{{copy.skip_to_content}}`;
      // about/contribute still carry the literal until phase 3b. The contract —
      // a skip link with that text as the first body control — is what is asserted.
      expect(content).toMatch(/<body>\s*<a class="skip-link" href="#main">(?:Skip to content|\{\{copy\.skip_to_content\}\})<\/a>/);
      expect(EN.SKIP_TO_CONTENT).toBe('Skip to content');
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
    expect(template('dumps.hbs')).toContain('<main id="main" tabindex="-1" class="dump-page sheet-inner">');
    expect(template('home.hbs')).toContain('<main id="main" tabindex="-1" class="home sheet-inner">');
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-04: labelled nav + aria-current + named pagination arrows.
// ---------------------------------------------------------------------------

describe('accessibility: keyboard and current state (KDV-A11Y-04)', () => {
  it('the header nav is labelled and renders the current item from data', () => {
    const header = template('site/header.hbs');
    expect(header).toMatch(/<nav class="nav" aria-label="\{\{copy\.nav_primary\}\}">/);
    expect(EN.NAV_PRIMARY).toBe('Primary');
    expect(header).toMatch(/\{\{#each nav\}\}/);
    expect(header).toMatch(/aria-current="page"/);
  });

  it('route datasets mark exactly the current route; dumps mark none', async () => {
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    const currentOf = (dataset) => dataset.nav.filter((item) => item.current).map((item) => item.href);
    expect(currentOf(routes.home)).toEqual(['/']);

    expect(currentOf(routes.about)).toEqual(['/about/']);
    expect(currentOf(routes.contribute)).toEqual(['/contribute/']);
    expect(currentOf(routes.notfound)).toEqual([]);

    const dumps = await readDumps(FIXTURES);
    const dump = toDataset(dumps.find((d) => d.slug === 'sample-dump'));
    expect(dump.nav).toHaveLength(3);
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
    expect(page).toMatch(/<nav class="pagination" aria-label="\{\{copy\.pagination_label\}\}">/);
    expect(page).toMatch(/aria-current="page"/);
    expect(page).toMatch(/aria-label="\{\{copy\.pagination_prev\}\}"/);
    expect(page).toMatch(/aria-label="\{\{copy\.pagination_next\}\}"/);
    expect(EN.PAGINATION_LABEL).toBe('Pagination');
    expect(EN.PAGINATION_PREV).toBe('Previous page');
    expect(EN.PAGINATION_NEXT).toBe('Next page');
  });

  it('the agent lane ships real, labelled controls (KDV-A11Y-04)', () => {
    const lane = template('site/agent-lane.hbs');
    expect(lane).toContain('class="copy-prompt"');
    expect(lane).toContain('class="agent-link"');
    expect(lane).toContain('target="_blank"');
    expect(lane).toContain('rel="noopener noreferrer"');
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
    expect(template('dumps.hbs')).toContain('aria-label="{{copy.back_to_feed}}"');
    expect(EN.BACK_TO_FEED).toBe('Back to feed');
  });
});

// ---------------------------------------------------------------------------
// KDV-A11Y-02: the declaration is an accessible inline region (v4).
// ---------------------------------------------------------------------------

describe('accessibility: accessible inline declaration (KDV-A11Y-02)', () => {
  const gate = template('site/gate.hbs');
  const dumps = template('dumps.hbs');

  it('names the inline declaration from the §7.1 statement and keeps the hook id', () => {
    // Human Surface v4/KDV-A11Y-02: the declaration is an inline NAMED region,
    // not a modal — dumps.hbs wraps the partial in `#plate-declaration` and
    // borrows the accessible name from the §7.1 statement; the hook keeps its id.
    expect(dumps).toMatch(
      /<section class="plate" id="plate-declaration"[^>]*aria-labelledby="gate-title"/,
    );
    expect(gate).not.toMatch(/<dialog/);
    expect(gate).toContain('id="gate-title"');
    expect(gate).toContain('id="gate-hook"');
    expect(gate).toMatch(/<p class="gate-kicker" id="gate-kicker">/);
    expect(gate).toMatch(/<h2 id="gate-title" class="gate-title">/);
    expect(gate).toMatch(/<p class="gate-hook" id="gate-hook">/);
    expect(gate).toContain('{{copy.gate_title}}');
  });

  it('gives both choices a descriptive, non-digit accessible name via their visible door labels', () => {
    // §6.5 P0-1: each door is a button whose descriptive label is its accessible
    // name (visible text, no aria-label — WCAG 2.5.3). The §7.1 digit stays as
    // an aria-hidden badge, so a bare "0"/"1" is never the accessible name.
    // Item 7: the label carries the plain door text and its parenthesized
    // consequence as a second line inside the same span — one accessible name.
    expect(gate).toMatch(/<div class="gate-doors" role="group" aria-label="\{\{copy\.gate_doors_label\}\}">/);
    expect(EN.GATE_DOORS_LABEL).toBe('Entry declaration');
    expect(gate).toMatch(
      /data-gate-choice="machine"[\s\S]*?<span class="door-label">\{\{copy\.gate_machine_door\}\}<br>\{\{copy\.gate_machine_note\}\}<\/span>/,
    );
    expect(gate).toMatch(
      /data-gate-choice="human"[\s\S]*?<span class="door-label">\{\{copy\.gate_human_door\}\}<br>\{\{copy\.gate_human_note\}\}<\/span>/,
    );
    expect(gate).toMatch(/<span class="door-digit" aria-hidden="true">0<\/span>/);
    expect(gate).toMatch(/<span class="door-digit" aria-hidden="true">1<\/span>/);
    expect(gate).not.toMatch(/aria-label="\{\{copy\.gate_machine_label\}\}"/);
    expect(gate).not.toMatch(/aria-label="\{\{copy\.gate_human_label\}\}"/);
    for (const label of [GATE_MACHINE_DOOR, GATE_HUMAN_DOOR]) {
      expect(label).not.toMatch(/^\d$/);
      expect(label.length).toBeGreaterThan(3);
    }
    // The consequence stays a parenthetical second line, never the whole name.
    for (const note of [GATE_MACHINE_NOTE, GATE_HUMAN_NOTE]) {
      expect(note).toMatch(/^\(.+\)$/);
    }
  });

  it('ships an SSR status region and a labelled inline declaration (KDV-A11Y-03)', () => {
    expect(dumps).toMatch(/<p id="a11y-status"[^>]*role="status"/);
    expect(dumps).toMatch(/aria-live="polite"/);
    expect(dumps).toMatch(/id="plate-declaration"[^>]*aria-labelledby="gate-title"/);
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
    expect(template('site/agent-lane.hbs')).toContain(
      'data-copied-announcement="{{copy.copied_announcement}}"',
    );
    for (const text of [HALL_ANNOUNCEMENT, RECEPTION_ANNOUNCEMENT, COPIED_ANNOUNCEMENT]) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('updates the region from site.js (copy) and the dumps controller (gate transitions)', () => {
    const site = read('static/assets/site.js');
    expect(site).toMatch(/function announce\b/);
    expect(site).toContain('[role="status"]');
    // §6.2 KDV-SURFACE-19: a dump page carries a second role="status" (the
    // declaration toast), so the shared region is addressed by its id first.
    expect(site).toContain("getElementById('a11y-status')");
    expect(site).toContain('data-copied-announcement');
    expect(site).toContain('announce: announce');

    const controller = read('input/controllers/dumps.js');
    expect(controller).toContain("getElementById('a11y-status')");
    expect(controller).toContain('data-hall-announcement');
    expect(controller).toContain('data-reception-announcement');
    // Human Surface v4/KDV-SURFACE-28: the bottom reset announces the re-opened
    // declaration in place (no dialog open/close to announce any more).
    expect(controller).toContain('data-declaration-announcement');
    expect(controller).toMatch(/focusMain|getElementById\('main'\)/);
  });
});

// ---------------------------------------------------------------------------
// KDV-SURFACE-19: the one-shot declaration toast is its own live region.
// ---------------------------------------------------------------------------

describe('accessibility: declaration toast (KDV-SURFACE-19)', () => {
  it('ships a hidden, dataset-wired role="status" region separate from #a11y-status', () => {
    const dumps = template('dumps.hbs');
    expect(dumps).toMatch(/<p class="declaration-toast"[^>]*hidden[^>]*role="status"/);
    expect(dumps).toContain('data-toast-text="{{copy.declaration_toast}}"');
    // The pre-existing announcement region keeps its id, role and data hooks.
    expect(dumps).toMatch(/<p id="a11y-status"[^>]*role="status"[^>]*aria-live="polite"/);
    expect(dumps).toContain('data-hall-announcement="{{copy.hall_announcement}}"');
  });

  it('declares the toast as a fixed overlay whose motion is disabled under reduced motion', () => {
    const css = read('static/assets/styles.css');
    expect(css).toMatch(/\.declaration-toast\s*\{[^}]*position:\s*fixed/);
    // It must not create horizontal scroll: bounded on both sides.
    expect(css).toMatch(/\.declaration-toast\s*\{[^}]*left:\s*1rem/);
    expect(css).toMatch(/\.declaration-toast\s*\{[^}]*right:\s*1rem/);
    const reduced = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
    expect(reduced, 'reduced-motion block').not.toBeNull();
    expect(reduced[1]).toContain('.declaration-toast');
  });
});

// ---------------------------------------------------------------------------
// KDV-SURFACE-17: the §7.13 species status chip in the shared header.
// ---------------------------------------------------------------------------

describe('accessibility: species status chip (KDV-SURFACE-17)', () => {
  it('KDV-SURFACE-17: the shared header ships the hidden status pill and a separate withdraw link', () => {
    const header = template('site/header.hbs');
    // SSR ships the pill hidden and empty; site.js fills the text and reveals it.
    expect(header).toMatch(/<span class="species-chip" id="species-chip" hidden/);
    expect(header).toMatch(/<span class="species-chip-text"><\/span>/);
    // The three copydeck labels reach the client through the dataset.
    expect(header).toContain('data-machine-label="{{copy.chip_machine_template}}"');
    expect(header).toContain('data-human-label="{{copy.chip_human_label}}"');
    expect(header).toContain('data-title-template="{{copy.chip_title_template}}"');
    // The status is a non-interactive pill: it holds plain text, never a control
    // (no link, no button, no focus stop).
    const pill = header.match(/<span class="species-chip"[\s\S]*?<\/span><\/span>/);
    expect(pill, 'the status pill element').not.toBeNull();
    expect(pill[0]).not.toMatch(/<(a|button|input|select|textarea)\b/);
    expect(pill[0]).not.toMatch(/tabindex/);
    // The withdraw action is a separate link OUTSIDE the pill, separated by the
    // dot separator, wired to the copydeck and hidden until a declaration
    // exists; a live region must never wrap this interactive link.
    expect(header).toMatch(
      /<span class="species-separator" aria-hidden="true">·<\/span><a class="species-chip-withdraw"[^>]*data-withdraw[^>]*hidden[^>]*>\{\{copy\.chip_withdraw_label\}\}<\/a>/,
    );
    expect(header).not.toMatch(/<span class="species-chip"[^>]*role="status"/);
  });

  it('KDV-SURFACE-17: site.js fills, refreshes and withdraws the chip client-side', () => {
    const site = read('static/assets/site.js');
    expect(site).toMatch(/function initSpeciesChip\b/);
    expect(site).toMatch(/function refreshSpeciesChip\b/);
    expect(site).toContain('refreshSpeciesChip: refreshSpeciesChip');
    expect(site).toContain("getElementById('species-chip')");
    expect(site).toContain('data-withdraw');
    // The withdraw link lives outside the pill, so the lookup walks to the
    // containing group and the declaration date lands on the link's title.
    expect(site).not.toMatch(/chip\.querySelector\('\[data-withdraw\]'\)/);
    expect(site).toMatch(/var withdraw = [^;]*querySelector\('\[data-withdraw\]'\)/);
    expect(site).toContain("withdraw.setAttribute('title'");
  });
});

// ---------------------------------------------------------------------------
// §6.5 visual language: two contours, one building — the human surface is
// proportional prose, the machine surface stays technical, and the gate dialog
// is framed as a contract card. No external fonts (KDV-MOBILE-06).
// ---------------------------------------------------------------------------

describe('visual language: two contours, one contract card (KDV-MOBILE-06 / KDV-SURFACE-13)', () => {
  const css = read('static/assets/styles.css');

  it('KDV-MOBILE-06: the human contour uses a --font-prose system stack and references no external font', () => {
    // The v2 "contract sheet" human stack, renamed to --font-prose and declared
    // exactly once.
    expect(css).toMatch(
      /--font-prose\s*:\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*Roboto,\s*"Helvetica Neue",\s*sans-serif/,
    );
    expect((css.match(/--font-prose\s*:/g) || []).length).toBe(1);
    // No web font anywhere in the single stylesheet: no @font-face, no CDN, no URL.
    expect(css).not.toMatch(/@font-face/i);
    expect(css).not.toMatch(/fonts\.googleapis/i);
    expect(css).not.toMatch(/https?:\/\//i);

    // The human-contour classes inherit the prose stack from one grouped rule.
    expect(css).toMatch(/\.reception-brief-section,\s*\n\.reception-brief-heading/);
    const prose = css.match(/\.reception-brief-section[^{]*\{[^}]*\}/);
    expect(prose, 'human-contour rule').not.toBeNull();
    expect(prose[0]).toContain('font-family: var(--font-prose)');
    for (const cls of [
      '.reception-brief-section',
      '.reception-brief-heading',
      '.reception-brief-note',
      '.reception-brief',
      '.reception-brief-missing',
      '.reception-brief-cta',
      '.reception-brief-report',
      '.reception-rating',
    ]) {
      expect(prose[0], cls).toContain(cls);
    }
  });

  it('KDV-SURFACE-13: the machine contour reuses one --font-mono token while the preview prose keeps --font-prose', () => {
    // §6.5: one source for the mono stack — declared once and never repeated.
    expect((css.match(/--font-mono\s*:/g) || []).length).toBe(1);
    expect(css).toMatch(
      /--font-mono\s*:\s*ui-monospace,\s*SFMono-Regular,\s*Menlo,\s*Consolas,\s*monospace/,
    );
    // No literal mono list survives outside the token.
    expect((css.match(/ui-monospace/g) || []).length).toBe(1);

    // The prompt walls and code blocks reference the token, not a literal list.
    // v4/KDV-SURFACE-28 introduces `.article-prompt` (the `02` plate's pinned
    // prompt) and retires the gate/reception prompt walls with the modal.
    expect(css).toMatch(
      /\.article-prompt,\s*\.machine-prompt,\s*\.home-prompt,\s*\.contribute-prompt\s*\{[^}]*font-family:\s*var\(--font-mono\)/,
    );
    expect(css).toMatch(/^pre\s*\{[^}]*font-family:\s*var\(--font-mono\)/m);

    // The hall body (keeping its KDV-MOBILE-02 clamp) and the manifest card are
    // machine contour: mono via the same token.
    expect(css).toMatch(/\.hall\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
    expect(css).toMatch(/\.hall\s*\{[^}]*clamp\(1rem, 2\.5vw, 1\.125rem\)/);
    expect(css).toMatch(/details\.card\s*\{[^}]*font-family:\s*var\(--font-mono\)/);

    // The human contour stays proportional: the preview/brief prose rule keeps
    // the prose token and never picks up the mono one.
    const prose = css.match(/\.reception-brief-section,[^{]*\{[^}]*\}/);
    expect(prose, 'human-contour rule').not.toBeNull();
    expect(prose[0]).toContain('font-family: var(--font-prose)');
    expect(prose[0]).not.toContain('--font-mono');
  });

  it('KDV-SURFACE-13: the inline declaration keeps the clause list and the signature rule', () => {
    // Human Surface v4/KDV-SURFACE-28: the plate role frames the declaration (the
    // modal card and its scrim are gone) — the duties read as a clause and the
    // doors sit under the signature rule.
    expect(css).toMatch(/\.plate\s*\{[^}]*border-top:\s*1px solid var\(--line-2\)/);
    expect(css).toMatch(/\.gate-duties\s*\{[^}]*border-left:\s*2px solid var\(--line\)/);
    expect(css).toMatch(/\.gate-doors\s*\{[^}]*border-top:\s*1px solid var\(--line\)/);
  });

  it('KDV-SURFACE-13: the declaration is a document measure (68ch prose) with no modal scrim', () => {
    // §6.5: the declaration prose keeps its measure cap inside the inline plate;
    // the v4 change removed the fixed 46rem viewport cap and the dark backdrop.
    const proseMeasure = css.match(
      /#plate-declaration p,\s*\n?\s*#plate-declaration \.door-label\s*\{[^}]*\}/,
    );
    expect(proseMeasure, '#plate-declaration prose measure').not.toBeNull();
    expect(proseMeasure[0]).toMatch(/max-width:\s*68ch/);
    expect(css).not.toMatch(/::backdrop/);
    expect(css).not.toMatch(/#gate\b/);
    // The first screen holds the H2/duties/doors at 1280x720; the old modal
    // height cap must not clip the inline flow.
    expect(css).not.toMatch(/#plate-declaration\s*\{[^}]*max-height/);
  });

  it('KDV-SURFACE-13: the grey prompt/rest blocks hug their text — no empty field on the right', () => {
    // §6.5 P1-1: the pinned prompt blocks and the declaration's long tail shrink
    // to their text; the hall's code blocks keep full width + horizontal scroll
    // (KDV-MOBILE-02), so this must NOT be a bare `pre { width: fit-content }`.
    // v4/KDV-SURFACE-28: `.article-prompt` (the `02` plate) joins the grey blocks
    // that hug their text; `.gate-rest` stays the declaration's own block.
    const hug = css.match(/\.article-prompt,\s*\.gate-rest,\s*\.machine-prompt,\s*\.home-prompt,\s*\.contribute-prompt\s*\{[^}]*\}/);
    expect(hug, 'prompt/rest hug rule').not.toBeNull();
    expect(hug[0]).toMatch(/width:\s*fit-content/);
    expect(hug[0]).toMatch(/max-width:\s*100%/);
    expect(css).not.toMatch(/^pre\s*\{[^}]*width:\s*fit-content/m);

    // §6.5/KDV-MOBILE-01 (owner decision 2026-09-17): the declaration keeps the
    // desktop reading order at every width — no <480px flex/`order` reorder of
    // the prompt and the doors (the doors are a short scroll away instead).
    expect(css).not.toMatch(/\.gate-rest\s*\{[^}]*order:/);
    expect(css).not.toMatch(/#plate-declaration:not\(\[hidden\]\)\s*>\s*\*/);
  });

  it('KDV-SURFACE-13: the preview/brief prose is human contour, the prompt walls stay machine mono', () => {
    // §6.5: the author's brief tier lives in the `01 · PREVIEW` plate and stays
    // proportional prose; the §7.2 wall it used to sit beside is not migrated.
    const prose = css.match(/\.reception-brief-section,[^{]*\{[^}]*\}/);
    expect(prose, 'human-contour rule').not.toBeNull();
    expect(prose[0]).toContain('font-family: var(--font-prose)');

    const wall = css.match(/\.reception-text\s*\{[^}]*\}/);
    expect(wall, 'the retired §7.2 wall rule').toBeNull();

    // §6.5 two contours: the prompt walls and the manifest card stay monospace.
    expect(css).toMatch(
      /\.article-prompt,\s*\.machine-prompt,\s*\.home-prompt,\s*\.contribute-prompt\s*\{[^}]*font-family:\s*var\(--font-mono\)/,
    );
    expect(css).toMatch(/details\.card\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
  });

  it('KDV-SURFACE-13: the machine panel hook sits a notch below the panel prose (§6.2, P2-3)', () => {
    const lead = css.match(/#machine-panel \.block-machine\s*\{[^}]*\}/);
    expect(lead, '#machine-panel .block-machine rule').not.toBeNull();
    const size = /font-size:\s*([\d.]+)rem/.exec(lead[0]);
    expect(size, 'font-size in rem').not.toBeNull();
    // < 1rem, i.e. smaller than the panel's prose (the inherited root size).
    expect(Number(size[1])).toBeLessThan(1);
  });

  it('KDV-SURFACE-13: hovering a lane control lights the prompt below (feedback-marketing item 11)', () => {
    // item 11: hovering a jump link or the copy chip recolours the prompt's
    // left rule in the accent colour. The controls sit inside .agent-lane
    // (ul > li), so the document's `button:hover ~ prompt` can never match from
    // the button itself — the hover crosses the wrapper via :has() (the §04
    // species-chip pattern) to the lane's later sibling prompt on every surface
    // that pairs them (article plate, machine panel, home plate).
    // feedback-contribute_skill item 02: KEYBOARD FOCUS gets the same parity —
    // `:hover` and `:focus-visible` light the prompt identically.
    const rule = css.match(
      /\.agent-lane:has\([^)]*\)\s*~\s*\.article-prompt,\s*\.agent-lane:has\([^)]*\)\s*~\s*\.machine-prompt,\s*\.agent-lane:has\([^)]*\)\s*~\s*\.home-prompt\s*\{[^}]*\}/,
    );
    expect(rule, 'lane-hover → prompt rule').not.toBeNull();
    expect(rule[0]).toContain('.agent-link:hover');
    expect(rule[0]).toContain('.agent-link:focus-visible');
    expect(rule[0]).toContain('.copy-prompt:hover');
    expect(rule[0]).toContain('.copy-prompt:focus-visible');
    expect(rule[0]).toMatch(/border-left-color:\s*var\(--accent\)/);
    // The resting state stays the muted 2px rule — the hover only recolours it
    // (the group now also carries the contribute-lane's prompt, item 01).
    expect(css).toMatch(
      /\.article-prompt,\s*\.machine-prompt,\s*\.home-prompt,\s*\.contribute-prompt\s*\{[^}]*border-left:\s*2px solid var\(--line-2\)/,
    );
  });

  it('KDV-SURFACE-29: the contribute copy button lights its prompt on hover/focus and ships the copydeck attrs', () => {
    // feedback-contribute_skill item 02: the contribute-lane's prompt is a
    // CHILD of its lane (not a sibling), so the rule reaches it directly —
    // hover AND keyboard focus of the one copy control recolour the left rule.
    const rule = css.match(/\.contribute-lane:has\([^)]*\)\s*\.contribute-prompt\s*\{[^}]*\}/);
    expect(rule, 'contribute-lane hover/focus → prompt rule').not.toBeNull();
    expect(rule[0]).toContain('.contribute-copy:hover');
    expect(rule[0]).toContain('.contribute-copy:focus-visible');
    expect(rule[0]).toMatch(/border-left-color:\s*var\(--accent\)/);
    // The prompt joins the shared prompt group (mono, muted, left rule, width).
    expect(css).toMatch(
      /\.article-prompt,\s*\.machine-prompt,\s*\.home-prompt,\s*\.contribute-prompt\s*\{[^}]*font-family:\s*var\(--font-mono\)/,
    );

    // item 01: ONE real control, labelled with the copydeck's copied strings
    // and wired to the prompt id below it — never the four chat links.
    const lane = template('contribute.hbs');
    expect(lane).toContain('class="copy-prompt contribute-copy"');
    expect(lane).toContain('data-copy-target="contribute-prompt"');
    expect(lane).toContain('data-copied-label="{{copy.copied_label}}"');
    expect(lane).toContain('data-copied-announcement="{{copy.copied_announcement}}"');
    expect(lane).toContain('id="contribute-prompt"');
    expect(lane).not.toContain('class="agent-link"');

    // D1: site.js auto-initialises copy buttons on DOM ready (the per-button
    // bound mark keeps it idempotent), so /contribute/ works without the dumps
    // controller that used to be the only caller of initCopyButtons.
    expect(read('static/assets/site.js')).toMatch(/initCopyButtons\(\);/);
  });
});

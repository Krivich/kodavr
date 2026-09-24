import { test, expect } from '@playwright/test';
import {
  COPIED_LABEL,
  POST_GATE_LINE,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  GATE_MACHINE_NOTE,
  GATE_HUMAN_NOTE,
} from '../../scripts/lib/copy.mjs';
import { CONTRACT_VERSION } from '../../scripts/lib/machine.mjs';

// §6.5 mobile adaptation. The gate.e2e.js suite proves the interactive flow on
// the desktop profile; this suite pins the viewport-dependent contract: the
// hall/inline-declaration must fit the two target widths without horizontal
// scroll, with touch-sized targets, the 13px invitation prompt and the
// accordion card.
const DUMP = '/dumps/sample-dump/';
const SPECIES_KEY = 'kodavr.species';

// Human Surface v4/KDV-SURFACE-28: a stored species collapses the inline plates
// on boot (state M for `machine`), so a test that reads the raw hall seeds it up
// front instead of driving the declaration on every navigation.
async function seedMachine(page) {
  await page.addInitScript((key) => window.localStorage.setItem(key, 'machine'), SPECIES_KEY);
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

async function stylesheet(page) {
  const response = await page.request.get('/assets/styles.css');
  expect(response.ok()).toBe(true);
  return response.text();
}

test.describe('mobile 375x667', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('KDV-MOBILE-01: the inline declaration fits 375x667 with 44px doors, >=17px type and no horizontal scroll', async ({ page }) => {
    await page.goto(DUMP);
    const declaration = page.locator('#plate-declaration');
    await expect(declaration).toBeVisible();

    expect(await noHorizontalScroll(page)).toBe(true);

    const baseFont = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(baseFont).toBeGreaterThanOrEqual(17);

    for (const choice of ['machine', 'human']) {
      const box = await page.locator(`[data-gate-choice="${choice}"]`).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // The inline plate inherits the page's own content measure: it never exceeds
    // the viewport and stays inside the sheet.
    const plateBox = await declaration.boundingBox();
    expect(plateBox.x).toBeGreaterThanOrEqual(0);
    expect(plateBox.x + plateBox.width).toBeLessThanOrEqual(375);
  });

  test('KDV-MOBILE-02: the hall uses fluid type, constrained images and code blocks with a "scroll ->" hint and no horizontal scroll', async ({ page }) => {
    await seedMachine(page);
    await page.goto(DUMP);
    const css = await stylesheet(page);
    expect(css).toContain('clamp(1rem, 2.5vw, 1.125rem)');
    expect(css).toMatch(/\.hall img\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.hall pre\s*\{[^}]*overflow-x:\s*auto/);

    const pre = page.locator('.hall pre').first();
    await expect(pre).toBeVisible();
    expect(await pre.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    expect(await pre.evaluate((el) => getComputedStyle(el, '::after').content)).toContain('scroll');

    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('KDV-MOBILE-02: a wide markdown table and a long unbreakable inline token stay inside the frame', async ({ page }) => {
    await seedMachine(page);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 667 });
      await page.goto(DUMP);

      const measured = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        await noHorizontalScroll(page),
        `no horizontal scroll at ${width}px (scrollWidth=${measured.scrollWidth} innerWidth=${measured.innerWidth})`,
      ).toBe(true);

      // KDV-MOBILE-02: a long unbreakable inline code token must shrink the
      // paragraph's min-content (`overflow-wrap:anywhere`), never widen the frame.
      const inline = page.locator('.hall p code', { hasText: 'unbreakable_inline_code_token' });
      await expect(inline).toBeVisible();
      const inlineBox = await inline.boundingBox();
      expect(
        inlineBox.x + inlineBox.width,
        `the long inline code token stays inside the viewport at ${width}px`,
      ).toBeLessThanOrEqual(width + 1);

      const wrapper = page.locator('.hall .table-scroll').first();
      await expect(wrapper).toBeVisible();
      expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
      expect(await wrapper.evaluate((el) => getComputedStyle(el, '::after').content)).toContain('scroll');
      expect(
        await wrapper.evaluate((el) => el.scrollWidth > el.clientWidth),
        `the table actually scrolls inside its wrapper at ${width}px`,
      ).toBe(true);
    }
  });

  test('KDV-MOBILE-03: artifacts render as cards and the manifest card is a collapsed accordion', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="machine"]');

    const cards = page.locator('.row');
    await expect(cards).toHaveCount(1);
    const card = cards.first();
    await expect(card).toContainText('url');
    await expect(card.locator('a')).toHaveAttribute('href', 'https://example.test/docs');
    await expect(card).toContainText('component docs');

    const manifest = page.locator('details.card');
    await expect(manifest).toBeVisible();
    expect(await manifest.evaluate((el) => el.tagName)).toBe('DETAILS');
    expect(await manifest.evaluate((el) => el.open)).toBe(false);
    await expect(manifest.locator('summary')).toContainText('Manifest');

    // Expanding the accordion reveals the metadata (a key:value list).
    await manifest.locator('summary').click();
    expect(await manifest.evaluate((el) => el.open)).toBe(true);
    await expect(manifest).toContainText('Trust level');
  });

  test('KDV-MOBILE-04: the invitation prompt is 13px monospace and the copy control is a lane chip with a Copied state', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('#plate-want')).toBeVisible();

    const prompt = page.locator('#article-prompt');
    expect(await prompt.evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px');
    expect((await prompt.evaluate((el) => getComputedStyle(el).fontFamily)).toLowerCase()).toContain('monospace');

    // §7.12: the copy control is a chip in the jump-links row — never a
    // full-width banner — and shares the jump links' chrome.
    const button = page.locator('#plate-want .copy-prompt');
    await expect(button).toBeVisible();
    expect(await button.evaluate((el) => el.closest('.agent-links') !== null)).toBe(true);
    const buttonBox = await button.boundingBox();
    expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    expect(buttonBox.width).toBeLessThan((await prompt.boundingBox()).width);

    const chrome = (el) => {
      const style = getComputedStyle(el);
      return [style.borderTopWidth, style.borderTopColor, style.borderTopLeftRadius, style.minHeight];
    };
    expect(await button.evaluate(chrome)).toEqual(
      await page.locator('#plate-want .agent-link').first().evaluate(chrome),
    );

    // §7.12: the prompt renders below the lane on this surface.
    const laneBox = await page.locator('#plate-want .agent-lane').boundingBox();
    const promptBox = await prompt.boundingBox();
    expect(promptBox.y).toBeGreaterThanOrEqual(laneBox.y + laneBox.height - 1);

    await button.click();
    await expect(button).toHaveText(COPIED_LABEL);
  });

  test('KDV-MOBILE-09: the agent lane wraps with no horizontal scroll and every control is a >= 44px target', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('#plate-want .agent-lane')).toBeVisible();

    expect(await noHorizontalScroll(page)).toBe(true);

    const controls = page.locator('#plate-want .copy-prompt, #plate-want .agent-link');
    const count = await controls.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('KDV-MOBILE-11: the wrapped hero CTA pair keeps the agent lane row gap — never flush', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('main.home a.cta[href="about/"]');
    const second = page.locator('main.home a.cta[href="contribute/"]');
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();

    // Both stamped doors render at full size (no overlap, no collapsed box).
    const a = await first.boundingBox();
    const b = await second.boundingBox();
    expect(a.height, 'the first CTA keeps its stamped box').toBeGreaterThanOrEqual(30);
    expect(b.height, 'the second CTA keeps its stamped box').toBeGreaterThanOrEqual(30);

    // At 375px the pair does not fit one row: it stacks. The row gap must be
    // the agent lane's --sp-2 (8px), not the flush 0px a bare <p> line-wrap
    // gives: a side-by-side pair yields a negative number, a flush wrap 0 —
    // both fail this one assertion.
    const gap = b.y - (a.y + a.height);
    expect(gap, 'stacked CTA rows keep the --sp-2 gap, never flush').toBeGreaterThanOrEqual(7);

    // The wrapper is a wrapping flex row with the lane's gap (same grammar as
    // .agent-links), on the base rule — no media query involved.
    expect(await first.evaluate((el) => el.parentElement.classList.contains('cta-row'))).toBe(true);
    const row = page.locator('main.home p.cta-row');
    expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe('flex');
    expect(await row.evaluate((el) => getComputedStyle(el).flexWrap)).toBe('wrap');
    expect(await row.evaluate((el) => getComputedStyle(el).gap)).toBe('8px');
  });

  test('KDV-MOBILE-08: viewport-fit, touch-action, breakpoint tokens, reduced-motion CSS and the post-gate line', async ({ page }) => {
    await page.goto(DUMP);

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('viewport-fit=cover');

    const css = await stylesheet(page);
    expect(css).toContain('--bp-mobile: 480px');
    expect(css).toContain('--bp-tablet: 768px');
    expect(css).toContain('touch-action: manipulation');
    expect(css).toContain('prefers-reduced-motion: reduce');

    const token = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bp-mobile').trim(),
    );
    expect(token).toBe('480px');

    expect(await page.locator('[data-gate-choice="machine"]').evaluate((el) => getComputedStyle(el).touchAction)).toBe(
      'manipulation',
    );

    await page.click('[data-gate-choice="machine"]');
    const postGate = page.locator('.statusline');
    await expect(postGate).toBeVisible();
    await expect(postGate).toHaveText(POST_GATE_LINE);
  });
});

test.describe('mobile 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('KDV-MOBILE-01 + KDV-MOBILE-02: gate and hall fit 360x640 with no horizontal scroll and the invitation prompt stays 13px', async ({ page }) => {
    await page.goto(DUMP);
    await expect(page.locator('#plate-declaration')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    const box = await page.locator('[data-gate-choice="machine"]').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('#plate-want')).toBeVisible();
    expect(await page.locator('#article-prompt').evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px');
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

// §6.5 viral-seed scenario: the gate must be flawless on screens as narrow as
// 320px. This pins the touch targets, the door labels and the absence of
// horizontal scroll — the first-screen composition promise is measured and
// reported here, not asserted (it does not fit at this width, see below).
test.describe('mobile 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('KDV-MOBILE-01: both labelled doors are 44px targets with visible labels and no horizontal scroll at 320x568', async ({ page }) => {
    await page.goto(DUMP);
    await expect(page.locator('#plate-declaration')).toBeVisible();

    // No horizontal scroll: the document never exceeds the viewport width.
    const measured = await page.evaluate(() => {
      const root = document.documentElement;
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { y: Math.round(r.y), height: Math.round(r.height), bottom: Math.round(r.bottom) };
      };
      return {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        declaration: rect('#plate-declaration'),
        hook: rect('#plate-declaration .gate-hook'),
        lane: rect('#plate-want .agent-lane'),
        duties: rect('#plate-declaration .gate-duties'),
        doors: rect('#plate-declaration .gate-doors'),
        prompt: rect('#article-prompt'),
      };
    });

    // Measured 2026-09-15, updated for the v4 inline plates (2026-09-21): the
    // declaration plate, the `02` lane and the pinned prompt are independent
    // plates, so "hook + lane + duties + doors share the first screen" cannot hold
    // at 320px. Per the owner decision of 2026-09-17 the surface keeps the desktop
    // reading order at every width (lane + prompt above the declaration, doors
    // under the duties), so the doors are a short scroll away; the number is
    // reported here so it is never silently lost (STATE.md keeps the decision).
    test.info().annotations.push({
      type: 'measurement',
      description: `320x568 declaration plate H=${measured.declaration.height}: hook ${measured.hook.height}, lane ${measured.lane.height}, duties ${measured.duties.height}, doors y=${measured.doors.y} h=${measured.doors.height}`,
    });

    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);

    // §6.5: each door is a >=44px touch target.
    for (const choice of ['machine', 'human']) {
      const door = page.locator(`[data-gate-choice="${choice}"]`);
      await expect(door).toBeVisible();
      const box = await door.boundingBox();
      expect(box.height, choice).toBeGreaterThanOrEqual(44);
    }

    // §6.5 P0-1/item 7: both doors carry their visible §7.1 labels plus the
    // parenthesized consequence (digit stays a badge).
    const labels = page.locator('#plate-declaration .door-label');
    await expect(labels).toHaveCount(2);
    await expect(labels.nth(0)).toContainText(GATE_MACHINE_DOOR);
    await expect(labels.nth(0)).toContainText(GATE_MACHINE_NOTE);
    await expect(labels.nth(1)).toContainText(GATE_HUMAN_DOOR);
    await expect(labels.nth(1)).toContainText(GATE_HUMAN_NOTE);

    // §6.5/KDV-MOBILE-01: the surface keeps the desktop order at every width — the
    // lane and its pinned prompt come BEFORE the declaration's doors.
    expect(measured.prompt.y).toBeLessThan(measured.doors.y);

    // Deliberately NOT asserted: both doors inside the initial 568px viewport — the
    // measurement above shows it is unreachable at this width; the composition
    // promise for <480px is bounded by the viewport.
  });
});

// §6.5 platform hooks on a phone: the OS chrome (theme-color, touch icon,
// safe area) and the Android hardware-back button, which must dismiss the
// gate/reception overlay instead of navigating away from the dump.
test.describe('platform hooks (KDV-MOBILE-07)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('KDV-MOBILE-07: theme-color, a 192x192 touch icon and the safe-area footer are present', async ({ page }) => {
    await page.goto(DUMP);

    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#111111');

    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveAttribute('sizes', '192x192');
    expect(await icon.getAttribute('href')).toContain('assets/touch-icon-192.png');
    const response = await page.request.get('/assets/touch-icon-192.png');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');

    const css = await (await page.request.get('/assets/styles.css')).text();
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  test('KDV-MOBILE-07: Android back closes the open declaration', async ({ page }) => {
    await page.goto(DUMP);
    await expect(page.locator('#plate-declaration')).toBeVisible();

    await page.goBack();

    await expect(page.locator('#plate-declaration')).toBeHidden();
    await expect(page.locator('.hall')).toBeVisible();
  });

  test('KDV-MOBILE-07: Android back dismisses state H back to the hall', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('#plate-want')).toBeVisible();

    await page.goBack();

    await expect(page.locator('#plate-want')).toBeHidden();
    await expect(page.locator('.hall')).toBeVisible();
  });
});

// §6.5 feed pagination on a phone. The shared e2e build seeds a second feed page
// (serve-site.mjs); page 1 is server-rendered at the root and the arrows must be
// touch-sized. The sticky header and the back-to-feed FAB are asserted here too.
test.describe('feed pagination (KDV-MOBILE-05)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('KDV-MOBILE-05: the feed paginates with 44px arrows and tapping next swaps the visible items', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.dump-feed .card');
    await expect(cards).toHaveCount(10);
    await expect(cards.first()).toContainText('Feed Dump 01');

    const next = page.locator('.pagination-arrow[data-page="2"]');
    await expect(next).toBeVisible();
    const box = await next.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await next.click();
    await expect(cards.first()).toContainText('Feed Dump 11');
    await expect(cards).toHaveCount(4);
  });

  test('KDV-MOBILE-05: the header is sticky and the back-to-feed FAB is a bottom-right 44px target', async ({ page }) => {
    await page.goto(DUMP);
    const header = page.locator('.masthead');
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');

    await page.click('[data-gate-choice="machine"]');
    const fab = page.locator('.fab');
    await expect(fab).toBeVisible();
    const box = await fab.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    const viewport = page.viewportSize();
    expect(box.x + box.width).toBeGreaterThan(viewport.width / 2);
    expect(box.y + box.height).toBeGreaterThan(viewport.height / 2);
  });

  // §6.5/§11: the home page has two mobile regressions — a long comma-joined
  // `content_flags` token blowing the feed card past the viewport, and the
  // language switcher dropping below the full-width nav row. The fix is the
  // grid track (minmax(0,1fr)), a breakable flag token and masthead row
  // ordering — none of which a screenshot would pin. Assert both widths.
  test('KDV-MOBILE-05: the home feed fits the viewport and the language switcher shares the logo row', async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('.dump-feed .card').first()).toBeVisible();

      expect(await noHorizontalScroll(page), `no horizontal scroll at ${viewport.width}px`).toBe(true);

      const mark = await page.locator('.masthead .mark').boundingBox();
      const switcher = await page.locator('.masthead .lang-switch').boundingBox();
      expect(mark, 'logo mark is laid out').not.toBeNull();
      expect(switcher, 'language switcher is laid out').not.toBeNull();
      expect(
        Math.abs(mark.y - switcher.y),
        `language switcher shares the logo row at ${viewport.width}px`,
      ).toBeLessThanOrEqual(8);

      // The reordered switcher still opens its popover: visible and anchored
      // inside the right edge (it must not introduce horizontal scroll).
      await page.locator('.masthead .lang-switch-summary').click();
      const menu = page.locator('.masthead .lang-switch-menu');
      await expect(menu).toBeVisible();
      const menuBox = await menu.boundingBox();
      expect(menuBox.x, `switcher menu inside the viewport at ${viewport.width}px`).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width + 1);
      await page.locator('.masthead .lang-switch-summary').click();
    }
  });
});

// §6.5/KDV-MOBILE-05: the masthead is a CONTAINER-QUERY GRID keyed to its OWN
// content width (not the viewport), with three deterministic states:
//   NARROW  row1 mark + switcher · row2 chip (FULL inner width) · row3 nav (FULL width)
//   MID     row1 mark + chip + switcher · row2 nav (FULL inner width)
//   WIDE    row1 mark + chip + nav (flush right) + switcher
// The switcher is pinned to row 1 in every state, so it never leaves the mark's
// row. The threshold literals below mirror the `@container` blocks in
// static/assets/styles.css §04 (a container query cannot read a custom prop).
test.describe('masthead reflow by available room (KDV-MOBILE-05)', () => {
  const SPECIES_KEY = 'kodavr.species';
  const ROW = 8; // px tolerance for "box tops share a row"
  const CENTER = 2; // px tolerance for "the switcher's visual centre sits on the mark's"
  const FLUSH = 24; // px: on the WIDE row the nav ends within ~1 gap of the switcher
  const T1 = 520; // NARROW: cw <= T1; MID: T1 < cw <= T2; WIDE: cw > T2
  const T2 = 860;

  // §6.2: seed a valid declaration record before any page script runs, so the
  // SSR-hidden chip is revealed by site.js and the masthead must place it.
  async function seedDeclaration(page) {
    await page.addInitScript(
      ({ key, record }) => {
        window.localStorage.setItem(key, JSON.stringify(record));
      },
      {
        key: SPECIES_KEY,
        record: {
          species: 'machine',
          contract_version: CONTRACT_VERSION,
          declared_at: '2026-01-01T00:00:00.000Z',
        },
      },
    );
  }

  async function measureMasthead(page) {
    return page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
      };
      const chip = document.querySelector('.masthead #species-chip');
      const mast = document.querySelector('.masthead');
      const inner = document.querySelector('.masthead-inner');
      const mastStyle = mast ? getComputedStyle(mast) : null;
      return {
        mark: box('.masthead .mark'),
        chip: box('.masthead #species-chip'),
        chipVisible: chip ? !chip.hidden : false,
        // The species group is the grid item that owns the chip's ROW.
        speciesRow: box('.masthead .species-declaration'),
        nav: box('.masthead .nav'),
        switcher: box('.masthead .lang-switch'),
        summary: box('.masthead .lang-switch-summary'),
        inner: box('.masthead-inner'),
        contentW: mast && mastStyle
          ? Math.round(mast.clientWidth - parseFloat(mastStyle.paddingLeft) - parseFloat(mastStyle.paddingRight))
          : 0,
        position: mastStyle ? mastStyle.position : null,
        containerType: mastStyle ? mastStyle.containerType : null,
        innerDisplay: inner ? getComputedStyle(inner).display : null,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
  }

  // The state the CSS container query resolves to, from the masthead's OWN
  // content width. Mirrors the `@container` bounds in §04.
  function stateOf(contentW) {
    if (contentW <= T1) return 'narrow';
    if (contentW <= T2) return 'mid';
    return 'wide';
  }

  // True when a full-width row starts and ends exactly at `.masthead-inner`'s
  // edges — the regression the old flex-sibling masthead confined to the cluster.
  function spansInner(row, inner) {
    return Boolean(row && inner)
      && Math.abs(row.x - inner.x) <= 2
      && Math.abs(row.right - inner.right) <= 2;
  }

  // The invariant asserted at EVERY width, plus the structure each state
  // promises. Returns the state (narrow/mid/wide) so callers can assert it.
  //   1. the switcher ALWAYS shares the mark's row, and its 44px tap box is
  //      centred on the 34px mark;
  //   2. NARROW: the chip row and the nav row each span the FULL inner width;
  //   3. MID: the chip climbs onto row 1, the nav spans the full width on row 2;
  //   4. WIDE: mark · chip · nav (flush against the switcher) · switcher on row 1.
  function expectMastheadInvariants(m, label) {
    const state = stateOf(m.contentW);
    expect(m.scrollWidth, `no horizontal scroll — ${label}`).toBeLessThanOrEqual(m.innerWidth);
    expect(m.mark, `mark laid out — ${label}`).not.toBeNull();
    expect(m.nav, `nav laid out — ${label}`).not.toBeNull();
    expect(m.switcher, `switcher laid out — ${label}`).not.toBeNull();
    expect(m.summary, `switcher summary laid out — ${label}`).not.toBeNull();
    expect(m.inner, `masthead-inner laid out — ${label}`).not.toBeNull();

    expect(Math.abs(m.mark.y - m.switcher.y), `switcher shares the mark row — ${label}`).toBeLessThanOrEqual(ROW);

    // KDV-MOBILE-05: the switcher's VISUAL centre sits on the mark's centre.
    // Top-edge equality alone is not enough: the 44px tap box and the 34px mark
    // would sag by (44 - 34) / 2 = 5px. The summary is measured (not the box)
    // because that is what the eye reads as the control's midline. Grid
    // `align-items:center` provides it now — there is no relative `top` nudge.
    const centerDelta = Math.abs(
      m.mark.y + m.mark.h / 2 - (m.summary.y + m.summary.h / 2),
    );
    expect(centerDelta, `switcher centred on the mark — ${label}`).toBeLessThanOrEqual(CENTER);

    if (state === 'narrow') {
      // The chip row and the nav row are FULL inner width (the defect: they were
      // confined to the old cluster column, masthead-width − switcher-width).
      expect(
        spansInner(m.nav, m.inner),
        `nav row spans the FULL inner width — ${label}`,
      ).toBe(true);
      expect(m.nav.y, `nav sits below the mark row — ${label}`).toBeGreaterThan(m.mark.y + ROW);
      if (m.chipVisible) {
        expect(
          spansInner(m.speciesRow, m.inner),
          `chip row spans the FULL inner width — ${label}`,
        ).toBe(true);
        expect(m.speciesRow.y, `chip drops below the mark row — ${label}`).toBeGreaterThan(m.mark.y + ROW);
        expect(m.nav.y, `nav drops below the chip row — ${label}`).toBeGreaterThan(m.speciesRow.y + ROW);
      }
    } else if (state === 'mid') {
      expect(
        spansInner(m.nav, m.inner),
        `nav row spans the FULL inner width — ${label}`,
      ).toBe(true);
      expect(m.nav.y, `nav drops below the mark row — ${label}`).toBeGreaterThan(m.mark.y + ROW);
      if (m.chipVisible) {
        expect(
          Math.abs(m.speciesRow.y - m.mark.y),
          `chip climbs onto the mark row — ${label}`,
        ).toBeLessThanOrEqual(ROW);
        expect(m.speciesRow.x, `chip right of the mark — ${label}`).toBeGreaterThanOrEqual(m.mark.x);
        expect(m.speciesRow.right, `chip left of the switcher — ${label}`).toBeLessThan(m.switcher.x);
      }
    } else {
      expect(Math.abs(m.nav.y - m.mark.y), `nav climbs onto the mark row — ${label}`).toBeLessThanOrEqual(ROW);
      const flush = m.switcher.x - (m.nav.x + m.nav.w);
      expect(flush, `nav flush against the switcher on the mark row — ${label}`).toBeLessThanOrEqual(FLUSH);
      expect(flush, `nav does not overlap the switcher — ${label}`).toBeGreaterThanOrEqual(-1);
      if (m.chipVisible) {
        expect(m.mark.x, `mark left of the chip — ${label}`).toBeLessThan(m.speciesRow.x);
        expect(m.speciesRow.x, `chip left of the nav — ${label}`).toBeLessThan(m.nav.x);
      } else {
        expect(m.mark.x, `mark left of the nav — ${label}`).toBeLessThan(m.nav.x);
      }
      expect(m.nav.x, `nav left of the switcher — ${label}`).toBeLessThan(m.switcher.x);
    }
    return state;
  }

  // The regression the container-query grid removes: under the old flex-sibling
  // masthead the chip and the nav were confined to the left cluster column
  // (masthead width − switcher width). In NARROW each must span the FULL
  // `.masthead-inner` width instead.
  test('KDV-MOBILE-05: narrow chip and nav rows span the full inner width at 320 and 375', async ({ page }) => {
    await seedDeclaration(page);

    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/');
      await expect(page.locator('.masthead #species-chip')).toBeVisible();

      const m = await measureMasthead(page);
      expect(stateOf(m.contentW), `320/375 land in the NARROW state — ${width}px`).toBe('narrow');
      expectMastheadInvariants(m, `/ @ ${width}px`);

      // The exact defect: chip/nav right edges were a switcher-width short of the
      // inner right edge; now they are equal (within 2px).
      expect(
        Math.abs(m.speciesRow.right - m.inner.right),
        `chip row right edge = inner right — ${width}px`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(m.nav.right - m.inner.right),
        `nav row right edge = inner right — ${width}px`,
      ).toBeLessThanOrEqual(2);
      expect(Math.abs(m.nav.x - m.inner.x), `nav row left edge = inner left — ${width}px`).toBeLessThanOrEqual(2);
    }
  });

  test('KDV-MOBILE-05: each width lands a documented state and keeps the switcher on row 1', async ({ page }) => {
    await seedDeclaration(page);
    const seen = new Set();

    for (const width of [320, 375, 420, 560, 768, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.locator('.masthead #species-chip')).toBeVisible();

      const m = await measureMasthead(page);
      seen.add(expectMastheadInvariants(m, `/ @ ${width}px`));

      // The header is still sticky, and the masthead itself is the query container.
      expect(m.position, `sticky header — ${width}px`).toBe('sticky');
      expect(m.containerType, `masthead is an inline-size query container — ${width}px`).toContain('inline-size');

      // The popover still opens directly under the switcher and never leaves the
      // viewport (there is no relative `top` nudge to displace it any more).
      const summaryBox = await page.locator('.masthead .lang-switch-summary').boundingBox();
      await page.locator('.masthead .lang-switch-summary').click();
      const menu = page.locator('.masthead .lang-switch-menu');
      await expect(menu).toBeVisible();
      const menuBox = await menu.boundingBox();
      expect(menuBox.x, `menu inside the viewport at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width, `menu inside the viewport at ${width}px`).toBeLessThanOrEqual(width + 1);
      expect(
        menuBox.y,
        `menu opens directly under the switcher at ${width}px`,
      ).toBeGreaterThanOrEqual(summaryBox.y + summaryBox.height - 1);
      await page.locator('.masthead .lang-switch-summary').click();
    }

    // The matrix exercises all three states (narrow ≤ T1 < mid ≤ T2 < wide).
    expect([...seen].sort()).toEqual(['mid', 'narrow', 'wide']);
  });

  test('KDV-MOBILE-05: very narrow, medium and wide each land the documented rows', async ({ page }) => {
    await seedDeclaration(page);

    // NARROW (320, cw 258 < T1): row1 mark + switcher, row2 chip FULL, row3 nav FULL.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.locator('.masthead #species-chip')).toBeVisible();
    const narrow = await measureMasthead(page);
    expect(expectMastheadInvariants(narrow, '/ @ 320px')).toBe('narrow');
    expect(narrow.speciesRow.y, 'chip drops below the mark row').toBeGreaterThan(narrow.mark.y + ROW);
    expect(narrow.nav.y, 'nav drops below the chip row').toBeGreaterThan(narrow.speciesRow.y + ROW);

    // MID (768, T1 < cw 677 ≤ T2): row1 mark + chip + switcher, row2 nav FULL.
    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto('/');
    const mid = await measureMasthead(page);
    expect(expectMastheadInvariants(mid, '/ @ 768px')).toBe('mid');
    expect(Math.abs(mid.speciesRow.y - mid.mark.y), 'chip climbs onto the mark row').toBeLessThanOrEqual(ROW);
    expect(mid.nav.y, 'nav still drops below').toBeGreaterThan(mid.mark.y + ROW);
    expect(spansInner(mid.nav, mid.inner), 'nav row spans the full inner width').toBe(true);

    // WIDE (1280, cw 1170 > T2): row1 mark + chip + nav + switcher, in that order.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const wide = await measureMasthead(page);
    expect(expectMastheadInvariants(wide, '/ @ 1280px')).toBe('wide');
    expect(Math.abs(wide.nav.y - wide.mark.y), 'nav climbs onto the mark row').toBeLessThanOrEqual(ROW);
    expect(wide.mark.x).toBeLessThan(wide.speciesRow.x);
    expect(wide.speciesRow.x).toBeLessThan(wide.nav.x);
    expect(wide.nav.x).toBeLessThan(wide.switcher.x);
  });

  // The regression the structural fix removes: at an intermediate width the
  // header runs out of room and, under the old flat layout, the switcher wrapped
  // onto its own line. `/` and `/ru/` (longest nav labels) fail before the fix;
  // `/zh/` rides along as the long-CJK case and pins the no-overflow contract.
  test('KDV-MOBILE-05: long content at an intermediate width keeps the switcher on the mark row', async ({ page }) => {
    await seedDeclaration(page);

    for (const width of [768, 832, 900]) {
      for (const path of ['/', '/zh/', '/ru/']) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(page.locator('.masthead #species-chip')).toBeVisible();

        expectMastheadInvariants(await measureMasthead(page), `${path} @ ${width}px`);
      }
    }
  });

  test('KDV-MOBILE-05: without a declaration the chip adds no row and no phantom gap', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.locator('.masthead #species-chip')).toBeHidden();

    const m = await measureMasthead(page);
    expect(expectMastheadInvariants(m, '/ @ 320px (no declaration)')).toBe('narrow');
    expect(m.chipVisible).toBe(false);

    // The empty group leaves the flow entirely — no empty chip row.
    expect(await page.locator('.masthead .species-declaration').evaluate((el) => getComputedStyle(el).display)).toBe(
      'none',
    );

    // The nav auto-places straight onto row 2 (one row-gap below the mark row):
    // no phantom chip row in between, and it still spans the full inner width.
    const gap = m.nav.y - (m.mark.y + m.mark.h);
    expect(gap).toBeGreaterThanOrEqual(-1);
    expect(gap, 'no phantom chip row between the mark and the nav').toBeLessThanOrEqual(24);
    expect(spansInner(m.nav, m.inner), 'nav row spans the full inner width').toBe(true);

    // Wide: the nav climbs onto the mark row with no chip in between.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const wide = await measureMasthead(page);
    expect(expectMastheadInvariants(wide, '/ @ 1280px (no declaration)')).toBe('wide');
    expect(Math.abs(wide.nav.y - wide.mark.y), 'nav shares the mark row without a chip').toBeLessThanOrEqual(ROW);
  });

  // KDV-MOBILE-05: the reflow is now a container-query GRID keyed to the
  // masthead's OWN width, not the viewport and not a flex-wrap cluster.
  test('KDV-MOBILE-05: the reflow is a container-query grid keyed to the masthead', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    const css = await stylesheet(page);
    expect(css).toContain('container-type:inline-size');
    expect(css).toContain('container-name:masthead');
    expect(css).toContain('@container masthead (max-width:860px)');
    expect(css).toContain('@container masthead (max-width:520px)');
    // The old flex cluster and grow-spacer are gone.
    expect(css).not.toContain('.masthead-main');
    expect(css).not.toContain('.masthead-spacer');
    expect(css).not.toMatch(/\.masthead\{[^}]*display:flex/);
    expect(css).not.toMatch(/\.masthead\{[^}]*flex-wrap:nowrap/);
    // The flush-right mechanism is `justify-self:end` on the nav's own track,
    // never `margin-left:auto` (which would right-align a full-width nav row too).
    expect(css).not.toMatch(/\.nav\{[^}]*margin-left:auto/);

    // Computed structure: the masthead is the query container; the inner wrapper
    // is the grid; the four items are direct children in DOM order.
    expect(await page.locator('.masthead').evaluate((el) => getComputedStyle(el).containerType)).toContain('inline-size');
    expect(await page.locator('.masthead').evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    expect(await page.locator('.masthead-inner').evaluate((el) => getComputedStyle(el).display)).toBe('grid');
    expect(
      await page.locator('.masthead .masthead-inner > *').evaluateAll((els) => els.map((el) => el.className.split(' ')[0])),
    ).toEqual(['mark', 'species-declaration', 'nav', 'lang-switch']);
    // The switcher is a grid item of the inner wrapper, NOT a flex sibling of
    // the content cluster.
    expect(await page.locator('.masthead .lang-switch').evaluate((el) => el.parentElement.className)).toBe('masthead-inner');

    // The old viewport reflow (`.nav`/`.lang-switch` inside a 720px @media) stays
    // gone. Other 720px media queries (trust scale, titleblock) are unrelated and
    // stay; this walks each 720px block to prove the masthead selectors left it.
    const blocks = [];
    const opener = /@media\s*\(max-width:720px\)\s*\{/g;
    let match;
    while ((match = opener.exec(css))) {
      let depth = 1;
      let i = match.index + match[0].length;
      for (; i < css.length && depth > 0; i += 1) {
        if (css[i] === '{') depth += 1;
        else if (css[i] === '}') depth -= 1;
      }
      blocks.push(css.slice(match.index, i));
    }
    expect(blocks.length).toBeGreaterThan(0); // guard: the walk found them
    for (const block of blocks) {
      expect(block).not.toContain('.nav{');
      expect(block).not.toContain('.lang-switch{');
    }
  });
});

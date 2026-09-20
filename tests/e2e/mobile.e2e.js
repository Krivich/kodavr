import { test, expect } from '@playwright/test';
import {
  COPIED_LABEL,
  POST_GATE_LINE,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
} from '../../scripts/lib/copy.mjs';
import { CONTRACT_VERSION } from '../../scripts/lib/machine.mjs';

// §6.5 mobile adaptation. The gate.e2e.js suite proves the interactive flow on
// the desktop profile; this suite pins the viewport-dependent contract: the
// hall/gate/reception must fit the two target widths without horizontal scroll,
// with touch-sized targets, the 13px reception prompt and the accordion card.
const DUMP = '/dumps/sample-dump/';

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

  test('KDV-MOBILE-01: the gate fits 375x667 with 44px buttons, >=17px type and no horizontal scroll', async ({ page }) => {
    await page.goto(DUMP);
    const gate = page.locator('#gate');
    await expect(gate).toBeVisible();

    expect(await noHorizontalScroll(page)).toBe(true);

    const baseFont = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(baseFont).toBeGreaterThanOrEqual(17);

    for (const choice of ['machine', 'human']) {
      const box = await page.locator(`[data-gate-choice="${choice}"]`).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // Below 480px the modal is full-width with 16px padding.
    expect(await gate.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('16px');
    const gateBox = await gate.boundingBox();
    expect(gateBox.width).toBeLessThanOrEqual(375);
    expect(gateBox.width).toBeGreaterThanOrEqual(343);
  });

  test('KDV-MOBILE-02: the hall uses fluid type, constrained images and code blocks with a "scroll ->" hint and no horizontal scroll', async ({ page }) => {
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

  test('KDV-MOBILE-04: the reception prompt is 13px monospace and the copy control is a lane chip with a Copied state', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('.reception-block')).toBeVisible();

    const prompt = page.locator('.reception-prompt');
    expect(await prompt.evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px');
    expect((await prompt.evaluate((el) => getComputedStyle(el).fontFamily)).toLowerCase()).toContain('monospace');

    // §7.12: the copy control is a chip in the jump-links row — never a
    // full-width banner — and shares the jump links' chrome.
    const button = page.locator('.reception-block .copy-prompt');
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
      await page.locator('.reception-block .agent-link').first().evaluate(chrome),
    );

    // §7.12: the prompt renders below the lane on this surface.
    const laneBox = await page.locator('.reception-block .agent-lane').boundingBox();
    const promptBox = await prompt.boundingBox();
    expect(promptBox.y).toBeGreaterThanOrEqual(laneBox.y + laneBox.height - 1);

    await button.click();
    await expect(button).toHaveText(COPIED_LABEL);
  });

  test('KDV-MOBILE-09: the agent lane wraps with no horizontal scroll and every control is a >= 44px target', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('.reception-block .agent-lane')).toBeVisible();

    expect(await noHorizontalScroll(page)).toBe(true);

    const controls = page.locator('.reception-block .copy-prompt, .reception-block .agent-link');
    const count = await controls.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
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

  test('KDV-MOBILE-01 + KDV-MOBILE-02: gate and hall fit 360x640 with no horizontal scroll and the reception prompt stays 13px', async ({ page }) => {
    await page.goto(DUMP);
    await expect(page.locator('#gate')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    const box = await page.locator('[data-gate-choice="machine"]').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('.reception-block')).toBeVisible();
    expect(await page.locator('.reception-prompt').evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px');
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
    await expect(page.locator('#gate')).toBeVisible();

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
        dialog: rect('#gate'),
        hook: rect('#gate .gate-hook'),
        lane: rect('#gate .agent-lane'),
        duties: rect('#gate .gate-duties'),
        doors: rect('#gate .gate-doors'),
        prompt: rect('#gate .gate-prompt'),
      };
    });

    // Measured 2026-09-15 with the gate dialog 552px tall: hook 190 + lane 284 +
    // duties 163 + doors 238 = 875px — so "hook + lane + duties + doors share the
    // first screen" cannot hold at 320px. Per the owner decision of 2026-09-17 the
    // gate keeps the desktop reading order at every width (prompt after the lane,
    // doors after the duties), so the doors are a short scroll away; the number is
    // reported here so it is never silently lost (STATE.md keeps the decision).
    test.info().annotations.push({
      type: 'measurement',
      description: `320x568 gate dialog H=${measured.dialog.height}: hook ${measured.hook.height}, lane ${measured.lane.height}, duties ${measured.duties.height}, doors y=${measured.doors.y} h=${measured.doors.height}`,
    });

    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);

    // §6.5: each door is a >=44px touch target.
    for (const choice of ['machine', 'human']) {
      const door = page.locator(`[data-gate-choice="${choice}"]`);
      await expect(door).toBeVisible();
      const box = await door.boundingBox();
      expect(box.height, choice).toBeGreaterThanOrEqual(44);
    }

    // §6.5 P0-1: both doors carry their visible §7.1 labels (digit stays a badge).
    const labels = page.locator('#gate .door-label');
    await expect(labels).toHaveCount(2);
    await expect(labels.nth(0)).toHaveText(GATE_MACHINE_DOOR);
    await expect(labels.nth(1)).toHaveText(GATE_HUMAN_DOOR);

    // §6.5/KDV-MOBILE-01: the gate keeps the desktop order at every width — the
    // prompt follows the lane and comes BEFORE the doors (owner decision 2026-09-17).
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

  test('KDV-MOBILE-07: Android back closes the open gate', async ({ page }) => {
    await page.goto(DUMP);
    await expect(page.locator('#gate')).toBeVisible();

    await page.goBack();

    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('.hall')).toBeVisible();
  });

  test('KDV-MOBILE-07: Android back dismisses reception back to the hall', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('.reception-block')).toBeVisible();

    await page.goBack();

    await expect(page.locator('.reception-block')).toBeHidden();
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

// §6.5/KDV-MOBILE-05: the masthead reflows PROGRESSIVELY by available room,
// content-driven — NO media or container breakpoints. The logo mark, species
// chip and nav share ONE left cluster (`.masthead-main`) that wraps internally;
// the language switcher is a `flex:none` SIBLING of the cluster, so it ALWAYS
// shares row 1 with the mark, at the far right. As room allows, the chip and
// then the nav climb onto that first row (order: chip → nav). Visual order is
// always mark, (chip), (nav), …switcher.
//   VERY NARROW  row1 mark + switcher · row2 chip (only if declared) · row3 nav
//   MEDIUM       row1 mark + chip + switcher · row2 nav
//   WIDE         row1 mark + chip + nav + switcher
test.describe('masthead reflow by available room (KDV-MOBILE-05)', () => {
  const SPECIES_KEY = 'kodavr.species';
  const ROW = 8; // px tolerance for "box tops share a row"
  const CENTER = 2; // px tolerance for "the switcher's visual centre sits on the mark's"
  const FLUSH = 24; // px: when the nav shares the mark row it ends within ~1 flex gap of the switcher

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
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const chip = document.querySelector('.masthead #species-chip');
      return {
        mark: box('.masthead .mark'),
        chip: box('.masthead #species-chip'),
        chipVisible: chip ? !chip.hidden : false,
        nav: box('.masthead .nav'),
        switcher: box('.masthead .lang-switch'),
        summary: box('.masthead .lang-switch-summary'),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
  }

  // The invariant asserted at EVERY width: the switcher can never leave the
  // mark's row; the chip and the nav may only sit at or below their left-hand
  // neighbour, and when they share a row with the mark they must be ordered
  // strictly left of the switcher (and of each other).
  function expectMastheadInvariants(m, label) {
    expect(m.scrollWidth, `no horizontal scroll — ${label}`).toBeLessThanOrEqual(m.innerWidth);
    expect(m.mark, `mark laid out — ${label}`).not.toBeNull();
    expect(m.nav, `nav laid out — ${label}`).not.toBeNull();
    expect(m.switcher, `switcher laid out — ${label}`).not.toBeNull();
    expect(m.summary, `switcher summary laid out — ${label}`).not.toBeNull();

    expect(Math.abs(m.mark.y - m.switcher.y), `switcher shares the mark row — ${label}`).toBeLessThanOrEqual(ROW);

    // KDV-MOBILE-05: the switcher's VISUAL centre sits on the mark's centre.
    // Top-edge equality alone is not enough: the 44px tap box and the 34px mark
    // would sag by (44 - 34) / 2 = 5px. The summary is measured (not the box)
    // because that is what the eye reads as the control's midline.
    const centerDelta = Math.abs(
      m.mark.y + m.mark.h / 2 - (m.summary.y + m.summary.h / 2),
    );
    expect(centerDelta, `switcher centred on the mark — ${label}`).toBeLessThanOrEqual(CENTER);

    if (m.chipVisible) {
      expect(m.chip.y, `chip at or below the mark row — ${label}`).toBeGreaterThanOrEqual(m.mark.y - 1);
      if (Math.abs(m.chip.y - m.mark.y) <= ROW) {
        expect(m.chip.x, `chip right of the mark — ${label}`).toBeGreaterThanOrEqual(m.mark.x);
        expect(m.chip.x, `chip left of the switcher — ${label}`).toBeLessThan(m.switcher.x);
      }
      expect(m.nav.y, `nav at or below the chip — ${label}`).toBeGreaterThanOrEqual(m.chip.y - 1);
    }
    if (Math.abs(m.nav.y - m.mark.y) <= ROW) {
      // KDV-MOBILE-05: on the WIDE line a grow-spacer before the nav pushes it
      // flush against the switcher — the nav must end within one masthead flex
      // gap (--sp-4 = 16px; small tolerance) of the switcher's left edge, not
      // trail right after the chip.
      const flush = m.switcher.x - (m.nav.x + m.nav.w);
      expect(flush, `nav flush right against the switcher on the mark row — ${label}`).toBeLessThanOrEqual(FLUSH);
      expect(flush, `nav does not overlap the switcher — ${label}`).toBeGreaterThanOrEqual(-1);
      expect(m.nav.x, `nav left of the switcher on the mark row — ${label}`).toBeLessThan(m.switcher.x);
    } else {
      // KDV-MOBILE-05: on a WRAPPED line the nav is ALONE and stays left-aligned
      // with the mark — the spacer lives on the wide line, so no `margin-left:auto`
      // creeps onto the nav's own line.
      expect(Math.abs(m.nav.x - m.mark.x), `nav stays left-aligned when wrapped — ${label}`).toBeLessThanOrEqual(CENTER);
    }
  }

  test('KDV-MOBILE-05: the switcher stays on the mark row across the width matrix', async ({ page }) => {
    await seedDeclaration(page);

    for (const width of [320, 375, 420, 560, 768, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.locator('.masthead #species-chip')).toBeVisible();

      expectMastheadInvariants(await measureMasthead(page), `/ @ ${width}px`);

      // The header is still sticky after every reflow.
      expect(await page.locator('.masthead').evaluate((el) => getComputedStyle(el).position)).toBe('sticky');

      // KDV-MOBILE-05: the vertical nudge must not displace the popover — it
      // still opens directly under the control and never leaves the viewport.
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
  });

  test('KDV-MOBILE-05: very narrow, medium and wide each land the documented rows', async ({ page }) => {
    await seedDeclaration(page);

    // VERY NARROW (320): row1 mark + switcher, row2 chip, row3 nav.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.locator('.masthead #species-chip')).toBeVisible();
    const narrow = await measureMasthead(page);
    expectMastheadInvariants(narrow, '/ @ 320px');
    expect(narrow.chip.y, 'chip drops below the mark row').toBeGreaterThan(narrow.mark.y + ROW);
    expect(narrow.nav.y, 'nav drops below the chip row').toBeGreaterThan(narrow.chip.y + ROW);

    // MEDIUM (768): row1 mark + chip + switcher, row2 nav.
    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto('/');
    const medium = await measureMasthead(page);
    expectMastheadInvariants(medium, '/ @ 768px');
    expect(Math.abs(medium.chip.y - medium.mark.y), 'chip climbs onto the mark row').toBeLessThanOrEqual(ROW);
    expect(medium.nav.y, 'nav still drops below').toBeGreaterThan(medium.mark.y + ROW);

    // WIDE (1280): row1 mark + chip + nav + switcher, in that order.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const wide = await measureMasthead(page);
    expectMastheadInvariants(wide, '/ @ 1280px');
    expect(Math.abs(wide.nav.y - wide.mark.y), 'nav climbs onto the mark row').toBeLessThanOrEqual(ROW);
    expect(wide.mark.x).toBeLessThan(wide.chip.x);
    expect(wide.chip.x).toBeLessThan(wide.nav.x);
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
    expectMastheadInvariants(m, '/ @ 320px (no declaration)');
    expect(m.chipVisible).toBe(false);

    // The empty group leaves the flow entirely — no empty chip row.
    expect(await page.locator('.masthead .species-declaration').evaluate((el) => getComputedStyle(el).display)).toBe(
      'none',
    );

    // The nav follows the mark by exactly one flex gap (16px), not a chip-row.
    const gap = m.nav.y - (m.mark.y + m.mark.h);
    expect(gap).toBeGreaterThanOrEqual(-1);
    expect(gap, 'no phantom chip row between the mark and the nav').toBeLessThanOrEqual(24);

    // Wide: the nav climbs onto the mark row with no chip in between.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const wide = await measureMasthead(page);
    expectMastheadInvariants(wide, '/ @ 1280px (no declaration)');
    expect(Math.abs(wide.nav.y - wide.mark.y), 'nav shares the mark row without a chip').toBeLessThanOrEqual(ROW);
  });

  test('KDV-MOBILE-05: the reflow is structural (one wrapping cluster + a fixed switcher sibling), not a query', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    const css = await stylesheet(page);
    // No container query and no fixed masthead reflow breakpoint left.
    expect(css).not.toContain('@container');
    expect(css).not.toContain('container-type');
    // The cluster wraps; the masthead itself does not; the switcher is fixed.
    expect(css).toMatch(/\.masthead\{[^}]*flex-wrap:nowrap/);
    expect(css).toContain('.masthead-main{display:flex;flex-wrap:wrap;align-items:center;');
    expect(css).toMatch(/\.lang-switch\{[^}]*flex:none/);
    expect(css).not.toMatch(/\.lang-switch\{[^}]*margin-left:auto/);
    expect(css).not.toMatch(/\.nav\{[^}]*margin-left:auto/);
    // The flush-right mechanism is a 0-base grow spacer, never a nav margin.
    expect(css).toMatch(/\.masthead-spacer\{[^}]*flex:1 1 0/);
    expect(css).toMatch(/\.masthead-spacer\{[^}]*min-width:0/);

    // DOM: the switcher is a direct child of `.masthead` (sibling of the
    // cluster); the cluster holds mark → species → spacer → nav in that order
    // (the spacer is the presentational grow item that flushes the nav right on
    // the wide line, and is inert without JS).
    expect(await page.locator('.masthead .lang-switch').evaluate((el) => el.parentElement.className)).toBe('masthead');
    expect(
      await page.locator('.masthead .masthead-main > *').evaluateAll((els) => els.map((el) => el.className.split(' ')[0])),
    ).toEqual(['mark', 'species-declaration', 'masthead-spacer', 'nav']);

    expect(await page.locator('.masthead').evaluate((el) => getComputedStyle(el).flexWrap)).toBe('nowrap');
    expect(await page.locator('.masthead .masthead-main').evaluate((el) => getComputedStyle(el).flexWrap)).toBe('wrap');

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

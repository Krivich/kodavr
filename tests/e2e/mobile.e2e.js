import { test, expect } from '@playwright/test';
import {
  COPIED_LABEL,
  POST_GATE_LINE,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
} from '../../scripts/lib/copy.mjs';

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
    expect(css).toMatch(/\.dump-body img\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.dump-body pre\s*\{[^}]*overflow-x:\s*auto/);

    const pre = page.locator('.dump-body pre').first();
    await expect(pre).toBeVisible();
    expect(await pre.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    expect(await pre.evaluate((el) => getComputedStyle(el, '::after').content)).toContain('scroll');

    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('KDV-MOBILE-03: artifacts render as cards and the manifest card is a collapsed accordion', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="machine"]');

    const cards = page.locator('.artifact-card');
    await expect(cards).toHaveCount(1);
    const card = cards.first();
    await expect(card).toContainText('url');
    await expect(card.locator('a')).toHaveAttribute('href', 'https://example.test/docs');
    await expect(card).toContainText('component docs');

    const manifest = page.locator('.manifest-card');
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
    const postGate = page.locator('.post-gate-line');
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
    // first screen" cannot hold at 320px, even with the prompt moved below the
    // doors (the <480px order in styles.css). Whether <480px keeps that promise or
    // settles for "hook + lane, doors a short scroll away" is a pending owner
    // decision; the number is reported here so it is never silently lost
    // (STATE.md keeps the decision record).
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

    // §6.5/KDV-MOBILE-01: below 480px the pinned prompt follows the doors — the
    // labelled doors reach the reader before the prompt does.
    expect(measured.prompt.y).toBeGreaterThan(measured.doors.bottom);

    // Deliberately NOT asserted: both doors inside the initial 568px viewport — the
    // measurement above shows it is unreachable at this width, and the composition
    // promise for <480px is the pending owner decision.
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
    await expect(page.locator('.dump-body')).toBeVisible();
  });

  test('KDV-MOBILE-07: Android back dismisses reception back to the hall', async ({ page }) => {
    await page.goto(DUMP);
    await page.click('[data-gate-choice="human"]');
    await expect(page.locator('.reception-block')).toBeVisible();

    await page.goBack();

    await expect(page.locator('.reception-block')).toBeHidden();
    await expect(page.locator('.dump-body')).toBeVisible();
  });
});

// §6.5 feed pagination on a phone. The shared e2e build seeds a second feed page
// (serve-site.mjs); page 1 is server-rendered at the root and the arrows must be
// touch-sized. The sticky header and the back-to-feed FAB are asserted here too.
test.describe('feed pagination (KDV-MOBILE-05)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('KDV-MOBILE-05: the feed paginates with 44px arrows and tapping next swaps the visible items', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.dump-feed .dump-card');
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
    const header = page.locator('.site-header');
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');

    await page.click('[data-gate-choice="machine"]');
    const fab = page.locator('.back-to-feed');
    await expect(fab).toBeVisible();
    const box = await fab.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    const viewport = page.viewportSize();
    expect(box.x + box.width).toBeGreaterThan(viewport.width / 2);
    expect(box.y + box.height).toBeGreaterThan(viewport.height / 2);
  });
});

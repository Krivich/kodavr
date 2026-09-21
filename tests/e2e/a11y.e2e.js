import { test, expect } from '@playwright/test';
import {
  GATE_TITLE,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  HALL_ANNOUNCEMENT,
  RECEPTION_ANNOUNCEMENT,
  COPIED_ANNOUNCEMENT,
} from '../../scripts/lib/copy.mjs';

// §6.6 dynamic half (P6b): the inline declaration's accessible name, focus
// management and the live region that announces no-navigation state changes.
// The static baseline (skip link, landmarks) is proven by tests/unit/a11y.test.js;
// here a real browser resolves the accessible names and focus targets.
const DUMP = '/dumps/sample-dump/';

// §6.5 P0-1: the doors' accessible names come from their visible labels, so the
// assertion reads the same §7.1 copy the DOM exposes. The human line carries a
// newline + indent in the fence; HTML collapses it to single spaces, and so does
// the accessible-name computation — normalize both sides to compare.
const flat = (label) => label.replace(/\s+/g, ' ').trim();

test('KDV-A11Y-01: Tab from the top reaches the skip link first', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');

  await expect(page.locator('.skip-link')).toBeFocused();
});

test('KDV-A11Y-02: the inline declaration region carries its §7.1 name and the 0/1 choices have descriptive names', async ({ page }) => {
  await page.goto(DUMP);

  const region = page.getByRole('region', { name: GATE_TITLE });
  await expect(region).toBeVisible();
  await expect(page.getByRole('button', { name: flat(GATE_MACHINE_DOOR) })).toBeVisible();
  await expect(page.getByRole('button', { name: flat(GATE_HUMAN_DOOR) })).toBeVisible();

  // A bare digit is not exposed as an accessible name.
  await expect(page.getByRole('button', { name: '0', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveCount(0);
});

test('KDV-A11Y-02: re-opening the collapsed declaration returns focus to the page (main), not <body>', async ({ page }) => {
  await page.goto(DUMP);
  await expect(page.getByRole('region', { name: GATE_TITLE })).toBeVisible();

  // A committed choice collapses the declaration; the single bottom reset
  // re-opens it in place and hands focus back to main (never <body>).
  await page.click('[data-gate-choice="machine"]');
  await page.locator('#article-reset [data-reset-human]').click();

  await expect(page.locator('#plate-declaration')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('main');
});

test('KDV-A11Y-03: choosing 0 by keyboard opens the hall and announces it', async ({ page }) => {
  await page.goto(DUMP);
  const status = page.locator('#a11y-status');

  await page.getByRole('button', { name: flat(GATE_MACHINE_DOOR) }).focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('.hall')).toBeVisible();
  await expect(status).toHaveText(HALL_ANNOUNCEMENT);
});

test('KDV-A11Y-03: choosing 1 opens reception and announces it; a copy sets the Copied announcement', async ({ page }) => {
  await page.goto(DUMP);
  const status = page.locator('#a11y-status');

  await page.getByRole('button', { name: flat(GATE_HUMAN_DOOR) }).focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#plate-want')).toBeVisible();
  await expect(page.locator('.hall')).toBeHidden();
  await expect(status).toHaveText(RECEPTION_ANNOUNCEMENT);

  await page.locator('#plate-want .copy-prompt').click();
  await expect(status).toHaveText(COPIED_ANNOUNCEMENT);
});

import { test, expect } from '@playwright/test';
import {
  GATE_TITLE,
  GATE_MACHINE_LABEL,
  GATE_HUMAN_LABEL,
  HALL_ANNOUNCEMENT,
  RECEPTION_ANNOUNCEMENT,
  COPIED_ANNOUNCEMENT,
} from '../../scripts/lib/copy.mjs';

// §6.6 dynamic half (P6b): the interactive modal's accessible name, focus
// management and the live region that announces no-navigation state changes.
// The static baseline (skip link, landmarks) is proven by tests/unit/a11y.test.js;
// here a real browser resolves the accessible names and focus targets.
const DUMP = '/dumps/sample-dump/';

test('KDV-A11Y-01: Tab from the top reaches the skip link first', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');

  await expect(page.locator('.skip-link')).toBeFocused();
});

test('KDV-A11Y-02: the gate dialog carries its §7.1 name and the 0/1 choices have descriptive names', async ({ page }) => {
  await page.goto(DUMP);

  const dialog = page.getByRole('dialog', { name: GATE_TITLE });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: GATE_MACHINE_LABEL })).toBeVisible();
  await expect(page.getByRole('button', { name: GATE_HUMAN_LABEL })).toBeVisible();

  // A bare digit is not exposed as an accessible name.
  await expect(page.getByRole('button', { name: '0', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveCount(0);
});

test('KDV-A11Y-02: closing the gate returns focus to the page (main), not <body>', async ({ page }) => {
  await page.goto(DUMP);
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.locator('#gate')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('main');
});

test('KDV-A11Y-03: choosing 0 by keyboard opens the hall and announces it', async ({ page }) => {
  await page.goto(DUMP);
  const status = page.locator('#a11y-status');

  await page.getByRole('button', { name: GATE_MACHINE_LABEL }).focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('.dump-body')).toBeVisible();
  await expect(status).toHaveText(HALL_ANNOUNCEMENT);
});

test('KDV-A11Y-03: choosing 1 opens reception and announces it; a copy sets the Copied announcement', async ({ page }) => {
  await page.goto(DUMP);
  const status = page.locator('#a11y-status');

  await page.getByRole('button', { name: GATE_HUMAN_LABEL }).focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('.reception-block')).toBeVisible();
  await expect(page.locator('.dump-body')).toBeHidden();
  await expect(status).toHaveText(RECEPTION_ANNOUNCEMENT);

  await page.locator('.copy-prompt').click();
  await expect(status).toHaveText(COPIED_ANNOUNCEMENT);
});

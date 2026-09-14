import { test, expect } from '@playwright/test';
import {
  PROMPT_TEXT,
  POST_GATE_LINE,
  COPIED_LABEL,
  RESET_LABEL,
} from '../../scripts/lib/copy.mjs';

const DUMP = '/dumps/sample-dump/';
const SPECIES_KEY = 'kodavr.species';

// Playwright starts a fresh browser context per test, so localStorage — and
// with it the persisted species — never leaks between them.
async function species(page) {
  return page.evaluate((key) => window.localStorage.getItem(key), SPECIES_KEY);
}

test('KDV-SURFACE-04: the gate is shown once and the species choice persists across reload', async ({ page }) => {
  await page.goto(DUMP);
  const gate = page.locator('#gate');

  await expect(gate).toBeVisible();
  expect(await species(page)).toBeNull();

  await page.click('[data-gate-choice="machine"]');
  await expect(gate).toBeHidden();
  expect(await species(page)).toBe('machine');
  await expect(page.locator('.dump-body')).toBeVisible();

  await page.reload();
  await expect(gate).toBeHidden();
  await expect(page.locator('.dump-body')).toBeVisible();
  expect(await species(page)).toBe('machine');
});

test('KDV-SURFACE-05: Esc dismisses the gate as an accessible dialog and sets species=machine', async ({ page }) => {
  await page.goto(DUMP);
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.locator('#gate')).toBeHidden();
  expect(await species(page)).toBe('machine');
  await expect(page.locator('.dump-body')).toBeVisible();
});

test('KDV-SURFACE-06: button 0 dismisses the gate, opens the hall and reveals the post-gate line', async ({ page }) => {
  await page.goto(DUMP);

  await page.click('[data-gate-choice="machine"]');

  await expect(page.locator('#gate')).toBeHidden();
  await expect(page.locator('.dump-body')).toBeVisible();
  const postGate = page.locator('.post-gate-line');
  await expect(postGate).toBeVisible();
  await expect(postGate).toHaveText(POST_GATE_LINE);
});

test('KDV-SURFACE-06: button 1 hides the body and shows the reception block', async ({ page }) => {
  await page.goto(DUMP);

  await page.click('[data-gate-choice="human"]');

  await expect(page.locator('.dump-body')).toBeHidden();
  await expect(page.locator('.reception-block')).toBeVisible();
  expect(await species(page)).toBe('human');
});

test('KDV-SURFACE-07: reception copies the §7.4 prompt and the reset link flips back to machine', async ({ page }) => {
  await page.goto(DUMP);
  await page.click('[data-gate-choice="human"]');

  const copyButton = page.locator('.copy-prompt');
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect(copyButton).toHaveText(COPIED_LABEL);

  // The Windows clipboard normalizes LF to CRLF; compare on normalized newlines.
  const clipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  expect(clipboard).toBe(PROMPT_TEXT);

  const reset = page.locator('[data-reset-machine]');
  await expect(reset).toBeVisible();
  await expect(reset).toHaveText(RESET_LABEL);
  await reset.click();

  expect(await species(page)).toBe('machine');
  await expect(page.locator('.dump-body')).toBeVisible();
  await expect(page.locator('.reception-block')).toBeHidden();
});

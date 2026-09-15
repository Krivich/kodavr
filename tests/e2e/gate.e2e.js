import { test, expect } from '@playwright/test';
import {
  PROMPT_TEXT,
  POST_GATE_LINE,
  DECLARATION_TOAST,
  HALL_ANNOUNCEMENT,
  COPIED_LABEL,
  RESET_LABEL,
  RESET_HUMAN_LABEL,
  CHIP_HUMAN_LABEL,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  chipMachine,
  chipTitle,
  dumpPrompt,
} from '../../scripts/lib/copy.mjs';
import { CONTRACT_VERSION } from '../../scripts/lib/machine.mjs';

const DUMP = '/dumps/sample-dump/';
const SPECIES_KEY = 'kodavr.species';
// §7.11: a dump page pins the prompt to its own canonical URL and points at the
// index for more. The e2e server serves the built site at 127.0.0.1:4173.
const DUMP_PROMPT = dumpPrompt(
  'http://127.0.0.1:4173/dumps/sample-dump/',
  'http://127.0.0.1:4173/index.json',
);

// Playwright starts a fresh browser context per test, so localStorage — and
// with it the persisted declaration — never leaks between them.
async function rawSpecies(page) {
  return page.evaluate((key) => window.localStorage.getItem(key), SPECIES_KEY);
}

// §6.2: the stored value is a versioned JSON declaration record.
async function declaration(page) {
  const raw = await rawSpecies(page);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// The species carried by the stored record, or null when nothing is declared.
async function species(page) {
  const record = await declaration(page);
  return record ? record.species : null;
}

test('KDV-SURFACE-04: the gate is shown once and the species choice persists across reload', async ({ page }) => {
  await page.goto(DUMP);
  const gate = page.locator('#gate');

  await expect(gate).toBeVisible();
  expect(await rawSpecies(page)).toBeNull();

  await page.click('[data-gate-choice="machine"]');
  await expect(gate).toBeHidden();
  const record = await declaration(page);
  expect(record.species).toBe('machine');
  expect(record.contract_version).toBe(CONTRACT_VERSION);
  expect(record.declared_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await expect(page.locator('.dump-body')).toBeVisible();

  await page.reload();
  await expect(gate).toBeHidden();
  await expect(page.locator('.dump-body')).toBeVisible();
  expect((await declaration(page)).species).toBe('machine');
});

test('KDV-SURFACE-04: a declaration is a versioned JSON record with exactly species, contract_version and declared_at', async ({ page }) => {
  await page.goto(DUMP);

  await page.click('[data-gate-choice="machine"]');

  const raw = await rawSpecies(page);
  const record = JSON.parse(raw);
  expect(Object.keys(record).sort()).toEqual(['contract_version', 'declared_at', 'species']);
  expect(record.species).toBe('machine');
  expect(record.contract_version).toBe(CONTRACT_VERSION);
  expect(Number.isNaN(Date.parse(record.declared_at))).toBe(false);
});

test('KDV-SURFACE-04: a legacy raw species value is migrated in place and does not force re-consent', async ({ page }) => {
  await page.goto(DUMP);
  await page.evaluate((key) => window.localStorage.setItem(key, 'human'), SPECIES_KEY);

  await page.reload();

  // The legacy choice still applies: no gate, reception open.
  await expect(page.locator('#gate')).toBeHidden();
  await expect(page.locator('.reception-block')).toBeVisible();

  const record = await declaration(page);
  expect(record.species).toBe('human');
  expect(record.contract_version).toBe(CONTRACT_VERSION);
  expect(typeof record.declared_at).toBe('string');
});

test('KDV-SURFACE-04: a contract-version bump clears the stale declaration and re-opens the gate', async ({ page }) => {
  await page.goto(DUMP);
  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        species: 'machine',
        contract_version: '0.0',
        declared_at: new Date().toISOString(),
      }),
    );
  }, SPECIES_KEY);

  await page.reload();

  await expect(page.locator('#gate')).toBeVisible();
  expect(await rawSpecies(page)).toBeNull();
});

test('KDV-SURFACE-04: getDeclaration returns the full record while getSpecies returns its species string', async ({ page }) => {
  await page.goto(DUMP);

  expect(await page.evaluate(() => window.Kodavr.getDeclaration())).toBeNull();

  await page.evaluate(() => window.Kodavr.setSpecies('machine'));

  const viaApi = await page.evaluate(() => ({
    declaration: window.Kodavr.getDeclaration(),
    species: window.Kodavr.getSpecies(),
  }));
  expect(viaApi.species).toBe('machine');
  expect(viaApi.declaration.species).toBe('machine');
  expect(viaApi.declaration.contract_version).toBe(CONTRACT_VERSION);

  await page.evaluate(() => window.Kodavr.clearSpecies());
  expect(await page.evaluate(() => window.Kodavr.getDeclaration())).toBeNull();
  expect(await page.evaluate(() => window.Kodavr.getSpecies())).toBeNull();
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

test('KDV-SURFACE-19: pressing 0 shows the declaration toast once and auto-hides it', async ({ page }) => {
  await page.goto(DUMP);
  const toast = page.locator('.declaration-toast');

  await expect(toast).toBeHidden();
  await page.click('[data-gate-choice="machine"]');

  await expect(toast).toBeVisible();
  await expect(toast).toHaveText(DECLARATION_TOAST);
  // It is its own live region; the hall announcement keeps its own.
  expect(await toast.getAttribute('role')).toBe('status');
  await expect(page.locator('#a11y-status')).toHaveText(HALL_ANNOUNCEMENT);

  // Auto-hides after a few seconds.
  await expect(toast).toBeHidden({ timeout: 6000 });
});

test('KDV-SURFACE-19: the visible toast fits 375px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(DUMP);

  await page.click('[data-gate-choice="machine"]');
  const toast = page.locator('.declaration-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText(DECLARATION_TOAST);

  const box = await toast.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('KDV-SURFACE-19: Esc, hardware back and a machine reload never show the toast', async ({ page }) => {
  const toast = page.locator('.declaration-toast');

  // Esc is a machine-adjacent dismissal, not a declaration.
  await page.goto(DUMP);
  await page.keyboard.press('Escape');
  await expect(page.locator('#gate')).toBeHidden();
  await expect(toast).toBeHidden();

  // Hardware back closes the gate the same way — as a fresh visitor, since the
  // Esc dismissal above already stored the species.
  await page.evaluate((key) => window.localStorage.removeItem(key), SPECIES_KEY);
  await page.goto(DUMP);
  await expect(page.locator('#gate')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#gate')).toBeHidden();
  await expect(toast).toBeHidden();

  // A boot into the hall with the species already stored shows no toast: no
  // declaration happened on this page load.
  await page.evaluate((key) => window.localStorage.setItem(key, 'machine'), SPECIES_KEY);
  await page.goto(DUMP);
  await expect(page.locator('.dump-body')).toBeVisible();
  await expect(toast).toBeHidden();
});

test('KDV-SURFACE-06: button 1 hides the body and shows the reception block', async ({ page }) => {
  await page.goto(DUMP);

  await page.click('[data-gate-choice="human"]');

  await expect(page.locator('.dump-body')).toBeHidden();
  await expect(page.locator('.reception-block')).toBeVisible();
  expect(await species(page)).toBe('human');
});

test('KDV-SURFACE-15: a declared machine sees the machine panel in the hall header and can reset to re-declare', async ({ page }) => {
  await page.goto(DUMP);

  const panel = page.locator('.machine-panel');
  await expect(panel).toBeHidden();

  await page.click('[data-gate-choice="machine"]');

  await expect(panel).toBeVisible();
  await expect(panel.locator('.machine-prompt')).toHaveText(DUMP_PROMPT);
  await expect(panel.locator('.agent-link')).toHaveCount(4);
  await expect(panel.locator('[data-reset-human]')).toHaveText(RESET_HUMAN_LABEL);

  await panel.locator('[data-reset-human]').click();

  await expect(page.locator('#gate')).toBeVisible();
  expect(await species(page)).toBeNull();
});

test('KDV-SURFACE-07: reception copies the §7.4 prompt and the reset link flips back to machine', async ({ page }) => {
  await page.goto(DUMP);
  await page.click('[data-gate-choice="human"]');

  // Scope to the reception lane: a dump page now has two copy controls (the
  // gate lane and the reception lane), so an unscoped .copy-prompt is ambiguous.
  const copyButton = page.locator('.reception-block .copy-prompt');
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect(copyButton).toHaveText(COPIED_LABEL);

  // The Windows clipboard normalizes LF to CRLF; compare on normalized newlines.
  const clipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  expect(clipboard).toBe(DUMP_PROMPT);

  const reset = page.locator('[data-reset-machine]');
  await expect(reset).toBeVisible();
  await expect(reset).toHaveText(RESET_LABEL);
  await reset.click();

  expect(await species(page)).toBe('machine');
  await expect(page.locator('.dump-body')).toBeVisible();
  await expect(page.locator('.reception-block')).toBeHidden();
});

test('KDV-SURFACE-13: the human fast lane leads the gate — a visible pinned prompt plus four agent jumps, with the hook, duties and choices above the fold', async ({ page }) => {
  await page.goto(DUMP);

  const lane = page.locator('#gate .agent-lane');
  await expect(lane).toBeVisible();
  await expect(page.locator('#gate .agent-link')).toHaveCount(4);

  // §7.1/§7.12: the controls lead; the pinned prompt sits below them.
  const prompt = page.locator('#gate .gate-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveText(DUMP_PROMPT);
  const laneBox = await lane.boundingBox();
  const promptBox = await prompt.boundingBox();
  expect(promptBox.y).toBeGreaterThanOrEqual(laneBox.y + laneBox.height - 1);

  // The prompt is rendered exactly once per surface: the reception block keeps
  // its own (hidden on a dump page) prompt copy.
  await expect(page.locator('.reception-prompt')).toHaveCount(1);

  // The first screen holds the lane, the hook, the duties line and the 0/1
  // choices — all inside the viewport, the long declaration stays below the
  // fold.
  const viewport = page.viewportSize();
  for (const selector of ['#gate .agent-lane', '#gate .gate-hook', '#gate .gate-duties', '#gate .gate-doors']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.y, selector).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, selector).toBeLessThanOrEqual(viewport.height);
  }

  // §6.5 P0-1: both doors carry their own visible §7.1 labels (the digit stays a
  // separate badge), so the first screen names the choices instead of a bare 0/1.
  const doorLabels = page.locator('#gate .door-label');
  await expect(doorLabels).toHaveCount(2);
  await expect(doorLabels.nth(0)).toHaveText(GATE_MACHINE_DOOR);
  await expect(doorLabels.nth(1)).toHaveText(GATE_HUMAN_DOOR);

  // The below-the-fold declaration must not be glued to the 0/1 buttons.
  const doors = await page.locator('#gate .gate-doors').boundingBox();
  const rest = await page.locator('#gate .gate-rest').boundingBox();
  expect(rest.y - (doors.y + doors.height)).toBeGreaterThanOrEqual(4);
});

test('KDV-SURFACE-14: the dump prompt is pinned; /reception/ keeps the universal prompt', async ({ page }) => {
  await page.goto(DUMP);

  const chatgpt = page.locator('#gate .agent-link', { hasText: 'ChatGPT' });
  await expect(chatgpt).toHaveAttribute('href', /^https:\/\/chatgpt\.com\/\?q=/);
  expect(await chatgpt.getAttribute('href')).toContain(encodeURIComponent(DUMP_PROMPT));
  // §7.12: every jump target prefills via ?q=.
  await expect(page.locator('#gate .agent-link', { hasText: 'Grok' })).toHaveAttribute(
    'href',
    /^https:\/\/grok\.com\/\?q=/,
  );

  await page.goto('/reception/');
  await expect(page.locator('.reception-prompt')).toHaveText(PROMPT_TEXT);
  await expect(page.locator('.agent-link')).toHaveCount(4);
});

test('KDV-SURFACE-17: the header chip follows the species — hidden fresh, machine after 0, human after 1, cleared by withdraw', async ({ page }) => {
  const chip = page.locator('#species-chip');
  const withdraw = page.locator('.species-declaration [data-withdraw]');

  // Nothing declared on a fresh visit: the chip stays hidden.
  await page.goto(DUMP);
  await expect(chip).toBeHidden();
  await expect(withdraw).toBeHidden();

  // "0" is handled in place by the dump controller — no reload, the chip flips
  // to the versioned machine label.
  await page.click('[data-gate-choice="machine"]');
  await expect(chip).toBeVisible();
  await expect(chip.locator('.species-chip-text')).toHaveText(chipMachine(CONTRACT_VERSION));
  await expect(withdraw).toBeVisible();

  // §7.13: the status pill is plain text — the withdraw action is a separate
  // link outside it, so no control and no focus stop ever sits inside the pill.
  await expect(chip.locator('a, button, [tabindex]')).toHaveCount(0);
  await expect(page.locator('#species-chip [data-withdraw]')).toHaveCount(0);

  // The link carries the §7.13 title template filled from the stored
  // declaration date (the same ISO prefix site.js shows).
  const record = await declaration(page);
  await expect(withdraw).toHaveAttribute('title', chipTitle(record.declared_at.slice(0, 10)));

  // Keyboard: Tab from the header logo lands on the withdraw link — the pill
  // itself is not a focus stop.
  await page.locator('a.site-logo').focus();
  await page.keyboard.press('Tab');
  await expect(withdraw).toBeFocused();

  // The withdraw link clears the stored declaration and navigates home. Wait
  // only for the navigation away from the dump; the stored record is the point.
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    withdraw.click(),
  ]);
  expect(await species(page)).toBeNull();

  // The reception ("1") path on a fresh load shows the human label.
  await page.goto(DUMP);
  await expect(page.locator('#species-chip')).toBeHidden();
  await page.click('[data-gate-choice="human"]');
  await expect(page.locator('#species-chip')).toBeVisible();
  await expect(page.locator('#species-chip .species-chip-text')).toHaveText(CHIP_HUMAN_LABEL);
  await expect(page.locator('.species-declaration [data-withdraw]')).toBeVisible();
});

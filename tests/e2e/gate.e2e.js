import { test, expect } from '@playwright/test';
import {
  POST_GATE_LINE,
  DECLARATION_TOAST,
  HALL_ANNOUNCEMENT,
  COPIED_LABEL,
  COPIED_ANNOUNCEMENT,
  LANE_COPY_LABEL,
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
// §7.11: a dump page's prompt is a bare boot address to its own manifest, whose
// embedded schema describes the `raw` layer. The e2e server serves the built
// site at 127.0.0.1:4173.
const DUMP_PROMPT = dumpPrompt('http://127.0.0.1:4173/dumps/sample-dump/manifest.json');

// Human Surface v4/KDV-SURFACE-28: the declaration is INLINE, not a modal. The
// article page renders `01 · PREVIEW` / `02 · INTERESTING?` / `03 · DECLARATION`
// as plates above the raw-body `01 · DUMP` plate, and the controller collapses
// them per the stored species:
//   0  — all three state-0 plates visible, the raw dump plate hidden, no reset;
//   M  — `01 · DUMP` + the machine panel + the statusline + reset, the rest gone;
//   H  — `01 · PREVIEW` + `02` + reset, the declaration and the dump gone.
// The single bottom reset (`#article-reset`) clears the species and re-opens
// state 0 in place.
const PLATE_PREVIEW = '#plate-preview';
const PLATE_WANT = '#plate-want';
const PLATE_DECLARATION = '#plate-declaration';
const PLATE_DUMP = '#plate-dump';
const RESET = '#article-reset [data-reset-human]';

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

test('KDV-SURFACE-04: the declaration is shown once and the species choice persists across reload', async ({ page }) => {
  await page.goto(DUMP);
  const declarationPlate = page.locator(PLATE_DECLARATION);

  await expect(declarationPlate).toBeVisible();
  await expect(page.locator(PLATE_PREVIEW)).toBeVisible();
  await expect(page.locator(PLATE_WANT)).toBeVisible();
  await expect(page.locator(PLATE_DUMP)).toBeHidden();
  expect(await rawSpecies(page)).toBeNull();

  await page.click('[data-gate-choice="machine"]');
  await expect(declarationPlate).toBeHidden();
  const record = await declaration(page);
  expect(record.species).toBe('machine');
  expect(record.contract_version).toBe(CONTRACT_VERSION);
  expect(record.declared_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await expect(page.locator(PLATE_DUMP)).toBeVisible();
  await expect(page.locator('.hall')).toBeVisible();

  await page.reload();
  await expect(declarationPlate).toBeHidden();
  await expect(page.locator('.hall')).toBeVisible();
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

  // The legacy choice still applies: no declaration, state H (preview + 02).
  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(page.locator(PLATE_PREVIEW)).toBeVisible();
  await expect(page.locator(PLATE_WANT)).toBeVisible();

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

  await expect(page.locator(PLATE_DECLARATION)).toBeVisible();
  expect(await rawSpecies(page)).toBeNull();
});

// §6.2 (reviewer item 2): a declaration binds the visitor to the contract version
// it was made against, so a record stamped with an older version must be dropped
// and the gate must ask again — and the chip must then read the version the
// visitor actually just signed, not the stale one it re-consented from.
test('KDV-SURFACE-17 + KDV-SURFACE-04: a stale contract version forces re-consent and the chip then names the shipped version', async ({ page }) => {
  await page.goto(DUMP);
  // The shipped version has one source: the <meta> site.js reads.
  const shipped = await page.locator('meta[name="kodavr-contract-version"]').getAttribute('content');
  expect(shipped).toBe(CONTRACT_VERSION);

  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ species: 'machine', contract_version: '0.9', declared_at: '2026-01-01' }),
    );
  }, SPECIES_KEY);
  await page.reload();

  // A machine was declared, yet the stale version invalidates it: re-consent.
  await expect(page.locator(PLATE_DECLARATION)).toBeVisible();
  expect(await rawSpecies(page)).toBeNull();

  // The fresh declaration is stamped with the shipped version and the chip
  // follows it in place, so the header never shows the stale contract.
  await page.click('[data-gate-choice="machine"]');
  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(page.locator('#species-chip .species-chip-text')).toHaveText(chipMachine(shipped));
  expect((await declaration(page)).contract_version).toBe(shipped);
});

// The converse of the check above: a record made against the shipped version is
// honoured — the gate must NOT reopen on every load (it is shown once, §6.2).
test('KDV-SURFACE-04: a declaration stored against the shipped contract version never re-opens the gate', async ({ page }) => {
  await page.goto(DUMP);
  const shipped = await page.locator('meta[name="kodavr-contract-version"]').getAttribute('content');
  await page.evaluate(({ key, version }) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ species: 'machine', contract_version: version, declared_at: new Date().toISOString() }),
    );
  }, { key: SPECIES_KEY, version: shipped });

  await page.reload();

  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(page.locator('.hall')).toBeVisible();
  await expect(page.locator('#species-chip .species-chip-text')).toHaveText(chipMachine(shipped));
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

test('KDV-SURFACE-05: Esc dismisses the inline declaration as an accessible region and sets species=machine', async ({ page }) => {
  await page.goto(DUMP);
  await expect(page.locator(PLATE_DECLARATION)).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  expect(await species(page)).toBe('machine');
  await expect(page.locator(PLATE_DUMP)).toBeVisible();
  await expect(page.locator('.hall')).toBeVisible();
});

// §6.2/§6.3 (reviewer item 8): the "no JS = machine" fiction. Without JavaScript
// the SSR markup IS the page — the body is fully readable while the three state-0
// plates ship `hidden` and stay that way (the engine marks the page "live" only
// when a controller exists, so there is no downgrade path).
test('KDV-SURFACE-03 + KDV-MOBILE-08: with JavaScript disabled the dump body is readable and neither the declaration nor the machine panel is shown', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(DUMP);

    // The whole body arrives from the server, rendered markdown and all.
    const body = page.locator('.hall');
    await expect(body).toBeVisible();
    await expect(body.locator('h1')).toHaveText('Sample Heading');
    await expect(body).toContainText('Body text with bold and a source link.');
    await expect(body).toContainText('first item');
    await expect(body.locator('pre')).toContainText('const answer = 42;');

    // The state-0 plates stay hidden: no preview, no invitation, no declaration,
    // no machine panel, no statusline and no reset.
    await expect(page.locator(PLATE_PREVIEW)).toBeHidden();
    await expect(page.locator(PLATE_WANT)).toBeHidden();
    await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
    await expect(page.locator(PLATE_DUMP)).toBeVisible();
    await expect(page.locator('#machine-panel')).toBeHidden();
    await expect(page.locator('.statusline')).toBeHidden();
    await expect(page.locator('#article-reset')).toBeHidden();
  } finally {
    await context.close();
  }
});

test('KDV-SURFACE-28: pressing 0 collapses to the raw dump plate, the machine panel and the post-gate line', async ({ page }) => {
  await page.goto(DUMP);

  await page.click('[data-gate-choice="machine"]');

  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(page.locator(PLATE_DUMP)).toBeVisible();
  await expect(page.locator('#machine-panel')).toBeVisible();
  const postGate = page.locator('.statusline');
  await expect(postGate).toBeVisible();
  await expect(postGate).toHaveText(POST_GATE_LINE);
  await expect(page.locator(RESET)).toBeVisible();
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
  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(toast).toBeHidden();

  // Hardware back closes the declaration the same way — as a fresh visitor,
  // since the Esc dismissal above already stored the species.
  await page.evaluate((key) => window.localStorage.removeItem(key), SPECIES_KEY);
  await page.goto(DUMP);
  await expect(page.locator(PLATE_DECLARATION)).toBeVisible();
  await page.goBack();
  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(toast).toBeHidden();

  // A boot into the hall with the species already stored shows no toast: no
  // declaration happened on this page load.
  await page.evaluate((key) => window.localStorage.setItem(key, 'machine'), SPECIES_KEY);
  await page.goto(DUMP);
  await expect(page.locator('.hall')).toBeVisible();
  await expect(toast).toBeHidden();
});

test('KDV-SURFACE-28: pressing 1 collapses the declaration to the preview and invitation plates', async ({ page }) => {
  await page.goto(DUMP);

  await page.click('[data-gate-choice="human"]');

  await expect(page.locator(PLATE_PREVIEW)).toBeVisible();
  await expect(page.locator(PLATE_WANT)).toBeVisible();
  await expect(page.locator(PLATE_DECLARATION)).toBeHidden();
  await expect(page.locator(PLATE_DUMP)).toBeHidden();
  await expect(page.locator('.hall')).toBeHidden();
  await expect(page.locator(RESET)).toBeVisible();
  expect(await species(page)).toBe('human');
});

test('KDV-SURFACE-15: a declared machine sees the machine panel and can reset to re-declare', async ({ page }) => {
  await page.goto(DUMP);

  const panel = page.locator('#machine-panel');
  await expect(panel).toBeHidden();

  await page.click('[data-gate-choice="machine"]');

  await expect(panel).toBeVisible();
  await expect(panel.locator('.machine-prompt')).toHaveText(DUMP_PROMPT);
  await expect(panel.locator('.agent-link')).toHaveCount(4);

  // The single reset lives at the bottom of the page (v4) and re-opens state 0.
  const reset = page.locator(RESET);
  await expect(reset).toBeVisible();
  await expect(reset).toHaveText(RESET_HUMAN_LABEL);
  await reset.click();

  await expect(page.locator(PLATE_DECLARATION)).toBeVisible();
  await expect(page.locator(PLATE_DUMP)).toBeHidden();
  expect(await species(page)).toBeNull();
});

test('KDV-SURFACE-28: the invitation lane copies the §7.11 prompt and the bottom reset re-opens the declaration', async ({ page }) => {
  await page.goto(DUMP);
  await page.click('[data-gate-choice="human"]');

  // Scope to the `02 · INTERESTING?` lane: the page also carries the machine
  // panel's lane (hidden in state H), so an unscoped .copy-prompt is ambiguous.
  const copyButton = page.locator(`${PLATE_WANT} .copy-prompt`);
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect(copyButton).toHaveText(COPIED_LABEL);

  // The Windows clipboard normalizes LF to CRLF; compare on normalized newlines.
  const clipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  expect(clipboard).toBe(DUMP_PROMPT);

  const reset = page.locator(RESET);
  await expect(reset).toBeVisible();
  await expect(reset).toHaveText(RESET_HUMAN_LABEL);
  await reset.click();

  expect(await species(page)).toBeNull();
  await expect(page.locator(PLATE_DECLARATION)).toBeVisible();
  await expect(page.locator(PLATE_PREVIEW)).toBeVisible();
  await expect(page.locator(PLATE_DUMP)).toBeHidden();
});

test('KDV-SURFACE-13: the 02 · INTERESTING? plate leads with the human fast lane — a pinned prompt plus four agent jumps above the declaration', async ({ page }) => {
  await page.goto(DUMP);

  const lane = page.locator(`${PLATE_WANT} .agent-lane`);
  await expect(lane).toBeVisible();
  await expect(page.locator(`${PLATE_WANT} .agent-link`)).toHaveCount(4);

  // §7.1/§7.12: the controls lead; the pinned prompt sits below them.
  const prompt = page.locator('#article-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveText(DUMP_PROMPT);
  const laneBox = await lane.boundingBox();
  const promptBox = await prompt.boundingBox();
  expect(promptBox.y).toBeGreaterThanOrEqual(laneBox.y + laneBox.height - 1);

  // The prompt is rendered exactly once per surface: the `02` plate's pinned
  // prompt and the machine panel's own pin (hidden in state 0).
  await expect(page.locator('#article-prompt')).toHaveCount(1);
  await expect(page.locator('#machine-prompt')).toHaveCount(1);

  // §6.5 P0-1: both doors carry their own visible §7.1 labels (the digit stays a
  // separate badge), so the declaration names the choices instead of a bare 0/1.
  const doorLabels = page.locator(`${PLATE_DECLARATION} .door-label`);
  await expect(doorLabels).toHaveCount(2);
  await expect(doorLabels.nth(0)).toHaveText(GATE_MACHINE_DOOR);
  await expect(doorLabels.nth(1)).toHaveText(GATE_HUMAN_DOOR);

  // The long declaration sits below the doors, not glued to them.
  const doors = await page.locator(`${PLATE_DECLARATION} .gate-doors`).boundingBox();
  const rest = await page.locator(`${PLATE_DECLARATION} .gate-rest`).boundingBox();
  expect(rest.y - (doors.y + doors.height)).toBeGreaterThanOrEqual(4);
});

// §6.5/§6.6 (reviewer items 5 and 7): the lane's copy chip is the fallback way to
// take the prompt. It must carry the WHOLE pinned prompt, flip to "Copied ✓",
// announce through the shared role=status region, and — where the platform
// exposes Web Share — hand the same text to the OS sheet (site.js maybeShare).
// The agent jump links opt out (data-copy-share="off"), so the sheet never
// hijacks a navigation; the stub covers the offer without opening anything.
test('KDV-SURFACE-13 + KDV-MOBILE-04: the lane copy chip copies the whole prompt, shows Copied and offers Web Share', async ({ page }) => {
  await page.addInitScript(() => {
    window.__kodavrShares = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data) => {
        window.__kodavrShares.push(data);
        return Promise.resolve();
      },
    });
  });
  await page.goto(DUMP);

  // The jump links must not trigger the share sheet: they navigate to an agent.
  await expect(page.locator(`${PLATE_WANT} .agent-link`).first()).toHaveAttribute('data-copy-share', 'off');

  const button = page.locator(`${PLATE_WANT} .copy-prompt`);
  await expect(button).toHaveText(LANE_COPY_LABEL);
  await button.click();

  await expect(button).toHaveText(COPIED_LABEL);
  // The Windows clipboard normalizes LF to CRLF; compare on normalized newlines.
  const clipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  expect(clipboard).toBe(DUMP_PROMPT);
  await expect(page.locator('#a11y-status')).toHaveText(COPIED_ANNOUNCEMENT);

  // Web Share gets the same whole prompt — the offer is exercised, then stops:
  // the stub is never awaited by the page (failures are silent by design).
  expect(await page.evaluate(() => window.__kodavrShares)).toEqual([{ text: DUMP_PROMPT }]);
});

test('KDV-SURFACE-14: the dump prompt is pinned and every jump target prefills', async ({ page }) => {
  await page.goto(DUMP);

  const chatgpt = page.locator(`${PLATE_WANT} .agent-link`, { hasText: 'ChatGPT' });
  await expect(chatgpt).toHaveAttribute('href', /^https:\/\/chatgpt\.com\/\?q=/);
  expect(await chatgpt.getAttribute('href')).toContain(encodeURIComponent(DUMP_PROMPT));
  // §7.12: every jump target prefills via ?q=.
  await expect(page.locator(`${PLATE_WANT} .agent-link`, { hasText: 'Grok' })).toHaveAttribute(
    'href',
    /^https:\/\/grok\.com\/\?q=/,
  );
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
  await page.locator('a.mark').focus();
  await page.keyboard.press('Tab');
  await expect(withdraw).toBeFocused();

  // The withdraw link clears the stored declaration and navigates home. Wait
  // only for the navigation away from the dump; the stored record is the point.
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    withdraw.click(),
  ]);
  expect(await species(page)).toBeNull();

  // The human ("1") path on a fresh load shows the human label.
  await page.goto(DUMP);
  await expect(page.locator('#species-chip')).toBeHidden();
  await page.click('[data-gate-choice="human"]');
  await expect(page.locator('#species-chip')).toBeVisible();
  await expect(page.locator('#species-chip .species-chip-text')).toHaveText(CHIP_HUMAN_LABEL);
  await expect(page.locator('.species-declaration [data-withdraw]')).toBeVisible();
});

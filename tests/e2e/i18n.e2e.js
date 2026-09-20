import { test, expect } from '@playwright/test';

// §11/KDV-I18N-06: the header language switcher and its intelligent hint,
// exercised in a real browser. The hint appears only when `navigator.languages`
// prefers a BUILT locale other than the page's and no choice is stored; it never
// navigates, and opening the switcher or choosing a language clears it.
const LANG_KEY = 'kodavr.lang';
const LANG_HINT_KEY = 'kodavr.langHint';

test('KDV-I18N-06: a ru-RU browser on an en page gets an intelligent hint, never a redirect', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto('/');

    expect(await page.evaluate(() => navigator.languages)).toContain('ru-RU');

    const details = page.locator('.lang-switch');
    await expect(details).toHaveAttribute('data-lang-hint');

    // The suggestion points at the /ru/ variant of this same page...
    await expect(details.locator('a[data-lang-code="ru"][data-lang-hint-target]')).toHaveAttribute('href', 'ru/');

    // ...and is conveyed accessibly (name + title), not by colour alone.
    const summary = details.locator('summary');
    await expect(summary).toHaveAttribute('title', 'Also available in Русский');
    await expect(summary).toHaveAttribute('aria-label', /Language.*Also available in Русский/);

    // Non-blocking and never an auto-redirect: still on the requested page.
    expect(new URL(page.url()).pathname).toBe('/');
  } finally {
    await context.close();
  }
});

test('KDV-I18N-06: a zh-CN browser matches the built zh-Hans locale by primary subtag', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN' });
  try {
    const page = await context.newPage();
    await page.goto('/');

    const details = page.locator('.lang-switch');
    await expect(details).toHaveAttribute('data-lang-hint');
    // `zh-CN` is not a built code; the primary subtag matches the built `zh-Hans`.
    await expect(details.locator('a[data-lang-code="zh-Hans"][data-lang-hint-target]')).toHaveAttribute('href', 'zh/');
    await expect(details.locator('summary')).toHaveAttribute('title', 'Also available in 中文');
  } finally {
    await context.close();
  }
});

test('KDV-I18N-06: a stored choice suppresses the hint', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.lang-switch')).toHaveAttribute('data-lang-hint');

    await page.evaluate((key) => window.localStorage.setItem(key, 'ru'), LANG_KEY);
    await page.reload();

    await expect(page.locator('.lang-switch')).not.toHaveAttribute('data-lang-hint');
  } finally {
    await context.close();
  }
});

test('KDV-I18N-06: opening the switcher clears the hint and remembers it for the session', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const details = page.locator('.lang-switch');
    await expect(details).toHaveAttribute('data-lang-hint');

    await details.locator('summary').click();
    await expect(details).not.toHaveAttribute('data-lang-hint');
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), LANG_HINT_KEY)).toBe('1');

    // The session flag suppresses the hint on the next load too.
    await page.reload();
    await expect(details).not.toHaveAttribute('data-lang-hint');
  } finally {
    await context.close();
  }
});

test('KDV-I18N-09: a ru feed jump lands on the ru dump, including the client-rendered page 2', async ({ page }) => {
  await page.goto('/ru/');
  const firstLink = page.locator('.dump-feed .card h3 a').first();
  // SSR page 1: the item link climbs to /ru/dumps/<slug>/, never the en target.
  await expect(firstLink).toHaveAttribute('href', /\/ru\/dumps\//);

  // Page 2 is re-rendered client-side by ignition/pagination (items/pagination
  // only), so the baked locale-prefixed href must survive unchanged.
  await page.locator('.pagination-number[data-page="2"]').click();
  await expect(page.locator('.dump-feed .card').first()).toBeVisible();
  await expect(page.locator('.dump-feed .card h3 a').first()).toHaveAttribute('href', /^\/ru\/dumps\//);
});

test('KDV-I18N-06: the switcher navigates to the same page in the chosen locale', async ({ page }) => {
  await page.goto('/about/');

  const details = page.locator('.lang-switch');
  await details.locator('summary').click();
  await details.locator('a[data-lang-code="ru"]').click();

  await expect(page).toHaveURL(/\/ru\/about\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  // KDV-I18N-06: following a language link stores the explicit choice.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), LANG_KEY)).toBe('ru');
});

test('KDV-I18N-06: Escape and an outside click close the switcher menu', async ({ page }) => {
  await page.goto('/');
  const details = page.locator('.lang-switch');

  await details.locator('summary').click();
  expect(await details.evaluate((el) => el.open)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await details.evaluate((el) => el.open)).toBe(false);

  await details.locator('summary').click();
  expect(await details.evaluate((el) => el.open)).toBe(true);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  expect(await details.evaluate((el) => el.open)).toBe(false);
});

test('KDV-I18N-06: without JavaScript the switcher ships and no hint appears', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('.lang-switch')).not.toHaveAttribute('data-lang-hint');
    await expect(page.locator('.lang-switch a[data-lang-code="ru"]')).toHaveAttribute('hreflang', 'ru');
  } finally {
    await context.close();
  }
});

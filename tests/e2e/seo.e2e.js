import { test, expect } from '@playwright/test';

// §6.4 SEO served over HTTP: the meta contract must survive the build, the
// relativize pass and the static server — canonical/og/twitter are absolute,
// the feed autodiscovery link is document-relative, and the PNG is servable.
const BASE = 'http://127.0.0.1:4173';
const DUMP = '/dumps/sample-dump/';

test('KDV-SURFACE-12: the served dump page carries canonical, og/twitter card and feed autodiscovery', async ({ page }) => {
  await page.goto(DUMP);

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${BASE}${DUMP}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Kodavr');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${BASE}/assets/og-default.png`);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

  const feed = page.locator('link[rel="alternate"][type="application/atom+xml"]');
  await expect(feed).toHaveAttribute('title', 'Kodavr dumps');
  await expect(feed).toHaveAttribute('href', '../../feeds/all.atom');

  const png = await page.request.get('/assets/og-default.png');
  expect(png.ok()).toBe(true);
  expect(png.headers()['content-type']).toContain('image/png');
});

test('KDV-SURFACE-08: the served 404 is noindex and the sitemap omits it', async ({ page }) => {
  const response = await page.goto('/definitely-missing-route/');
  expect(response.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');

  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain(`${BASE}/404<`);
});

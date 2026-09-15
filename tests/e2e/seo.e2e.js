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

// §6.4/§6.2 (reviewer item 9): what a search crawler gets over HTTP. The SSR
// page must already be the whole dump (KDV-ARCH-04), with the gate/reception
// interstitials hidden and NO server-side UA branching — the same artifact is
// served to every client. canonical/og must stay absolute and host-qualified
// after the relativize pass and the static server (a path-only canonical would
// be indexed against the wrong origin); the build embeds the production host
// (tests/unit/arch.test.js), so the e2e build's configured origin stands in for
// it here. No external font may be referenced or fetched: §6.5 forbids FOUT, and
// a font can arrive either as a <link> or from inside the stylesheet — hence the
// markup check plus the request log of a real crawl-identity load below.
test('KDV-SURFACE-12: a Googlebot request gets the readable SSR body with the gate hidden, an absolute canonical and no external font', async ({ page, browser }) => {
  const response = await page.request.get(DUMP, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  });
  expect(response.status()).toBe(200);
  const html = await response.text();

  // The full body ships in the markup, so a crawler reads the dump itself.
  expect(html).toContain('<h1>Sample Heading</h1>');
  expect(html).toContain('Body text with');
  // The gate and the reception block stay hidden, and nothing branches on the UA.
  expect(html).toMatch(/<dialog id="gate"[^>]*hidden/);
  expect(html).toMatch(/class="reception-block"[^>]*hidden/);
  expect(html).not.toMatch(/Googlebot|navigator\.userAgent/);

  // canonical/og are absolute and on the build's own origin, never a bare path.
  expect(html).toContain(`<link rel="canonical" href="${BASE}${DUMP}">`);
  expect(html).toContain(`<meta property="og:url" content="${BASE}${DUMP}">`);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  expect(new URL(canonical).origin).toBe(BASE);

  // §6.5: no external font — no Google Fonts reference and no cross-origin <link>
  // at all (relative hrefs resolve same-origin, absolute ones must not escape).
  expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  for (const link of html.match(/<link\b[^>]*>/g) || []) {
    const href = (link.match(/\shref="([^"]*)"/) || [])[1];
    if (href && /^https?:\/\//i.test(href)) {
      expect(new URL(href).origin, `cross-origin <link>: ${link}`).toBe(BASE);
    }
  }

  // And the page as a crawler loads it fetches nothing cross-origin: every font
  // resource (link, preload or @font-face inside the CSS) resolves same-origin.
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  });
  try {
    const crawl = await context.newPage();
    const fonts = [];
    crawl.on('request', (request) => {
      const url = request.url();
      if (/font|\.woff2?|\.ttf|\.otf/i.test(url)) fonts.push(url);
    });
    await crawl.goto(DUMP);
    for (const url of fonts) {
      expect(new URL(url).origin, `external font request: ${url}`).toBe(BASE);
    }
    expect(fonts.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
  } finally {
    await context.close();
  }
});

test('KDV-SURFACE-08: the served 404 is noindex and the sitemap omits it', async ({ page }) => {
  const response = await page.goto('/definitely-missing-route/');
  expect(response.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');

  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain(`${BASE}/404<`);
});

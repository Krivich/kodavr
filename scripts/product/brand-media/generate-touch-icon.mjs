/**
 * CONTRACT: scripts/product/brand-media/generate-touch-icon.mjs
 * ROLE: rasterizes the touch icon from the wordmark
 * CONSUMES:
 *   @playwright/test — the chromium rasterizer (dev)
 *   node:fs/promises — read the logo, write the PNG
 *   node:path — join paths
 *   node:url — find the repo root
 * INVARIANTS:
 *   — the icon is generated, never hand-edited
 */

// scripts/product/brand-media/generate-touch-icon.mjs — one-off regeneration of the 192x192
// home-screen icon (§6.5). Deliberately OUTSIDE `npm run build`: the PNG is a
// committed asset, and Playwright is a dev-only dependency. Run it only after
// `static/logo.svg` changes:
//
//     npm run touch-icon
//
// It rasterizes the trusted logo on the theme-color background (#111111) using
// the already-installed Playwright chromium — no new dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SIZE = 192;
const BACKGROUND = '#111111';
const OUTPUT = join(ROOT, 'static', 'assets', 'touch-icon-192.png');

const logoSvg = await readFile(join(ROOT, 'static', 'logo.svg'), 'utf8');
const html =
  '<!doctype html><html><head><style>' +
  `html,body{margin:0;background:${BACKGROUND}}` +
  `svg,img{display:block;width:${SIZE}px;height:${SIZE}px}` +
  '</style></head><body>' + logoSvg + '</body></html>';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const png = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: SIZE, height: SIZE },
  });
  await writeFile(OUTPUT, png);
  console.log(`wrote ${OUTPUT} (${SIZE}x${SIZE}, ${png.length} bytes)`);
} finally {
  await browser.close();
}

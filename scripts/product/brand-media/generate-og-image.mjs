/**
 * CONTRACT: scripts/product/brand-media/generate-og-image.mjs
 * ROLE: rasterizes the 1200x630 OG card from the wordmark + OG tagline
 * CONSUMES:
 *   ../../lib/pages.mjs — the trusted wordmark and OG_TAGLINE
 *   @playwright/test — the chromium rasterizer (dev)
 *   node:fs/promises — read the logo, write the PNG
 *   node:path — join paths
 *   node:url — find the repo root
 * INVARIANTS:
 *   — the card is generated, never hand-edited
 */

// scripts/product/brand-media/generate-og-image.mjs — one-off regeneration of the 1200x630 social
// card (§6.4). Deliberately OUTSIDE `npm run build`: the PNG is a committed
// asset, and Playwright is a dev-only dependency. Run it only after the logo or
// the OG tagline changes:
//
//     npm run og-image
//
// It composes the trusted wordmark and the OG tagline on the theme-color
// background (#111111) and rasterizes it with the already-installed Playwright
// chromium — no new dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { OG_TAGLINE } from '../../lib/pages.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = '#111111';
const FOREGROUND = '#f5f5f5';
const MUTED = '#c8c8c8';
const OUTPUT = join(ROOT, 'static', 'assets', 'og-default.png');

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

const logoSvg = await readFile(join(ROOT, 'static', 'logo.svg'), 'utf8');
const html =
  '<!doctype html><html><head><style>' +
  `html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;background:${BACKGROUND};` +
  `color:${FOREGROUND};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;` +
  'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}' +
  '.og-mark svg{width:150px;height:150px;display:block}' +
  '.og-wordmark{font-size:104px;letter-spacing:0.14em;font-weight:600}' +
  `.og-tagline{font-size:30px;line-height:1.45;max-width:920px;text-align:center;color:${MUTED}}` +
  '</style></head><body>' +
  `<div class="og-mark">${logoSvg}</div>` +
  '<div class="og-wordmark">kodavr</div>' +
  `<div class="og-tagline">${escapeHtml(OG_TAGLINE)}</div>` +
  '</body></html>';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const png = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  await writeFile(OUTPUT, png);
  console.log(`wrote ${OUTPUT} (${WIDTH}x${HEIGHT}, ${png.length} bytes)`);
} finally {
  await browser.close();
}

#!/usr/bin/env node
/**
 * CONTRACT: scripts/workflow-arrows-svg.mjs
 * ROLE: post-processes the rendered docs/workflow-arrows.svg to add the hover highlight
 * EXPORTS:
 *   injectHover — adds the whole-arrow hover CSS block to an SVG string
 *   parseHoverColor — reads `skinparam pathHoverColor` from the .puml
 *   main — the CLI entry point
 * CONSUMES:
 *   node:fs — read the .puml, rewrite the .svg
 *   node:path — resolve the diagram files
 *   node:url — find the repo root and detect the entry point
 * INVARIANTS:
 *   — injection is idempotent: the block carries a marker and is replaced, never doubled
 *   — the hover colour has one source: skinparam pathHoverColor in the .puml
 */
// workflow-arrows-svg — the hover step for the code map (docs/workflow-arrows.svg).
//
// PlantUML's `skinparam pathHoverColor` emits only `path:hover { stroke: … }`: the
// arrow line is stroke-width 1 (hard to hit), and its head is a <polygon> and its
// label an <a><text> — neither recolours. So after rendering, we append a small
// CSS block that lights the WHOLE arrow (`g.link:hover` — line, head, label),
// thickens the line, and LINGERS on hover-out (a transition delay) so a long arrow
// stays lit while the reader scrolls to its far end. Hover works only in a
// CSS-capable viewer (a browser), never in a PNG or a static IDE preview.
//
// Usage: render the .puml, then `npm run workflow-arrows:svg` (see the doc).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SVG = path.join(ROOT, 'docs', 'workflow-arrows.svg');
const DEFAULT_PUML = path.join(ROOT, 'docs', 'workflow-arrows.puml');

// A CSS comment marks the injected block so a re-run replaces it instead of doubling it.
const MARK = '/* workflow-arrows-hover */';
const LINGER_DEFAULT = 5;

// parseHoverColor(puml) → the `skinparam pathHoverColor` value (or the default red).
export function parseHoverColor(puml) {
  const m = puml.match(/^\s*skinparam\s+pathHoverColor\s+(\S+)/im);
  return m ? m[1] : '#C62828';
}

// hoverCss(color, lingerSeconds) → the CSS block: whole-arrow highlight + linger.
function hoverCss(color, lingerSeconds) {
  const t = `.6s ${lingerSeconds}s`;
  return [
    MARK,
    `g.link path,g.link polygon{transition:stroke ${t},fill ${t},stroke-width ${t}}`,
    `g.link:hover path{stroke:${color} !important;stroke-width:2;transition:none}`,
    `g.link:hover polygon{fill:${color} !important;stroke:${color} !important;transition:none}`,
  ].join('\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// injectHover(svg, { color, lingerSeconds }) → the SVG with the hover block appended
// inside its existing <style> (a fresh one is added when the render carries none).
export function injectHover(svg, { color = '#C62828', lingerSeconds = LINGER_DEFAULT } = {}) {
  // Replace any previous injection (marker up to the style's end) so re-runs converge.
  let out = svg.replace(new RegExp(`\\n?${escapeRe(MARK)}[\\s\\S]*?(?=]]></style>|</style>)`), '');
  const block = `\n${hoverCss(color, lingerSeconds)}\n`;
  if (out.includes(']]></style>')) return out.replace(']]></style>', `${block}]]></style>`);
  if (out.includes('</style>')) return out.replace('</style>', `${block}</style>`);
  return out.replace(/(<svg\b[^>]*>)/, `$1<style type="text/css"><![CDATA[${block}]]></style>`);
}

// CLI: read the .puml + .svg, inject the hover block, write the .svg back.
export function main({ svg = DEFAULT_SVG, puml = DEFAULT_PUML, color, lingerSeconds = LINGER_DEFAULT } = {}) {
  let pumlText;
  let svgText;
  try {
    pumlText = fs.readFileSync(puml, 'utf8');
    svgText = fs.readFileSync(svg, 'utf8');
  } catch (e) {
    console.error(`workflow-arrows-svg: ${e.message}`);
    process.exit(1);
    return;
  }
  const c = color || parseHoverColor(pumlText);
  const out = injectHover(svgText, { color: c, lingerSeconds });
  if (out === svgText) {
    console.log('workflow-arrows-svg: hover block already present');
    return;
  }
  fs.writeFileSync(svg, out);
  console.log(`workflow-arrows-svg: hover block written to ${path.relative(ROOT, svg)} (color ${c}, linger ${lingerSeconds}s)`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();

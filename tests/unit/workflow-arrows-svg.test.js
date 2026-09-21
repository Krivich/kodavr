// tests/unit/workflow-arrows-svg.test.js — the map's SVG carries the hover block.
// `npm run workflow-arrows:svg` injects a whole-arrow highlight (line path, head
// polygon, label) that lingers after the pointer leaves, so a long arrow stays
// lit while the reader scrolls to its far end. The committed .svg must be the
// output of that step; the colour has one source: the .puml's pathHoverColor.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { injectHover, parseHoverColor } from '../../scripts/workflow-arrows-svg.mjs';

const svgPath = fileURLToPath(new URL('../../docs/workflow-arrows.svg', import.meta.url));
const pumlPath = fileURLToPath(new URL('../../docs/workflow-arrows.puml', import.meta.url));

const RAW =
  '<svg xmlns="http://www.w3.org/2000/svg"><style type="text/css">' +
  '<![CDATA[path:hover { stroke: #C62828 !important;}]]></style>' +
  '<g class="link"><path d="M0 0"/><polygon points="0,0,1,1"/></g></svg>';

describe('workflow-arrows svg hover (KDV-CI-21)', () => {
  it('KDV-CI-21: injects a whole-arrow highlight that lingers on hover-out, and is idempotent', () => {
    const out = injectHover(RAW, { color: '#C62828', lingerSeconds: 5 });
    expect(out).toContain('g.link:hover path');
    expect(out).toContain('g.link:hover polygon');
    expect(out).toContain('stroke:#C62828 !important');
    expect(out).toMatch(/transition:stroke [\d.]+s 5s/);
    expect(out).toContain('</svg>');
    // running it again does not duplicate the block
    expect(injectHover(out, { color: '#C62828', lingerSeconds: 5 })).toBe(out);
  });

  it('KDV-CI-21: reads the hover colour from the map\'s skinparam pathHoverColor', () => {
    expect(parseHoverColor(readFileSync(pumlPath, 'utf8'))).toBe('#C62828');
  });

  it('KDV-CI-21: the committed docs/workflow-arrows.svg carries the injected block', () => {
    const committed = readFileSync(svgPath, 'utf8');
    expect(committed).toContain('g.link:hover path');
    expect(committed).toContain('g.link:hover polygon');
    expect(committed).toContain(parseHoverColor(readFileSync(pumlPath, 'utf8')));
  });
});

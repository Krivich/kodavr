/**
 * CONTRACT: scripts/product/site-build/build.mjs
 * ROLE: the npm run build entry point
 * CONSUMES:
 *   ../../lib/build.mjs — the one build pipeline
 *   node:url — resolve the repo root
 */

import { fileURLToPath } from 'node:url';
import { buildProject } from '../../lib/build.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));

try {
  const { count } = await buildProject({
    root,
    contentDir: 'content/dumps',
    sourceDir: 'input',
    outputDir: 'output',
    domain: 'https://kodavr.xyz',
  });
  console.log(`Built ${count} dump(s) → output/public/dumps/`);
} catch (err) {
  console.error(`Build failed: ${err.message}`);
  process.exit(1);
}

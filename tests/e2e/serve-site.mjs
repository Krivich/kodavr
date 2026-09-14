// tests/e2e/serve-site.mjs — build the fixture site once, then serve it over the
// shared static server for the Playwright specs. No new deps.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { buildProject } from '../../scripts/lib/build.mjs';
import { createStaticServer } from '../../scripts/lib/static-server.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const HOST = '127.0.0.1';
const PORT = 4173;
const PUBLIC_DIR = join(REPO_ROOT, 'tmp', 'e2e-output', 'public');

// The real fixtures drive the single-dump surface/gate specs. A generated tail
// pushes the home feed past one page (perPage=10) so KDV-MOBILE-05 can tap
// "next" and observe the change. The tail lives in tmp/, never in git.
const CONTENT_DIR = join(REPO_ROOT, 'tmp', 'e2e-content', 'dumps');
await rm(join(REPO_ROOT, 'tmp', 'e2e-content'), { recursive: true, force: true });
await mkdir(CONTENT_DIR, { recursive: true });
await cp(join(REPO_ROOT, 'tests', 'fixtures'), CONTENT_DIR, { recursive: true });

for (let i = 1; i <= 12; i += 1) {
  const n = String(i).padStart(2, '0');
  const slug = `2026-01-01-feed-dump-${n}`;
  const dir = join(CONTENT_DIR, slug);
  await mkdir(dir, { recursive: true });
  const manifest = {
    slug,
    type: 'note',
    title: `Feed Dump ${n}`,
    date: '2026-01-01',
    domain: 'engineering',
    tags: ['fixture'],
    stakes: 'low',
    content_flags: [],
    trust_level: 'raw',
    generated_by: 'human',
    human_review: 'none',
    summary: `Synthetic feed fixture number ${n}.`,
  };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await writeFile(join(dir, 'raw.md'), `# Feed Dump ${n}\n\nSynthetic body ${n}.\n`, 'utf8');
}

await buildProject({
  root: REPO_ROOT,
  contentDir: 'tmp/e2e-content/dumps',
  sourceDir: 'input',
  outputDir: 'tmp/e2e-output',
  domain: `http://${HOST}:${PORT}`,
  commitSha: null,
});

const { start } = createStaticServer({ publicDir: PUBLIC_DIR, host: HOST, port: PORT });
const url = await start();
console.log(`e2e static server: ${url} (${PUBLIC_DIR})`);

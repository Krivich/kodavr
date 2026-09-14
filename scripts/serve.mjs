/**
 * CONTRACT: scripts/serve.mjs
 * ROLE: the npm run serve local preview server
 * CONSUMES:
 *   ./lib/static-server.mjs — the HTTP server
 *   node:path — the public directory
 *   node:url — find the repo root
 */

// scripts/serve.mjs — local preview of the built site (npm run serve).
//
// Serves an already-built directory (default: output/public) so a human can look
// at the pages. It does NOT build: run `npm run build` first (or `npm run preview`
// to build and serve in one go). Override with env: PORT, SERVE_HOST, SERVE_DIR.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './lib/static-server.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

const port = Number(argValue('--port') || process.env.PORT || 8080);
const host = argValue('--host') || process.env.SERVE_HOST || '127.0.0.1';
const publicDir = resolve(REPO_ROOT, argValue('--dir') || process.env.SERVE_DIR || 'output/public');

const { start, server } = createStaticServer({ publicDir, host, port });

try {
  const url = await start();
  console.log(`Kodavr preview: ${url}`);
  console.log(`Serving: ${publicDir}`);
  console.log('Ctrl+C to stop.');
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is busy. Try: $env:PORT=8081; npm run serve`);
  } else {
    console.error(`Server failed: ${err.message}`);
  }
  process.exit(1);
}

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

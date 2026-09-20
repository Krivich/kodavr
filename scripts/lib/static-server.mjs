/**
 * CONTRACT: scripts/lib/static-server.mjs
 * ROLE: a minimal static server for local preview and e2e
 * EXPORTS:
 *   contentType — the MIME type for a file path
 *   createStaticServer — creates the HTTP server for a public directory
 *   resolveFile — maps a URL path to a file inside the root (traversal-safe)
 * CONSUMES:
 *   node:fs/promises — stat and read files
 *   node:http — the HTTP server
 *   node:path — resolve paths safely
 * INVARIANTS:
 *   — a path escaping the public root is never served
 */

// scripts/lib/static-server.mjs — a minimal node:http static server (no deps).
// Shared by `npm run serve` (human preview of output/public) and the Playwright
// webServer, so the local-view behaviour and the tested behaviour are one thing:
// directory → index.html, a miss → 404.html, and path traversal clamped to root.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.atom': 'application/atom+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function contentType(filePath) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

// Resolve a request path to a file: directory → index.html, path traversal
// clamped to the public root; a miss returns null so the caller serves 404.html.
export async function resolveFile(root, urlPath) {
  // §8.2/KDV-BUILD-13: a malformed `%` sequence throws URIError here; contain it
  // as a miss so a bad request path is a 404, never a 500.
  let decoded;
  try {
    decoded = decodeURIComponent((urlPath || '/').split('?')[0].split('#')[0]);
  } catch (err) {
    if (err instanceof URIError) return null;
    throw err;
  }
  const relative = decoded.replace(/^\/+/, '');
  const filePath = resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(root + sep)) return null;

  const index = join(filePath, 'index.html');
  if (decoded.endsWith('/') || (await isFile(index))) {
    if (await isFile(index)) return index;
  }
  if (await isFile(filePath)) return filePath;
  return null;
}

async function send(res, status, filePath) {
  const body = await readFile(filePath);
  res.writeHead(status, { 'content-type': contentType(filePath), 'content-length': body.length });
  res.end(body);
}

export function createStaticServer({ publicDir, host = '127.0.0.1', port = 8080 }) {
  const root = resolve(publicDir);
  const server = createServer(async (req, res) => {
    try {
      const filePath = await resolveFile(root, req.url);
      if (filePath) {
        await send(res, 200, filePath);
        return;
      }
      const notFound = join(root, '404.html');
      if (await isFile(notFound)) {
        await send(res, 404, notFound);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`500 ${err.message}`);
    }
  });

  return {
    root,
    server,
    start() {
      return new Promise((resolveStart, rejectStart) => {
        server.once('error', rejectStart);
        server.listen(port, host, () => {
          resolveStart(`http://${host}:${port}/`);
        });
      });
    },
  };
}

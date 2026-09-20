import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolveFile, createStaticServer } from '../../scripts/lib/static-server.mjs';

describe('static server', () => {
  it('KDV-BUILD-13: a malformed percent-encoding in the request path resolves to a miss, never a throw', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kodavr-static-'));
    try {
      await writeFile(join(root, 'index.html'), '<h1>home</h1>');
      // `decodeURIComponent` throws URIError on these; a miss must win over the 500.
      for (const bad of ['/%', '/%zz', '/%E0%A4%A']) {
        await expect(resolveFile(root, bad)).resolves.toBeNull();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('KDV-BUILD-13: a valid request still resolves — the root to index.html and a nested file to itself', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kodavr-static-'));
    try {
      await writeFile(join(root, 'index.html'), '<h1>home</h1>');
      await mkdir(join(root, 'nested'), { recursive: true });
      await writeFile(join(root, 'nested', 'page.html'), '<h1>nested</h1>');

      await expect(resolveFile(root, '/')).resolves.toBe(join(root, 'index.html'));
      await expect(resolveFile(root, '/nested/page.html')).resolves.toBe(
        join(root, 'nested', 'page.html'),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('KDV-BUILD-13: an end-to-end fetch of a malformed path is served 404, not 500', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kodavr-static-'));
    const { server, start } = createStaticServer({ publicDir: root, host: '127.0.0.1', port: 0 });
    try {
      await writeFile(join(root, 'index.html'), '<h1>home</h1>');
      await start();
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/%`);
      expect(res.status).toBe(404);
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose));
      await rm(root, { recursive: true, force: true });
    }
  });
});

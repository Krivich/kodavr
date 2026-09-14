import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEPLOY = join(ROOT, '.github', 'workflows', 'deploy.yml');
const CNAME = join(ROOT, 'static', 'CNAME');
const RUNBOOK = join(ROOT, 'docs', 'decisions.md');
const PKG = join(ROOT, 'package.json');

describe('deploy pipeline (§8.3–8.5)', () => {
  it('KDV-CI-09: deploy.yml builds with npm ci and publishes output/public via the GitHub Pages actions', async () => {
    const yml = await readFile(DEPLOY, 'utf8');

    // Trigger: push to main over the paths that can change the site.
    expect(yml).toMatch(/^on:/m);
    expect(yml).toMatch(/push:/);
    expect(yml).toMatch(/branches:\s*\[\s*main\s*\]/);
    for (const p of ['content/**', 'input/**', 'scripts/**', 'static/**', 'package.json', 'package-lock.json']) {
      expect(yml, `watched path ${p}`).toContain(p);
    }

    // Pages publishing needs the id-token and pages permissions + a stable group.
    expect(yml).toMatch(/permissions:/);
    expect(yml).toMatch(/contents:\s*read/);
    expect(yml).toMatch(/pages:\s*write/);
    expect(yml).toMatch(/id-token:\s*write/);
    expect(yml).toMatch(/concurrency:/);
    expect(yml).toMatch(/group:\s*pages/);
    expect(yml).toMatch(/cancel-in-progress:\s*false/);

    // Build job: checkout, pinned Node 20 with npm cache, clean install, build.
    expect(yml).toMatch(/actions\/checkout@/);
    expect(yml).toMatch(/actions\/setup-node@/);
    expect(yml).toMatch(/node-version:\s*20/);
    expect(yml).toMatch(/cache:\s*npm/);
    expect(yml).toContain('npm ci');
    expect(yml).toContain('npm run build');

    // Artifact is the whole public tree; deploy job consumes it.
    expect(yml).toMatch(/actions\/configure-pages@v5/);
    expect(yml).toMatch(/actions\/upload-pages-artifact@v3/);
    expect(yml).toContain('path: output/public');
    expect(yml).toMatch(/actions\/deploy-pages@v4/);
    expect(yml).toMatch(/needs:\s*build/);
    expect(yml).toMatch(/environment:/);
    expect(yml).toMatch(/name:\s*github-pages/);
  });

  it('KDV-CI-09: the engine dependency is vendored inside the repo so npm ci works on a clean checkout', async () => {
    const pkg = JSON.parse(await readFile(PKG, 'utf8'));
    const dep = pkg.dependencies['ignition-ssg'];
    expect(dep, 'engine dependency must point at the committed vendor tree').toMatch(/^file:vendor\//);

    // The referenced tarball must exist in the tree — a dangling file: dependency
    // would still pass `npm install` locally but break a fresh `npm ci`.
    const tarball = join(ROOT, dep.replace(/^file:/, ''));
    expect((await stat(tarball)).isFile()).toBe(true);
  });

  it('KDV-CI-10: static/CNAME binds kodavr.xyz and the runbook documents apex A records, HTTPS and the Cloudflare grey cloud', async () => {
    expect((await readFile(CNAME, 'utf8')).trim()).toBe('kodavr.xyz');

    const runbook = await readFile(RUNBOOK, 'utf8');
    // Apex A records for GitHub Pages.
    for (const ip of ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153']) {
      expect(runbook, `apex A record ${ip}`).toContain(ip);
    }
    // www → <owner>.github.io and Enforce HTTPS.
    expect(runbook).toMatch(/www/);
    expect(runbook).toContain('.github.io');
    expect(runbook).toMatch(/Enforce HTTPS/i);
    // Cloudflare proxying must stay off (grey cloud) or the cert is never issued.
    expect(runbook).toMatch(/grey cloud/i);
  });

  it('KDV-CI-11: the runbook pins the release tag convention, kind="release" URLs and the domain-ops checklist', async () => {
    const runbook = await readFile(RUNBOOK, 'utf8');
    // §8.4 releases: tag dump-<slug>-v<N>, pack.zip asset, manifest kind="release".
    expect(runbook).toContain('dump-<slug>-v<N>');
    expect(runbook).toContain('pack.zip');
    expect(runbook).toContain('kind="release"');
    expect(runbook).toMatch(/releases\/download/);
    // §8.5 domain ops: renewal, WHOIS privacy, 2FA, 60-day transfer lock.
    expect(runbook).toMatch(/renew/i);
    expect(runbook).toMatch(/WHOIS/i);
    expect(runbook).toMatch(/2FA|two-factor/i);
    expect(runbook).toMatch(/60[- ]day/i);
  });
});

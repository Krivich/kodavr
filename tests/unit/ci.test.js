import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, stat } from 'node:fs/promises';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const AUDIT = join(WORKFLOWS_DIR, 'audit.yml');
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

  it('KDV-CI-19: the deploy build job runs the content gate before npm run build, so a BLOCK stops publication', async () => {
    const yml = await readFile(DEPLOY, 'utf8');
    // Order, not mere presence: the §8.1 gate is a prerequisite of the artifact.
    const gate = yml.indexOf('node scripts/tooling/quality-gates/validate.mjs');
    const build = yml.indexOf('npm run build');
    expect(gate, 'the content gate must run in the deploy build job').toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(build);
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

describe('audit workflow (KDV-SCAN-08)', () => {
  it('KDV-SCAN-08: audit.yml grants exactly the minimal permissions and wires the LLM config', async () => {
    const yml = await readFile(AUDIT, 'utf8');

    // Minimal permissions: read code, write only the comment and the status check.
    expect(yml).toMatch(/permissions:/);
    expect(yml).toMatch(/contents:\s*read/);
    expect(yml).toMatch(/pull-requests:\s*write/);
    expect(yml).toMatch(/statuses:\s*write/);
    expect(yml).not.toMatch(/contents:\s*write/);

    // The audit step hands the audit the endpoint/model (non-secret literals) and
    // the secret-only key. The second judge run is a framing, not a second model.
    expect(yml).toContain('AUDIT_LLM_ENDPOINT: https://api.neuraldeep.ru/v1/chat/completions');
    expect(yml).toContain('AUDIT_LLM_MODEL: gpt-oss-120b');
    expect(yml).toContain('AUDIT_LLM_API_KEY: ${{ secrets.AUDIT_LLM_API_KEY }}');
    expect(yml).not.toContain('AUDIT_LLM_MODEL_2');
  });

  it('KDV-SCAN-08: the audit model key is exclusive to audit.yml and no workflow carries a literal key', async () => {
    const files = (await readdir(WORKFLOWS_DIR)).filter((name) => /\.ya?ml$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    let auditHits = 0;
    for (const name of files) {
      const text = await readFile(join(WORKFLOWS_DIR, name), 'utf8');
      expect(text, `${name} must not carry a literal sk- key`).not.toMatch(/sk-[A-Za-z0-9]/);
      const hits = text.split('AUDIT_LLM_API_KEY').length - 1;
      if (name === 'audit.yml') {
        auditHits += hits;
      } else {
        expect(hits, `${name} must not reference AUDIT_LLM_API_KEY`).toBe(0);
      }
    }
    expect(auditHits, 'audit.yml must reference AUDIT_LLM_API_KEY').toBeGreaterThan(0);
  });
});

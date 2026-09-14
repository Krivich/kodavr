// tests/unit/arch.test.js — architectural decisions that are file/deploy facts
// (§0): publication process (KDV-ARCH-02), licences (KDV-ARCH-06), hosting
// (KDV-ARCH-07) and the single controller (KDV-BUILD-06). The runtime/surface
// halves of ARCH live in tests/integration/build.test.js.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_LICENSE, ISSUES_URL } from '../../scripts/lib/machine.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(join(ROOT, rel));

describe('architectural decisions (§0)', () => {
  it('KDV-ARCH-02: publication is a PR and merge publishes; discussions live in GitHub Issues', () => {
    // The verifiable half: PR path + contribution rules + PR-triggered validate.
    expect(exists('.github/PULL_REQUEST_TEMPLATE.md')).toBe(true);
    expect(exists('CONTRIBUTING.md')).toBe(true);
    expect(read('.github/workflows/validate.yml')).toMatch(/pull_request:/);

    // Merge = publication: the deploy workflow only runs on main.
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(deploy).not.toMatch(/pull_request:/);

    // Discussions = GitHub Issues, from the single repository constant.
    expect(ISSUES_URL).toMatch(/\/issues$/);
    expect(read('docs/decisions.md')).toMatch(/GitHub Issues/i);
  });

  it('KDV-ARCH-06: engine/scripts code is MIT and dump content defaults to CC-BY-4.0', () => {
    expect(read('LICENSE')).toContain('MIT');
    expect(read('LICENSE-CONTENT.md')).toContain('CC-BY-4.0');
    expect(DEFAULT_LICENSE).toBe('CC-BY-4.0');
    expect(read('README.md')).toMatch(/MIT[\s\S]*CC-BY-4\.0/);
  });

  it('KDV-ARCH-07: production is kodavr.xyz on GitHub Pages, with the DNS/HTTPS runbook', () => {
    expect(read('static/CNAME').trim()).toBe('kodavr.xyz');
    const runbook = read('docs/decisions.md');
    expect(runbook).toMatch(/GitHub Pages/);
    for (const ip of ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153']) {
      expect(runbook, ip).toContain(ip);
    }
    expect(runbook).toMatch(/grey cloud/i);
    // The deploy workflow publishes exactly that artifact tree.
    expect(read('.github/workflows/deploy.yml')).toContain('output/public');
  });
});

describe('single controller (§8.2)', () => {
  it('KDV-BUILD-06: one controller is invoked both by `npm run build` and by CI', () => {
    // Locally: npm run build -> scripts/build.mjs.
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.build).toBe('node scripts/build.mjs');
    // The entrypoint delegates to the one controller module.
    const entry = read('scripts/build.mjs');
    expect(entry).toContain("from './lib/build.mjs'");
    expect(entry).toContain('buildProject');
    // In CI: the very same npm script, so local and CI share one code path.
    expect(read('.github/workflows/deploy.yml')).toContain('npm run build');
  });
});

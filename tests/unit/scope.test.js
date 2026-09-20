// tests/unit/scope.test.js — MVP non-goals (§11) and roadmap triggers (§13).
//
// These are negative requirements: the point is not that some code exists, but
// that the listed feature is genuinely ABSENT from the artifact and the tree.
// Each test reads the real repository files (templates, client assets, scripts,
// package.json, workflows, docs) and asserts the non-goal was not built.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { ROUTE_PAGES } from '../../scripts/lib/pages.mjs';
import { buildIndex, buildWellKnown } from '../../scripts/lib/machine.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(join(ROOT, rel));

// Recursively list files under a repo-relative directory, filtered by suffix.
function listFiles(dir, suffixes) {
  const out = [];
  (function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) out.push(full);
    }
  })(join(ROOT, dir));
  return out;
}

const templates = () => listFiles('input/templates', ['.hbs']);
const clientAssets = () => listFiles('static/assets', ['.js', '.css']);
const controllers = () => listFiles('input/controllers', ['.js']);
const projectSources = () => [...templates(), ...clientAssets(), ...controllers()];
const sourceText = () => projectSources().map((file) => readFileSync(file, 'utf8')).join('\n');

describe('MVP non-goals (§11)', () => {
  it('KDV-SCOPE-01: no client-side search, no tag/domain pages and no index facets', () => {
    // The route table knows nothing about tags, domains or search.
    for (const page of ROUTE_PAGES) {
      expect(page.layout).not.toMatch(/tag|domain|search/);
      expect(page.to).not.toMatch(/tag|domain|search/);
    }
    // Neither the templates nor the client scripts implement a search box.
    for (const file of projectSources()) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/type="search"|role="search"|data-search/);
    }
    // site.js never fetches: the machine index is the only query surface.
    expect(read('static/assets/site.js')).not.toMatch(/\bfetch\s*\(/);
    // index.json stays a flat list — no facets/sections.
    const index = buildIndex([], { baseUrl: 'https://kodavr.xyz', generatedAt: 't' });
    expect(Object.keys(index).sort()).toEqual([
      '$schema',
      'base_url',
      'dumps',
      'generated_at',
      'index_url',
      'platform',
      'schema',
      'total',
      'version',
    ]);
  });

  it('KDV-SCOPE-02: no comments or social features outside GitHub Issues', () => {
    const text = sourceText().toLowerCase();
    for (const provider of ['disqus', 'giscus', 'utterances', 'facebook']) {
      expect(text, provider).not.toContain(provider);
    }
    // Social EMBEDS/widgets are forbidden; standard `twitter:*` card METADATA is
    // part of the SEO head, not a widget, so only embed patterns are banned.
    for (const embed of ['platform.twitter.com', 'twitter-timeline', 'twitter-widget', '//twitter.com']) {
      expect(text, embed).not.toContain(embed);
    }
    // No like/rating/subscribe/follow widgets anywhere in the source.
    for (const file of projectSources()) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/data-(like|rating|subscribe|follow)/i);
    }
    // The only discussion affordance is the GitHub Issues link on a dump page.
    const dump = read('input/templates/dumps.hbs');
    expect(dump).toContain('{{issues_url}}');
  });

  it('KDV-SCOPE-03: no backend/DB/auth and no private dumps', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const banned of [
      'express', 'fastify', 'koa', 'sqlite', 'sqlite3', 'better-sqlite3',
      'pg', 'mysql', 'mongoose', 'passport', 'jsonwebtoken', 'bcrypt', 'argon2',
    ]) {
      expect(deps, banned).not.toHaveProperty(banned);
    }
    // No access-control/private-visibility concept enters the manifest schema.
    const validator = read('scripts/validate.mjs');
    expect(validator).not.toContain("'private'");
    expect(validator).not.toContain('"private"');
    // There is no separate private content root — every dump is public.
    expect(exists('content/private')).toBe(false);
    // The client never carries credentials or an auth header.
    expect(read('static/assets/site.js')).not.toMatch(/Authorization:|Bearer |\bcredentials\b/);
  });

  it('KDV-SCOPE-04: no monetisation/paid tiers and no analytics/tracking', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const banned of ['stripe', '@stripe/stripe-js', 'paddle', '@paddle/paddle-js']) {
      expect(deps, banned).not.toHaveProperty(banned);
    }
    const text = sourceText().toLowerCase();
    for (const tracker of [
      'gtag', 'google-analytics', 'googletagmanager', 'plausible',
      'matomo', 'umami', 'mixpanel', 'segment.com', 'hotjar', 'posthog',
    ]) {
      expect(text, tracker).not.toContain(tracker);
    }
    for (const pay of ['pricing', 'paid tier', 'buy now', 'subscribe now']) {
      expect(text, pay).not.toContain(pay);
    }
  });

  it('KDV-SCOPE-07 + KDV-SCOPE-08 + KDV-SCOPE-09: no auto-publication of a first dump, no federation/mirrors, no mobile app', () => {
    // Publication waits for a merged PR: deploy only ever runs on push to main.
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toMatch(/push:/);
    expect(deploy).not.toMatch(/pull_request:/);
    // Auto-merge is owner-granted after >= 3 green PRs, never automatic.
    const runbook = read('docs/decisions.md');
    expect(runbook).toMatch(/auto-merge/i);
    expect(runbook).toMatch(/first PR is reviewed manually/i);
    // The discovery document advertises no federation/mirror endpoint.
    expect(JSON.stringify(buildWellKnown())).not.toMatch(/federat|mirror/i);

    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const banned of ['capacitor', '@capacitor/core', 'react-native', 'cordova']) {
      expect(deps, banned).not.toHaveProperty(banned);
    }
    for (const dir of ['android', 'ios']) {
      expect(exists(dir), dir).toBe(false);
    }
  });

  it('KDV-SCOPE-06: §13 triggers are documented but unimplemented', () => {
    const spec = read('docs/SPEC.md');
    expect(spec).toContain('## 13. Post-MVP Roadmap');
    for (const trigger of [
      'Tag/domain pages',
      'Auto-merge for trusted authors',
      'npx kodavr init',
      'Federation via',
      'open standard',
      'Monetisation tiers',
    ]) {
      expect(spec, trigger).toContain(trigger);
    }
    // The monetisation options are recorded as options in docs/decisions.md…
    const runbook = read('docs/decisions.md');
    expect(runbook).toMatch(/Monetisation options/i);
    // …and none of the roadmap items is implemented in code.
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.bin ?? {}).not.toHaveProperty('init');
    expect(JSON.stringify(buildWellKnown())).not.toMatch(/federat|audit/i);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const banned of ['stripe', '@stripe/stripe-js']) {
      expect(deps, banned).not.toHaveProperty(banned);
    }
  });
});

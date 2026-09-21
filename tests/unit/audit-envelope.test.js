// tests/unit/audit-envelope.test.js — Layer-0 deterministic envelope
// (KDV-AUDIT-02..07). The envelope reads git metadata and author signals only,
// never the content text; any non-conformance is a failed condition, not a throw.
import { describe, it, expect } from 'vitest';
import {
  DUMPS_ROOT,
  DEFAULT_MIN_ACCOUNT_AGE_DAYS,
  DEFAULT_MAX_PRS_PER_DAY,
  checkDiffShape,
  checkAuthorSignals,
  evaluateEnvelope,
} from '../../scripts/lib/audit-envelope.mjs';

const added = (filename) => ({ filename, status: 'added' });

describe('KDV-AUDIT-02: the diff-shape envelope', () => {
  it('KDV-AUDIT-02: a single new dump directory of added files passes and yields its slug', () => {
    const shape = checkDiffShape([
      added('content/dumps/demo/raw.md'),
      added('content/dumps/demo/manifest.json'),
    ]);
    expect(DUMPS_ROOT).toBe('content/dumps/');
    expect(shape.ok).toBe(true);
    expect(shape.slug).toBe('demo');
    expect(shape.conditions).toEqual({
      additionsOnly: true,
      singleNewDirectory: true,
      insideDumpsRoot: true,
    });
    expect(shape.violations).toEqual([]);
  });

  it('KDV-AUDIT-02: a modified file fails additions-only', () => {
    const shape = checkDiffShape([
      added('content/dumps/demo/raw.md'),
      { filename: 'content/dumps/demo/manifest.json', status: 'modified' },
    ]);
    expect(shape.ok).toBe(false);
    expect(shape.conditions.additionsOnly).toBe(false);
    expect(shape.violations).toContainEqual(
      expect.objectContaining({
        filename: 'content/dumps/demo/manifest.json',
        rule: 'additions-only',
      }),
    );
  });

  it('KDV-AUDIT-02: a file outside the dump directory fails both directory conditions', () => {
    const shape = checkDiffShape([added('content/dumps/demo/raw.md'), added('scripts/evil.mjs')]);
    expect(shape.ok).toBe(false);
    expect(shape.conditions.singleNewDirectory).toBe(false);
    expect(shape.conditions.insideDumpsRoot).toBe(false);
    expect(shape.slug).toBeNull();
    const rules = shape.violations
      .filter((v) => v.filename === 'scripts/evil.mjs')
      .map((v) => v.rule);
    expect(rules).toContain('inside-dumps-root');
  });

  it('KDV-AUDIT-02: two dump directories fail single-new-directory and yield no slug', () => {
    const shape = checkDiffShape([
      added('content/dumps/one/raw.md'),
      added('content/dumps/two/raw.md'),
    ]);
    expect(shape.ok).toBe(false);
    expect(shape.conditions.singleNewDirectory).toBe(false);
    expect(shape.conditions.insideDumpsRoot).toBe(true);
    expect(shape.slug).toBeNull();
    expect(shape.violations.some((v) => v.rule === 'single-new-directory')).toBe(true);
  });

  it('KDV-AUDIT-02: an empty file list fails (an empty PR is not a dump)', () => {
    const shape = checkDiffShape([]);
    expect(shape.ok).toBe(false);
    expect(shape.slug).toBeNull();
  });
});

describe('KDV-AUDIT-07: the author-signal envelope', () => {
  const now = new Date('2026-09-21T00:00:00Z');
  const oldAccount = '2020-01-01T00:00:00Z';
  const good = { createdAt: oldAccount, prsToday: 0, hasMergedPr: true, isFork: false };

  it('KDV-AUDIT-07: all-good author signals pass and ageDays is computed', () => {
    const res = checkAuthorSignals(good, { now });
    expect(res.ok).toBe(true);
    expect(res.conditions).toEqual({
      accountAge: true,
      rateLimit: true,
      notFork: true,
      notFirstPr: true,
    });
    expect(Number.isInteger(res.ageDays)).toBe(true);
    expect(res.ageDays).toBeGreaterThanOrEqual(DEFAULT_MIN_ACCOUNT_AGE_DAYS);
  });

  it('KDV-AUDIT-07: a young, a missing and an invalid createdAt all fail accountAge', () => {
    const young = checkAuthorSignals({ ...good, createdAt: '2026-09-20T00:00:00Z' }, { now });
    expect(young.conditions.accountAge).toBe(false);
    expect(young.ok).toBe(false);

    const missing = checkAuthorSignals({ ...good, createdAt: undefined }, { now });
    expect(missing.conditions.accountAge).toBe(false);
    expect(missing.ageDays).toBeNull();

    const invalid = checkAuthorSignals({ ...good, createdAt: 'not-a-date' }, { now });
    expect(invalid.conditions.accountAge).toBe(false);
    expect(invalid.ageDays).toBeNull();
  });

  it('KDV-AUDIT-07: the daily rate limit counts the incoming PR', () => {
    const atLimit = checkAuthorSignals({ ...good, prsToday: DEFAULT_MAX_PRS_PER_DAY }, { now });
    expect(atLimit.conditions.rateLimit).toBe(false);
    const under = checkAuthorSignals({ ...good, prsToday: DEFAULT_MAX_PRS_PER_DAY - 1 }, { now });
    expect(under.conditions.rateLimit).toBe(true);
    const negative = checkAuthorSignals({ ...good, prsToday: -1 }, { now });
    expect(negative.conditions.rateLimit).toBe(false);
    const fractional = checkAuthorSignals({ ...good, prsToday: 1.5 }, { now });
    expect(fractional.conditions.rateLimit).toBe(false);
  });

  it('KDV-AUDIT-07: a fork and an author with no merged PR both fail', () => {
    const fork = checkAuthorSignals({ ...good, isFork: true }, { now });
    expect(fork.conditions.notFork).toBe(false);
    expect(fork.ok).toBe(false);

    const first = checkAuthorSignals({ ...good, hasMergedPr: false }, { now });
    expect(first.conditions.notFirstPr).toBe(false);
    expect(first.ok).toBe(false);
  });
});

describe('KDV-AUDIT-03 + KDV-AUDIT-04 + KDV-AUDIT-05 + KDV-AUDIT-06: envelope assembly', () => {
  const diffShape = {
    ok: true,
    slug: 'demo',
    conditions: { additionsOnly: true, singleNewDirectory: true, insideDumpsRoot: true },
    violations: [],
  };
  const authorSignals = {
    ok: true,
    ageDays: 100,
    conditions: { accountAge: true, rateLimit: true, notFork: true, notFirstPr: true },
  };
  const contentGate = {
    assetsOk: true,
    secretsOk: true,
    personalDataOk: true,
    manifestOk: true,
    slugDateOk: true,
  };

  it('KDV-AUDIT-03 + KDV-AUDIT-04 + KDV-AUDIT-05 + KDV-AUDIT-06: all-true inputs pass the whole envelope', () => {
    const res = evaluateEnvelope({ diffShape, authorSignals, contentGate, layer1Clean: true });
    expect(res.ok).toBe(true);
    expect(res.failed).toEqual([]);
    expect(res.slug).toBe('demo');
    expect(Object.keys(res.conditions)).toEqual([
      'additionsOnly',
      'singleNewDirectory',
      'insideDumpsRoot',
      'assetsOk',
      'secretsOk',
      'personalDataOk',
      'manifestOk',
      'slugDateOk',
      'layer1Clean',
      'accountAgeOk',
      'rateLimitOk',
      'notFork',
      'notFirstPr',
    ]);
  });

  it('KDV-AUDIT-03 + KDV-AUDIT-04 + KDV-AUDIT-05 + KDV-AUDIT-06: a false content gate or layer1Clean lands its key in failed', () => {
    for (const key of ['assetsOk', 'secretsOk', 'personalDataOk', 'manifestOk', 'slugDateOk']) {
      const res = evaluateEnvelope({
        diffShape,
        authorSignals,
        contentGate: { ...contentGate, [key]: false },
        layer1Clean: true,
      });
      expect(res.ok).toBe(false);
      expect(res.failed).toContain(key);
    }

    const dirty = evaluateEnvelope({ diffShape, authorSignals, contentGate, layer1Clean: false });
    expect(dirty.ok).toBe(false);
    expect(dirty.failed).toContain('layer1Clean');
  });

  it('KDV-AUDIT-03 + KDV-AUDIT-04 + KDV-AUDIT-05 + KDV-AUDIT-06: missing inputs become failed conditions, not throws', () => {
    const res = evaluateEnvelope({});
    expect(res.ok).toBe(false);
    expect(res.slug).toBeNull();
    expect(res.failed).toContain('manifestOk');
    expect(res.failed).toContain('layer1Clean');
    expect(res.failed).toContain('accountAgeOk');
  });
});

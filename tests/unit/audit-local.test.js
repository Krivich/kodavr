// tests/unit/audit-local.test.js — the repeatable local harness (KDV-REVIEW-24).
// The pure module turns each dump into an addition-only single-directory PR and
// runs the real deterministic pipeline; the CLI (scripts/product/pr-review/local.mjs) supplies
// the disk reads and the near-real author / content-gate signals. The real-dump
// regression reads content/dumps/* from disk and asserts that no legitimate dump
// can be DECLINEd — only a channel veto could do that and the structural channel
// flags, it never vetoes. The per-dump decisions are deliberately not snapshotted
// (they would red on every detector/policy tweak); the report is the point.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TRUSTED_AUTHOR, dumpToPr, auditDumps, summarizeRuns } from '../../scripts/product/pr-review/audit/local.mjs';

const ROOT_URL = new URL('../../', import.meta.url);
const DUMPS_DIR = fileURLToPath(new URL('content/dumps', ROOT_URL));

// The near-real signals the CLI builds: a year-old non-fork author with a merged
// PR, and a green content gate (the repository's dumps ship validator-green).
const SIGNALS = { ...TRUSTED_AUTHOR, createdAt: '2020-01-01T00:00:00Z' };
const GATE = { assetsOk: true, secretsOk: true, personalDataOk: true, manifestOk: true, slugDateOk: true };

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.pdf', '.zip',
]);

// readDumpFiles(dir) → [{name,text}] for the dump's text files, names relative to
// the dump directory (the same rule the CLI applies).
function readDumpFiles(dir, base = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readDumpFiles(full, name));
      continue;
    }
    if (!entry.isFile() || BINARY_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    files.push({ name, text: readFileSync(full, 'utf8') });
  }
  return files;
}

// readRealDumps() → every content/dumps/<slug> directory as a harness input.
function readRealDumps() {
  return readdirSync(DUMPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ slug: entry.name, files: readDumpFiles(path.join(DUMPS_DIR, entry.name)) }))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

describe('KDV-REVIEW-24: the local harness synthesizes a single-dump PR', () => {
  it('KDV-REVIEW-24: dumpToPr makes addition-only content/dumps/<slug>/ names and preserves order', () => {
    const { prFiles, scanFiles } = dumpToPr('demo', [
      { name: 'manifest.json', text: '{}' },
      { name: 'raw.md', text: 'safe prose' },
    ]);
    expect(prFiles).toEqual([
      { filename: 'content/dumps/demo/manifest.json', status: 'added' },
      { filename: 'content/dumps/demo/raw.md', status: 'added' },
    ]);
    expect(scanFiles).toEqual([
      { file: 'content/dumps/demo/manifest.json', text: '{}' },
      { file: 'content/dumps/demo/raw.md', text: 'safe prose' },
    ]);
    expect(TRUSTED_AUTHOR).toMatchObject({ prsToday: 0, hasMergedPr: true, isFork: false });
  });
});

describe('KDV-REVIEW-24: auditDumps runs the deterministic pipeline per dump', () => {
  it('KDV-REVIEW-24: a clean synthetic dump reaches MERGE', () => {
    const runs = auditDumps(
      [{ slug: 'demo', files: [{ name: 'manifest.json', text: '{}' }, { name: 'raw.md', text: 'safe prose' }] }],
      { authorSignals: SIGNALS, contentGate: GATE },
    );
    expect(runs).toHaveLength(1);
    expect(runs[0].result.envelope.failed).toEqual([]);
    expect(runs[0].result.policy.decision).toBe('MERGE');
  });

  // NB: the brief's section D expected THINK here. The frozen pipeline folds the
  // structural channel into the envelope via layer1Clean, and evaluatePolicy
  // returns MANUAL before it ever reaches its `flag -> THINK` branch. We assert
  // the real behavior (and report the discrepancy) instead of tuning the pipeline.
  it('KDV-REVIEW-24: an invisible character in raw.md fails the envelope and blocks MERGE', () => {
    const runs = auditDumps(
      [
        {
          slug: 'demo',
          files: [
            { name: 'manifest.json', text: '{}' },
            { name: 'raw.md', text: 'hidden\u200bhere' },
          ],
        },
      ],
      { authorSignals: SIGNALS, contentGate: GATE },
    );
    expect(runs[0].result.channel.verdict).toBe('flag');
    expect(runs[0].result.policy.decision).toBe('MANUAL');
    expect(runs[0].result.envelope.failed).toContain('layer1Clean');
    const finding = runs[0].result.policy.findings.find((f) => f.channels.includes('structural'));
    expect(finding).toBeTruthy();
    expect(finding.reasons.join(' ')).toContain('invisible');
  });
});

describe('KDV-REVIEW-24: summarizeRuns tallies the decisions', () => {
  it('KDV-REVIEW-24: counts every decision and flags every non-MERGE slug', () => {
    const fake = (slug, decision) => ({ slug, result: { policy: { decision } } });
    const summary = summarizeRuns([
      fake('a', 'MERGE'),
      fake('b', 'THINK'),
      fake('c', 'MANUAL'),
      fake('d', 'DECLINE'),
      fake('e', 'MERGE'),
    ]);
    expect(summary).toEqual({
      total: 5,
      byDecision: { MANUAL: 1, MERGE: 2, THINK: 1, DECLINE: 1 },
      flagged: [
        { slug: 'b', decision: 'THINK' },
        { slug: 'c', decision: 'MANUAL' },
        { slug: 'd', decision: 'DECLINE' },
      ],
    });
  });
});

describe('KDV-REVIEW-24: the harness over the repository\'s own dumps', () => {
  it('KDV-REVIEW-24: every real dump runs and none is DECLINEd (the structural channel flags, never vetoes)', () => {
    const dumps = readRealDumps();
    expect(dumps.length).toBeGreaterThan(0);

    const runs = auditDumps(dumps, { authorSignals: SIGNALS, contentGate: GATE });
    expect(runs).toHaveLength(dumps.length);
    expect(runs.map((run) => run.slug)).toEqual(dumps.map((dump) => dump.slug));

    for (const run of runs) {
      expect(run.result.policy.decision, `${run.slug} must not be DECLINE`).not.toBe('DECLINE');
    }
  });
});

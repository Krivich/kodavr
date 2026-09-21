// tests/unit/audit-pr.test.js — the PR-audit orchestration (KDV-REVIEW-01/12/19/22).
// The pure module maps GitHub API objects into envelope inputs, runs the
// deterministic policy and renders the advisory comment + status check. In the
// shadow phase every outcome is advisory: the action class is forced to MANUAL.
import { describe, it, expect } from 'vitest';
import {
  STATUS_CONTEXT,
  normalizePrFiles,
  authorSignalsFromApi,
  runAudit,
} from '../../scripts/product/pr-review/audit/pr.mjs';
import { AUDIT_MARKER } from '../../scripts/product/pr-review/audit/report.mjs';

const CLEAN_FILES = [
  { filename: 'content/dumps/demo/raw.md', status: 'added' },
  { filename: 'content/dumps/demo/manifest.json', status: 'added' },
];
const GATE = { assetsOk: true, secretsOk: true, personalDataOk: true, manifestOk: true, slugDateOk: true };
const SIGNALS = {
  createdAt: '2020-01-01T00:00:00Z',
  prsToday: 0,
  hasMergedPr: true,
  isFork: false,
};

describe('KDV-REVIEW-22: API objects map to envelope inputs', () => {
  it('KDV-REVIEW-22: normalizePrFiles keeps order and tolerates missing fields with strings', () => {
    const files = normalizePrFiles([
      { filename: 'a.md', status: 'added' },
      { filename: 'b.md' },
      { status: 'modified' },
      null,
    ]);
    expect(files).toEqual([
      { filename: 'a.md', status: 'added' },
      { filename: 'b.md', status: '' },
      { filename: '', status: 'modified' },
      { filename: '', status: '' },
    ]);
    expect(normalizePrFiles('nope')).toEqual([]);
  });

  it('KDV-REVIEW-22: authorSignalsFromApi counts only the author\'s other PRs inside the window', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    const user = { login: 'ann', created_at: '2020-01-01T00:00:00Z' };
    const pulls = [
      { number: 7, user: { login: 'ann' }, created_at: '2026-09-21T08:00:00Z', merged_at: null }, // current
      { number: 6, user: { login: 'ann' }, created_at: '2026-09-21T04:00:00Z', merged_at: null }, // today
      { number: 5, user: { login: 'bob' }, created_at: '2026-09-21T05:00:00Z', merged_at: '2026-09-21T06:00:00Z' },
      { number: 4, user: { login: 'ann' }, created_at: '2026-09-10T00:00:00Z', merged_at: null }, // old
      { number: 3, user: { login: 'ann' }, created_at: '2026-09-19T00:00:00Z', merged_at: '2026-09-19T02:00:00Z' },
    ];
    const signals = authorSignalsFromApi({ user, pulls, isFork: false, currentNumber: 7 }, { now });
    expect(signals.createdAt).toBe('2020-01-01T00:00:00Z');
    expect(signals.prsToday).toBe(1);
    expect(signals.hasMergedPr).toBe(true);
    expect(signals.isFork).toBe(false);
  });

  it('KDV-REVIEW-22: missing pieces never throw and simply do not count', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    expect(authorSignalsFromApi({}, { now })).toEqual({
      createdAt: null,
      prsToday: 0,
      hasMergedPr: false,
      isFork: false,
    });
    const junk = authorSignalsFromApi(
      {
        user: {},
        pulls: [null, { number: 1 }, { number: 2, user: null, created_at: 'not-a-date' }],
        isFork: 'yes',
        currentNumber: 1,
      },
      { now },
    );
    expect(junk.prsToday).toBe(0);
    expect(junk.hasMergedPr).toBe(false);
    expect(junk.isFork).toBe(false);
  });
});

describe('KDV-REVIEW-12: shadow mode forces MANUAL', () => {
  it('KDV-REVIEW-12: a mergeable clean PR still reports MANUAL and a success status', () => {
    const res = runAudit({
      prFiles: CLEAN_FILES,
      scanFiles: [{ file: 'content/dumps/demo/raw.md', text: 'safe prose' }],
      authorSignals: SIGNALS,
      contentGate: GATE,
    });
    expect(res.envelope.ok).toBe(true);
    expect(res.policy.decision).toBe('MERGE');
    expect(res.policy.actionClass).toBe('MANUAL');
    expect(res.status.state).toBe('success');
    expect(res.status.description).toBe('audit: MERGE');
    // The advisory comment carries no numeric score.
    expect(res.comment).not.toMatch(/\d+\.\d+/);
  });

  it('KDV-REVIEW-12: a flagged channel yields a failure status, never a success', () => {
    const res = runAudit({
      prFiles: CLEAN_FILES,
      scanFiles: [{ file: 'content/dumps/demo/raw.md', text: 'hidden\u200bhere' }],
      authorSignals: SIGNALS,
      contentGate: GATE,
    });
    expect(res.policy.decision).not.toBe('MERGE');
    expect(res.status.state).toBe('failure');
  });
});

describe('KDV-REVIEW-19: the layered workflow status check', () => {
  it('KDV-REVIEW-19: the status carries the pr-audit context and fails on a modified file', () => {
    const res = runAudit({
      prFiles: [
        { filename: 'content/dumps/demo/raw.md', status: 'added' },
        { filename: 'content/dumps/demo/manifest.json', status: 'modified' },
      ],
      scanFiles: [],
      authorSignals: SIGNALS,
      contentGate: GATE,
    });
    expect(STATUS_CONTEXT).toBe('pr-audit');
    expect(res.status.context).toBe(STATUS_CONTEXT);
    expect(res.envelope.ok).toBe(false);
    expect(res.status.state).toBe('failure');
  });
});

describe('KDV-REVIEW-01: review runs on the forensic map', () => {
  it('KDV-REVIEW-01: the comment leads with the marker and shows spans, not the dump text', () => {
    const rawText = 'safe prose \u200b rest';
    const res = runAudit({
      prFiles: CLEAN_FILES,
      scanFiles: [{ file: 'content/dumps/demo/raw.md', text: rawText }],
      authorSignals: SIGNALS,
      contentGate: GATE,
    });
    expect(res.comment.startsWith(AUDIT_MARKER)).toBe(true);
    expect(res.comment).toContain('Forensic map');
    expect(res.comment).toContain('content/dumps/demo/raw.md');
    // The whole dump body is never echoed into the report.
    expect(res.comment).not.toContain('safe prose');
  });
});

describe('KDV-REVIEW-26: runAudit merges extra LLM channels into the policy', () => {
  it('KDV-REVIEW-26: a veto extraChannel yields DECLINE; an empty default keeps the MERGE result', () => {
    const base = {
      prFiles: CLEAN_FILES,
      scanFiles: [{ file: 'content/dumps/demo/raw.md', text: 'safe prose' }],
      authorSignals: SIGNALS,
      contentGate: GATE,
    };
    const plain = runAudit(base);
    expect(plain.policy.decision).toBe('MERGE');

    const veto = runAudit({
      ...base,
      extraChannels: [{ channel: 'llm-judge', score: 0.9, spans: [], verdict: 'veto' }],
    });
    expect(veto.policy.decision).toBe('DECLINE');
    expect(veto.status.state).toBe('failure');
  });
});

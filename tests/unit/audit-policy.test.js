// tests/unit/audit-policy.test.js — the deterministic policy
// (KDV-AUDIT-01/09/10/12/13/14). Envelope + channel results reduce to a
// recommendation and an action class; the LLM never decides.
import { describe, it, expect } from 'vitest';
import {
  DECISIONS,
  ACTION_CLASSES,
  envelopeAllPass,
  evaluatePolicy,
} from '../../scripts/product/pr-review/audit/policy.mjs';
import { makeChannelResult, makeSpan } from '../../scripts/product/pr-review/audit/channel.mjs';

const ALL_PASS = {
  additionsOnly: true,
  singleDumpDir: true,
  secretsGreen: true,
  manifestValid: true,
};
const span = (start, end, reason) => makeSpan({ file: 'raw.md', start, end, rule: 'test', reason });
const channel = (id, score, verdict, spans = []) =>
  makeChannelResult({ channel: id, score, verdict, spans });

describe('KDV-AUDIT-01: the envelope gate', () => {
  it('KDV-AUDIT-01: envelopeAllPass is true only for a non-empty all-true object', () => {
    expect(envelopeAllPass(ALL_PASS)).toBe(true);
    expect(envelopeAllPass({ a: true, b: false })).toBe(false);
    expect(envelopeAllPass({})).toBe(false);
    expect(envelopeAllPass(null)).toBe(false);
    expect(envelopeAllPass({ a: 1 })).toBe(false);
  });

  it('KDV-AUDIT-01: a non-conforming envelope is MANUAL regardless of channels', () => {
    const result = evaluatePolicy({
      envelope: { ...ALL_PASS, secretsGreen: false },
      channels: [channel('structural', 0, 'pass'), channel('classifier', 0.1, 'pass')],
      author: { class: 'FULL' },
    });
    expect(result.decision).toBe('MANUAL');
    expect(result.actionClass).toBe('MANUAL');
    expect(result.reasons).toContain('envelope');
    expect(Array.isArray(result.findings)).toBe(true);
  });
});

describe('KDV-AUDIT-09: channel verdicts override the others', () => {
  it('KDV-AUDIT-09: a veto yields DECLINE and a flag yields THINK over an otherwise mergeable set', () => {
    const veto = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [channel('judge', 0, 'pass'), channel('trace', 0.9, 'veto', [span(0, 3, 'payload')])],
      author: { class: 'FULL' },
    });
    expect(veto.decision).toBe('DECLINE');
    expect(veto.actionClass).toBe('MANUAL');

    const flag = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [channel('judge', 0, 'pass'), channel('classifier', 0.7, 'flag')],
      author: { class: 'FULL' },
    });
    expect(flag.decision).toBe('THINK');
    expect(flag.actionClass).toBe('MANUAL');
  });
});

describe('KDV-AUDIT-10: channel disagreement', () => {
  it('KDV-AUDIT-10: a score gap beyond the threshold yields THINK with the pair', () => {
    const res = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [channel('judge', 0.1, 'pass'), channel('classifier', 0.95, 'pass')],
    });
    expect(res.decision).toBe('THINK');
    expect(res.conflict).not.toBeNull();
    expect([...res.conflict.pair].sort()).toEqual(['classifier', 'judge']);
    expect(res.conflict.delta).toBeCloseTo(0.85);
    expect(res.reasons.join(' ')).toMatch(/classifier/);
    expect(res.reasons.join(' ')).toMatch(/judge/);

    const close = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [channel('judge', 0.4, 'pass'), channel('classifier', 0.6, 'pass')],
    });
    expect(close.decision).toBe('MERGE');
    expect(close.conflict).toBeNull();
  });
});

describe('KDV-AUDIT-12: the recommendation enum', () => {
  it('KDV-AUDIT-12: every recommendation is one of the frozen DECISIONS', () => {
    expect(DECISIONS).toEqual(['MANUAL', 'MERGE', 'THINK', 'DECLINE']);
    const cases = [
      evaluatePolicy({ envelope: ALL_PASS, channels: [channel('a', 0.5, 'pass')] }),
      evaluatePolicy({ envelope: { ...ALL_PASS, x: false } }),
      evaluatePolicy({ envelope: ALL_PASS, channels: [channel('a', 0.5, 'veto')] }),
      evaluatePolicy({ envelope: ALL_PASS, facts: { highStakes: true } }),
    ];
    for (const r of cases) expect(DECISIONS).toContain(r.decision);
    expect(new Set(cases.map((r) => r.decision)).size).toBeGreaterThan(1);

    const malformed = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [{ channel: 'broken', score: 9, spans: [], extra: true }],
    });
    expect(malformed.decision).toBe('THINK');
    expect(malformed.reasons.join(' ')).toMatch(/broken/);
  });
});

describe('KDV-AUDIT-13: action classes', () => {
  it('KDV-AUDIT-13: actionClass is an enum; only a clean MERGE inherits the author class', () => {
    expect(ACTION_CLASSES).toEqual(['MANUAL', 'MERGE_GREEN', 'MERGE_LOW_RISK', 'FULL']);

    const merged = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [channel('a', 0.5, 'pass')],
      author: { class: 'MERGE_GREEN' },
    });
    expect(merged.decision).toBe('MERGE');
    expect(merged.actionClass).toBe('MERGE_GREEN');
    expect(ACTION_CLASSES).toContain(merged.actionClass);

    const think = evaluatePolicy({
      envelope: ALL_PASS,
      channels: [channel('a', 0.5, 'flag')],
      author: { class: 'FULL' },
    });
    expect(think.actionClass).toBe('MANUAL');

    const noClass = evaluatePolicy({ envelope: ALL_PASS, channels: [channel('a', 0.5, 'pass')] });
    expect(noClass.actionClass).toBe('MANUAL');
    expect(ACTION_CLASSES).toContain(noClass.actionClass);
  });
});

describe('KDV-AUDIT-14: non-automatable exceptions', () => {
  it('KDV-AUDIT-14: high-stakes, medical/financial flags, fork and first PR reach a human', () => {
    const run = (facts) =>
      evaluatePolicy({ envelope: ALL_PASS, channels: [channel('a', 0.5, 'pass')], facts });
    expect(run({ highStakes: true }).decision).toBe('THINK');
    expect(run({ medicalFlag: true }).decision).toBe('THINK');
    expect(run({ financialFlag: true }).decision).toBe('THINK');
    expect(run({ fork: true }).decision).toBe('MANUAL');
    expect(run({ firstPr: true }).decision).toBe('MANUAL');
    // High stakes outranks a fork: the exact precedence is the contract.
    expect(run({ highStakes: true, fork: true }).decision).toBe('THINK');
    expect(run({ fork: true }).actionClass).toBe('MANUAL');
  });
});

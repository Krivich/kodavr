// tests/unit/registry.test.js — the requirements registry must stay internally
// consistent: every row is counted, the summary totals match, and every group in
// the summary has a section (and vice versa). Guards the silent-drift class the
// `req-coverage` parser had (a group code with digits, e.g. KDV-A11Y, was ignored).
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkFlow, LEGACY } from '../../scripts/tooling/quality-gates/req-coverage.js';
import { PROCESSES } from '../../scripts/tooling/workflow-map/workflow-arrows-lint.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const registry = readFileSync(join(ROOT, 'REQUIREMENTS.md'), 'utf8');
const PROCESS_NAMES = PROCESSES.map((p) => p.name);

// Same tolerant grammar as scripts/tooling/quality-gates/req-coverage.js: group codes may carry digits.
const ROW = /^-\s*(✅|🟧|⬜|❓)\s*\*\*(KDV-[A-Z0-9]+-\d+)\*\*/gm;
const MARK = { '✅': 'ok', '🟧': 'partial', '⬜': 'open', '❓': 'unknown' };

describe('requirements registry integrity', () => {
  const rows = [...registry.matchAll(ROW)].map((m) => ({ status: MARK[m[1]], id: m[2] }));
  const tally = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});

  it('parses every row, including digit-bearing group codes', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.id.startsWith('KDV-A11Y-'))).toBe(true);
  });

  it('the summary Total row matches the parsed rows and their statuses', () => {
    const m = registry.match(
      /\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/,
    );
    expect(m, 'summary Total row').not.toBeNull();
    expect(Number(m[1])).toBe(rows.length);
    expect(Number(m[2])).toBe(tally.ok || 0);
    expect(Number(m[3])).toBe(tally.partial || 0);
    expect(Number(m[4])).toBe(tally.open || 0);
    expect(Number(m[5])).toBe(tally.unknown || 0);
  });

  it('the per-group summary rows sum to the total', () => {
    const groupRows = [
      ...registry.matchAll(/^\|\s*KDV-[A-Z0-9]+\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm),
    ];
    expect(groupRows.length).toBeGreaterThan(0);
    expect(groupRows.reduce((sum, g) => sum + Number(g[1]), 0)).toBe(rows.length);
  });

  it('every summary group has a section and vice versa', () => {
    const summaryGroups = new Set(
      [...registry.matchAll(/^\|\s*(KDV-[A-Z0-9]+)\s*\|/gm)].map((m) => m[1]),
    );
    const sectionGroups = new Set(
      [...registry.matchAll(/^##\s+(KDV-[A-Z0-9]+)\b/gm)].map((m) => m[1]),
    );
    expect([...summaryGroups].sort()).toEqual([...sectionGroups].sort());
  });
});

// KDV-CI-25: the design-time flow-impact hook. checkFlow() is pure, so the rule is
// pinned on synthetic rows; the last test pins the real registry against the frozen
// LEGACY anchor. Synthetic IDs are assembled at runtime — the req-coverage scanner
// reads every literal KDV-* token in a test file as a real registry reference.
describe('flow-impact hook (KDV-CI-25)', () => {
  const fakeId = (group) => `KDV-${group}-01`;
  const rowOf = (id, refs = '§1') => `- ✅ **${id}**: a synthetic requirement. *(${refs})*`;
  // A frozen anchor over a synthetic legacy ID set (same construction as LEGACY).
  const frozenOf = (ids) => {
    const sorted = [...ids].sort();
    return {
      count: sorted.length,
      sha256: createHash('sha256').update(sorted.join('\n')).digest('hex'),
    };
  };

  it('KDV-CI-25: a row without a flow: field is a problem naming the ID', () => {
    const problems = checkFlow(rowOf(fakeId('NEW')), PROCESS_NAMES, frozenOf([]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(fakeId('NEW'));
    expect(problems[0]).toContain('no flow:');
  });

  it('KDV-CI-25: valid flow: values pass (single, list and none)', () => {
    const id = fakeId('NEW');
    const frozen = frozenOf([]);
    expect(checkFlow(rowOf(id, '§1; flow: Publish; tests/x.test.js'), PROCESS_NAMES, frozen)).toEqual([]);
    expect(checkFlow(rowOf(id, '§1; flow: Publish, Notify; tests/x.test.js'), PROCESS_NAMES, frozen)).toEqual([]);
    expect(checkFlow(rowOf(id, '§1; flow: none; tests/x.test.js'), PROCESS_NAMES, frozen)).toEqual([]);
  });

  it('KDV-CI-25: an unknown flow: is a problem (and lists the allowed values)', () => {
    const problems = checkFlow(rowOf(fakeId('NEW'), '§1; flow: Nope'), PROCESS_NAMES, frozenOf([]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(fakeId('NEW'));
    expect(problems[0]).toContain("unknown flow: 'Nope'");
    expect(problems[0]).toContain('allowed: PR review, Publish, Notify, Consume, Engineering, none, legacy');
  });

  it('KDV-CI-25: a flow: legacy row passes only against a matching frozen anchor', () => {
    const id = fakeId('OLD');
    expect(checkFlow(rowOf(id, '§1; flow: legacy'), PROCESS_NAMES, frozenOf([id]))).toEqual([]);
  });

  it('KDV-CI-25: a drifted flow: legacy set is one "exemption set changed" problem', () => {
    const id = fakeId('OLD');
    // A new row trying to dodge with `legacy`: the actual set (1) exceeds the frozen (0).
    const grown = checkFlow(rowOf(id, '§1; flow: legacy'), PROCESS_NAMES, frozenOf([]));
    expect(grown).toHaveLength(1);
    expect(grown[0]).toContain('exemption set changed');
    // Same count, different ID: the digest mismatch is caught too.
    const swapped = checkFlow(
      rowOf(id, '§1; flow: legacy'),
      PROCESS_NAMES,
      frozenOf([fakeId('OTHER')]),
    );
    expect(swapped).toHaveLength(1);
    expect(swapped[0]).toContain('exemption set changed');
  });

  it('KDV-CI-25: the field must be delimited — prose mentioning flow: is not mistaken for it', () => {
    // A row that only talks about flow: is still missing the field.
    const problems = checkFlow(
      rowOf(fakeId('NEW'), '§1; the flow: concept is described here'),
      PROCESS_NAMES,
      frozenOf([]),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no flow:');
  });

  it('KDV-CI-25: the real registry is clean against the exported frozen anchor', () => {
    expect(checkFlow(registry, PROCESS_NAMES, LEGACY)).toEqual([]);
  });
});

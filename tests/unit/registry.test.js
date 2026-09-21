// tests/unit/registry.test.js — the requirements registry must stay internally
// consistent: every row is counted, the summary totals match, and every group in
// the summary has a section (and vice versa). Guards the silent-drift class the
// `req-coverage` parser had (a group code with digits, e.g. KDV-A11Y, was ignored).
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const registry = readFileSync(join(ROOT, 'REQUIREMENTS.md'), 'utf8');

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

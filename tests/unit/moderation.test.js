// tests/unit/moderation.test.js — the owner-side moderation runbook (§9).
// Branch protection and auto-merge are GitHub settings that cannot be verified
// locally (KDV-MOD-03/04 are 🟧 for that reason), so the operational contract is
// pinned here: docs/decisions.md must carry every key clause.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8').replace(/\r\n/g, '\n');

describe('moderation runbook', () => {
  it('KDV-MOD-01 + KDV-MOD-02: decisions.md points discussions at GitHub Issues and defines withdrawal', () => {
    const runbook = read('docs/decisions.md');
    expect(runbook).toContain('GitHub Issues');
    expect(runbook).toContain('status": "withdrawn');
    expect(runbook).toContain('withdrawal_reason');
    // §5.6: removal is never a 404; history is preserved.
    expect(runbook).toContain('HTTP 200');
    expect(runbook).toContain('git history are preserved');
  });

  it('KDV-MOD-04: decisions.md documents branch protection — no direct pushes, required checks, first-PR review, unmerged = unpublished', () => {
    const runbook = read('docs/decisions.md');
    expect(runbook).toContain('Direct pushes are forbidden');
    expect(runbook).toContain('Required status checks');
    expect(runbook).toMatch(/first PR is reviewed manually/i);
    expect(runbook).toMatch(/Unmerged = not published/i);
    expect(runbook).toMatch(/published site is unaffected/i);
  });

  it('KDV-MOD-03: decisions.md documents owner-granted auto-merge only on a fully green validate', () => {
    const runbook = read('docs/decisions.md');
    expect(runbook).toContain('auto-merge');
    expect(runbook).toMatch(/≥ 3 green PRs/);
    expect(runbook).toContain('fully green');
    expect(runbook).toMatch(/enabled by the owner, never\nby the author/i);
  });
});

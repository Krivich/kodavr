// tests/unit/workflow-arrows.test.js — the code map is linted against the tree.
// docs/workflow-arrows.puml must match the real first-party dirs, files, links
// and symbols; the CLI alarm is pinned here too, so `npm test` covers it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lintDiagram, DRIFT_GUIDANCE, missingScriptDrawers } from '../../scripts/workflow-arrows-lint.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const pumlDir = fileURLToPath(new URL('../../docs', import.meta.url));
const puml = readFileSync(fileURLToPath(new URL('../../docs/workflow-arrows.puml', import.meta.url)), 'utf8');

describe('workflow-arrows map (§8.1)', () => {
  it('KDV-CI-12: the committed map is clean, and the linter really catches drift', () => {
    expect(lintDiagram({ text: puml, pumlDir, repoRoot })).toEqual([]);

    // Not a no-op: erase one code brick and the missing file is reported.
    const broken = puml.split('\n').filter((line) => !line.includes('as COPY <<lib>>')).join('\n');
    expect(lintDiagram({ text: broken, pumlDir, repoRoot }).join('\n')).toMatch(
      /file scripts\/lib\/copy\.mjs not drawn/,
    );
    expect(DRIFT_GUIDANCE).toContain('AGENTS/workflow-arrows.md');
  });

  it('KDV-CI-12, KDV-STRUCT-09: every scripts/* subfolder must be a declared drawer', () => {
    expect(missingScriptDrawers(['lib'], ['scripts', 'scripts/lib'])).toEqual([]);
    expect(missingScriptDrawers(['lib', 'map'], ['scripts', 'scripts/lib'])).toEqual(['scripts/map']);
  });
});

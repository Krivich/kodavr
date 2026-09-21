// tests/unit/contract.test.js — the module map cannot lie (KDV-CI-13).
// Every first-party module opens with a CONTRACT header that must equal the
// module's real exports/imports both ways; the generated index lives between
// the MODULE-INDEX markers in AGENTS/code-map.md. The generator is pinned here
// so `npm test` covers the alarm the same way CI does.
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MARK_BEGIN,
  MARK_END,
  generateIndex,
  parseHeader,
  validate,
  validateAll,
  walkTrees,
} from '../../scripts/contract.mjs';

const buildSrc = readFileSync(
  fileURLToPath(new URL('../../scripts/lib/build.mjs', import.meta.url)),
  'utf8',
);

describe('contract module index (§8.1)', () => {
  it('KDV-CI-13: every module header matches its code, and drift is caught', () => {
    expect(validateAll()).toEqual([]);

    // Not a no-op: an export claimed in the header but absent from the code.
    const lying = buildSrc.replace(
      ' *   buildProject — runs the whole build and returns the dump count',
      ' *   buildProject — runs the whole build and returns the dump count\n *   notAFunction — a lie',
    );
    expect(validate('scripts/lib/build.mjs', lying).join('\n')).toMatch(
      /exports in header, not in code: notAFunction/,
    );

    // A module without a header is drift too.
    expect(validate('scripts/lib/build.mjs', 'export const x = 1;').join('\n')).toMatch(
      /no contract header/,
    );
  });

  it('KDV-CI-13: the generated index is delimited and lists the modules', () => {
    const index = generateIndex();
    expect(index.startsWith(MARK_BEGIN)).toBe(true);
    expect(index.endsWith(MARK_END)).toBe(true);
    expect(index).toContain('**scripts/lib/build.mjs**');
    expect(index).toContain('**input/controllers/dumps.js**');
    expect(parseHeader(buildSrc).contract).toBe('scripts/lib/build.mjs');
  });

  it('KDV-CI-13, KDV-STRUCT-09: module discovery is recursive, so a scripts role subfolder is covered', () => {
    const root = mkdtempSync(join(tmpdir(), 'kdv-contract-'));
    try {
      mkdirSync(join(root, 'scripts', 'map'), { recursive: true });
      writeFileSync(join(root, 'scripts', 'a.mjs'), '');
      writeFileSync(join(root, 'scripts', 'map', 'b.mjs'), '');
      writeFileSync(join(root, 'scripts', 'map', 'skip.txt'), '');
      expect(walkTrees([{ dir: 'scripts', recursive: true }], root)).toEqual([
        'scripts/a.mjs',
        'scripts/map/b.mjs',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

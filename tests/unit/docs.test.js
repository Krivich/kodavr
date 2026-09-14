// tests/unit/docs.test.js — project-facing documents pinned to the specification.
// The spec (docs/SPEC.md) is the single source: KDV-COPY-04 checks README.md opens
// with the §7.5 copydeck block (the constant itself is pinned to the spec fenced
// block in copy.test.js); KDV-COPY-07 compares the PR template byte-for-byte against
// §7.8 and checks CONTRIBUTING covers every §7.7 rule; KDV-STRUCT-08 checks the §3
// root files exist and carry their licences.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { README_INTRO_TEXT } from '../../scripts/lib/copy.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => existsSync(fileURLToPath(new URL(rel, ROOT)));

// The spec's own fenced block for a §7.x section (same rule as copy.test.js).
function blockFor(section) {
  const lines = read('docs/SPEC.md').split('\n');
  const heading = lines.findIndex((line) => line.startsWith(`### ${section}`));
  if (heading === -1) throw new Error(`spec section ${section} not found`);
  const start = lines.findIndex((line, i) => i > heading && line.trim() === '```');
  const end = lines.findIndex((line, i) => i > start && line.trim() === '```');
  return lines.slice(start + 1, end).join('\n');
}

// One distinctive phrase per §7.7 rule (meaning is mandatory, wording is free).
const CONTRIBUTING_RULES = [
  'content/dumps/<slug>/', // 1  one PR = one dump
  'manifest.json', //         2  manifest is mandatory and schema-valid
  'secret', //                3  secrets forbidden / secret-scan
  'synthetic', //             4  examples synthetic only
  'REDACTIONS.md', //         5  correspondence redactions
  'content_flags', //         6  stakes/content_flags honest
  'generated_by', //          7  honest generation
  'CC-BY-4.0', //             8  default licence
  'Release', //               9  heavy files in a Release
  'auto-merge', //            10 first PR manual, then owner-granted auto-merge
  'merged PR', //             11 attribution from the merged PR
];

const ROOT_FILES = [
  'README.md',
  'LICENSE',
  'LICENSE-CONTENT.md',
  'CONTRIBUTING.md',
  'docs/SPEC.md',
  'docs/decisions.md',
];

describe('project-facing docs', () => {
  it('KDV-COPY-04: README opens with the §7.5 intro block verbatim', () => {
    const readme = read('README.md');
    expect(readme.startsWith(README_INTRO_TEXT)).toBe(true);
    expect(readme).toContain(README_INTRO_TEXT);
  });

  it('KDV-COPY-07: CONTRIBUTING covers all §7.7 rules and the PR template matches §7.8', () => {
    const contributing = read('CONTRIBUTING.md');
    for (const phrase of CONTRIBUTING_RULES) {
      expect(contributing, `CONTRIBUTING rule phrase: ${phrase}`).toContain(phrase);
    }
    expect(contributing).toContain('node scripts/validate.mjs');

    const template = read('.github/PULL_REQUEST_TEMPLATE.md').replace(/\n$/, '');
    expect(template).toBe(blockFor('7.8'));
  });

  it('KDV-STRUCT-08: root carries the §3 docs and licence files', () => {
    for (const file of ROOT_FILES) {
      expect(exists(file), `${file} exists`).toBe(true);
    }
    expect(read('LICENSE')).toContain('MIT');
    expect(read('LICENSE-CONTENT.md')).toContain('CC-BY-4.0');
  });
});

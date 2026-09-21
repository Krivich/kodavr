// tests/unit/workflow-arrows.test.js — the code map is linted against the tree.
// docs/workflow-arrows.puml must match the real first-party dirs, files, links
// and symbols; the CLI alarm is pinned here too, so `npm test` covers it.
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lintDiagram,
  lintProblems,
  formatProblem,
  MASKABLE_CODES,
  DRIFT_GUIDANCE,
  missingScriptDrawers,
  PROCESSES,
  STRUCTURAL_COLOR,
} from '../../scripts/tooling/workflow-map/workflow-arrows-lint.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const pumlDir = fileURLToPath(new URL('../../docs', import.meta.url));
const puml = readFileSync(fileURLToPath(new URL('../../docs/workflow-arrows.puml', import.meta.url)), 'utf8');

// compose(lines) → a minimal diagram around the given body lines.
const compose = (lines) => ['@startuml', ...lines, '@enduml'].join('\n');
// ignore(rules) → an @lint-ignore block carrying the given rule lines.
const ignore = (rules) => ["' @lint-ignore", ...rules.map((r) => `' ${r}`), "' @end"];
// opts → the real docs/ + repo root that synthetic diagrams resolve against.
const opts = { pumlDir, repoRoot };
// problemsOf(text) → the structured problems (the M errors included).
const problemsOf = (text, o = opts) => lintProblems(text, o).problems;
// formatted(text) → one string per problem, for readable assertions.
const formatted = (text, o = opts) => problemsOf(text, o).map(formatProblem);
// lintText(text) → the joined formatted problems of a diagram.
const lintText = (text) => lintDiagram(text, opts).join('\n');

describe('workflow-arrows map (§8.1)', () => {
  it('KDV-CI-12: the committed map is clean, and the linter really catches drift', () => {
    expect(lintDiagram(puml, opts)).toEqual([]);
    // Two justified masks: the by-path controllers (KDV-CI-24).
    expect(lintProblems(puml, opts).suppressed.count).toBe(2);

    // Not a no-op: erase one code brick and the missing file is reported.
    const broken = puml.split('\n').filter((line) => !line.includes('as COPY <<lib>>')).join('\n');
    expect(formatted(broken)).toContain('B: scripts/lib/copy.mjs — file not drawn');
    expect(DRIFT_GUIDANCE).toContain('AGENTS/workflow-arrows.md');
  });

  it('KDV-CI-12, KDV-STRUCT-09: every scripts/* subfolder must be a declared drawer', () => {
    expect(missingScriptDrawers(['lib'], ['scripts', 'scripts/lib'])).toEqual([]);
    expect(missingScriptDrawers(['lib', 'map'], ['scripts', 'scripts/lib'])).toEqual(['scripts/map']);
  });

  it('KDV-CI-12, KDV-STRUCT-09: nested scripts folders must be declared drawers too', () => {
    // The mapper turns a relative subpath into scripts/<subpath>.
    expect(missingScriptDrawers(['product', 'product/site-build'], ['scripts/product'])).toEqual([
      'scripts/product/site-build',
    ]);

    // The linter walks scripts/ recursively: a nested folder with no drawer is drift.
    const root = mkdtempSync(join(tmpdir(), 'kodavr-wfmap-'));
    try {
      mkdirSync(join(root, 'scripts', 'product', 'new-thing'), { recursive: true });
      const problems = problemsOf('', { pumlDir: root, repoRoot: root });
      expect(problems).toContainEqual({
        code: 'H',
        subject: 'scripts/product/new-thing',
        message: 'drawer not drawn (scripts/ subfolder)',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    // The real committed map declares every directory under scripts/, recursively.
    expect(lintDiagram(puml, opts)).toEqual([]);
  });

  // KDV-CI-22: arrow colour = business process, global numbering ordered by
  // process rank, and no orphan bricks. Synthetic diagrams keep this mechanism
  // pinned independently of the (still hand-drawn) real map.
  it('KDV-CI-22: the palette is 5 processes with unique colours and ranks 1..5', () => {
    expect(PROCESSES).toHaveLength(5);
    expect(new Set(PROCESSES.map((p) => p.color)).size).toBe(5);
    expect(new Set(PROCESSES.map((p) => p.name)).size).toBe(5);
    expect([...PROCESSES.map((p) => p.rank)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(STRUCTURAL_COLOR).toBe('#9E9E9E');
  });

  it('KDV-CI-22: an arrow needs a palette colour — none/unknown is a P1 problem', () => {
    const plain = compose(['actor "A" as A', 'component "one" as ONE <<lib>>', 'A --> ONE : plain edge']);
    expect(formatted(plain)).toContain('P1: arrow A -> ONE — has no process colour');

    const unknown = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'A -[#123456]-> ONE : plain edge',
    ]);
    expect(formatted(unknown)).toContain('P1: arrow A -> ONE — colour #123456 is not in the process palette');

    const ok = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      `A -[${PROCESSES[0].color}]-> ONE : plain edge`,
    ]);
    expect(lintText(ok)).not.toMatch(/has no process colour|not in the process palette/);
  });

  it('KDV-CI-22: steps grouped by process rank pass P2, an inversion fails', () => {
    const inversion = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'component "two" as TWO <<lib>>',
      `A -[${PROCESSES[1].color}]-> ONE : 1 · x`,
      `A -[${PROCESSES[0].color}]-> TWO : 2 · y`,
    ]);
    expect(formatted(inversion)).toContain(
      'P2: step 2 — step 1 (Publish, rank 2) precedes step 2 (PR review, rank 1) — steps must be grouped by process rank',
    );

    const grouped = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'component "two" as TWO <<lib>>',
      `A -[${PROCESSES[0].color}]-> ONE : 1 · x`,
      `A -[${PROCESSES[1].color}]-> TWO : 2 · y`,
    ]);
    expect(lintText(grouped)).not.toMatch(/steps must be grouped by process rank/);
  });

  it('KDV-CI-22: a numbered arrow must not carry the structural colour', () => {
    const structural = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      `A -[${STRUCTURAL_COLOR}]-> ONE : 1 · x`,
    ]);
    expect(formatted(structural)).toContain(
      `P2: step 1 — (A -> ONE) carries the structural colour ${STRUCTURAL_COLOR} — numbered arrows must use a process colour`,
    );
  });

  it('KDV-CI-22: a non-exempt brick unreachable from an actor is a P3 orphan', () => {
    const orphan = compose([
      'actor "A" as A',
      'component "reachable" as R <<lib>>',
      'component "orphan" as O <<cli>>',
      `A -[${PROCESSES[0].color}]-> R : 1 · x`,
    ]);
    expect(formatted(orphan)).toContain('P3: brick O — is not reachable from any actor');

    const anchored = compose([
      'actor "A" as A',
      'component "reachable" as R <<lib>>',
      'component "orphan" as O <<cli>>',
      `A -[${PROCESSES[0].color}]-> R : 1 · x`,
      `R -[${PROCESSES[1].color}]-> O : 2 · y`,
    ]);
    expect(lintText(anchored)).not.toMatch(/brick O is not reachable from any actor/);
  });
});

// KDV-CI-23: the @lint-ignore suppression mechanism. A mask states a falsifiable
// reason (mechanism + text) for a cheap-validation false positive; structural
// codes (A–H, M) can never be suppressed, and an unused mask is itself an error.
describe('workflow-arrows @lint-ignore (§8.1)', () => {
  const P1_ONE = 'P1: arrow A -> ONE — has no process colour';

  it('KDV-CI-23: MASKABLE_CODES is exactly the cheap-validation codes (never A–H/M)', () => {
    expect([...MASKABLE_CODES].sort()).toEqual(['I', 'P1', 'P2', 'P3']);
  });

  it('KDV-CI-23: a mask suppresses a matching problem and is reported as suppressed', () => {
    const body = ['actor "A" as A', 'component "one" as ONE <<lib>>', 'A --> ONE : plain edge'];
    const masked = compose([
      ...body,
      ...ignore([
        "' a plain comment line with no [CODE] is allowed",
        '[P1] arrow A -> ONE  # non-module: the edge is illustrative',
      ]),
    ]);
    expect(formatted(compose(body))).toContain(P1_ONE);

    const { problems, suppressed } = lintProblems(masked, opts);
    expect(problems.map(formatProblem)).not.toContain(P1_ONE);
    expect(suppressed.count).toBe(1);
    expect(suppressed.list.map(formatProblem)).toEqual([P1_ONE]);
  });

  it('KDV-CI-23: a mask naming a structural code is rejected and suppresses nothing', () => {
    const text = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'A --> ONE : plain edge',
      ...ignore(['[A] scripts/lib  # by-path: trying to hide a structural gap']),
    ]);
    const { problems, suppressed } = lintProblems(text, opts);
    expect(suppressed.count).toBe(0);
    expect(problems.map(formatProblem)).toContain('M: [A] scripts/lib — mask targets a structural check A');
    expect(problems.map(formatProblem)).toContain(P1_ONE);
  });

  it('KDV-CI-23: a mask without a reason is an M error and suppresses nothing', () => {
    const text = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'A --> ONE : plain edge',
      ...ignore(['[P1] arrow A -> ONE']),
    ]);
    const { problems, suppressed } = lintProblems(text, opts);
    expect(suppressed.count).toBe(0);
    expect(problems.map(formatProblem)).toContain(
      "M: [P1] arrow A -> ONE — mask has no reason (expected '# <mechanism>: ...')",
    );
    expect(problems.map(formatProblem)).toContain(P1_ONE);
  });

  it('KDV-CI-23: an unknown mechanism is an M error and suppresses nothing', () => {
    const text = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'A --> ONE : plain edge',
      ...ignore(['[P1] arrow A -> ONE  # because: it is fine']),
    ]);
    const { problems, suppressed } = lintProblems(text, opts);
    expect(suppressed.count).toBe(0);
    expect(problems.map(formatProblem)).toContain(
      "M: [P1] arrow A -> ONE — unknown mechanism 'because' (allowed: by-path|dynamic|transitive|non-module)",
    );
    expect(problems.map(formatProblem)).toContain(P1_ONE);
  });

  it('KDV-CI-23: a mask that matches no problem is an unused-mask M error', () => {
    const text = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'A --> ONE : plain edge',
      ...ignore(['[P1] arrow ZZ -> YY  # by-path: no such arrow exists']),
    ]);
    const { problems, suppressed } = lintProblems(text, opts);
    expect(suppressed.count).toBe(0);
    expect(problems.map(formatProblem)).toContain('M: [P1] arrow ZZ -> YY — unused mask');
    expect(problems.map(formatProblem)).toContain(P1_ONE);
  });

  it('KDV-CI-23: a !-prefixed mask un-ignores a key matched earlier (last match wins)', () => {
    const text = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'component "two" as TWO <<lib>>',
      'A --> ONE : a',
      'A --> TWO : b',
      ...ignore([
        '[P1] arrow *  # non-module: both edges are illustrative',
        '[P1] !arrow A -> ONE  # dynamic: but this one is a real edge',
      ]),
    ]);
    const { problems, suppressed } = lintProblems(text, opts);
    expect(suppressed.list.map(formatProblem)).toEqual(['P1: arrow A -> TWO — has no process colour']);
    expect(problems.map(formatProblem)).toContain(P1_ONE);
    expect(problems.map(formatProblem)).not.toContain('P1: arrow A -> TWO — has no process colour');
  });

  it('KDV-CI-23: an @lint-ignore without @end is an M error and applies no masks', () => {
    const text = compose([
      'actor "A" as A',
      'component "one" as ONE <<lib>>',
      'A --> ONE : plain edge',
      "' @lint-ignore",
      "' [P1] arrow A -> ONE  # non-module: illustrative",
    ]);
    const { problems, suppressed } = lintProblems(text, opts);
    expect(suppressed.count).toBe(0);
    expect(problems.map(formatProblem)).toContain('M: line 5 — @lint-ignore without @end');
    expect(problems.map(formatProblem)).toContain(P1_ONE);
  });
});

// KDV-CI-24: check (I) — a drawn edge between two MODULE bricks must be a real
// import in one direction. A by-path spawn or a stale map edge is drift unless a
// justified @lint-ignore mask suppresses it. Non-modules (css/svg/png/hbs/json)
// are out of scope.
describe('workflow-arrows module imports (§8.1)', () => {
  const moduleBrick = (file, alias) => `component "${alias}" as ${alias} <<lib>> [[${file}]]`;
  const onlyI = (text) => formatted(text).filter((p) => p.startsWith('I:'));

  it('KDV-CI-24: a module→module edge with no real import is an I problem', () => {
    const noImport = compose([
      moduleBrick('../scripts/lib/pages.mjs', 'PAGES'),
      moduleBrick('../scripts/lib/copy.mjs', 'COPY'),
      `PAGES -[${PROCESSES[1].color}]-> COPY : 1 · copydeck`,
    ]);
    expect(onlyI(noImport)).toContain('I: PAGES -> COPY — drawn edge is not a real import in either direction');
  });

  it('KDV-CI-24: a module→module edge with a real import (either direction) passes', () => {
    // pages.mjs imports ./i18n-en.mjs; i18n.mjs re-imports each bundle.
    const forward = compose([
      moduleBrick('../scripts/lib/pages.mjs', 'PAGES'),
      moduleBrick('../scripts/lib/i18n-en.mjs', 'I18N_EN'),
      `PAGES -[${PROCESSES[1].color}]-> I18N_EN : 1 · EN`,
    ]);
    expect(onlyI(forward)).toEqual([]);

    // Reverse direction: the import is real even though the arrow is drawn backwards.
    const backward = compose([
      moduleBrick('../scripts/lib/i18n-en.mjs', 'I18N_EN'),
      moduleBrick('../scripts/lib/copy.mjs', 'COPY'),
      `COPY -[${PROCESSES[1].color}]-> I18N_EN : 1 · EN`,
    ]);
    expect(onlyI(backward)).toEqual([]);
  });

  it('KDV-CI-24: non-module targets (css/svg/hbs/json) are ignored', () => {
    const nonModule = compose([
      moduleBrick('../scripts/lib/build.mjs', 'BUILD'),
      'component "asset" as ASSET <<asset>> [[../static/assets/styles.css]]',
      `BUILD -[${STRUCTURAL_COLOR}]..> ASSET : publishes static/`,
    ]);
    expect(onlyI(nonModule)).toEqual([]);
  });

  it('KDV-CI-24: the real map has exactly the two masked I problems and no stale PAGES edge', () => {
    const { suppressed } = lintProblems(puml, opts);
    const iProblems = suppressed.list.map(formatProblem).filter((p) => p.startsWith('I:'));
    expect(iProblems).toEqual([
      'I: IGN -> CTRL_DUMPS — drawn edge is not a real import in either direction',
      'I: IGN -> CTRL_REC — drawn edge is not a real import in either direction',
    ]);
    expect(suppressed.count).toBe(2);
    // Step 18 was retargeted to a real import, so no PAGES -> COPY drift survives.
    expect(formatted(puml)).not.toContain('I: PAGES');
  });
});

// KDV-CI-26: one label grammar for every brick and drawer — NAME, then the
// business meaning, then `--` and the exported members (the `--` only when there
// are members). Check (J) holds it: members never sit above the line, a `--`
// always has a meaning above it and members below it, and a linked `#symbol`
// must be one of the listed members.
describe('workflow-arrows label grammar (§8.1)', () => {
  const onlyJ = (text) => formatted(text).filter((p) => p.startsWith('J:'));

  it('KDV-CI-26: members above the -- are drift (the old shape)', () => {
    const oldShape = compose([
      'component "copy.mjs\\nEN · t\\n--\\nthe locale registry" as X <<lib>>',
    ]);
    expect(onlyJ(oldShape)).toContain('J: X — members must sit below the -- separator');
  });

  it('KDV-CI-26: more than one -- separator is drift', () => {
    const twoSeps = compose(['component "copy.mjs\\ndoes the thing\\n--\\nt\\n--\\nextra" as X <<lib>>']);
    expect(onlyJ(twoSeps)).toContain('J: X — more than one -- separator');
  });

  it('KDV-CI-26: a -- with no members below is drift', () => {
    const emptyMembers = compose(['component "copy.mjs\\ndoes the thing\\n--" as X <<lib>>']);
    expect(onlyJ(emptyMembers)).toContain(
      'J: X — the -- has no members below it (drop the -- when there are no members)',
    );
  });

  it('KDV-CI-26: a -- with no meaning above is drift', () => {
    const emptyMeaning = compose(['component "copy.mjs\\n--\\nt" as X <<lib>>']);
    expect(onlyJ(emptyMeaning)).toContain('J: X — the -- needs a meaning line above it');
  });

  it('KDV-CI-26: a linked #symbol missing from the members below -- is drift', () => {
    const badSymbol = compose([
      'component "i18n.mjs\\ndoes the thing\\n--\\nrender" as X <<lib>> [[../scripts/lib/i18n.mjs#t]]',
    ]);
    expect(onlyJ(badSymbol)).toContain(
      "J: X — the linked symbol 't' is not listed among the members below --",
    );
  });

  it('KDV-CI-26: the correct grammar passes (with and without members)', () => {
    const withMembers = compose([
      'component "i18n.mjs\\ndoes the thing\\n--\\nt · LOCALES" as X <<lib>> [[../scripts/lib/i18n.mjs#t]]',
    ]);
    expect(onlyJ(withMembers)).toEqual([]);

    const noMembers = compose([
      'component "copy.mjs\\ndoes the thing" as X <<lib>> [[../scripts/lib/copy.mjs]]',
    ]);
    expect(onlyJ(noMembers)).toEqual([]);

    // The real committed map follows the grammar.
    expect(lintDiagram(puml, opts)).toEqual([]);
  });
});

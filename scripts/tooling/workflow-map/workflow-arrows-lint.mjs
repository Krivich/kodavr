#!/usr/bin/env node
/**
 * CONTRACT: scripts/tooling/workflow-map/workflow-arrows-lint.mjs
 * ROLE: the drift alarm for docs/workflow-arrows.puml against the code tree
 * EXPORTS:
 *   DRIFT_GUIDANCE — the guidance printed before the DRIFT lines
 *   MASKABLE_CODES — the codes an @lint-ignore mask may suppress (I, P1–P3)
 *   PROCESSES — the 5 business processes: colour = process, rank = global step order
 *   STRUCTURAL_COLOR — the grey used by imports/assets/glue, never a numbered step
 *   actorAliases — the Set of actor aliases declared in the diagram
 *   bricks — the diagram's component bricks with their drawer and link
 *   declaredDrawers — the drawer paths declared in the diagram
 *   formatProblem — render a structured problem as "CODE: subject — message"
 *   lintDiagram — the pure linter over the diagram text (formatted strings)
 *   lintProblems — the structured linter: { problems, suppressed, ignoreErrors }
 *   main — the CLI entry point
 *   missingScriptDrawers — dirs under scripts/ (recursively) not declared drawers
 *   parseArrows — every arrow line as { source, target, operator, color, label }
 *   parseLinks — every [[url]] with its file and #symbol
 *   symbolDeclared — true when a #symbol is declared or called in a file
 * CONSUMES:
 *   node:fs — read the diagram and the linked files
 *   node:path — resolve links and the trees
 *   node:url — find the repo root and detect the entry point
 * INVARIANTS:
 *   — a red lint names the drift and exits 1; it is never weakened to pass
 */

// workflow-arrows-lint — linter for docs/workflow-arrows.puml (kodavr).
//
// The diagram is a hand-drawn map of kodavr's code tree:
//   * drawer blocks  — package "<dir>\n<why>" for each first-party code dir;
//   * module bricks  — component "<file>\n<meaning>\n--\n<members>" as X <<st>> [[<link>]];
//     one grammar (J): NAME → business meaning → `--` → members; the `--` only
//     when members exist, and a linked #symbol must be one of the members;
//   * a numbered flow — labels `N · call` (with a link) / `N ⟵ return` (no link).
// Everything in it points at real things; the linter is the drift alarm:
//
//   (A) drawer coverage both ways — declared drawers vs the configured first-party dirs
//   (B) file coverage both ways for code drawers — every file is a brick, every
//       brick link exists, and no file is drawn twice
//   (C) every [[url]] resolves to an existing file (relative to docs/)
//   (D) a link's #symbol is declared in the target file
//   (E) the flow's step numbers are exactly 1..N, unique and contiguous
//   (F) a brick's stereotype equals its drawer's stereotype
//   (G) T3 idiom — a numbered call to a module brick carries a [[file#symbol]]
//       link; a numbered return carries none
//   (H) every directory under scripts/ (recursively) is a declared drawer, so a
//       new role subfolder or nested process folder cannot be added without
//       drawing it (KDV-STRUCT-09)
//   (I) a drawn edge between two MODULE bricks is a real import in one direction:
//       a by-path spawn (the engine injects the controllers) or a stale map edge
//       is drift; non-modules (.css/.svg/.png/.hbs/...) and unresolved links are
//       other checks' business (KDV-CI-24)
//   (J) every brick/drawer label follows one grammar — NAME, then the business
//       meaning, then `--` and the members (`--` only when members exist):
//       members never sit above the line, a `--` needs a meaning above it and
//       members below it, and a linked #symbol must be one of the members
//       (KDV-CI-26)
//   (P1) every arrow carries a process colour from the palette (or the structural
//       grey) — the colour names the business process
//   (P2) a numbered step carries a process colour (never the structural grey) and
//       the process rank is non-decreasing in draw order: steps grouped by process
//   (P3) every non-exempt brick is reachable from an actor by the drawn arrows
//       (dashed included): no orphan bricks
//   (M) the @lint-ignore block itself is well-formed: a mask may target ONLY a
//       cheap-validation code (I, P1–P3), must cite a reason mechanism
//       (by-path|dynamic|transitive|non-module), and must actually match a
//       problem — an unused, unreasoned or structural-targeting mask is drift
//
// Suppression — a mask is proof of a false positive, never a way to hide a
// structural gap. The block lives in the same puml text:
//   ' @lint-ignore
//   ' [I] IGN -> CTRL_DUMPS  # by-path: spawned by path, not imported
//   ' [P1] arrow *  # transitive: the glue arrow elides the chain
//   ' @end
// A `'`-line without `[CODE]` is a plain comment. The glob matches the problem
// key "CODE: subject" gitignore-style: `*` any run, `?` one char, `!` un-ignores
// keys matched earlier (last match wins). Structural codes (A–H, M) are never
// suppressible.
//
// lintDiagram() is pure over `text`; it reads the filesystem only to resolve
// links and list drawer files. An empty array means clean. The CLI exits 1 on
// any problem and stays silent when the diagram is clean.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_PUML = path.join(ROOT, 'docs', 'workflow-arrows.puml');

// The first-party code drawers. A drawer is a directory block in the map.
// `cover: 'files'` (with `ext`) → every matching file must appear as exactly one
// brick, and every brick link must point at a file in that drawer.
// `cover: 'dir'` → the folder is declared/checked, bricks are illustrative.
const DRAWERS = [
  { path: 'scripts/lib', st: 'lib', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product', st: 'pack', ext: [], cover: 'dir' },
  { path: 'scripts/product/site-build', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/pr-review', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/pr-review/audit', st: 'audit', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/pr-review/audit/llm', st: 'audit', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/telegram', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/brand-media', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/tooling', st: 'pack', ext: [], cover: 'dir' },
  { path: 'scripts/tooling/quality-gates', st: 'cli', ext: ['.mjs', '.js'], cover: 'files' },
  { path: 'scripts/tooling/workflow-map', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/tooling/dev-tools', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'input/controllers', st: 'ctrl', ext: ['.js'], cover: 'files' },
  { path: 'input/templates', st: 'view', ext: ['.hbs'], cover: 'dir' },
  { path: 'static/assets', st: 'asset', ext: [], cover: 'dir' },
  { path: 'content/dumps', st: 'content', ext: [], cover: 'dir' },
];

// A link carries a scheme when it is not a repo-relative file reference.
const SCHEME = /^(?:www\.|https?:|mailto:|about:)/i;
// Stereotypes that are not a drawer theme: external actors/systems and packs.
const EXEMPT_STEREOTYPES = new Set(['ext', 'pack', 'p_pack']);

// The member-line grammar (KDV-CI-26): identifier-only symbols, ` · `-separated,
// each with an optional `()`. A file list (`home.hbs · about.hbs`) or prose is
// NOT a member line — the dot/space rules them out.
const MEMBER_LINE = /^[A-Za-z_$][\w$]*(\(\))?(?: · [A-Za-z_$][\w$]*(\(\))?)*$/;

// The business processes: the arrow COLOUR names the process and the RANK fixes
// the global step order — all rank-1 steps precede rank-2, and so on (P1/P2).
// One truth: this table is the palette the linter and the diagram share.
export const PROCESSES = [
  { name: 'PR review', rank: 1, color: '#00897B' }, // teal
  { name: 'Publish', rank: 2, color: '#1E88E5' }, // blue
  { name: 'Notify', rank: 3, color: '#8E24AA' }, // purple
  { name: 'Consume', rank: 4, color: '#43A047' }, // green
  { name: 'Engineering', rank: 5, color: '#6D4C41' }, // brown
];

// Grey: imports, assets and glue — a valid arrow colour, but NOT a process and
// never carried by a numbered step.
export const STRUCTURAL_COLOR = '#9E9E9E';

// The guidance a red lint prints BEFORE the DRIFT lines. A failing check must
// send the reader to the rules (fix the diagram / the code), never to a weakened
// check. Exported so a project test can pin the pointer.
export const DRIFT_GUIDANCE = [
  'workflow-arrows-lint: docs/workflow-arrows.puml has drifted from the code.',
  'Maintenance rules + how to read it: AGENTS/workflow-arrows.md',
  'then make the diagram match the code — or fix the code if the change was',
  'unintended. Never weaken/skip this check or erase bricks; re-render the .svg.',
].join('\n');

// The check codes an @lint-ignore mask may suppress — only the cheap validations.
// Everything else (A–H and M) is STRUCTURAL: a mask naming it is itself an error,
// so a structural gap can never be hidden. `I` is the module-edge check: a
// by-path spawn or a dynamic import is a legitimate false positive.
export const MASKABLE_CODES = new Set(['I', 'P1', 'P2', 'P3']);

// The closed vocabulary of reasons a mask may cite. The mechanism states WHY the
// drawn thing is not a real edge, so a mask asserts a falsifiable fact.
const MECHANISMS = new Set(['by-path', 'dynamic', 'transitive', 'non-module']);

// formatProblem(p) → "CODE: subject — message" (the CLI/test rendering).
export function formatProblem(p) {
  return `${p.code}: ${p.subject} — ${p.message}`;
}

// globToRegex(glob) → an unanchored RegExp for a gitignore-style mask: `*` = any
// run, `?` = one char, every other character literal (regex metachars escaped).
function globToRegex(glob) {
  let out = '';
  for (const ch of glob) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out);
}

// parseIgnoreBlock(text) → { masks, errors }. A block is:
//   ' @lint-ignore
//   ' [P1] arrow *  # transitive: ...
//   ' @end
// Only lines between the markers are read; a `'`-line with no `[CODE]` is a
// comment. Every rule is validated here — a maskable code, a reason with a known
// mechanism — and an invalid rule is an M error and is NEVER applied.
const IGNORE_START = /^\s*'\s*@lint-ignore\b/;
const IGNORE_END = /^\s*'\s*@end\b/;

function parseIgnoreBlock(text) {
  const masks = [];
  const errors = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!IGNORE_START.test(lines[i])) continue;
    const startLine = i + 1;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (IGNORE_END.test(lines[j])) {
        end = j;
        break;
      }
    }
    if (end === -1) {
      errors.push({ code: 'M', subject: `line ${startLine}`, message: '@lint-ignore without @end' });
      break;
    }
    for (let k = i + 1; k < end; k++) {
      const raw = lines[k];
      if (!raw.trim()) continue;
      if (!/^\s*'/.test(raw)) {
        errors.push({
          code: 'M',
          subject: `line ${k + 1}`,
          message: "ignore-block line is not a puml comment (must start with ')",
        });
        continue;
      }
      const body = raw.replace(/^\s*'\s?/, '').trim();
      if (!body) continue;
      const rule = body.match(/^\[([A-Za-z0-9]+)\]\s+(.+)$/);
      if (!rule) {
        // A `[`-opening line is meant to be a rule and failed to parse; anything
        // else is a plain comment.
        if (body.startsWith('[')) {
          errors.push({
            code: 'M',
            subject: `line ${k + 1}`,
            message: "malformed mask (expected '[CODE] <glob>  # <mechanism>: <reason>')",
          });
        }
        continue;
      }
      const code = rule[1];
      const rest = rule[2];
      const hash = rest.indexOf('#');
      const globRaw = (hash === -1 ? rest : rest.slice(0, hash)).trim();
      const reason = hash === -1 ? '' : rest.slice(hash + 1);
      const label = `[${code}] ${globRaw}`;

      if (!MASKABLE_CODES.has(code)) {
        errors.push({ code: 'M', subject: label, message: `mask targets a structural check ${code}` });
        continue; // structural targets are never applied
      }
      const mech = reason.match(/^\s*([A-Za-z][\w-]*)\s*:/);
      if (!mech) {
        errors.push({ code: 'M', subject: label, message: "mask has no reason (expected '# <mechanism>: ...')" });
        continue;
      }
      if (!MECHANISMS.has(mech[1])) {
        errors.push({
          code: 'M',
          subject: label,
          message: `unknown mechanism '${mech[1]}' (allowed: by-path|dynamic|transitive|non-module)`,
        });
        continue;
      }
      const negated = globRaw.startsWith('!');
      const glob = negated ? globRaw.slice(1).trim() : globRaw;
      if (!glob) {
        errors.push({ code: 'M', subject: label, message: 'mask has no glob' });
        continue;
      }
      masks.push({ code, glob, negated, regex: globToRegex(glob), label, used: false });
    }
    i = end;
  }
  return { masks, errors };
}

// pkgPath(name) → the drawer path (the title line before the `\n====` divider)
function pkgPath(name) {
  return (name ?? '').split('\\n')[0].trim();
}

// immediateFiles(dir, exts) → sorted direct file names ([] if absent / no match)
function immediateFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && (!exts || !exts.length || exts.some((x) => e.name.endsWith(x))))
    .map((e) => e.name)
    .sort();
}

// declaredDrawers(text) → the drawer paths from `package "<path>..."`
export function declaredDrawers(text) {
  return [
    ...new Set(
      [...text.matchAll(/^\s*package\s+"([^"]*)"/gm)]
        .map((m) => pkgPath(m[1]))
        .filter((p) => p && !p.startsWith('npm:')),
    ),
  ].sort();
}

// parseLinks(text) → [{ raw, url, file, symbol }]. The puml wraps a link as
// [[<url>[ <label>]]]; the URL ends at the first space (the label may hold the
// step number). `file` drops the fragment; `symbol` is the fragment (or null).
export function parseLinks(text) {
  const out = [];
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const raw = m[1];
    const sp = raw.indexOf(' ');
    const url = sp === -1 ? raw : raw.slice(0, sp);
    const hash = url.indexOf('#');
    out.push({
      raw,
      url,
      file: hash === -1 ? url : url.slice(0, hash),
      symbol: hash === -1 ? null : url.slice(hash + 1),
    });
  }
  return out;
}

// The arrow-line grammar: `A -[#c]-> B : label`, `A --> B : label`,
// `A ..> B : label`, `A -[#c]..> B : label`. The operator is captured whole so
// the colour and the solid/dashed shape stay inspectable.
const ARROW_LINE = /^(\w+)\s+(-\[[^\]]+\](?:->|\.\.>)|-->|\.\.>)\s+(\w+)\s*:\s*(.*)$/;

// parseArrows(text) → [{ source, target, operator, color, label }] for every
// arrow line, in draw order. `color` is the normalized `#RRGGBB` or null.
export function parseArrows(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ARROW_LINE);
    if (!m) continue;
    const c = m[2].match(/#([0-9A-Fa-f]{6})/);
    out.push({
      source: m[1],
      target: m[3],
      operator: m[2],
      color: c ? `#${c[1].toUpperCase()}` : null,
      label: m[4],
    });
  }
  return out;
}

// actorAliases(text) → the Set of aliases declared as `actor "..." as X`.
export function actorAliases(text) {
  return new Set([...text.matchAll(/^\s*actor\s+"[^"]*"\s+as\s+(\w+)/gm)].map((m) => m[1]));
}

// missingScriptDrawers(subdirNames, declaredDrawers) → `scripts/<name>` paths still
// missing a drawer declaration. `subdirNames` are relative to scripts/ (a nested
// subpath like `product/site-build` works too), so EVERY directory under scripts/
// recursively — not just the immediate children — must be drawn.
export function missingScriptDrawers(subdirNames, declaredDrawers) {
  return subdirNames
    .map((n) => `scripts/${n}`)
    .filter((p) => !declaredDrawers.includes(p));
}

// scriptDirNames(scriptsDir) → every directory under scripts/, as posix paths
// relative to scripts/ without the `scripts/` prefix (`lib`, `product`,
// `product/pr-review/audit/llm`, …), sorted. The walk is recursive; symlinks are
// not followed (a symlinked dir is skipped), and a missing tree yields [].
function scriptDirNames(scriptsDir) {
  if (!fs.existsSync(scriptsDir)) return [];
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      out.push(child);
      walk(path.join(dir, e.name), child);
    }
  };
  walk(scriptsDir, '');
  return out.sort();
}

// bricks(text) → the components with their enclosing drawer: [{ alias, st, pkg, file }].
// A simple brace-depth scan keeps the innermost open `package "..."` frame;
// `skinparam package { ... }` carries no quoted name and is skipped. `file` is
// the brick's own [[link]] target (the first link on the component line), or null.
export function bricks(text) {
  const out = [];
  const stack = [];
  let depth = 0;
  for (const line of text.split(/\r?\n/)) {
    const pkg = line.match(/^\s*package\s+"([^"]*)"/);
    const comp = line.match(/component\s+"[^"]*"\s+as\s+(\w+)\s*<<(\w+)>>(.*)$/);
    if (pkg) stack.push({ name: pkg[1], depth });
    if (comp) {
      const link = (comp[3].match(/\[\[([^\]]+)\]\]/) || [])[1] ?? null;
      const url = link ? link.split(' ')[0] : null;
      out.push({
        alias: comp[1],
        st: comp[2],
        pkg: stack.length ? stack[stack.length - 1].name : null,
        file: url ? url.split('#')[0] : null,
      });
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    while (stack.length && depth <= stack[stack.length - 1].depth) stack.pop();
  }
  return out;
}

// labelBlocks(text) → every component/package label as { kind, subject, text,
// symbol }: `subject` is the brick alias (or the drawer path), `text` the raw
// quoted label, `symbol` the `#fragment` of the brick's [[link]] (or null). One
// parser feeds check (J), so a brick and a drawer are held to one grammar.
function labelBlocks(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const comp = line.match(/^\s*component\s+"([^"]*)"\s+as\s+(\w+)\s*<<\w+>>(.*)$/);
    if (comp) {
      const link = (comp[3].match(/\[\[([^\]]+)\]\]/) || [])[1] ?? null;
      const url = link ? link.split(' ')[0] : null;
      const hash = url ? url.indexOf('#') : -1;
      out.push({
        kind: 'component',
        subject: comp[2],
        text: comp[1],
        symbol: hash === -1 ? null : url.slice(hash + 1),
      });
      continue;
    }
    const pkg = line.match(/^\s*package\s+"([^"]*)"/);
    if (pkg) {
      out.push({ kind: 'package', subject: pkgPath(pkg[1]), text: pkg[1], symbol: null });
    }
  }
  return out;
}

// symbolDeclared(src, symbol) → true when the symbol is a declaration or a call
// site (a reference alone is not enough: `#handleChat` must be a real member,
// not a mention in a comment). This is what catches a renamed method.
export function symbolDeclared(src, symbol) {
  const s = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${s}\\s*\\(|(?:function|class|const|let|var)\\s+${s}\\b`).test(src);
}

// importSpecifiers(src) → the module specifiers a file imports: static `from`
// clauses (re-exports included), side-effect imports and dynamic `import(...)`,
// deduped. Bare/node specifiers are kept here and filtered later by
// resolveSpecifier (only relative ones are part of our graph).
function importSpecifiers(src) {
  const out = new Set();
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) out.add(m[1]);
  return out;
}

// resolveSpecifier(spec, fromFile) → the absolute file a RELATIVE specifier points
// at, trying the path, `+'.mjs'`, `+'.js'`, `/index.mjs`, `/index.js`; null when
// the specifier is bare / `node:` or nothing exists (not a first-party edge).
function resolveSpecifier(spec, fromFile) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.mjs`, `${base}.js`, path.join(base, 'index.mjs'), path.join(base, 'index.js')];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// moduleFiles(dir) → every `.mjs`/`.js` file under dir, recursively (absolute).
function moduleFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...moduleFiles(p));
    else if (e.isFile() && /\.(?:mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

// buildImportGraph(repoRoot) → Map<absFile, Set<abs imported file>> for every
// first-party module under scripts/ and input/ (relative specifiers resolved).
function buildImportGraph(repoRoot) {
  const graph = new Map();
  const files = [...moduleFiles(path.join(repoRoot, 'scripts')), ...moduleFiles(path.join(repoRoot, 'input'))];
  for (const f of files) {
    const imported = new Set();
    graph.set(f, imported);
    let src;
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const spec of importSpecifiers(src)) {
      const resolved = resolveSpecifier(spec, f);
      if (resolved) imported.add(resolved);
    }
  }
  return graph;
}

// lintProblems(text, { pumlDir, repoRoot }) → { problems, suppressed, ignoreErrors }.
// `problems` = the real problems no mask hides, plus every M (ignore-block) error;
// `suppressed` = { count, list } of the real problems a mask moved out. M errors
// are never suppressible. Pure over `text`.
export function lintProblems(text, { pumlDir = path.dirname(DEFAULT_PUML), repoRoot = ROOT } = {}) {
  const problems = [];
  const all = bricks(text);
  const arrows = parseArrows(text);

  // (A) drawers: the first-party tree, both directions
  const declared = declaredDrawers(text);
  for (const d of DRAWERS) if (!declared.includes(d.path)) problems.push({ code: 'A', subject: d.path, message: 'drawer not drawn' });
  for (const p of declared) {
    if (!DRAWERS.some((d) => d.path === p)) {
      problems.push({ code: 'A', subject: p, message: 'phantom drawer (not a configured first-party dir)' });
    }
  }

  // (H) every directory under scripts/ (recursively) must be a declared drawer
  const scriptsDir = path.join(repoRoot, 'scripts');
  const scriptSubdirs = scriptDirNames(scriptsDir);
  for (const p of missingScriptDrawers(scriptSubdirs, declared)) {
    problems.push({ code: 'H', subject: p, message: 'drawer not drawn (scripts/ subfolder)' });
  }

  // (B) file coverage for code drawers, both directions + no double-draw
  for (const d of DRAWERS) {
    if (d.cover !== 'files') continue;
    const onDisk = immediateFiles(path.join(repoRoot, d.path), d.ext);
    const drawn = all.filter((b) => pkgPath(b.pkg) === d.path && b.file).map((b) => path.basename(b.file));
    for (const f of onDisk) if (!drawn.includes(f)) problems.push({ code: 'B', subject: `${d.path}/${f}`, message: 'file not drawn' });
    for (const f of drawn) if (!onDisk.includes(f)) problems.push({ code: 'B', subject: `${d.path}/${f}`, message: 'phantom brick file' });
    for (const f of new Set(drawn)) {
      if (drawn.filter((x) => x === f).length > 1) {
        problems.push({ code: 'B', subject: `${d.path}/${f}`, message: 'drawn more than once' });
      }
    }
  }

  // (C) + (D) links resolve, and their #symbol is declared in the target
  for (const link of parseLinks(text)) {
    if (SCHEME.test(link.url)) continue;
    const target = path.resolve(pumlDir, link.file);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      problems.push({ code: 'C', subject: link.file, message: 'link target not found' });
      continue;
    }
    if (link.symbol && !symbolDeclared(fs.readFileSync(target, 'utf8'), link.symbol)) {
      problems.push({ code: 'D', subject: `${link.file}#${link.symbol}`, message: `link symbol "${link.symbol}" not declared` });
    }
  }

  // (E) step numbers: the labels must carry exactly 1..N, unique
  const nums = [...text.matchAll(/(\d+)\s*(?:·|⟵)/g)].map((m) => Number(m[1]));
  const seen = new Set();
  const dupes = new Set();
  for (const n of nums) {
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  if (dupes.size) {
    problems.push({ code: 'E', subject: 'flow', message: `step numbering has duplicates: ${[...dupes].sort((a, b) => a - b).join(', ')}` });
  }
  const max = seen.size ? Math.max(...seen) : 0;
  const missing = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length) problems.push({ code: 'E', subject: 'flow', message: `step numbering has gaps: missing ${missing.join(', ')}` });

  // (F) a brick's stereotype must equal its drawer's stereotype
  for (const b of all) {
    const d = DRAWERS.find((x) => x.path === pkgPath(b.pkg));
    if (d && b.st !== d.st) {
      problems.push({
        code: 'F',
        subject: b.alias,
        message: `stereotype <<${b.st}>> mismatches drawer ${d.path} (expect <<${d.st}>>)`,
      });
    }
  }

  // (G) T3 idiom: a numbered call to a module brick must carry a
  // [[file#symbol]] link; a numbered return must carry none. Module bricks are
  // the bricks whose stereotype is not an exempt external/pack one.
  const modules = new Set(all.filter((b) => !EXEMPT_STEREOTYPES.has(b.st)).map((b) => b.alias));
  for (const a of arrows) {
    const target = a.target;
    const label = a.label;
    const hasLink = label.includes('[[');
    if (/(\d+)\s*·/.test(label) && modules.has(target) && !hasLink) {
      problems.push({ code: 'G', subject: `${a.source} -> ${a.target}`, message: `numbered call to module "${target}" lacks a [[file#symbol]] link (T3)` });
    }
    if (/\d+\s*⟵/.test(label) && hasLink) {
      problems.push({ code: 'G', subject: `${a.source} -> ${a.target}`, message: `numbered return to "${target}" must not carry a link (T3)` });
    }
  }

  // (I) a drawn edge between two MODULE bricks must be a real import in one
  // direction. A brick link on a `.mjs`/`.js` file on both ends is checked
  // against the first-party import graph; a by-path spawn or a stale map edge
  // is drift (mask it only with a justified @lint-ignore). Non-module targets
  // (.css/.svg/.png/.hbs/.json) and unresolved links are skipped — other checks
  // own them.
  const MODULE_FILE = /\.(?:mjs|js)$/;
  const byAlias = new Map(all.map((b) => [b.alias, b]));
  const graph = buildImportGraph(repoRoot);
  const seenEdges = new Set();
  for (const a of arrows) {
    const src = byAlias.get(a.source);
    const dst = byAlias.get(a.target);
    if (!src || !dst || !src.file || !dst.file) continue;
    if (!MODULE_FILE.test(src.file) || !MODULE_FILE.test(dst.file)) continue;
    const key = `${a.source} -> ${a.target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    const srcFile = path.resolve(pumlDir, src.file);
    const dstFile = path.resolve(pumlDir, dst.file);
    let bothExist = false;
    try {
      bothExist = fs.statSync(srcFile).isFile() && fs.statSync(dstFile).isFile();
    } catch {
      bothExist = false;
    }
    if (!bothExist) continue; // unresolved links are check (C)'s business
    const forward = graph.get(srcFile) ?? new Set();
    const backward = graph.get(dstFile) ?? new Set();
    if (!forward.has(dstFile) && !backward.has(srcFile)) {
      problems.push({ code: 'I', subject: key, message: 'drawn edge is not a real import in either direction' });
    }
  }

  // (J) one label grammar for every brick and drawer (KDV-CI-26): NAME, then the
  // business meaning, then `--` and the members — the `--` only when members
  // exist. Members never sit above the line; a `--` needs a meaning above it and
  // members below it; a linked #symbol must be one of those members.
  for (const b of labelBlocks(text)) {
    const lines = b.text.split('\\n');
    const separators = lines.filter((l) => l === '--').length;
    if (separators > 1) {
      problems.push({ code: 'J', subject: b.subject, message: 'more than one -- separator' });
      continue;
    }
    const sep = lines.indexOf('--');
    const above = sep === -1 ? lines.slice(1) : lines.slice(1, sep);
    const below = sep === -1 ? [] : lines.slice(sep + 1);
    if (above.some((l) => MEMBER_LINE.test(l))) {
      problems.push({ code: 'J', subject: b.subject, message: 'members must sit below the -- separator' });
    }
    if (sep === -1) continue;
    if (!above.some((l) => !MEMBER_LINE.test(l))) {
      problems.push({ code: 'J', subject: b.subject, message: 'the -- needs a meaning line above it' });
    }
    if (!below.length) {
      problems.push({
        code: 'J',
        subject: b.subject,
        message: 'the -- has no members below it (drop the -- when there are no members)',
      });
      continue;
    }
    if (b.symbol) {
      const sym = b.symbol.replace(/\(\)$/, '');
      const members = new Set();
      for (const ml of below) for (const tok of ml.split(' · ')) members.add(tok.replace(/\(\)$/, ''));
      if (!members.has(sym)) {
        problems.push({
          code: 'J',
          subject: b.subject,
          message: `the linked symbol '${sym}' is not listed among the members below --`,
        });
      }
    }
  }

  // (P1) a process colour: every arrow names its business process (or is grey glue)
  const palette = new Set([...PROCESSES.map((p) => p.color), STRUCTURAL_COLOR]);
  for (const a of arrows) {
    if (!a.color) problems.push({ code: 'P1', subject: `arrow ${a.source} -> ${a.target}`, message: 'has no process colour' });
    else if (!palette.has(a.color)) {
      problems.push({
        code: 'P1',
        subject: `arrow ${a.source} -> ${a.target}`,
        message: `colour ${a.color} is not in the process palette`,
      });
    }
  }

  // (P2) rank order: a numbered step carries a process colour, and the process
  // rank never decreases in draw order — steps are grouped by process.
  const byColor = new Map(PROCESSES.map((p) => [p.color, p]));
  const numbered = [];
  for (const a of arrows) {
    const s = a.label.match(/(\d+)\s*(?:·|⟵)/);
    if (s) numbered.push({ ...a, step: Number(s[1]) });
  }
  for (const a of numbered) {
    if (a.color === STRUCTURAL_COLOR) {
      problems.push({
        code: 'P2',
        subject: `step ${a.step}`,
        message: `(${a.source} -> ${a.target}) carries the structural colour ${STRUCTURAL_COLOR} — numbered arrows must use a process colour`,
      });
    }
  }
  let prev = null;
  for (const a of numbered) {
    const proc = byColor.get(a.color);
    if (!proc) continue;
    if (prev && proc.rank < prev.proc.rank) {
      problems.push({
        code: 'P2',
        subject: `step ${a.step}`,
        message: `step ${prev.step} (${prev.proc.name}, rank ${prev.proc.rank}) precedes step ${a.step} (${proc.name}, rank ${proc.rank}) — steps must be grouped by process rank`,
      });
      break;
    }
    prev = { step: a.step, proc };
  }

  // (P3) no orphan bricks: BFS from the actors over the drawn arrows (dashed
  // edges included); every non-exempt brick must be reachable.
  const reached = new Set(actorAliases(text));
  const edges = new Map();
  for (const a of arrows) {
    if (!edges.has(a.source)) edges.set(a.source, []);
    edges.get(a.source).push(a.target);
  }
  const queue = [...reached];
  while (queue.length) {
    for (const t of edges.get(queue.shift()) ?? []) {
      if (!reached.has(t)) {
        reached.add(t);
        queue.push(t);
      }
    }
  }
  for (const b of all) {
    if (EXEMPT_STEREOTYPES.has(b.st)) continue;
    if (!reached.has(b.alias)) problems.push({ code: 'P3', subject: `brick ${b.alias}`, message: 'is not reachable from any actor' });
  }

  // One truth per issue: collapse exact duplicates before masking.
  const seenKeys = new Set();
  const real = problems.filter((p) => {
    const k = formatProblem(p);
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });

  // Apply the @lint-ignore masks (last match wins) and collect the M errors,
  // which are never suppressible.
  const { masks, errors: ignoreErrors } = parseIgnoreBlock(text);
  const suppressed = [];
  const kept = [];
  for (const p of real) {
    const key = `${p.code}: ${p.subject}`;
    let ignored = false;
    for (const mask of masks) {
      if (mask.regex.test(key)) {
        mask.used = true;
        ignored = !mask.negated;
      }
    }
    (ignored ? suppressed : kept).push(p);
  }
  for (const mask of masks) {
    if (!mask.used) ignoreErrors.push({ code: 'M', subject: mask.label, message: 'unused mask' });
  }

  return {
    problems: [...kept, ...ignoreErrors],
    suppressed: { count: suppressed.length, list: suppressed },
    ignoreErrors,
  };
}

// lintDiagram(text, opts) → formatProblem()ed problems ([] = clean). The string
// API stays for callers/tests that read the DRIFT lines.
export function lintDiagram(text, opts) {
  return lintProblems(text, opts).problems.map(formatProblem);
}

// CLI: read the diagram, print problems, exit 1 on any. Silent when clean.
export function main({ puml = DEFAULT_PUML, pumlDir = path.dirname(puml), repoRoot = ROOT } = {}) {
  let text;
  try {
    text = fs.readFileSync(puml, 'utf8');
  } catch (e) {
    console.error(`workflow-arrows-lint: cannot read ${puml}: ${e.message}`);
    process.exit(1);
    return;
  }
  const { problems, suppressed } = lintProblems(text, { pumlDir, repoRoot });
  if (problems.length) {
    console.error(DRIFT_GUIDANCE);
    console.error(problems.map((p) => `DRIFT ${formatProblem(p)}`).join('\n'));
  }
  if (suppressed.count > 0) console.error(`suppressed ${suppressed.count} (see @lint-ignore)`);
  if (problems.length) process.exit(1);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();

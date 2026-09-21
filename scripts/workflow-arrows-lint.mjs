#!/usr/bin/env node
/**
 * CONTRACT: scripts/workflow-arrows-lint.mjs
 * ROLE: the drift alarm for docs/workflow-arrows.puml against the code tree
 * EXPORTS:
 *   DRIFT_GUIDANCE — the guidance printed before the DRIFT lines
 *   bricks — the diagram's component bricks with their drawer and link
 *   declaredDrawers — the drawer paths declared in the diagram
 *   lintDiagram — the pure linter over the diagram text
 *   main — the CLI entry point
 *   missingScriptDrawers — scripts/* subdirs that are not declared drawers
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
//   * drawer blocks  — package "<dir>\n====\n<why>" for each first-party code dir;
//   * module bricks  — component "<file>\n<symbol>\n--\n<role>" as X <<st>> [[<link>]];
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
//   (H) every immediate subdirectory of scripts/ is a declared drawer, so a new
//       role subfolder cannot be added without drawing it (KDV-STRUCT-09)
//
// lintDiagram() is pure over `text`; it reads the filesystem only to resolve
// links and list drawer files. An empty array means clean. The CLI exits 1 on
// any problem and stays silent when the diagram is clean.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PUML = path.join(ROOT, 'docs', 'workflow-arrows.puml');

// The first-party code drawers. A drawer is a directory block in the map.
// `cover: 'files'` (with `ext`) → every matching file must appear as exactly one
// brick, and every brick link must point at a file in that drawer.
// `cover: 'dir'` → the folder is declared/checked, bricks are illustrative.
const DRAWERS = [
  { path: 'scripts/lib', st: 'lib', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts', st: 'cli', ext: ['.mjs', '.js'], cover: 'files' },
  { path: 'input/controllers', st: 'ctrl', ext: ['.js'], cover: 'files' },
  { path: 'input/templates', st: 'view', ext: ['.hbs'], cover: 'dir' },
  { path: 'static/assets', st: 'asset', ext: [], cover: 'dir' },
  { path: 'content/dumps', st: 'content', ext: [], cover: 'dir' },
];

// A link carries a scheme when it is not a repo-relative file reference.
const SCHEME = /^(?:www\.|https?:|mailto:|about:)/i;
// Stereotypes that are not a drawer theme: external actors/systems and packs.
const EXEMPT_STEREOTYPES = new Set(['ext', 'pack', 'p_pack']);

// The guidance a red lint prints BEFORE the DRIFT lines. A failing check must
// send the reader to the rules (fix the diagram / the code), never to a weakened
// check. Exported so a project test can pin the pointer.
export const DRIFT_GUIDANCE = [
  'workflow-arrows-lint: docs/workflow-arrows.puml has drifted from the code.',
  'Maintenance rules + how to read it: AGENTS/workflow-arrows.md',
  'then make the diagram match the code — or fix the code if the change was',
  'unintended. Never weaken/skip this check or erase bricks; re-render the .svg.',
].join('\n');

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

// missingScriptDrawers(subdirNames, declaredDrawers) → `scripts/<name>` paths still
// missing a drawer declaration. Keeps a new scripts role subfolder from escaping.
export function missingScriptDrawers(subdirNames, declaredDrawers) {
  return subdirNames
    .map((n) => `scripts/${n}`)
    .filter((p) => !declaredDrawers.includes(p));
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

// symbolDeclared(src, symbol) → true when the symbol is a declaration or a call
// site (a reference alone is not enough: `#handleChat` must be a real member,
// not a mention in a comment). This is what catches a renamed method.
export function symbolDeclared(src, symbol) {
  const s = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${s}\\s*\\(|(?:function|class|const|let|var)\\s+${s}\\b`).test(src);
}

// lintDiagram({ text, pumlDir, repoRoot }) → problems[] (empty = clean)
export function lintDiagram({ text, pumlDir, repoRoot }) {
  const problems = [];
  const all = bricks(text);

  // (A) drawers: the first-party tree, both directions
  const declared = declaredDrawers(text);
  for (const d of DRAWERS) if (!declared.includes(d.path)) problems.push(`drawer ${d.path} not drawn`);
  for (const p of declared) if (!DRAWERS.some((d) => d.path === p)) problems.push(`phantom drawer ${p}`);

  // (H) every immediate subdirectory of scripts/ must be a declared drawer
  const scriptsDir = path.join(repoRoot, 'scripts');
  const scriptSubdirs = fs.existsSync(scriptsDir)
    ? fs.readdirSync(scriptsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  for (const p of missingScriptDrawers(scriptSubdirs, declared)) problems.push(`drawer ${p} not drawn`);

  // (B) file coverage for code drawers, both directions + no double-draw
  for (const d of DRAWERS) {
    if (d.cover !== 'files') continue;
    const onDisk = immediateFiles(path.join(repoRoot, d.path), d.ext);
    const drawn = all.filter((b) => pkgPath(b.pkg) === d.path && b.file).map((b) => path.basename(b.file));
    for (const f of onDisk) if (!drawn.includes(f)) problems.push(`file ${d.path}/${f} not drawn`);
    for (const f of drawn) if (!onDisk.includes(f)) problems.push(`phantom brick file ${d.path}/${f}`);
    for (const f of new Set(drawn)) if (drawn.filter((x) => x === f).length > 1) problems.push(`file ${d.path}/${f} drawn more than once`);
  }

  // (C) + (D) links resolve, and their #symbol is declared in the target
  for (const link of parseLinks(text)) {
    if (SCHEME.test(link.url)) continue;
    const target = path.resolve(pumlDir, link.file);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      problems.push(`link target not found: ${link.file}`);
      continue;
    }
    if (link.symbol && !symbolDeclared(fs.readFileSync(target, 'utf8'), link.symbol)) {
      problems.push(`link symbol "${link.symbol}" not declared in ${link.file}`);
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
  if (dupes.size) problems.push(`step numbering has duplicates: ${[...dupes].sort((a, b) => a - b).join(', ')}`);
  const max = seen.size ? Math.max(...seen) : 0;
  const missing = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length) problems.push(`step numbering has gaps: missing ${missing.join(', ')}`);

  // (F) a brick's stereotype must equal its drawer's stereotype
  for (const b of all) {
    const d = DRAWERS.find((x) => x.path === pkgPath(b.pkg));
    if (d && b.st !== d.st) problems.push(`stereotype <<${b.st}>> on brick "${b.alias}" mismatches drawer ${d.path} (expect <<${d.st}>>)`);
  }

  // (G) T3 idiom: a numbered call to a module brick must carry a
  // [[file#symbol]] link; a numbered return must carry none. Module bricks are
  // the bricks whose stereotype is not an exempt external/pack one.
  const modules = new Set(all.filter((b) => !EXEMPT_STEREOTYPES.has(b.st)).map((b) => b.alias));
  const ARROW = /^(\w+)\s+(?:-\[[^\]]+\]->|-->|\.\.>)\s+(\w+)\s*:\s*(.*)$/;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ARROW);
    if (!m) continue;
    const target = m[2];
    const label = m[3];
    const hasLink = label.includes('[[');
    if (/(\d+)\s*·/.test(label) && modules.has(target) && !hasLink) {
      problems.push(`numbered call to module "${target}" lacks a [[file#symbol]] link (T3)`);
    }
    if (/\d+\s*⟵/.test(label) && hasLink) {
      problems.push(`numbered return to "${target}" must not carry a link (T3)`);
    }
  }

  return [...new Set(problems)];
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
  const problems = lintDiagram({ text, pumlDir, repoRoot });
  if (problems.length) {
    console.error(DRIFT_GUIDANCE);
    console.error(problems.map((p) => `DRIFT ${p}`).join('\n'));
    process.exit(1);
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();

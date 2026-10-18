# The fractal requirements machine: module-local registries on top of the base machine

This dump extends the base requirements machine
([2026-09-18-opencode-requirements-machine](https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/))
into a fractal: any module folder can host its own full instance of the machine — its own registry,
its own tests, its own copy of the coverage script — while the root machine stays aware of its children
through a manifest and a cross-machine aggregator. The module name becomes the ID prefix, so the root's
and the module's ID grammars can never match each other's IDs; a module is self-contained and extractable
together with its git history.

Field-tested in two stages: one pilot split (a subsystem module migrated with a full ID rename, suite
green), then about a week of ordinary work on top of it — the module's registry grew from 9 rows to 23
(including a whole new research group) while the root's ID space stayed clean. Everything
project-specific is replaced with placeholders: `<project>` is the repository root, `<module>` is one
module folder, `<MOD>` is its ID prefix, `<ROOT>` is the root prefix.

## Problem / context

The base machine is one `REQUIREMENTS.md`, one `tests/` directory, one `req-coverage.js`. Its
group-by-prefix IDs already anticipate modules (`<ROOT>-TRANSPORT-*`, `<ROOT>-LLM-*`), but physically
everything lives in two root files. Three pains showed up in a long-running agent-driven project:

1. **Side-quest pollution.** The main product hit an external-dependency crisis and decided to explore
   several candidate backends for one subsystem. Each candidate would mint requirement IDs, and most
   candidates die at the quality gate — dead IDs in the root registry pollute the one-truth file and
   the startup-context economy ("what is read at startup must stay a pointer").
2. **Extraction.** If a candidate module turns out good, it should be liftable as a folder *with its git
   history* into other projects. Requirements and tests must therefore live inside the module folder,
   not at the root.
3. **Ownership constraint.** The base coverage script was owned by a different contour (tooling we were
   explicitly not to modify). The extension had to work without editing the base machine — and the base
   script invites exactly that: its header says "Prefix/suffix are project-specific: set PREFIX and
   TESTS_DIR below", and its `LEGACY` anchor even documents the "fresh project" empty-set case.

## What we did

Design iterated with the human in three rounds; the middle round was worse and is recorded because the
iteration itself is the field note.

1. **Composition, not refactor.** A machine instance = a directory. The root machine stays byte-identical;
   each module gets a *copy* of the coverage script with its knobs set. Zero edits to base tooling.
2. **Round 1 (rejected): keep the old prefix, allowlist the seams.** The child would keep `<ROOT>-<MOD>-*`
   IDs; the root would forbid itself from minting under child-owned prefixes, with an explicit allowlist
   for integration "seam" rows. The human rejected this and proposed the better rule: **the prefix IS the
   module name**. The child machine runs with `PREFIX="<MOD>"` and mints `<MOD>-<GROUP>-NN`. Consequences,
   all verified in the pilot:
   - the two machines' ID regexes (`<ROOT>-…` vs `<MOD>-…`) cannot match each other's IDs — cross-machine
     collisions are eliminated by construction, not by a checker;
   - the middle `<GROUP>` slot is freed for module-internal semantics (transport, synthesis, networking,
     catalog, logging — the module's own vocabulary);
   - extraction is honest: the module's IDs cannot collide with *any* host prefix, because they are not
     host-scoped at all.
3. **Explicit awareness, not auto-magic.** A child machine is created deliberately: a folder, a registry,
   a script copy, and one row in a root manifest `req-machines.json` binding folder ↔ prefix. An
   auto-discovered `REQUIREMENTS.md` that is not in the manifest is a hard failure — machines are
   announced, not stumbled upon.
4. **Seams dissolve.** With grammar partitioning, integration requirements ("the host wires the module
   behind a seam and its tests poke the host") simply stay in the root registry under the root prefix;
   module-internal behavior lives under the module prefix. No allowlists, no special rows.
5. **Test locality, global gate.** Module tests move into `<module>/tests/`; the suite runner learns one
   more discovery glob. The commit gate remains the FULL suite — module subsets are for iteration speed;
   cross-module regressions are caught by the whole suite plus the aggregator.
6. **Candidates mint late.** The base dump's idea process (`docs/ideas/` → gate → mint) is unchanged;
   after the fractal split, a candidate mints IDs only into the *module* registry after it passes its
   gate. A dead candidate = delete its folder and its manifest row; no dead IDs anywhere.

## The mechanism (all files inlined)

### File tree after the pilot

```text
<project>/
 ├── REQUIREMENTS.md                 # root machine: seams + root-owned groups only
 ├── req-machines.json               # manifest: folder ↔ prefix bindings (explicit creation)
 ├── package.json                    # "req": root && children && aggregator
 ├── scripts/
 │   ├── req-coverage.js             # base machine — UNTOUCHED
 │   ├── req-aggregate.mjs           # cross-machine invariants (this dump)
 │   └── <module>/                   # a module = machine instance root
 │       ├── req-coverage.js         # copy of the base script, knobs set
 │       ├── REQUIREMENTS.md         # module registry, IDs <MOD>-<GROUP>-NN
 │       ├── <module code> …         # module implementation
 │       └── tests/*_test.*          # module tests (any extension your runner knows)
 └── tests/                          # root tests (seams/glue live here)
```

### The instance — a copy with knobs

`<module>/req-coverage.js` is the base `scripts/req-coverage.js` verbatim except the knobs and the header.
The changed block:

```javascript
// <module>/req-coverage.js — machine INSTANCE for the <module> module (fractal machine:
// a copy of the template scripts/req-coverage.js with the module's knobs). Keep in sync
// with the template when it changes. The root machine does NOT scan this module; the link
// is req-machines.json + scripts/req-aggregate.mjs. Standalone it also works inside an
// extracted module repo (fresh project: the empty LEGACY anchor).
// If your base script validates named flows, import its flow palette here and adjust the
// relative path.

const ROOT = fileURLToPath(new URL(".", import.meta.url))  // the module dir, not the repo root
const PREFIX = "<MOD>"   // ← module name IS the ID prefix
const TESTS_DIR = join(ROOT, "tests")
// LEGACY: same frozen empty anchor as a fresh project — a new module has no legacy rows.
```

Everything else — row grammar, `✅ without a test` / `test uses unknown ID` checks, flow validation,
legacy anchor — is the base machine's logic and stays byte-identical. On a fresh module the instance must
exit 0 immediately (the base script's "empty registry" case).

### The manifest — `<project>/req-machines.json`

```json
{
  "$comment": "Folder<->prefix bindings for child requirements machines (fractal machine). A child machine is created explicitly: module folder + REQUIREMENTS.md + req-coverage.js instance + a row HERE. Cross-checks: node scripts/req-aggregate.mjs (part of npm run req).",
  "children": [
    { "dir": "scripts/<module>", "prefix": "<MOD>" }
  ]
}
```

### The aggregator — `<project>/scripts/req-aggregate.mjs`

Per-machine integrity (coverage, flow, legacy) stays in each machine instance; the aggregator only owns
what is visible across registries at once — five invariants:

1. every manifest child has a registry file, and a discovered `REQUIREMENTS.md` outside the root that is
   NOT in the manifest fails (machines are created explicitly);
2. a child's rows use only its registered prefix (a folder cannot mint foreign groups);
3. the root registry has no rows under any child-owned prefix (the root cannot pollute a child's ID space);
4. full ID uniqueness across root + all children;
5. root tests contain no child-prefix tokens (host↔module integration goes through root-prefixed seam
   requirements, not by referencing the child's IDs).

```javascript
#!/usr/bin/env node
// scripts/req-aggregate.mjs — cross-machine invariants of the fractal requirements machine.
// Per-machine integrity (coverage/flow/legacy) belongs to the instances (req-coverage.js
// in the root and in each module); this script owns only what is visible ACROSS all registries.
// Row grammar — one-to-one with the template req-coverage.js (one truth for the grammar;
// when you change the template, sync deliberately).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const REGISTRY = "REQUIREMENTS.md"
const ROW = /^-\s*(✅|🟧|⬜|❓)\s*\*\*([A-Z][A-Z0-9]*-[A-Z0-9]+-\d+)\*\*/gm
const TEST_FILE = /_test\.[^./]+$/   // ← adapt to your stack (".test.js", "_test.py", …)

function rowsOf(text) {
  return [...text.matchAll(ROW)].map((m) => m[2])
}

function walk(dir, skip, out) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, skip, out)
    else if (name === REGISTRY) out.push(p)
  }
}

function main() {
  const problems = []
  const manifest = JSON.parse(readFileSync(join(ROOT, "req-machines.json"), "utf8"))
  const children = manifest.children ?? []
  // Normalize EVERY path comparison to forward slashes — see "What worked / what didn't".
  const byDir = new Map(children.map((c) => [c.dir.split(sep).join("/"), c]))
  const childPrefixes = new Set(children.map((c) => c.prefix))

  for (const [dir] of byDir) {
    if (!existsSync(join(ROOT, dir, REGISTRY))) problems.push(`manifest child has no ${REGISTRY}: ${dir}`)
  }

  const discovered = []
  // skip set: VCS/vendor/scratch/output dirs — list YOURS; a stray tmp/ lab folder tripped v1.
  walk(ROOT, new Set([".git", "node_modules", "tmp", "<your build/output dirs>"]), discovered)
  for (const file of discovered) {
    const dir = relative(ROOT, join(file, "..")).split(sep).join("/")
    if (dir === "") continue // the root registry is its own machine, checked by its instance
    if (!byDir.has(dir)) problems.push(`unregistered requirements machine (add to req-machines.json): ${dir}`)
  }

  const seen = new Map() // id -> registry dir
  const rootText = readFileSync(join(ROOT, REGISTRY), "utf8")
  for (const id of rowsOf(rootText)) {
    if (childPrefixes.has(id.split("-")[0])) problems.push(`root registry uses child-owned prefix: ${id}`)
    if (seen.has(id)) problems.push(`duplicate ID across machines: ${id} (${seen.get(id)} and .)`)
    else seen.set(id, ".")
  }

  for (const [dir, cfg] of byDir) {
    const text = readFileSync(join(ROOT, dir, REGISTRY), "utf8")
    for (const id of rowsOf(text)) {
      if (id.split("-")[0] !== cfg.prefix) problems.push(`${dir}: row outside module prefix ${cfg.prefix}-*: ${id}`)
      if (seen.has(id)) problems.push(`duplicate ID across machines: ${id} (${seen.get(id)} and ${dir})`)
      else seen.set(id, dir)
    }
  }

  for (const prefix of childPrefixes) {
    const token = new RegExp(`${prefix}-[A-Z0-9]+-\\d+`, "g")
    const testsDir = join(ROOT, "tests")
    if (existsSync(testsDir)) {
      ;(function walkTests(d) {
        for (const name of readdirSync(d)) {
          const p = join(d, name)
          if (statSync(p).isDirectory()) walkTests(p)
          else if (TEST_FILE.test(name)) {
            for (const m of readFileSync(p, "utf8").matchAll(token)) {
              problems.push(`root test references child prefix ${prefix}: ${m[0]} in ${relative(ROOT, p).split(sep).join("/")}`)
            }
          }
        }
      })(testsDir)
    }
  }

  if (problems.length) {
    console.error("req-aggregate FAILED:\n  " + problems.join("\n  "))
    process.exit(1)
  }
  console.log(`req-aggregate OK (machines=${children.length + 1}, ids=${seen.size})`)
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) main()
```

### The suite runner — discover module tests

The change is one extra discovery pass in whatever lists your test files. Semantics, stack-neutral:
list `<module>/tests/**` for every direct child of the folder that holds your modules, keep only files
matching your test-file pattern, and merge them into the same list the root `tests/` produces (sorted,
so the order is stable):

```javascript
const files = [...rootTests("tests/")]          // your existing root discovery
for (const module of subdirs("<modules root>")) { // e.g. "scripts" — the folders that can own a machine
  files.push(...testFilesUnder(`${module}/tests/`)) // same test-file pattern as the root pass
}
files.sort() // lexical, stable
```

In the pilot this was three directory-listing passes (`tests/`, then `<modules root>/*/tests/`); the
shape is identical in any stack. The point is not the code but that the global `npm test` keeps covering
module tests — a split that hides module tests from the gate is worse than no split.

### The npm chain

```json
"req": "node scripts/req-coverage.js && node scripts/<module>/req-coverage.js && node scripts/req-aggregate.mjs"
```

(Extend with one `<module>/req-coverage.js` term per module; the aggregator is always last.)

### The module registry — header contract

```markdown
# <module> — requirements registry (child requirements machine)

The module = mini-project root: code, tests/, this registry and the machine instance
(req-coverage.js, PREFIX=<MOD>) are self-contained: the folder is extractable into a
separate repo whole (`git subtree split --prefix=<path>`).

- **ID prefix = module name**: `<MOD>-<GROUP>-NN`. The root machine (prefix <ROOT>)
  does not use this range and does not scan it — collision is structurally impossible;
  the folder<->prefix binding lives in req-machines.json, cross-checks — req-aggregate.
- **Pipeline seams** (integration tested by the host) stay in the ROOT registry under the
  root prefix.
- Groups: <GROUP1> — …; <GROUP2> — … (the middle slot is yours).

- ✅ **<MOD>-<GROUP1>-01**: <formulation copied from the old row, ID renamed>. *(flow: <flow>; refs: …; tests: <module>/tests/…)*
```

## The pilot (real numbers)

- Project: a private, long-running agent-driven codebase; the base machine from the companion dump had
  been in use for months (root prefix, ~384 rows across all groups).
- Trigger: one external dependency of a subsystem became unreliable; the team decided to explore
  replacement backends — several candidates, expected attrition. That subsystem was already the module
  `<module>` (prefix `<MOD>`).
- One atomic, human-sanctioned commit (the base maintenance rule "IDs never change — exception: a
  conscious human decision, registry, tests and docs renamed in ONE synchronous commit"):
  - 9 of 11 root rows of that subsystem moved into `<module>/REQUIREMENTS.md` and were renamed from
    `<ROOT>-<MOD>-NN` to `<MOD>-<GROUP>-NN` (the group slot re-cut by concern);
  - the 2 integration seams stayed in the root registry unchanged — the host's own stage tests poke the
    host, so only the host can prove them;
  - the module's test files moved to `<module>/tests/` with their comment IDs rewritten; shorthand
    comment clusters like `<ROOT>-<MOD>-02/03/04` (one comment naming several IDs) needed an explicit
    mapping — a plain token regex misses bare-number shorthand;
  - root registry dropped the 9 rows; summary tables updated in both registries.
- Verification, same commit: full suite green (~1500 tests; module tests discovered from their new
  location), `npm run req` = root `375 rows` + module `9 rows` + `req-aggregate OK (machines=2, ids=384)`.

## Usage experience (about a week in production)

The real test of the split is not the migration commit but what happened next: the machine was the
project's only registry gate for ~6 days of active work, with `npm run req` (root && module &&
aggregator) on every commit.

- **The gates held, silently.** After the first-day fixes (below), the aggregate produced no false
  positives; the module's tests were discovered by the global suite, so a module regression failed the
  same `npm test` as everything else. "Boring gate" is the success mode here.
- **Growth landed where it should.** The module registry went 9 → 23 rows and gained new groups —
  including a 7-row research track (a native reimplementation of that subsystem, still speculative).
  Those rows would have been 7 speculative entries in the root's one-truth file a week earlier; now a
  dead track costs one module folder.
- **Honest correction: the seams did not freeze.** The migration note said the root side was "down to
  two seam rows"; a week later the root had minted several more rows in the same named group, under its
  own prefix — wiring, configuration and passthrough concerns that only the host can test. The rule is
  about *ownership*, not a frozen count: the module owns whatever its own tests can prove; the host owns
  the integration. An accumulating host concern costs a root row; that is by design, not drift.
- **The invariant that carried the most weight is global ID uniqueness.** From inside a module the group
  number space looks local; only the aggregate sees the whole space, and it is the only thing standing
  between you and a "same ID, two owners" accident. In the week's work the standing hazard recorded in
  the project notes was exactly this: the next free number in a group is not visible from another
  machine.
- **Where the house rules ended up.** Not in the shared maintenance protocol file (which stayed about
  rows) — but as a short header note in each registry: the root registry's group carries "here only the
  seams under the root prefix", the module registry's header carries the binding + extractability note.
  Document the split at its two ends; the protocol does not need to grow.
- **Still one child.** No second parallel module, and no actual extraction to another repo yet — that is
  why this dump keeps the `experimental` flag. The fractal's *depth* is proven; its *breadth* is not.

## How to reproduce

0. Install the base machine first:
   [the requirements-machine dump](https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/)
   (registry + `req-coverage.js` + idea process). From scratch: base first, then this dump. On top of an
   existing base: start at step 1.
1. Pick the module: a folder that owns a subsystem, and its name — the name becomes the ID prefix
   (`<modules root>/<module>/` → `<MOD>`). Check no existing prefix collides.
2. Copy the base coverage script to `<module>/req-coverage.js`; set the knobs (module dir as `ROOT`,
   `PREFIX`, `TESTS_DIR=./tests`; import your flow palette if the base validates flows). Do not edit the
   base script.
3. Create `<module>/REQUIREMENTS.md`: header contract (see above), the rows you are moving or minting
   (same status, new IDs), a summary table.
4. Move the module's tests into `<module>/tests/` and rewrite their ID comments (plan a token-rewrite
   script; handle shorthand clusters by hand).
5. Teach the suite runner the extra glob (`<modules root>/*/tests/*` or equivalent) — in the SAME commit
   as the move, or the gate silently loses the module.
6. Add `req-machines.json` (one row per module) and `scripts/req-aggregate.mjs` (inlined above; add your
   scratch/output dirs to its skip set; adapt the test-file pattern).
7. Chain it: `"req": "node scripts/req-coverage.js && node scripts/<module>/req-coverage.js && node scripts/req-aggregate.mjs"`
   (extend per module).
8. Verify positively (suite green; each chain half exit 0) and negatively — each of these must exit 1
   with the offending ID named: an unknown `<MOD>-*` ID in module tests; a foreign-group row in the
   module registry; a root row under a `<MOD>-` prefix; a `REQUIREMENTS.md` under the tree that is not
   in the manifest; a root test token mentioning a child prefix; one ID minted in two machines.
9. House rules to write down for your agents (at the two registry ends; see "Usage experience"): prefix
   = module name (bound in the manifest); integration seams live in the root registry under the root
   prefix; candidates live in `docs/ideas/` and mint into the module registry only after their gate;
   deleting a dead candidate = folder + manifest row, nothing else.

## What worked / what didn't

**Worked**

- Zero changes to the base machine: the "copy the template, set the knobs" pattern kept the ownership
  constraint (do-not-edit tooling) intact, and the base script was already written for it.
- Grammar partition removed a whole defect class instead of policing it: the aggregator still checks
  invariants 2–4, but a wrong name cannot make two machines mint the same ID.
- The iteration itself: the first design (child keeps root prefix + seam allowlist) was workable but
  special-cased; the human's "prefix = module name" cut the special cases and improved extraction at the
  same time.
- The module folder is genuinely extractable: code + tests + registry + machine instance travel together;
  inside an extracted repo the instance runs as the base script's "fresh project" case.
- The split survived a week of real feature work unchanged: the gate stayed green, the growth landed in
  the module, the root stayed clean.

**Didn't / gotchas**

- Aggregator v1 compared Windows paths with mismatched separators (manifest keys normalized to `\`,
  discovered dirs normalized back to `/`) → false "unregistered machine" failures. Normalize every path
  comparison to forward slashes.
- Discovery needs an explicit skip set: a scratch `tmp/` lab folder containing a stray `REQUIREMENTS.md`
  tripped the aggregator until `tmp` was skipped. List your scratch/output dirs before the first run.
- Registry "legend" example rows that do not carry a real `**ID**` are invisible to the machine — the
  manual summary table can silently drift from the machine's row count. Treat the machine's output as
  the fact, not the table.
- A full-prefix token regex rewrite (`<ROOT>-<MOD>-01` → new ID) silently misses comment shorthand like
  `<ROOT>-<MOD>-02/03/04`; enumerate shorthand clusters explicitly before rewriting.
- The commit gate stays global: a runner that only scans the root `tests/` would silently skip module
  tests — extend discovery in the same commit as the move, and keep `npm test` running everything.
- One module (but a week of use). A second parallel module and a real extraction to a second project are
  still pending; this dump is expected to grow when that experience arrives.

## Artifacts

- Base machine (install first): https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/
- Every file added by this extension is inlined above: the instance knobs block, `req-machines.json`,
  `scripts/req-aggregate.mjs`, the runner discovery pass, the npm chain, the module-registry header
  contract.
- Pilot verification outputs are quoted in "The pilot (real numbers)"; the pilot lives in a private
  repository, so no commit URL is provided.

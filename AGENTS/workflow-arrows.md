# workflow-arrows — the workflow map (`docs/workflow-arrows.puml` → `.svg`)

Two files, one artifact:

- **`docs/workflow-arrows.puml`** — the machine source: plain text, the thing you
  edit, checked by the linter.
- **`docs/workflow-arrows.svg`** — the human render: generated from the `.puml`,
  the thing people look at. Never edit it by hand. A fresh project has no `.svg`
  until the map has content and is rendered once.

The map starts empty and grows with the code: add a drawer when a first-party code
directory appears, a brick when a module appears, a numbered arrow when a
cross-cutting flow appears. The linter (`scripts/tooling/workflow-map/workflow-arrows-lint.mjs`) keeps it
from rotting, locally and in CI.

## Why a trustworthy map

Code maps usually rot: they show whatever modules someone happened to open last.
This one is linted against the code tree, so it either matches the code or the lint
goes red. That matters when you touch a cross-cutting flow: you can see the whole
picture at once and extend the flow that already exists instead of adding a parallel
path around it. A map you can trust is what prevents those workarounds.

Think of the code as a park with a few main paths — the cross-cutting flows. A new
feature should widen a path or add a bench, not cut a flowerbed straight across one
because that is the shortest line to the goal: the flowerbed "works" until someone
walks the path, and then it is just broken ground. A shortcut around a shared step
is the same — it routes delivery around the step that owns the concern; locally
green, globally a second truth that drifts. Widening the path is the work; cutting
across it is the bug.

## How to read it

- **Drawers** = first-party code directories, drawn as a `package "<dir>\n<why>"`
  block; the header says why the directory exists. Externals (actors, the engine,
  GitHub, dev tools) are top-level bricks stereotyped `<<ext>>`.
- A **brick** = one file, drawn with one label grammar (check J below):
  `NAME` → one or more lines of **what it does** (business meaning) → `--` →
  **members** (its exported symbols). The `--` exists **only** when there are
  members; a brick whose meaning line already names its one method needs no
  members line. It carries its drawer's stereotype and links its file
  (`[[../<path>#symbol <label>]]`, symbol optional).
- **Numbered arrows** = the flow order `1..N`. Label line 1 is
  `N · callee.method()` — the API method **of the target brick** (the callee).
  Label line 2 (plain text) is **why** the call happens.
- **Solid** `-->` = a call; **dashed** `..>` = a return or a push.
- **Colour** = the business process (P1/P2 below): every arrow carries
  `-[#RRGGBB]->` from the palette, and the numbered flow is grouped by process
  rank, so all rank-1 steps come before rank-2, and so on. Grey `#9E9E9E` is
  structural glue (imports, assets), never a process and never a numbered step.
- **No orphans**: every non-exempt brick must be reachable from an actor by
  following the drawn arrows (dashed included).
- **Click targets**: a brick opens its file, a call label opens the callee method
  (in the `.svg` + the IntelliJ PlantUML plugin).

## Process palette

| # | Process | Colour | Covers |
|---|---|---|---|
| 1 | PR review | `#00897B` teal | a dump arrives as a validated PR |
| 2 | Publish | `#1E88E5` blue | build → engine → artifact |
| 3 | Notify | `#8E24AA` purple | mirroring / card posts |
| 4 | Consume | `#43A047` green | machine + human reads |
| 5 | Engineering | `#6D4C41` brown | local dev / tooling |

The table lives in `PROCESSES` (plus `STRUCTURAL_COLOR`) at the top of the linter.

## The drawers (kodavr)

A drawer is either **file-covered** (`cover: files`) or **dir-only** (`cover: dir`).
For a file-covered drawer every matching file must appear as exactly one brick, and
every brick must link a file in that drawer. Dir-only drawers need only be drawn;
their bricks are illustrative.

| Drawer | Stereotype | Coverage |
|---|---|---|
| `scripts/lib` | `<<lib>>` | files `.mjs` — the shared publishing engine |
| `scripts/product` | `<<pack>>` | dir — the product processes |
| `scripts/product/site-build` | `<<cli>>` | files `.mjs` — the site build entry point |
| `scripts/product/pr-review` | `<<cli>>` | files `.mjs` — the PR surface: card + audit entry points |
| `scripts/product/pr-review/audit` | `<<audit>>` | files `.mjs` — the deterministic audit engine |
| `scripts/product/pr-review/audit/llm` | `<<audit>>` | files `.mjs` — the LLM audit layers |
| `scripts/product/telegram` | `<<cli>>` | files `.mjs` — the Telegram mirror entry point |
| `scripts/product/brand-media` | `<<cli>>` | files `.mjs` — the brand-image generators |
| `scripts/tooling` | `<<pack>>` | dir — the development tooling |
| `scripts/tooling/quality-gates` | `<<cli>>` | files `.mjs`, `.js` — the CI gates |
| `scripts/tooling/workflow-map` | `<<cli>>` | files `.mjs` — the map's drift alarm + hover injection |
| `scripts/tooling/dev-tools` | `<<cli>>` | files `.mjs` — local dev conveniences |
| `input/controllers` | `<<ctrl>>` | files `.js` — engine-injected client controllers |
| `input/templates` | `<<view>>` | dir — Handlebars layouts + partials |
| `static/assets` | `<<asset>>` | dir — stylesheet, client JS, brand images |
| `content/dumps` | `<<content>>` | dir — the dumps themselves |

The set lives in `DRAWERS` at the top of the linter. The `scripts/` tree is
two-level — `scripts/<category>/<process>/` with categories `product` and
`tooling` around the shared `lib/` engine; a category and a process folder are
both drawers. Add a directory there when a new first-party tree appears, and draw
its block.

## Linted idioms (T1–T6)

The linter pins these; every new brick or arrow must obey them.

- **T1** — a brick's stereotype equals its drawer's stereotype (exempt: `<<ext>>`).
- **T2** — a drawer's title first line is exactly the directory path.
- **T3** — numbered **call** arrows carry a `[[file#symbol]]` link; **returns carry no link**.
- **T4** — the step number is the label's first token: `N ·` for a call,
  `N ⟵` for a return.
- **T5** — a link's `#symbol` must be declared in the target file.
- **T6** — returns use `..>` and `⟵`.
- **T7** — one label grammar for every brick and drawer: `NAME`, then the business
  meaning, then `--` and the members — the `--` only when members exist. Members
  never sit above the line, and a linked `#symbol` must be one of the members
  (enforced by check J, KDV-CI-26).

## The linter

`scripts/tooling/workflow-map/workflow-arrows-lint.mjs`, pure `lintDiagram({ text, pumlDir, repoRoot })`.
Run it from the project root (silent, exit 0 when clean):

```
npm run workflow-arrows:lint
```

It also runs in CI (`validate.yml`, KDV-CI-12) and is pinned by
`tests/unit/workflow-arrows.test.js`, so `npm test` covers the map too.

Checks:

- **(A)** drawer coverage both ways — declared drawers ↔ the configured first-party dirs.
- **(B)** file coverage both ways for code drawers — every file is exactly one brick,
  every brick link exists, no file drawn twice.
- **(C)** every `[[url]]` resolves relative to `docs/`.
- **(D)** a link's `#symbol` is declared in the target file.
- **(E)** step numbers are exactly `1..N`, unique and contiguous.
- **(F)** a brick's stereotype equals its drawer's (T1).
- **(G)** a numbered **call** to a module brick carries a `[[file#symbol]]` link;
  a numbered **return** carries none (T3).
- **(I)** a drawn edge between two **module** bricks is a real import in one
  direction (KDV-CI-24): the linter builds the first-party import graph over
  `scripts/` + `input/` (static `from`, side-effect `import`, dynamic `import(...)`;
  relative specifiers resolved to `.mjs`/`.js`), and an edge whose two `.mjs`/`.js`
  bricks never import each other is drift. A **by-path** spawn (the engine injects
  `input/controllers/*` by path) or a **dynamic** call is a legitimate false
  positive — mask it with `@lint-ignore`. Non-modules (`.css`/`.svg`/`.png`/`.hbs`/
  `.json`) and unresolved links are other checks' business.
- **(J)** every brick/drawer label follows one grammar (KDV-CI-26, T7): at most
  one `--`; the lines above it (besides the NAME) are business meaning, never
  members; a `--` has a meaning line above it and members below it; and a brick
  whose link carries a `#symbol` must list that symbol among the members below
  the line. The old `NAME / members / -- / meaning` shape is drift.
- **(P1)** every arrow carries a process colour from the palette, or the
  structural grey (no colour, or an unknown colour, is drift).
- **(P2)** a numbered step carries a process colour (never the structural grey)
  and the process rank is non-decreasing in draw order — steps grouped by process.
- **(P3)** every non-exempt brick is reachable from an actor by the drawn arrows
  (dashed included) — no orphan bricks.
- **(M)** the `@lint-ignore` block is well-formed (see below) — a bad mask is
  itself drift.

P1–P3 are pinned independently of the hand-drawn map by synthetic diagrams in
`tests/unit/workflow-arrows.test.js` (KDV-CI-22).

### Suppressing a false positive (`@lint-ignore`)

Some drawn edges are legitimately not imports: a `by-path` controller is spawned
by path, a call is dynamic, a transitive chain is elided, an artifact is no
module. A mask suppresses ONLY such a **cheap-validation** problem — the codes
`I`, `P1`, `P2`, `P3` — and never a structural one (A–H, or the block's own `M`).
**A mask is proof of a false positive, never a way to hide a structural gap.**

Embed the mask block in the `.puml` itself:

```
' @lint-ignore
' [I] IGN -> CTRL_DUMPS  # by-path: spawned by path, not imported
' [P1] arrow *  # transitive: the glue arrow elides the chain
' @end
```

- Only lines between `@lint-ignore` and `@end` are read; a `'`-line with no
  `[CODE]` is a plain comment.
- The glob matches the problem key `CODE: subject` gitignore-style: `*` any run,
  `?` one char, `!` un-ignores a key matched earlier (last match wins).
- Every rule MUST carry `# <mechanism>: <reason>`; the mechanism is one of
  `by-path`, `dynamic`, `transitive`, `non-module` — the closed vocabulary that
  makes a mask assert *why* it is a false positive.
- The guards are themselves `M` problems, never suppressible: a mask targeting a
  structural code, a mask with no reason, an unknown mechanism, an unused mask,
  or an `@lint-ignore` without `@end`.
- Suppressed problems are reported, not hidden: the CLI prints
  `suppressed N (see @lint-ignore)` and exits 0 only when nothing unsuppressed
  remains. After a real code fix, remove the mask so it does not go unused.
- Maskable codes are pinned as `MASKABLE_CODES` in the linter (`I, P1, P2, P3`;
  `I` is the module-edge check of KDV-CI-24).

## When lint fails

A red lint is the drift alarm, not an obstacle. Do this:

1. **Read this file and the `DRIFT` lines** — they name what drifted.
2. **Fix the diagram** so drawers, files, links, symbols, stereotypes and numbers
   match the code: the code is the truth, the map follows it.
3. If the code change was **unintended**, fix the code instead.
4. **Never** weaken or skip the check, and never erase bricks to silence it.
5. **Re-render** the `.svg` after editing.

The linter prints this file's path in the guidance for exactly this reason.

## Maintaining & rendering

**Editing the `.puml` is not finished until `docs/workflow-arrows.svg` is re-rendered
and committed in the SAME change** — source and render are one artifact; an
unrendered `.puml` edit is an incomplete edit.

Render (Smetana layout — no GraphViz needed):

```
java -jar <plantuml.jar> -tsvg -charset UTF-8 docs/workflow-arrows.puml
```

Then confirm the `.svg` holds no `Syntax Error`. Add the hover block (it is part of
the render, not an extra) and commit both files:

```
npm run workflow-arrows:svg
```

- Links are relative **to `docs/`**:
  `[[../scripts/lib/build.mjs#buildProject <label>]]`. The label follows the URL
  after a **space** — not `{}`. No absolute paths, no `file://` (the IntelliJ plugin
  opens neither).
- `====` is gone from drawers: one grammar everywhere — `NAME` → what it does →
  `--` → members; `--` draws the divider inside a brick and exists only when
  members follow (T7, check J).
- **Add a module → add a brick** — otherwise a code drawer fails file coverage.
- `npm run workflow-arrows:svg` injects the **hover block**: the whole arrow lights up
  (line, head, label) in the `.puml`'s `skinparam pathHoverColor` colour, and lingers
  ~5s after the pointer leaves — so a long arrow stays lit while you scroll to its far
  end. It shows only in a CSS-capable viewer (a browser), never in PNG or an IDE
  preview. The committed `.svg` must carry the block (pinned by KDV-CI-21).
- **Commit `.puml` and `.svg` together** — source and render are one artifact.

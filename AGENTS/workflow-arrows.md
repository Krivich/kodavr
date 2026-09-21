# workflow-arrows — the workflow map (`docs/workflow-arrows.puml` → `.svg`)

Two files, one artifact:

- **`docs/workflow-arrows.puml`** — the machine source: plain text, the thing you
  edit, checked by the linter.
- **`docs/workflow-arrows.svg`** — the human render: generated from the `.puml`,
  the thing people look at. Never edit it by hand. A fresh project has no `.svg`
  until the map has content and is rendered once.

The map starts empty and grows with the code: add a drawer when a first-party code
directory appears, a brick when a module appears, a numbered arrow when a
cross-cutting flow appears. The linter (`scripts/workflow-arrows-lint.mjs`) keeps it
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

- **Drawers** = first-party code directories, drawn as a `package "<dir>\n====\n<why>"`
  block; the header says why the directory exists. Externals (actors, the engine,
  GitHub, dev tools) are top-level bricks stereotyped `<<ext>>`.
- A **brick** = one file: it reads `file` / `symbol` / `role`, carries its drawer's
  stereotype, and links its file (`[[../<path>#symbol <label>]]`, symbol optional).
- **Numbered arrows** = the flow order `1..N`. Label line 1 is
  `N · callee.method()` — the API method **of the target brick** (the callee).
  Label line 2 (plain text) is **why** the call happens.
- **Solid** `-->` = a call; **dashed** `..>` = a return or a push.
- **Click targets**: a brick opens its file, a call label opens the callee method
  (in the `.svg` + the IntelliJ PlantUML plugin).

## The drawers (kodavr)

A drawer is either **file-covered** (`cover: files`) or **dir-only** (`cover: dir`).
For a file-covered drawer every matching file must appear as exactly one brick, and
every brick must link a file in that drawer. Dir-only drawers need only be drawn;
their bricks are illustrative.

| Drawer | Stereotype | Coverage |
|---|---|---|
| `scripts/lib` | `<<lib>>` | files `.mjs` — the smart controller |
| `scripts` | `<<cli>>` | files `.mjs`, `.js` — the entry points |
| `input/controllers` | `<<ctrl>>` | files `.js` — engine-injected client controllers |
| `input/templates` | `<<view>>` | dir — Handlebars layouts + partials |
| `static/assets` | `<<asset>>` | dir — stylesheet, client JS, brand images |
| `content/dumps` | `<<content>>` | dir — the dumps themselves |

The set lives in `DRAWERS` at the top of the linter. Add a directory there when a
new first-party tree appears, and draw its block.

## Linted idioms (T1–T6)

The linter pins these; every new brick or arrow must obey them.

- **T1** — a brick's stereotype equals its drawer's stereotype (exempt: `<<ext>>`).
- **T2** — a drawer's title first line is exactly the directory path.
- **T3** — numbered **call** arrows carry a `[[file#symbol]]` link; **returns carry no link**.
- **T4** — the step number is the label's first token: `N ·` for a call,
  `N ⟵` for a return.
- **T5** — a link's `#symbol` must be declared in the target file.
- **T6** — returns use `..>` and `⟵`.

## The linter

`scripts/workflow-arrows-lint.mjs`, pure `lintDiagram({ text, pumlDir, repoRoot })`.
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
- `====` draws a divider inside a `package` title; `--` draws one inside a
  `component` body.
- **Add a module → add a brick** — otherwise a code drawer fails file coverage.
- `npm run workflow-arrows:svg` injects the **hover block**: the whole arrow lights up
  (line, head, label) in the `.puml`'s `skinparam pathHoverColor` colour, and lingers
  ~5s after the pointer leaves — so a long arrow stays lit while you scroll to its far
  end. It shows only in a CSS-capable viewer (a browser), never in PNG or an IDE
  preview. The committed `.svg` must carry the block (pinned by KDV-CI-21).
- **Commit `.puml` and `.svg` together** — source and render are one artifact.

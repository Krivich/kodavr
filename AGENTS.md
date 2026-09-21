# AGENTS.md — kodavr

Instructions for agents (and humans) working with this repository.

## What this is

<One paragraph: what the project does. To be filled in.>

## Language

Don't rewrite existing text in the repo's current language — that's churn, not value. NEW
content (code comments, doc additions, commit messages) goes in the language agreed for
the project. Human-facing UI strings keep their current language.

**UI copy is multilingual — change one key, change every locale.** Human-facing strings live
in the per-locale bundles `scripts/lib/i18n-{en,ru,zh-Hans,es}.mjs` (English is the source; the
English side is `scripts/lib/copy.mjs` + `i18n-en.mjs`), and all bundles must keep an IDENTICAL
key set. When you add, edit or remove a string, update ALL four bundles in the same change;
`assertComplete` / `npm test` / `npm run req` fail on drift. Dump bodies are never translated.

## Terminology (accumulate, don't invent new)

The full glossary is **AGENTS/domain-model.md**: runtime product terms + our own
development terms. New terms are accumulated there; the section grows as work proceeds.

## Philosophy and values

1. **TDD is mandatory.** Red → green: the contract is fixed by a test before implementation.
   Regressions are caught by the suite, not by hope. A commit without a green `npm test` is not allowed.
2. **Declarativeness.** An extension point is a file (md/json/a registry row), not code, wherever possible.
3. **Act only with explicit consent.** Irreversible actions go through gates and human
   confirmation; read-only autonomy is a separate requirement, not a default right.
4. **Fail-visible.** A broken verdict, a model/integration error, an unknown format — a visible
   error or alert, never silent swallowing.
5. **One truth per entity.** Every fact lives in one place; during migrations old sources are deleted.
6. **Security always.** Escape user/external input, keep secrets out of the repository,
   never delete human work silently.
7. **Mechanism, not plea.** A weak model does not obey prose prohibitions — we hold the contract
   with deterministic code and schema grammar (gates, guards), not with wording in a prompt.
8. **A bug is a symptom of a class.** Formulate a live case as a class of problems and fix it
   systematically all at once; hardcoding a symptom (one `if` for the case) is not a fix. If
   "model weakness" is the diagnosis — first prove it is not the prompt confusing it.
9. **Extend the flow, don't route around it.** A feature is woven into the existing flow that
   owns its concern — never a parallel path that bypasses the common step. Read the flow map
   (`AGENTS/workflow-arrows.md`) before changing a part.
10. **Sketch before a UI/UX batch.** Where a UI/UX change admits more than one reasonable
    reading, the agent first proposes a cheap sketch of the whole batch — text/ASCII, a copy
    mock, a static page, covering the human-facing copy too — and gets it approved. Only then
    does the implementation chain run unattended against an approved surface. An approved but
    wrong sketch costs one message; an implemented but wrong batch costs rework and
    re-verification of everything built on top of it.

## Requirements registry — AGENTS/requirements.md

`REQUIREMENTS.md` is the single registry (stable `KDV-<GROUP>-NN` IDs + tests;
`docs/ideas/` holds raw material and verdicts). **The file can grow large — do not read it whole:**
find rows with `Grep`, read a region with `Read`, check coverage with `npm run req`
**before every commit**. Maintenance protocol — **AGENTS/requirements.md**.

## TDD cycle for a typical change

1. **Contract.** Define the requirement/extend an existing one, add the ID to the registry.
2. **Red.** A test with the ID in its title; run it — it fails.
3. **Green.** Implement with the minimal change; all consumers of the contract are updated.
4. **Suite + registry.** The whole suite and `npm run req`; fix the summary table if statuses changed.
5. **Commit.** The message is a one-line "story" (what — how/why — edge cases),
   with requirement IDs in parentheses after the essence.

## Structure

### Maps — on demand (AGENTS/code-map.md)

Module maps and "Hot zones" live in **AGENTS/code-map.md**: so as NOT to walk files in a row,
take a zone from the map and make ONE targeted read of the needed region (offset/limit).

### Flow map — `docs/workflow-arrows.puml` (AGENTS/workflow-arrows.md)

The linted map of the code tree and the numbered cross-cutting flow. Read it before
changing a part so you extend the flow that already exists instead of adding a parallel
path around it. How to read / maintain / lint / render — **AGENTS/workflow-arrows.md**;
the drift alarm is `npm run workflow-arrows:lint` (silent, exit 0 when clean).

## Tools (dev) — AGENTS/tools.md

Full rules, protocols and hard caveats for every development tool live in
**AGENTS/tools.md**; here there is only a list with the essence.

## STATE.md — "what we're doing now" checkpoint (NOT a product journal)

- `STATE.md` in the root (untracked) is maintained by the agent: uncommitted changes, the current
  batch, the next step, flakes. **Read it first** in a new session and **update it at the end of
  every batch** — it is insurance against a sudden compaction, NOT a release history (git remembers
  that). Keep the head tiny: if it grows — move the excess below the marker/into the archive.
- **Diet**: the marker `<!-- ARCHIVE:BELOW -->` separates the head (current state) from the
  chronicle; once a batch is finished — `npm run state:diet` (the chronicle moves to
  `docs/history/state.md`, new archives on top). Keep only "now" in the head.
- **Link with compaction**: on compaction context-sentinel writes the mechanical checkpoint
  `.opencode/CHECKPOINT-*.md` (verbatim last human posts + todo + touched files)
  and appends the model digest to `STATE.md` BELOW the marker. The sentinel names the fresh
  checkpoint path in a toast and injects it into the context — record it in the head of `STATE.md` as a durable pointer.

### Recovery protocol — after a session start or a compaction

1. **STATE.md head only** (above the `<!-- ARCHIVE:BELOW -->` marker; read with a line limit).
2. **Fresh compaction checkpoint**: if a compaction just happened — read
   `.opencode/CHECKPOINT-*.md` (the sentinel names the file in a toast and injects its path):
   verbatim last human posts, todo, touched files — do not reconstruct them by walking around.
3. **Take the task zone from the map** — **AGENTS/code-map.md**: one targeted read of the needed region.
4. **Overview walks are forbidden**: bulk reads of whole files and chains of
   grep→read→re-read after a compaction are a waste of tokens on reconstructing what
   the map already knows.

## Context machine — how it works (AGENTS/context-machine.md)

Start: system prompt = base + compact summary + **AGENTS.md** (digest with pointers);
`AGENTS/*`, `REQUIREMENTS.md`, `STATE.md`, `docs/*` — on demand.
**Compaction** (context-sentinel): toast at 70/85% → checkpoint → `/compact`; the mechanical
checkpoint is always written; the digest is validated. **Delegation**: a heavy step goes to a
subagent with a fresh context, the root keeps the vision. Details and motivation —
**AGENTS/context-machine.md** (read on demand, not at start).

## Cleanup (self-cleaning) — "clean up after yourself"

Files read at start (AGENTS.md) and checkpoints must not grow. When a batch is finished:
- `npm run state:diet` — the STATE.md head = only "now".
- `AGENTS.md` — a digest. Do not append chronicles or process notes to it: they belong in
  `STATE.md`/`docs/`, not in the start prompt.
- Compaction checkpoints `.opencode/CHECKPOINT-*.md` are ephemeral: after a compaction only the
  fresh one is needed; delete the old ones.
- Keep one-off dumps/probes only while needed for a debrief; the rest — to `docs/history/` or gone.
- Rule: **what is read at start does not grow**; only what is read on demand grows.

## Tool-call traps (battle-tested)

- Send long command output to a file (`… > "$env:TEMP\out.txt"` / `> /tmp/out.txt`),
  then parse it with a script; inline scripts with complex quotes/unicode break —
  write temporary script files.
- Do not do string replacements in files with shell means (like PowerShell `-replace`) —
  they silently corrupt Cyrillic/EOL; use node scripts or the Edit tools.
- A full suite run may take a minute; rerun known flakes separately before fixing them.
- Git: only `git add <specific files>`; the tree contains the human's untracked files —
  `git add -A` pulls them into the commit.
- Bulk deletes: `Get-ChildItem -Include` without `-Recurse` and without a wildcard in the path
  selects EVERYTHING in the directory (PowerShell 5.1). Print the selection count first and delete
  through an explicit `-Filter`/wildcard path (`...\dm-*.cjs`), never a folder-wide sweep.

## Commands

```bash
npm test                   # whole suite
npm run req                # reconcile test IDs with the requirements registry
npm run contract           # contract headers ↔ module index (AGENTS/code-map.md)
npm run state:diet         # STATE.md chronicle → docs/history/state.md
npm run workflow-arrows:lint  # workflow-map drift alarm (silent when clean)
```

## What not to do

- Do not commit personal data/keys.
- Do not edit generated files — edit the generation source.
- Do not add dependencies without an explicit need.
- Do not tighten/loosen security without a separate discussion.

## DELEGATION MODE — see AGENTS/delegation-mode.md

Delegation mode is **root-session only**; subagents (`worker`, `worker-lite`,
`explore`) ignore it. It is enabled by a human phrase ("delegation mode" …);
when enabled, read **AGENTS/delegation-mode.md** and follow the protocol (roles, cycle,
model selection, brief template, context discipline). The canonical master is
`~/.config/opencode/templates/delegation-mode.md`.

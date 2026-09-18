# The requirements machine: stable IDs, coverage checks and an idea process for agent-driven code

This is a self-contained setup guide for the **requirements-management** half of a
long-session OpenCode configuration: a single registry of obligations with stable IDs
and a test per requirement, a coverage check that reconciles every test with the
registry, and an idea process that turns a raw brainstorm into grounded, testable
requirements. It is one of two companion dumps. The other, *The agent-control loop* —
https://kodavr.xyz/dumps/2026-09-18-opencode-agent-control/ — installs the global OpenCode
loop, the root `AGENTS.md` digest that points at this registry, and the `STATE.md`
checkpoint; applied together, the two reproduce the combined `context-machine-setup` guide.

*Inspiration: the requirements-management machine was inspired by the Telegram channel
**LLM Under the Hood** — [https://t.me/llm_under_hood](https://t.me/llm_under_hood).*

All files are stripped of the original project's specifics and given in an initial
empty state — the mechanisms work, domain data is empty. Paths: `~` = the user's home
directory (`C:\Users\<name>` on Windows), `<project>` = the root of your repository.

## 0. The knowledge-drift problem

Long agent sessions fail a fifth way: knowledge drifts. An obligation agreed in one
session is forgotten or re-litigated in the next; an idea is mistaken for design; the
same requirement gets two homes and the two homes diverge. The machine binds the
obligations to one place:

*   **Obligations live in the `REQUIREMENTS.md` registry** — stable IDs plus a test per requirement. `npm run req` reconciles test IDs with the registry before every commit.
*   **Current state lives in the head of `STATE.md`** — a checkpoint, not a chronicle. `STATE.md` itself is installed by the agent-control companion dump; this dump only relies on it.
*   **Ideas and verdicts live in `docs/ideas/`** — raw brainstorms are hypothesis generators, never design; only grounded branches are minted into registry rows.

Everything read at startup stays a pointer and does not grow.

**Core principles (the requirements side):** TDD is mandatory (the contract is fixed
by a test before implementation); declarativity (an extension point is a file or a
registry row, not code); one truth per entity (after minting, the registry owns the
contract, not the idea doc); fail-visible (a typo'd ID or a ✅ row without a test fails
the coverage check); mechanism not a request (the coverage script holds the contract,
not a note in the prompt).

## 1. File tree (requirements side)

```text
<project>/
 ├── REQUIREMENTS.md                        # single registry: stable IDs + statuses + test links
 ├── package.json                           # adds the `req` script (base installed by the agent-control dump)
 ├── AGENTS.md                              # digest: the registry pointer + TDD cycle live here (base)
 ├── AGENTS/
 │   └── requirements.md                    # registry maintenance protocol (this dump)
 ├── scripts/
 │   └── req-coverage.js                    # reconcile test IDs with the registry (this dump)
 └── docs/
     └── ideas/                              # raw brainstorms and their verdicts
         ├── README.md                      # idea lifecycle (this dump)
         └── idea-TEMPLATE.md               # brainstorm dump template (this dump)
```

`package.json`, `AGENTS.md` and `.gitignore` come from the base agent-control dump; this
dump adds the registry, its maintenance protocol, the coverage tool and the idea process.

## 2. Installation order

1. Apply the companion agent-control dump first — it installs the global loop, the root `AGENTS.md` digest, `STATE.md` and `package.json`.
2. Create `REQUIREMENTS.md` (§4.5).
3. Add `scripts/req-coverage.js` (§4.3) and the `req` npm script (`"req": "node scripts/req-coverage.js"`).
4. Add the maintenance protocol `AGENTS/requirements.md` (§4.9) and keep the registry pointer plus the TDD cycle in `AGENTS.md` (the two sections reproduced under §4.7 below).
5. Seed the idea process: `docs/ideas/README.md` and `docs/ideas/idea-TEMPLATE.md` (§4.15, §4.16).
6. Verify: `npm run req` exits 0 on the empty registry.

If you are applying only this dump, make sure steps 1 and 4 hold: `AGENTS.md` must carry
the two sections in §4.7, and `package.json` must have the `req` script.

## 3. The registry

### 4.7 `<project>/AGENTS.md` — the two sections this dump relies on

The base digest (`AGENTS.md`) carries the registry pointer and the TDD cycle. They are
reproduced here because every requirement change depends on them; the full file is
installed by the companion agent-control dump.

## Requirements registry — AGENTS/requirements.md
`REQUIREMENTS.md` is the single registry (stable `<PREFIX>-<GROUP>-NN` + tests;
`docs/ideas/` — raw material and verdicts). **The file can grow large — do not read it entirely:**
search with `Grep` by requirement strings, read the region with `Read`, coverage — `npm run req`
**before every commit**. Maintenance protocol — **AGENTS/requirements.md**.

## TDD cycle for a typical change
1. **Contract.** Define a requirement/extend an existing one, add ID to the registry.
2. **Red.** Test with ID in the title; run — it fails.
3. **Green.** Implementation with minimal change; all contract consumers updated.
4. **Suite + registry.** Entire suite and `npm run req`; fix the summary table if statuses changed.
5. **Commit.** Message — one-line "history" (what — how/why — edge cases),
   requirement IDs in parentheses after the essence.

### 4.5 `<project>/REQUIREMENTS.md` (empty registry)

```markdown
# <project> — Requirements

Source: [docs/design.md](docs/design.md). Every requirement has a **stable ID**.

> **Maintenance protocol, structure, tools, and recipes — [AGENTS/requirements.md](AGENTS/requirements.md).**
> This is the base (registry body). The file can grow large — do not read it entirely without need;
> search with `Grep` by requirement strings, read the region with `Read`, coverage — `npm run req`.

---

## <Group 1> (§…)
- ⬜ **<PREFIX>-<GROUP1>-01**: <formulation — one testable line>. *(tests will appear during implementation)*

## <Group 2> (§…)
- ⬜ **<PREFIX>-<GROUP2>-01**: <formulation>.

---

## Summary
| Group | Total | ✅ | 🟧 | ⬜ | ⛔ |
|---|---|---|---|---|---|
| <Group 1> | 1 | 0 | 0 | 1 | 0 |
| <Group 2> | 1 | 0 | 0 | 1 | 0 |
| **Total** | **2** | **0** | **0** | **2** | **0** |
```
Format rules: requirement = exactly one line `- <status> **ID**: formulation. *(links/tests)*`; statuses ✅ has test · 🟧 partial · ⬜ none · ❓ concept; canceled — `DEPRECATED` (ID preserved); summary updated in the same commit.

### 4.9 `<project>/AGENTS/requirements.md`

```markdown
# requirements — requirements registry protocol

> **Base (body): `REQUIREMENTS.md`**. The file can grow large (~tens of KB and above).
> Do not read it entirely without need. Here is how the base is structured, how to read and edit it.

## How the base is structured
- **Groups** — `## ` headers.
- **Requirement** — exactly **one line**: `- <status> **<PREFIX>-<GROUP>-NN**: formulation. *(links/tests)*`.
- **ID** — `<PREFIX>-<GROUP>-NN`, stable (see "Maintenance rules").
- **Statuses**: ✅ has test · 🟧 partial · ⬜ none · ❓ concept (not directly testable); `DEPRECATED` — canceled.
- **"Summary"** at the end — table of groups × statuses (maintained manually: number of lines = fact).
- **Ideas** — `docs/ideas/` (raw material + verdicts).

The format is line-based and greps perfectly: every requirement line starts with `-`. Search with `Grep`.

## Size — warning
It is justified to read it entirely only for complex tasks (full analysis of a new idea). Otherwise —
pointedly: `Grep` by keys/IDs → `Read` of the needed region (`offset/limit`).

## Tools
- `npm run req` (`scripts/req-coverage.js`) — reconcile IDs from tests with the registry; exit 1 on
  typos/unknown IDs. **Before every commit.**
- `Grep` over `REQUIREMENTS.md` — candidate lines (ID + status + text), without reading the file.
- `Read` (`offset/limit`) — one region / group / line entirely.

## Recipes

### Bug → reconcile with registry
1. Symptom → keywords (entity, command, area).
2. `Grep` the registry → candidates.
3. `Read` narrow region — full text of the requirement.
4. `npm run req` + `Grep` over tests — coverage and where the regression lives.
5. Solution: regression (same ID + new test) / coverage gap (`✅` without test — anomaly) /
   not yet implemented (`⬜`/`🟧`) / **new requirement**.

### New idea (`idea-*.md`) → flat requirements
1. Read the idea itself (this is the human's input).
2. For each point — `Grep` related/conflicting requirements (candidates).
3. Conflict (idea X ↔ requirement ¬X) — **agent's judgment**, not the tool's.
4. New points → **flatly**: one requirement = one testable formulation; status ⬜;
   ID — next `NN` of the group.
5. Idea verdict — by `docs/ideas/README.md`.

## Maintenance rules
1. **IDs never change**: we do not rename, renumber, or delete them.
   Exception — a conscious human decision: registry, tests, and docs are renamed in ONE
   synchronous commit.
2. `REQUIREMENTS.md` is the **single registry**: stable ID + formulation + status + links to tests.
3. New requirement → new ID at the end of its group; line with status ⬜ (or ✅ immediately,
   if the test is written in this same change).
4. Canceled requirement → marked `DEPRECATED`, ID preserved.
5. **Every test must reference the requirement ID as the first word of the title**:
   `it('<PREFIX>-LLM-04: keys never reach the browser')`. A test without an ID is an overview error;
   an ID without a test — the requirement must not be ✅.
6. One test can cover multiple requirements: `it('<PREFIX>-LLM-04 + <PREFIX>-SEC-01: ...')`.
7. Status in the file is updated in the same commit as the test.
8. When adding — update the summary table at the end of the base.
9. Refactoring that changes behavior covers existing IDs; new requirements — new IDs.
```

## 4. Coverage tool

### 4.3 `<project>/scripts/req-coverage.js`

Reconciling test IDs with the registry (run before every commit): exit 1 on typos, unknown IDs, and "✅ without a test".

```javascript
#!/usr/bin/env node
// scripts/req-coverage.js — reconcile requirement IDs between REQUIREMENTS.md and tests.
// Exit 1 on: an ID used in a test but absent from the registry; a ✅ row with no test.
// Prefix/suffix are project-specific: set PREFIX and TESTS_DIR below.

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const PREFIX = "WF" // ← your registry prefix
const TESTS_DIR = join(ROOT, "tests")

const registry = readFileSync(join(ROOT, "REQUIREMENTS.md"), "utf8")
const rows = [...registry.matchAll(new RegExp(`^-\\s*(✅|🟧|⬜|❓)\\s*\\*\\*(${PREFIX}-[A-Z]+-\\d+)\\*\\*`, "gm"))]
  .map((m) => ({ status: m[1], id: m[2] }))

const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(test|spec)\.[cm]?[jt]s$/.test(name)) files.push(p)
  }
})(TESTS_DIR)

const tested = new Set()
for (const f of files) {
  for (const m of readFileSync(f, "utf8").matchAll(new RegExp(`${PREFIX}-[A-Z]+-\\d+`, "g"))) tested.add(m[0])
}

const known = new Set(rows.map((r) => r.id))
const problems = []
for (const id of [...tested].sort()) if (!known.has(id)) problems.push(`test uses unknown ID: ${id}`)
for (const r of rows) if (r.status === "✅" && !tested.has(r.id)) problems.push(`✅ without a test: ${r.id}`)

if (problems.length) {
  console.error("req-coverage FAILED:\n  " + problems.join("\n  "))
  process.exit(1)
}
console.log(`req-coverage OK (${rows.length} rows, ${tested.size} IDs tested)`)
```

## 5. The idea process

### 4.15 `<project>/docs/ideas/README.md`

```markdown
# docs/ideas/ — raw brainstorm dumps and their verdicts

## What these files are
Each file here is an unloading of a wide discussion (a "mindmap"): the human brings a seed
("what if..."), the discussion spreads it across pains, cases, value and candidate
contracts, and everything is dumped into an `idea-*.md` file. These documents are
**hypothesis generators, not design** — their facts about the real system are unverified
and often wrong. Their value is coverage, not accuracy.

**Start every new dump from [idea-TEMPLATE.md](idea-TEMPLATE.md)** — the skeleton with the
hard-won rules baked in (append-only branches, the «Ground» section, per-branch verdicts in
the Status tail, anti-patterns).

## Active
<empty for now — list of active ideas with their status>

## The lifecycle (mindmap → code → registry)
1. **Raw dump.** A new `idea-*.md` lands here with a status header saying it is raw and
   unverified. No requirement exists yet.
2. **Grounding.** Any branch taken into work must be checked against the REAL code first —
   what exists, what the pipeline actually does, which invariants would block it. Expect to
   reject items as factually wrong.
3. **Minting.** A grounded idea becomes an **ID row in the registry** (`REQUIREMENTS.md`)
   with a red test written first (TDD) — the working protocol lives in
   [AGENTS/requirements.md](../../AGENTS/requirements.md). After minting, the idea doc is
   no longer the source of truth for that branch — one truth per entity; the registry row +
   its test carry the contract.
4. **Verdicts stay in the doc.** Every branch that is NOT minted gets an explicit verdict in
   the doc's `Status`/disposition tail:
   - **rejected** — with the reason (false premise, conflicts with a value or invariant,
     costs more than it returns);
   - **deferred** — with the return condition (which brick/blocking must land first).
   Rejected "chaff" is NEVER pulled into the registry: no ID, no status churn — the doc
   keeps the reasoning so nobody (human or agent) re-litigates the same idea from scratch.
5. **Re-taking is fine.** A deferred or partially-minted doc may feed new IDs later; the
   Status tail honestly shows what was taken, when, and as what.

## Rules of thumb
- The registry holds obligations only; this folder holds exploration and verdicts. Don't
  mirror registry rows here beyond pointers.
- A mindmap's internal numbering (5.1, 7.3 …) is local to the doc — quote it as
  "contract 5.2 review", never as a registry ID.
- The verdict language: a short, honest sentence beats a taxonomy. When in doubt —
  rejected-with-reason is the safer default; a minted row is a promise to keep a test green
  forever.
```

### 4.16 `<project>/docs/ideas/idea-TEMPLATE.md`

```markdown
# <topic>-idea

**Status:** raw dump — facts about the system are NOT verified
**Origin:** dump from discussion, <date>; seed: "<initial human formulation>"

> **File rule: APPENDED, NOT EDITED.** Branch addresses are eternal anchors
> (2.4.3 lives forever). Source errors are not erased — the discrepancy "mindmap vs ground"
> is valuable in itself; the history of decisions is read as a protocol, not as a
> retroactively rewritten plan.

## Mindmap

### 0. Ground (filled on the FIRST analysis — before hypotheses)
- 0.1 Code mechanics the idea touches (files/modules/invariants — by fact, with paths;
  "seems" does not live here).
- 0.2 Existing requirements (with IDs) that block or help.
- 0.3 Connections with other ideas in this folder.
- 0.4 Target slicing group.

### 1. Pain
Every statement about the current system is a hypothesis, mark it `[needs ground]` if not verified.
Pain is formulated by the HUMAN, not the model.

### 2. Dependencies (blockers — verify on the ground!)

### 3. Cases (1–3 real user scenarios)
Cases are the main tool for convergence: a real scenario closes forks that
abstract branches chew on endlessly.

### 4. Value

### 5. Resolved (contracts, do not re-resolve)
Formulations-obligations. When slicing, they are cut into IDs with a test; after minting, the source
of truth is the registry, not this file.

### 6. Open questions (closing — by a new branch with a link)
Closed question = new branch linking to the old one; do not edit the old one.

### 7+. Hypotheses (candidates for moving to a separate idea — mark immediately)

## Entry point for the agent (take into work only by explicit command)
1. Read the doc entirely; "Resolved" branches — contracts, do not re-resolve.
2. Fill/verify the "Ground" against the real code and registry.
3. The agent proposes requirement and test variants; the word "we take it" — the human's.
4. Verdicts — in the Status tail; code — only after explicit command.

## Status (verdicts by branches — tail, appended, never rewritten)
- **Accepted:** <branch> → <ID> (<date>)
- **Rejected:** <branch> → <why, in one honest sentence>
- **Deferred:** <branch> → <return condition: what brick/blocking is needed>

---

## Anti-patterns (what killed past runs — do not repeat)
- Fact about code without path/ID → eternal false branch ("raw material without ground gives false anchors").
- Retelling a closed branch instead of linking → duplication of meaning, registry swells.
- Duplicate ID when throwing in — check the registry, not memory.
- File rules are stricter than the owner's will — human changes the process, file follows.
- Hypotheses not marked "candidate for moving out" are eaten into the slice and generate garbage requirements.
```

## 6. Smoke test / verification

*   **Empty registry:** `npm run req` — exit 0 on the empty registry (no tests yet).
*   **Red → green:** add one requirement (status ⬜) and a test with its ID in the title; the test fails; implement; the row may be flipped to ✅ only in the same commit as its green test.
*   **Fail-visible:** use a test ID that is absent from the registry, or a ✅ row without a test — `npm run req` must exit 1 with the offending IDs named.

## 7. Operational protocols (briefly)

*   **Bug → reconcile with the registry** (full recipe in §4.9): symptom → keywords; `Grep` the registry → candidates; `Read` the narrow region; `npm run req` + `Grep` over tests; then decide — regression (same ID + new test), coverage gap (✅ without test — anomaly), not yet implemented (⬜/🟧), or a new requirement.
*   **New idea → flat requirements** (full recipe in §4.9): read the idea; `Grep` related/conflicting requirements; make the conflict call as an agent, not the tool; mint every new point as one testable row with the next `NN` of its group and status ⬜; record the verdict per `docs/ideas/README.md`.
*   **What the agent will fill over time (empty now):** `REQUIREMENTS.md` (requirement lines) and `docs/ideas/` (ideas and verdicts).

## Companion dump

This dump works in tandem with *The agent-control loop* —
https://kodavr.xyz/dumps/2026-09-18-opencode-agent-control/ — the companion dump that
installs the global OpenCode loop, the compaction sentinel and the lazy layers. Applied
together, the two reproduce the combined `context-machine-setup` guide in full.

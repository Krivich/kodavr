# requirements — requirements registry protocol

> **The base (body): `REQUIREMENTS.md`**. The file can grow large (tens of KB and more).
> Do not read it whole without need. This file describes how the base is shaped and how to read and edit it.

## How the base is shaped

- **Groups** — `## ` headings.
- **Requirement** — exactly **one line**: `- <status> **<PREFIX>-<GROUP>-NN**: formulation. *(references/tests)*`.
- **ID** — `<PREFIX>-<GROUP>-NN`, stable (see "Maintenance rules").
- **Statuses**: ✅ tested · 🟧 partial · ⬜ not done · ❓ concept (not directly testable); `DEPRECATED` — cancelled.
- **"Summary"** at the end — a groups × statuses table (maintained by hand: row count = fact).
- **Ideas** — `docs/ideas/` (raw material + verdicts).

The format is line-based and greps perfectly: every requirement line starts with `-`. Find them with `Grep`.

## Size — a warning

Reading it whole is justified only for complex tasks (a full analysis of a new idea). Otherwise —
targeted: `Grep` by keywords/ID → `Read` of the needed region (`offset/limit`).

## Tools

- `npm run req` (`scripts/tooling/quality-gates/req-coverage.js`) — reconcile IDs from tests with the registry; exit 1 on
  typos/unknown IDs. **Before every commit.**
- `Grep` over `REQUIREMENTS.md` — candidate lines (ID + status + text), without reading the file.
- `Read` (`offset/limit`) — one region / group / line in full.

## Recipes

### Bug → reconcile with the registry

1. Symptom → keywords (entity, command, area).
2. `Grep` the registry → candidates.
3. `Read` a narrow region — the full text of the requirement.
4. `npm run req` + `Grep` the tests — coverage and where the regression lives.
5. Decision: regression (same ID + new test) / coverage hole (`✅` without a test — an anomaly) /
   not implemented yet (`⬜`/`🟧`) / **a new requirement**.

### New idea (`idea-*.md`) → flat requirements

1. Read the idea itself (this is the human's input).
2. For each point — `Grep` related/conflicting requirements (candidates).
3. A conflict (idea X ↔ requirement ¬X) is an **agent's judgement**, not a tool's.
4. New points → **flat**: one requirement = one verifiable formulation; status ⬜;
   ID — the next `NN` of the group.
5. The idea's verdict — per `docs/ideas/README.md`.

## Maintenance rules

1. **IDs never change**: we do not rename, renumber, or delete them.
   The exception is a deliberate human decision: registry, tests and docs are renamed in ONE
   synchronous commit.
2. `REQUIREMENTS.md` is the **single registry**: stable ID + formulation + status + links to tests.
3. A new requirement → a new ID at the end of its group; a line with status ⬜ (or ✅ at once,
   if the test is written in the same change).
4. A cancelled requirement → marked `DEPRECATED`, the ID is preserved.
5. **Every test must reference the requirement ID as the first word of its title**:
   `it('<PREFIX>-LLM-04: keys never reach the browser')`. A test without an ID is a review error;
   an ID without a test means the requirement must not be ✅.
6. One test may cover several requirements: `it('<PREFIX>-LLM-04 + <PREFIX>-SEC-01: ...')`.
7. The status in the file is updated in the same commit as the test.
8. When adding — update the summary table at the end of the base.
9. A refactoring that changes behavior covers existing IDs; new requirements — new IDs.
10. **Draft until the first commit (the one window where rule 1 is relaxed).** An uncommitted
    change is a draft, not a log: reworking the same concern edits its row in place (no new ID);
    a requirement that died while polishing is deleted together with its tests — `DEPRECATED` is
    for contracts that already shipped; a genuinely new concern appends a new `NN`. An ID that
    never left the working tree may be reused; once the change is committed it is frozen.

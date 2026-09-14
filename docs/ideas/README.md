# docs/ideas/ — raw brainstorm dumps and their verdicts

## What these files are

Each file here is an unloading of a wide discussion (a "mindmap"): the human brings a seed
("what if…"), the discussion spreads it across pains, cases, value and candidate
contracts, and everything is dumped into an `idea-*.md` file. These documents are
**hypothesis generators, not design** — their facts about the real system are unverified
and often wrong. Their value is coverage, not accuracy.

**Start every new dump from [idea-TEMPLATE.md](idea-TEMPLATE.md)** — the skeleton with the
hard-won rules baked in (append-only branches, the "ground" section, per-branch verdicts in
the Status tail, anti-patterns).

## Active

<empty for now — a list of active ideas with their status>

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
   Rejected chaff is NEVER pulled into the registry: no ID, no status churn — the doc
   keeps the reasoning so nobody (human or agent) re-litigates the same idea from scratch.
5. **Re-taking is fine.** A deferred or partially-minted doc may feed new IDs later; the
   Status tail honestly shows what was taken, when, and as what.

## Rules of thumb

- The registry holds obligations only; this folder holds exploration and verdicts. Don't
  mirror registry rows here beyond pointers.
- A mindmap's internal numbering (5.1, 7.3 …) is local to the doc — quote it as
  "review contract 5.2", never as a registry ID.
- The verdict language: a short, honest sentence beats a taxonomy. When in doubt —
  rejected-with-reason is the safer default; a minted row is a promise to keep a test green
  forever.

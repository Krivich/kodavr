# <topic>-idea

**Status:** raw dump — facts about the system are NOT verified
**Origin:** unloaded from a discussion, <date>; seed: "<the human's original wording>"

> **File rule: APPEND, DO NOT EDIT.** Branch addresses are permanent anchors
> (2.4.3 lives forever). Source errors are not overwritten — a "mindmap vs ground"
> divergence is itself value; the history of decisions reads as a protocol, not as a
> plan rewritten after the fact.

## Mindmap

### 0. Ground (filled on the FIRST smoke-through — before hypotheses)

- 0.1 Code mechanics the idea touches (files/modules/invariants — per fact, with paths;
  "it seems" does not live here).
- 0.2 Existing requirements (with IDs) that block or help.
- 0.3 Links to other ideas in this folder.
- 0.4 Target slice group.

### 1. Pain

Every statement about the current system is a hypothesis; mark `[needs ground]` if unverified.
Pain is formulated by the HUMAN, not the model.

### 2. What it depends on (blockers — verify against the ground!)

### 3. Cases (1–3 real user scenarios)

Cases are the main tool of convergence: a real scenario closes forks that abstract branches
chew on endlessly.

### 4. Value

### 5. Decided (contracts, do not re-decide)

Commitment formulations. When slicing, they are cut into IDs with a test; after minting the
source of truth is the registry, not this file.

### 6. Open questions (closing one — a new branch with a reference)

A closed question = a new branch referencing the old one; do not edit the old one.

### 7+. Hypotheses (mark candidates for spinning out into a separate idea immediately)

## Entry point for the agent (take into work only on an explicit command)

1. Read the whole doc; "Decided" branches are contracts — do not re-decide.
2. Fill in/verify "Ground" against the real code and registry.
3. The agent proposes requirement and test options; the word "take it" is the human's.
4. Verdicts — into the Status tail; code — only after an explicit command.

## Status (per-branch verdicts — a tail, appended, never rewritten)

- **Accepted:** <branch> → <ID> (<date>)
- **Rejected:** <branch> → <why, in one honest sentence>
- **Deferred:** <branch> → <return condition: which brick/blocking is needed>

---

## Anti-patterns (what killed past runs — do not repeat)

- A fact about the code without a path/ID → an eternal false branch ("raw material without
  ground produces false anchors").
- Retelling a closed branch instead of referencing it → duplicated meaning, the registry bloats.
- Duplicate ID when adding — check against the registry, not memory.
- File rules stricter than the owner's will — the human changes the process, the file follows.
- Hypotheses not marked "candidate for spinning out" get pulled into slicing and produce junk requirements.

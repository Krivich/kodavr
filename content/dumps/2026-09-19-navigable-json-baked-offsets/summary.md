# Navigable JSON (.njson) — a short brief

## What this is

A data format for the specific way AI agents read: sequentially, so a document
with a hundred records makes the agent pay for all hundred even when it needs
one. Navigable JSON (`.njson`) is still ordinary JSON, but it carries **byte
offsets baked in at build time**. A reader makes a read-or-skip decision from a
short header and then **jumps over the bodies it does not need**. Selection cost
drops from "read the whole corpus" to "read the headers on the path plus the one
matched body."

## What a reader's agent can reuse

- The format definition: two primitives only — a **sibling jump** (`no`/`nl`)
  and a **descent** (`bo`/`bl`/`bhl`). Every offset is an absolute byte position
  from the file start, so a descent costs no arithmetic; it is the same
  `read <size> at <offset>` as a jump.
- A complete reference implementation in JavaScript: an **iterative linker**
  (offsets depend on the digits of the offsets, so it re-runs until stable) and a
  **reader** that needs only a byte-range read tool — no AI required.
- A JSON Schema for the format.
- A worked example: a real 5-record index with **live baked offsets**, plus how
  to verify it by hash.

## The part that makes it work, and the honest caveats

- Offsets bind to **exact bytes**, so the format pins one canonical
  serialization style (here, `JSON.stringify(value, null, 2)`) and pins the file
  by hash. Any reflow or "tidy" pass invalidates the numbers; re-link after every
  change.
- The format was **tested by putting real files next to a small model** and
  recording every read it made. Two failures are documented: the model wasting
  reads in round chunks until the protocol demanded exact sizes, and an earlier
  design whose relative offsets forced the model to do arithmetic. That is why
  offsets are global.
- The example `.njson` is **larger on disk** than the flat file it replaces
  (it embeds the schema inline); the saving is in what a reader *touches*, not in
  file size, and it grows with scale.

## Watch out for

- This is an early format (`experimental`). The reference reader uses brace
  balancing and assumes no `{`/`}` inside navigation strings.
- The offsets in the article are live for the exact canonical bytes shown; if
  you reformat the listing, they no longer apply. Verify with the published
  digest before trusting them.

# Navigable JSON as a Turing Machine — a short brief

## What this is

A follow-up to the Navigable JSON (`.njson`) format. The earlier case showed an
agent can **jump over** the record bodies it does not need. This one asks a
sharper question: if a file can be navigated, can it also be **executed** — is
the same file a *program*, not just data?

The answer proposed here is yes, and the mapping is not invented: any structured
control flow reduces to the **Böhm-Jacopini** trio — **sequence, selection,
iteration**. `.njson` already has a sibling jump (`no`/`nl`) and a descent
(`bo`/`bl`), so all three are expressible with the primitives that already exist.
The agent's own context is the RAM: the loop counter, the accumulator, the
current offset all live in what the model is holding.

## The two orchestration patterns

- **Pattern A — the LLM is the CPU.** The model itself follows `no`, evaluates
  semantic keys, and decides where to jump next. Maximum flexibility, but every
  control-flow step costs tokens and reasoning.
- **Pattern B — the backend is the CPU, the LLM is a subroutine.** A
  deterministic backend walks the machine; the LLM is called only at genuine
  decision points and answers under **constrained decoding** (a JSON Schema), so
  it physically cannot return anything but a valid decision. Cheaper and
  auditable; the article argues this is the stronger design for control.

Both patterns ship as **runnable JavaScript** (lifted from the article by a
snippet extractor), together with a canonical linker/reader and a small
live-offset demo program.

## What the live model run actually showed

- **Comfort:** exact byte navigation with **zero** repeated reads, **zero**
  requests for offset `-1`, and **zero** out-of-range reads; the schema-guided
  decision loop was accepted and parsed cleanly.
- **Struggle:** the model tends to **flatten** the loop into its own context —
  it reads the whole program once and "runs" it mentally instead of iterating
  byte-by-byte — and it made a **reproducible off-by-one** when naming a record
  it had visited. Both are documented as failures, with the failure classes and
  proposed format fixes.

## Watch out for

- This is an **experimental** format; the control-flow argument is a mapping
  argument plus a small live run, not a proof.
- The offsets in the article are live only for the **exact canonical bytes**
  shown. Reformatting the listing invalidates them; the body pins the file by
  digest and tells you how to verify it.
- The §7 token-economy numbers are an **architecture-based hypothesis**, not
  measurements (the run was too small to measure context pressure); only the two
  Pattern-B decision token counts are real.

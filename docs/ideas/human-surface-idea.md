# human-surface-idea

**Status:** retrospect — written AFTER the batch. All seven branches were grounded against
the real code and registry and minted in the same uncommitted change; the map below records
coverage, the registry holds the obligations (this file is not the source of truth).
**Origin:** 2026-09-15; unloaded from the Human Surface v2 discussion after its seven changes
had already landed. Source: a local review of the deployed human surface, kept out of the
repository; the seven branches it distilled are listed below.

> **File rule: APPEND, DO NOT EDIT.** Branch addresses are permanent anchors
> (2.4.3 lives forever). Source errors are not overwritten — a "mindmap vs ground"
> divergence is itself value; the history of decisions reads as a protocol, not as a
> plan rewritten after the fact.

## Mindmap

### 0. Ground (filled on the FIRST smoke-through — before hypotheses)

- 0.1 Code mechanics the idea touched (verified against the working tree):
  - Human strings / copydeck: `scripts/lib/copy.mjs` (gate, brief, chip, toast, footer report).
  - One source for the four duties and the contract version: `scripts/lib/machine.mjs`
    (`AGENT_DUTIES`, `CONTRACT_VERSION`), shared by `/.well-known/kodavr.json` and the gate.
  - Optional brief: `scripts/lib/dumps.mjs` reads `summary.md` → `brief_html` with demoted
    headings; `scripts/lib/pages.mjs` wires the datasets and `FOOTER_REPORT_URL`.
  - Client state: `static/assets/site.js` — the versioned `kodavr.species` record
    `{species, contract_version, declared_at}`, migration, re-consent on a version bump,
    `announce`, the species chip and its withdraw link; controllers
    `input/controllers/dumps.js` (gate/hall/reception, one-shot toast) and `reception.js`.
  - Markup `input/templates/site/gate.hbs`, `reception-block.hbs`, `agent-lane.hbs`,
    `header.hbs`, `footer.hbs`; spec `docs/SPEC.md` §6.2–6.3, §6.5, §7.1–7.3, §7.12–7.13;
    report channel `.github/ISSUE_TEMPLATE/risk-report.md`,
    `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md` rule 12.
- 0.2 Existing requirements that block or help (all ✅ except KDV-MOBILE-06 🟧):
  KDV-SURFACE-04, -07, -13, -16, -17, -18, -19; KDV-COPY-01/-02/-03; KDV-STRUCT-02;
  KDV-A11Y-02, -03; KDV-MOBILE-01, -06, -08.
- 0.3 Links to other ideas in this folder: none yet — this is the first `*-idea.md`; the
  local review it distils is git-ignored and stays unpublished.
- 0.4 Target slice group: KDV-SURFACE with KDV-COPY (KDV-MOBILE / KDV-A11Y / KDV-STRUCT touched).

### 1. Pain

Formulated by the human about the human surface as it stood before the batch:

- The gate's first line read as a refusal ("verifying that you are not human") before a
  stranger knew what the place was; both doors read as a trap — "0" as "you lied, duties
  land on you", "1" as "you will be processed". The fear came from ambiguity ("am I allowed
  here?"), not from the declaration itself.
- Dead end for a visitor without an agent: reception said "take an agent"; a person arriving
  from a chat link had none and no next step.
- The declaration was invisible and irreversible: no visible state, no way back; and the
  real report/moderation channel existed but was invisible from the human surface.

### 2. What it depends on (blockers — verify against the ground!)

- The copydeck is the single source: every string lands in `scripts/lib/copy.mjs` and its
  `docs/SPEC.md` §7 fence, never ad-hoc in a template (KDV-COPY-01…09).
- The duties line must render from the same source as the discovery document
  (`machine.mjs`), so both signatories read one clause.
- The brief depends on the already-optional `summary.md` layer (§4.1 schema, KDV-STRUCT-02);
  the report channel on the Issue template that already exists (`risk-report.md`).
- Mobile first-screen budget: hook + lane + duties + choices must fit without scrolling
  (KDV-MOBILE-01).
- No backend, no analytics: the declaration stays client-only and is never logged
  (KDV-SURFACE-04).
- The "no JS = machine" fiction is unchanged: the gate is hidden in SSR and the body is
  readable (KDV-SURFACE-03).

### 3. Cases (1–3 real user scenarios)

1. A stranger taps a shared link on a phone: the first screen shows the hook and the agent
   lane; they press "1", read the author's brief, then send the prompt to their own agent or
   return to "0". No dead end.
2. A visitor presses "0": the duties line and the one-shot toast make the role explicit; the
   header chip shows `species: machine (declared · contract v1.0)` with a withdraw link.
3. A reader sees something wrong in a dump: the footer report link on every page opens the
   risk/takedown Issue form.

### 4. Value

- Removes the dead end — the brief is the missing next step for a visitor without an agent.
- Makes the declaration explicit, visible and reversible: consent-shaped, not quiz-shaped,
  without pretending the raw body was polished.
- Keeps machine-first: the raw body is untouched; the brief is a separate, clearly marked
  adaptation.
- One contract, two signatories: human and machine sign the same four duties in the same words.
- Makes the platform's real report channel visible on every page.

### 5. Decided (contracts, do not re-decide)

Retrospective: the registry is the source of truth, so this section only points at the rows
(one truth per entity):

- Gate copydeck v2 (hook first, kicker demoted, heading = declaration) → KDV-COPY-01,
  KDV-SURFACE-13, KDV-A11Y-02.
- Duties line rendered from `machine.mjs` → KDV-SURFACE-13, KDV-COPY-09.
- Versioned/withdrawable species record, header chip, re-consent on bump → KDV-SURFACE-04,
  KDV-SURFACE-17.
- One-shot declaration toast → KDV-SURFACE-19, KDV-A11Y-03.
- Reception's third tier: author brief + honest fallback → KDV-SURFACE-16, KDV-SURFACE-07,
  KDV-COPY-02, KDV-STRUCT-02.
- Footer report/takedown channel + Issue template → KDV-SURFACE-18, KDV-COPY-03.
- Two contours, one contract-card dialog → KDV-MOBILE-06, KDV-SURFACE-13 (contrast held per
  KDV-A11Y-05; one stylesheet per KDV-MOBILE-08).
- CONTRIBUTING rule 12 + PR checkbox → KDV-COPY-07.

### 6. Open questions (closing one — a new branch with a reference)

- Does the duties line fit the 320px first screen without pushing the 0/1 choices below the
  fold? If not, the documented fallback is the summary line above the fold and the full text
  below (tracked by KDV-MOBILE-01).
- Brief quality: an agent-written brief may be raw. It is marked as an adaptation, not a
  promise of polish; the first author PR gets manual review.
- Re-consent after a major version bump: returning visitors see the gate again — accepted,
  since the version changes only on a major break (KDV-SURFACE-04).

## Entry point for the agent (take into work only on an explicit command)

1. Read the whole doc; "Decided" branches are contracts — do not re-decide.
2. Fill in/verify "Ground" against the real code and registry.
3. The agent proposes requirement and test options; the word "take it" is the human's.
4. Verdicts — into the Status tail; code — only after an explicit command.

## Status (per-branch verdicts — a tail, appended, never rewritten)

_All seven branches were already grounded and minted when this tail was written (retrospect,
2026-09-15); the registry rows above are the contracts, this tail is the disposition record._

- **Accepted:** gate hook + duties line on the first screen → KDV-COPY-01, KDV-SURFACE-13, KDV-A11Y-02, KDV-COPY-09 (2026-09-15)
- **Accepted:** visible, withdrawable, versioned species record + header chip + re-consent → KDV-SURFACE-04, KDV-SURFACE-17 (2026-09-15)
- **Accepted:** one-shot declaration toast on entering via "0" → KDV-SURFACE-19, KDV-A11Y-03 (2026-09-15)
- **Accepted:** reception's third tier (author brief + honest fallback) → KDV-SURFACE-16, KDV-SURFACE-07, KDV-COPY-02, KDV-STRUCT-02 (2026-09-15)
- **Accepted:** footer report/takedown channel + Issue template → KDV-SURFACE-18, KDV-COPY-03 (2026-09-15)
- **Accepted:** two contours + contract-card dialog → KDV-MOBILE-06, KDV-SURFACE-13 (2026-09-15)
- **Rejected:** none — every branch was grounded and minted in the same batch; nothing was dropped.
- **Deferred:** none — every branch landed as the IDs above.

---

## Anti-patterns (what killed past runs — do not repeat)

- A fact about the code without a path/ID → an eternal false branch ("raw material without
  ground produces false anchors").
- Retelling a closed branch instead of referencing it → duplicated meaning, the registry bloats.
- Duplicate ID when adding — check against the registry, not memory.
- File rules stricter than the owner's will — the human changes the process, the file follows.
- Hypotheses not marked "candidate for spinning out" get pulled into slicing and produce junk requirements.

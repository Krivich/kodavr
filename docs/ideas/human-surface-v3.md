# KODAVR · Human Surface v3 — the friendliness pass (RFC)

**Status:** draft for the owner's approval. This is the sketch gate (AGENTS.md §10):
nothing is implemented until the surface below is approved.
**Scope:** three human-facing entry points only — the home storefront hero and its CTAs, the
dump gate's first screen, and the README opening block (§7.5). The machine contract
(`index.json`, manifests, feeds, `/.well-known`) does not change.
**Force hierarchy:** Ignition principles > SPEC > this document > the implementer's taste.
**Design-code invariant:** the two-contour design system is preserved. No new visual language,
no page-specific CSS, no new fonts, no external origins. Every change reuses existing roles
(kicker, h1, lead, block-statement, `.cta`, `.micro`, `.meta`, prose, plate) and the single
`styles.css` (KDV-MOBILE-06/08, KDV-COPY-12). This document changes *copy and placement*, not
the design code.
**Origin:** an external agent report on making the entry pages friendlier, reconciled against
the landed v2/v2.1 surface; the raw source is kept out of the repository.
**File rule: APPEND, DO NOT EDIT.** Branch addresses are permanent anchors. Source errors are
not overwritten — a "report vs ground" divergence is itself value; the history of decisions
reads as a protocol, not as a plan rewritten after the fact.

## 0. The essence in one paragraph

The v2/v2.1 pass removed the fear of the gate but left three entry points speaking to the
machine before the human: the home H1 still reads "A registry for machines", a shared dump
link gives no hint of *which* dump the human is about to open, and the README opens on a
cryptic slogan. v3 changes only the human-facing framing at those three points — the
asymmetry stated as a human benefit, the dump named before the doors, the README opening
human-first — while the machine-first mechanism, the gate, the contract and the design code
stay exactly as they are.

## 1. Why: the diagnosis

### 1.1 What the report got right

1. **The home H1 is machine-worded.** `A registry for machines` is the first thing a casual
   visitor reads; it names the consumer, not the value, and reads as "you are not welcome"
   before the visitor has learned what the place is. (Found current at `i18n-en.mjs:171`.)
2. **The asymmetry is not on the storefront.** The 1x-build / 10x-package argument that makes
   the whole thing make sense lives only on `/about/` (`ABOUT_LEAD`, `i18n-en.mjs:79-80`); the
   home hero never states it.
3. **A shared dump link has no topic.** On `/dumps/<slug>/` the gate modal opens with only
   platform-level prose (`GATE_HOOK`); the dump's own title and summary sit behind the modal.
   The human must pick a door before learning what the dump is about.
4. **The README opens on an in-joke.** `The autopsy revealed the code was useful.` is a good
   brand line but a bad first line for a developer scanning GitHub for practical value.

### 1.2 What the report got wrong (verified against the code)

The report partly targets the pre-v2 surface and must not be acted on literally:

- It treats `YOU ARE HUMAN. THIS IS NOT A DIAGNOSIS…` as the first screen. That is the
  reception block's accessible title (`copy.mjs:282`), revealed only after choosing `1`; the
  first screen is the gate modal, whose hook already answers "what is this / am I allowed"
  (`copy.mjs:99-103`, `GATE_HOOK`).
- It proposes moving "the Human Brief" above the gate. The brief is already the third tier of
  reception when a dump carries `summary.md` (`copy.mjs:292-323`, `KDV-SURFACE-16`); there is
  no plan to make it the first screen, and doing so would replace the gate-first ceremony
  that v2 was built around.
- It proposes demoting the machine-first ordering. That contradicts the primary-audience
  decision (SPEC §1.5, A4) and the design code. v3 does not touch the ordering.

### 1.3 The four real gaps v3 closes

1. Home hero says "machines", not "your problem solved".
2. No publish path from the storefront — the only CTA is `/about/` (`KDV-SURFACE-24`).
3. The dump gate does not name the dump.
4. The README opens without a human or machine payoff in the first two lines.

## 2. Principles and invariants (what we do not change)

- Machine-first: `index.json`/manifests/feeds remain the primary interface; HTML is a projection (A4).
- The gate is declarative, view-source is not blocked, no new locks (A7).
- The raw body is not polished for humans; the brief stays a separate layer marked as an
  adaptation (`KDV-COPY-02`, `KDV-SURFACE-16`).
- The declaration, the perjury fine print, the duties and the blanket 18+ keep their meaning
  verbatim; v3 only adds a dump-specific context line and never reorders the ceremony.
- The copydeck is the single source (§7): every copy edit goes through a §7 amendment for the
  copydeck strings, or a catalog entry for the structural/SEO strings; templates never retype
  (KDV-I18N-07, KDV-COPY-01…11).
- The four locale bundles stay key-identical: every added/edited key lands in `en`, `ru`, `es`
  and `zh-Hans` in the same change, or `assertComplete` fails.
- Design code: two contours (mono machine / sans human), one stylesheet, existing roles only;
  no page-specific CSS (KDV-MOBILE-06/08, KDV-COPY-12).
- Tone: engineering irony without gloom; dark notes only in the permitted places (§1.4).

## 3. What to do: three changes

Entry format: **What / Why / How / Acceptance.**

### Change 1. Home hero: state the asymmetry, offer two doors

- **What:** the storefront H1 and lead are rewritten to lead with the human benefit and the
  1x/10x asymmetry; the single `/about/` CTA is joined by a second CTA to `/contribute/`
  (`Publish a dump`). The kicker and the §7.10 "what is a dump" block-statement stay.
- **Why:** answers "what is this for me?" before any machine vocabulary, and gives the two
  real next steps — understand it (manifesto) or act (publish).
- **How:** catalog entries `HOME_TITLE`, `HOME_TAGLINE`, `HOME_ABOUT_CTA`, new
  `HOME_CONTRIBUTE_CTA` in all four bundles; `input/templates/home.hbs` adds the second
  `.cta` link next to the existing one. No new CSS — the `.cta` role is reused.
- **Acceptance:** both CTAs are present and reachable; the home `<title>`, meta description
  and JSON-LD `WebSite`/`CollectionPage` name/description follow the new entries (they derive
  from `HOME_TITLE`/`HOME_TAGLINE`, `pages.mjs:533-568`); KDV-SURFACE-24 is amended to pin two
  CTAs; no visual regression (one `.cta` role, still the design system's).

### Change 2. The dump gate names the dump

- **What:** on a dump page the gate's first screen carries a compact context block — the
  dump's `title`, its `summary`, and the metadata line `date · domain · stakes · trust_level`
  — placed directly under the dialog H1 and above the hook. On `/reception/` and every
  non-dump surface the block is absent (the gate partial is used only on a dump page).
- **Why:** closes gap 3 without touching the ceremony: a human arriving from a shared link
  learns *which* dump this is, and still chooses a door deliberately.
- **How:** `input/templates/site/gate.hbs` renders the block from the dump dataset fields
  already exposed by `dumps.mjs:316-325`; `input/templates/dumps.hbs` passes them through the
  partial context. Copy: one new catalog label `GATE_DUMP_CONTEXT_LEAD` (`About this dump:`)
  in all four bundles; title/summary/meta are author content and machine tokens — never
  translated. Layout reuses `.micro`/`.meta`/prose roles; any new selector that proves
  unavoidable lives in the single `styles.css` and uses existing tokens (do not add a
  page-scoped stylesheet).
- **Acceptance:** on a dump page the gate shows title, summary and the four metadata tokens;
  `/reception/` is unchanged; the no-JS fiction is intact; at 320px there is no horizontal
  scroll (a new KDV-SURFACE-25; an amendment to KDV-MOBILE-01: the prompt and the full
  declaration may follow below the fold, as today).

### Change 3. README §7.5: human-first opening

- **What:** the §7.5 opening is restructured: a human headline and a 1x/10x paragraph
  replace the cryptic first slogan, while `What is a dump?`, the three audience sections,
  both remaining slogans and the licences line are kept. The README stays verbatim-synced to
  SPEC §7.5.
- **Why:** GitHub is where a developer decides in seconds; the current opening says nothing
  about the payoff.
- **How:** amend `docs/SPEC.md §7.5`, mirror it in `scripts/lib/copy.mjs:README_INTRO_TEXT`,
  and keep `README.md` starting with the same block (`docs.test.js:54-56`). §7.5 is not
  localized, so no bundle change.
- **Acceptance:** `copy.test.js` (§7.5 block comparison) and `docs.test.js` (README starts
  with `README_INTRO_TEXT`) are green after the one-line §7.5 amendment; KDV-COPY-04 stays
  ✅.

## 4. Copydeck sketches (English, single source)

These are the approval surface, not the final edit; they become the §7/catalog amendment once
approved.

### §7.5 v3 — README opening

```
# KODAVR 🤖⚙️
Share raw experience. Let agents do the explaining.

Building something costs 1x. Packaging it so someone else can reuse it
costs 10x — the documentation, the generalised examples, the private
context to strip, the upkeep. Kodavr fixes that asymmetry: publish a
"dump" — a raw field report with a machine-readable contract — and the
reader's agent adapts it to their context. Share gears, not text.

## What is a dump?
You built something — a script, a workflow, a hack that finally worked.
Instead of writing "a proper article" (10x the effort of building it),
you tell your agent:
"I just finished something potentially very interesting for others.
Let them judge and learn if they want. Write it up as a dump."
Your agent writes the body and the manifest. You open a PR.
One prompt — no article writing, no polishing.

## For machines
curl -s https://kodavr.xyz/index.json | jq '.dumps[] | select(.stakes=="low")'
Protocol: /.well-known/kodavr.json · Feeds: /feeds/all.atom

## For humans
Go to reception: https://kodavr.xyz/reception/
(Yes, we check that you are not human. Yes, we mean it.)

## For authors
CONTRIBUTING.md · One PR = one dump · CI rejects junk before merge.

Built on Ignition. Licences: MIT (code), CC-BY-4.0 (content).
```

### Home catalog v3

```
HOME_KICKER:  registry of raw experience            (unchanged)
HOME_TITLE:   Share raw experience. Let agents do the explaining.
HOME_TAGLINE: Kodavr is a registry of dumps — unpolished field reports, scripts and
              workflows with a machine-readable contract. Building something is 1x
              effort; packaging it for others is 10x. We fix that asymmetry.
HOME_ABOUT_CTA:      Read the manifesto             (was: About the platform)
HOME_CONTRIBUTE_CTA: Publish a dump                 (new; href /contribute/)
```

### Gate addition

```
GATE_DUMP_CONTEXT_LEAD: About this dump:
```

Rendered above the hook as: the dump `title` (strong), the `summary` (muted prose), then the
`date · domain · stakes · trust_level` token line.

## 5. What not to do

- Do not move the Human Brief above the gate or make it the first screen: the gate-first
  ceremony is the concept (v2 §2), and the brief exists only when `summary.md` is attached.
- Do not reorder the home plates or the gate blocks: v3 adds context, it does not restructure
  the flow.
- Do not reintroduce machine vocabulary into the hero, and do not remove the machine-first
  disclosure from the page — the hero speaks to the human, the contract stays for the agent.
- Do not add page-specific CSS, new fonts or a second stylesheet.
- Do not edit copy ad-hoc in templates: go through the copydeck/catalog and the four bundles.
- Do not translate dump content: title/summary are author material and ride verbatim.

## 6. Priorities and effort

| Priority | Content | Estimate | Why so |
|---|---|---|---|
| P0 | Changes 1 + 2 | ~half a day | The two site entry points; ~all the human-friendliness gain |
| P1 | Change 3 (README §7.5) | ~1 hour | Cheap; a developer-facing first impression |

## 7. Registry amendments and acceptance

### Amendments to existing IDs

| ID | Amendment |
|---|---|
| KDV-SURFACE-24 | the storefront hero states the 1x/10x asymmetry and offers two CTAs (`/about/`, `/contribute/`) |
| KDV-COPY-04 | the §7.5 source is replaced with v3; the verbatim rule is preserved |
| KDV-MOBILE-01 | the gate's first screen gains the dump context; the prompt/declaration may stay below the fold |

### New IDs (sketch)

- KDV-SURFACE-25: on a dump page the gate's first screen names the dump (title, summary and
  the domain/stakes/trust metadata) before the doors; the block is absent on every non-dump
  surface; the no-JS fiction is intact.

## 8. Risks and open questions

- **320px budget:** adding the dump context to the gate's first screen pushes the prompt
  and/or the duties line below the fold. Accepted: KDV-MOBILE-01 already allows it, and the
  context replaces the missing topic. A manual 320px check is on the acceptance list.
- **SEO title length:** `HOME_TITLE` becomes a full sentence and doubles as `<title>` and the
  JSON-LD `WebSite` name. Accepted for clarity; if it reads badly in search, the fallback is
  a short `HOME_TITLE` plus a separate `HOME_HERO` key — deferred, not in v3.
- **Slogan placement:** "The autopsy revealed the code was useful." leaves the README opening
  and stays on `/about/` (§7.15, KDV-COPY-11). If the owner wants it kept in the README, it
  can close the opening paragraph instead — one-line variant, pending the owner's call.
- **i18n drafts:** the `ru`/`es`/`zh-Hans` bundle entries remain owner-reviewed drafts, as
  with every catalog string (KDV-I18N-01); v3 does not change that process.

## 9. The closing line

The mechanism is not what scares: the machine vocabulary in the first line is. v3 lets the
human understand the place — the asymmetry on the storefront, the dump's own name before the
doors, a README that pays off in two lines — while the two-contour design code, the gate
ceremony and the machine contract stay untouched.

---

The document is self-sufficient: diagnosis → invariants → three changes with acceptance →
copy sketches → prohibitions → priorities → registry amendments → risks. The recommended
first step is P0 (Changes 1 + 2) because it carries almost all of the human-friendliness gain
for the site's two real entry points.

## Status (per-branch verdicts — a tail, appended, never rewritten)

**Approved by the owner, 2026-09-21.** Landed as one batch (site copy + README; the machine
contract untouched):

- **Accepted:** Change 1 — the home hero states the 1x/10x asymmetry and offers two CTAs →
  KDV-SURFACE-24 (amended).
- **Accepted:** Change 2 — the dump gate names the dump (title, summary, metadata) before the
  doors → KDV-SURFACE-26 (new).
- **Accepted:** Change 3 — README §7.5 opening is human-first → KDV-COPY-04 (amended source).
- **Accepted:** the "autopsy" slogan leaves the README opening; it stays on `/about/` under
  KDV-COPY-11.

**Correction (appended):** the new dump-gate ID is **KDV-SURFACE-26**, not the
`KDV-SURFACE-25` written in §3 and §7 — 25 was already taken by the CSP-meta requirement.

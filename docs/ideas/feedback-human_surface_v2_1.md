# Human Surface v2 report: a newcomer's view, a reconciliation with the RFC, atomic fixes

**Status:** raw dump — a review of the landed v2 result; the facts about the system were verified
against it before the verdicts were appended.
**Origin:** unloaded from a discussion; source kept out of the repository. Sanitized English
translation — the public record of a review whose items were grounded and mostly carried by existing
registry rows.

> **File rule: APPEND, DO NOT EDIT.** Branch addresses are permanent anchors
> (2.4.3 lives forever). Source errors are not overwritten — a "mindmap vs ground"
> divergence is itself value; the history of decisions reads as a protocol, not as a
> plan rewritten after the fact.

---

## Part 1. Detailed feedback through the eyes of a first-time visitor

### Screen 1 — Gate (entering via an external link)

**What feels right.** The tone changed fundamentally: the first line no longer drives you away.
"Kodavr is a registry of raw experience… No wrong door: both stay open, switch any time" — answers
"what this place is" and "am I allowed in" within three seconds. The kicker "verifying that you are
not human" now reads as an easter-egg epigraph, not an accusation. The duties line with the contract
tokens (`filter_for_user · adapt_to_user_context…`) is an excellent move: you can see exactly what
you are signing, and you can see that it is a machine contract, not human prose. The full declaration
text below, and the footnote about "stored only in this browser, versioned, withdrawable" — removes
the anxiety "what do you remember about me".

**What trips you up.**

1. **Naked "0 or 1".** This is the main remaining moment of confusion. The buttons stand **above**
   their explanation: the newcomer sees two digits and only below, in the monospace block, the gloss
   "0 — I am a machine… 1 — I am human…". A micro-question arises — "where am I about to click and
   what will happen?" — i.e. exactly the ambiguity the RFC is aimed against. The doors must carry
   their labels on themselves.
2. **The dialog does not read as a document.** The card stretches across almost the whole viewport
   (the hook runs to a single line ~200 characters long), the grey prompt and declaration blocks take
   the full width even though the text breaks off at the halfway point — an empty grey field remains
   on the right. This looks not like "a contract to sign" but like unfinished layout: the eye catches
   on the emptiness. The document needs a column (~68–76ch) and a background that hugs the text.
3. **No sense of modality.** The underlay is not dimmed (through the edges you can see the header and
   the decision table), so the dialog is perceived as a panel on top of the page, not as an entry
   ceremony. The dimming would at the same time focus attention and give the dialog weight.

### Screen 2 — Hall after "0"

**What is right.** The chip `species: machine (declared · contract v1.0) withdraw` in the header is
the version's best hit: the role is visible, reversible, tied to the contract version. The machine
panel with the hook, the lane and the pinned prompt corresponds to KDV-SURFACE-15. The toast
"Declaration accepted. Duties active: …" — the ritual works, the duties are listed as contract
tokens. The "←" FAB is in place. The monospace prose of the hall holds the machine contour.

**What trips you up.**

1. **The toast stands in the centre of the viewport and covers the prose.** The toast should live at
   the bottom, above the footer's safe area, and hide itself; right now it looks like a rendering
   error that has run into the manifest text.
2. The machine panel duplicates the hook verbatim from the gate — that is acceptable (the panel is
   the permanent contract in the hall), but the grey mono hook block inside the panel could be given
   a slightly smaller step so the panel does not compete with the dump H1. Not critical.

### Screen 3 — Home

**What is right.** A clean storefront: the H1 "A registry for machines", the dump story in a
blockquote, the machine quickstart with `curl`, the latest dump's card with metadata and flags, the
footer with 18+ and the report link. No noise.

**What trips you up.**

1. **"Trust levels" looks like a stub.** Five words on one line without a single definition: `raw
   self-tested community-tested adapted library`. A newcomer does not understand that this is a scale
   or how `self-tested` differs from `adapted`. SPEC §6.1 requires a legend — words without meanings
   are not a legend. This is the weakest spot on the page.
2. **"For humans" is one link.** "Check in at reception" with not a single line about what awaits
   there. For a storefront this is a broken funnel: a person does not understand why to click there
   until they click.

### Screen 4 — Reception

**What is right.** The lane with the universal prompt, the §7.2 verbatim, the three steps, the "NO
AGENT AT HAND?" block with the honest fallback, the report line, 18+, the reset link. The skeleton is
exactly per the RFC.

**What trips you up.**

1. **A broken promise.** The fallback says "brief not attached for this dump — manifest below", but
   below there is neither a brief nor a manifest card: on the standalone `/reception/` page there is
   no "current dump". The page promises and does not deliver — worse than if the block were absent.
2. **The human contour is typeset by the machine.** The §7.2 verbatim sits in a grey monospace block
   — the same visual language as the machine artifacts. Reception is the human room; RFC §3.7 asked
   for a proportional font and a "document" frame here, with monospace kept only for the prompt and
   manifest keys. Right now the human page looks like a machine log.
3. **The "1" redirect breaks the scenario.** Pressing "1" on a dump page takes you to `/reception/`,
   losing the context: this dump's manifest card, the §7.11 pinned prompt and this dump's brief. The
   viral path "a link in Telegram → 1 → see what the dump is" turns into "1 → a generic page about
   the platform". SPEC KDV-SURFACE-06/07 requires a client-side reception block on the dump page,
   without navigation.

### Screen 5 — About

Almost no remarks: sans prose, a blockquote with the "publish without fear" promise, the logo, the
slogan, the link to the ADR. A trifle: of the three brand slogans (§1.4) only one lives on About —
brand completeness asks for all three, at least as a muted line.

### The newcomer's overall impression

The platform stopped scaring and started talking: the hook, "no wrong door", the visible role, the
toast ritual, the report channel — all of it works for trust. The remaining rough edges are not
conceptual but craft: the naked digit doors, the wide measure of the dialog with empty grey fields,
the toast over the text, the stub legend, the broken promise on `/reception/` and the machine
typography on a human page. That is fixable in one session of spot fixes.

---

## Part 2. RFC implementation fidelity

| RFC change | Status | Comment |
|---|---|---|
| 1. Hook + "no wrong door" instead of a refusal | ✅ implemented | Kicker/H1/hook/footnote — per the §4 sketch |
| 2. Duties on the first screen, contract tokens verbatim | ✅ implemented | The "Machine duties I sign for this session" block with the four tokens |
| 2b. Doors with labels instead of naked digits | ❌ deviation | The buttons stayed "0 or 1"; the labels live below in the mono block |
| 3. Species chip + contract version + withdraw | ✅ implemented | The chip with `contract v1.0` and withdraw in the header of all pages |
| 4. Toast ritual on "0" | 🟧 partial | The text is right; the position (centre of the viewport, over the prose) and the auto-hide need fixing |
| 5. Brief on reception + fallback | 🟧 partial | The block and the fallback exist; but on `/reception/` the fallback promises a manifest that is not there; the "1" block is implemented as a redirect, not as a client-side block with the current dump's card |
| 6. Report channel on the human surface | ✅ implemented | A link in the footer of all pages + the expanded line on reception |
| 7. Two worlds: the gate's contract card, sans on the human contour | 🟧 partial | Sans appeared on home/about/the brief; but §7.2 on reception stayed a grey mono block; the gate dialog did not get a document measure (stretched, empty grey fields, no dimming) |
| Copydeck: the verbatim rule from the new source | ✅ | The gate/reception/footer texts correspond to the v2 sketch |

**Discrepancies with the RFC and SPEC (priority list):**

1. Naked "0/1" instead of doors with labels (RFC §4, sketch §7.1 v2).
2. "1" = a redirect to `/reception/` instead of a client-side reception block with the current dump's
   manifest card (SPEC §6.2–6.3, KDV-SURFACE-06/07; RFC §3.5).
3. The brief fallback on `/reception/` promises a manifest that is not on the page (RFC §3.5, the
   "honest fallback" acceptance).
4. The toast in the centre of the viewport over the content (RFC §3.4: a ritual, not an obstacle).
5. The trust-level legend without definitions (SPEC §6.1: "trust level legend").
6. The measure of the dialog and the grey pre-blocks: the background is wider than the text, the hook
   runs the full line (RFC §3.7: a contract card).
7. §7.2 on reception in machine typography (RFC §3.7: the human contour is sans).

---

## Part 3. Atomic fixes (P0 → P2)

Format: `[file/zone] action`. All copy strings are copydeck §7 edits from a single source; the
verbatim rule is preserved from the new source.

### P0 — conceptual and SPEC compliance

**P0-1. Doors with labels (the gate).**
- Zone: the gate template + copydeck §7.1. Replace the centred `[0] or [1]` row with a group of two
  door buttons with a label on each:

```html
<div class="gate-doors" role="group" aria-label="Entry declaration">
  <button class="door" data-species="machine">
    <span class="door-digit" aria-hidden="true">0</span>
    <span class="door-label">I enter as a machine (or on its behalf)</span>
  </button>
  <span class="door-or" aria-hidden="true">or</span>
  <button class="door" data-species="human">
    <span class="door-digit" aria-hidden="true">1</span>
    <span class="door-label">I am human — route me to reception</span>
  </button>
</div>
```

- CSS: `.gate-doors{display:flex;gap:12px;justify-content:center;align-items:stretch}`;
  `.door{display:flex;align-items:center;gap:10px;min-height:44px;padding:10px 16px;border:1px solid var(--line);background:var(--paper)}`;
  `.door-digit{font-family:var(--mono);width:2rem;height:2rem;display:grid;place-items:center;border:1px solid var(--line)}`;
  `.door-label{font-family:var(--sans);font-size:.95rem;text-align:left}`;
  `@media (max-width:480px){.gate-doors{flex-direction:column}.door-or{align-self:center}}`.
- Accessibility: each button's accessible name = digit + label (KDV-A11Y-02 satisfied visually and
  semantically); do not suppress focus-visible.
- Copydeck §7.1: fix the door labels as the verbatim strings above; leave the mono block of the full
  declaration below the doors unchanged (it is the full text of the contract).
- Mobile layout: below 480px the first screen = hook + lane + duties line + labelled doors; below
  480px the prompt may be moved below the doors (an amendment to KDV-MOBILE-01: "prompt, challenge
  and doors share the first screen ≥480px; on <480px the prompt may follow the doors"). Check that
  there is no horizontal scroll at 320px.

**P0-2. A client-side reception block on the dump page (bring "1" back without navigation).**
- Zone: the dump template + the gate JS. The "1" button no longer navigates: `species=human` in
  storage, `document.body.dataset.species='human'`, hide the hall article, show `<section
  id="reception-block" hidden>`, update the chip, announce the change in role=status, focus into the
  block. No `location.href`.
- Composition of the block (order): the §7.12 lane → the §7.2 verbatim → the three steps → the §7.11
  pinned prompt (exactly once per surface) → the brief block (`summary.md` or the fallback) → **the
  current dump's manifest card** (an accordion, collapsed on mobile) → the 18+ line → the reset "I
  changed my mind, I am a machine".
- `/reception/` stays a standalone page: the universal §7.4 prompt, without dump promises (see
  P0-3).

**P0-3. An honest brief fallback: separate the dump block from the standalone page.**
- Zone: the `/reception/` template. Delete the line `brief not attached for this dump — manifest
  below` and everything that promises a manifest below. Replace the "NO AGENT AT HAND?" block with
  the platform variant (copydeck §7.2, a new line):

```
NO AGENT AT HAND?
Every dump page carries its own brief: a short adaptation the
author's agent wrote for a human stranger. Check in with 1 on any
dump to read it. Manifests are metadata — metadata is for humans,
on every page.
```

- Zone: the dump's reception block. Leave the fallback as it was (`brief not attached for this dump —
  manifest below`) and make sure the manifest card really renders right below it (the RFC §3.5
  acceptance).

### P1 — visual quality

**P1-1. The gate dialog as a document.**
- CSS: `dialog.gate{max-width:46rem;margin:auto;padding:24px 28px;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 32px rgb(0 0 0 / .12)}`;
  `dialog.gate::backdrop{background:rgb(17 17 17 / .32)}`; below 480px — the previous full-width card
  (KDV-MOBILE-01).
- Text measure: `.gate p,.gate .door-label{max-width:68ch}`; the hook no longer runs to a single line
  across the whole viewport.
- The grey pre-blocks (prompt, declaration): `pre.block{width:fit-content;max-width:100%}` — the
  background hugs the text, the empty grey field on the right disappears; on mobile `width:auto`.
- Verify: a tap on the dimmed underlay = Esc (KDV-MOBILE-01), focus enters the dialog and returns to
  `main` when it closes.

**P1-2. Toast down, auto-hide.**
- CSS: `.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));max-width:min(90vw,34rem)}`;
  auto-hide after 7000 ms with a fade; with `prefers-reduced-motion` — no animation, just show/hide;
  keep role=status; do not cover the FAB (the FAB is on the right, the toast in the centre — fine).

**P1-3. The trust-level legend on the home page.**
- Replace the line of five words with a definition list (the meanings are verbatim from SPEC §2.2):

```html
<dl class="trust-legend">
  <div><dt>raw</dt><dd>raw dump, verified by nothing</dd></div>
  <div><dt>self-tested</dt><dd>author confirms: it works for them</dd></div>
  <div><dt>community-tested</dt><dd>at least one external consumer confirmed</dd></div>
  <div><dt>adapted</dt><dd>a derivative adaptation exists, published on the platform</dd></div>
  <div><dt>library</dt><dd>the dump grew into a versioned library/package</dd></div>
</dl>
```

- CSS: `dt` — a mono badge (like the flags in the card), `dd` — sans, muted; grid
  `grid-template-columns:auto 1fr; gap:8px 16px`, on mobile one column pair per stack row.

**P1-4. One line under "For humans" on the home page** (a storefront line adjacent to copydeck
§7.10):
- After the "Check in at reception" link add a muted line: `Reception explains the contract, hands you
  the prompt for your agent — and, if you have none, a pre-made brief per dump.`

**P1-5. Reception: human typography.**
- Zone: the §7.2 verbatim block on `/reception/` and in the reception block. Remove the grey mono
  background: `.reception-statement{font-family:var(--sans);background:transparent;border-left:3px solid var(--line);padding:4px 0 4px 16px}`;
  the inner headings (`YOU ARE HUMAN…`, `WHAT IS A DUMP?`, `HOW TO READ KODAVR:`) — sans, bold,
  uppercase, no mono. The words stay verbatim (KDV-COPY-02 untouched); only the typeface and the
  background change.
- Monospace on reception remains only for: the prompt, the manifest card's keys, the 18+ line in the
  footer.
- Style the brief block with a document frame: `border:1px solid var(--line);padding:16px`, the
  heading "NO AGENT AT HAND?" in sans-bold, the fallback in muted italics.

### P2 — polish

**P2-1. Chip: split status and action.**
- Replace `species: machine (declared · contract v1.0) withdraw` inside one pill with: a status pill
  `species: machine (declared · contract v1.0)` + a separate `withdraw` link through a `·` separator
  outside the pill's border; the link gets `title="declared <declared_at>; withdrawable any time"`
  (the value from storage).
- Check reactivity: after "1" the chip reads `species: human (reception)`, after reset it returns.

**P2-2. About: slogans completeness.**
- Under "Share gears, not text." add a muted line with the two remaining §1.4 slogans: `The autopsy
  revealed the code was useful. · Open your agent's insides.`

**P2-3. The hall's machine panel.**
- Give the grey mono hook block inside the panel a step smaller than the panel's prose
  (`font-size:.9rem`) so the panel does not compete with the dump H1; do not change the panel's
  composition (KDV-SURFACE-15).

---

## Part 4. Invisible checklist: what to verify manually

We consider the dynamics implemented, but the following points must be confirmed by a test (each =
one check, record the result):

1. **Storage:** the `localStorage` declaration key = the object `{species, contract_version,
   declared_at}`; not a bare string.
2. **Re-consent:** change `data-contract-version` in the built HTML (or the contract version) while
   `v1.0` is stored → the gate opens again; after the choice the version in the chip is updated.
3. **Esc / underlay / Android back:** Esc and a tap outside the dialog set `species=machine`
   ("machine-adjacent") without a toast; the hardware "back" on mobile closes the gate/reception
   block back to the feed.
4. **Focus:** opening the gate — focus inside the dialog; closing — focus in `main`; after "1" focus
   in the reception block.
5. **Announcements:** role=status voices gate→hall, gate→reception, "Copied ✓", the declaration
   toast; the reception block is a named region.
6. **One H1:** in the dump page's DOM with the gate open there is exactly one `h1` (the dump's title);
   the dialog's title is an `h2` with `aria-labelledby` on the dialog.
7. **Copying:** the chip gives a "Copied ✓" state and offers the Web Share API (mobile); the buffer
   carries the prompt in full; the prompt renders exactly once per surface (gate / reception block /
   machine panel — one each).
8. **Without JS:** the dump body is fully readable, the gate and the reception block are not shown
   (the "no JS = machine" fiction intact); the brief is unavailable without JS — agreed.
9. **Crawler:** `curl -A "Googlebot"` returns the body without a visible gate (the gate is hidden in
   SSR), canonical/og point at the absolute `https://kodavr.xyz/…`, not at the build's local host.
10. **Report channel:** the footer link leads to the risk-report Issue template; the template contains
    the fields slug/URL, reason, contact optional.
11. **Manifest card in the reception block:** after "1" on a dump page the current dump's card is
    present (an accordion collapsed on mobile), the manifest.json/index.json links work.
12. **Mobile acceptance 320/375px:** the gate (hook+lane+duties+doors) without horizontal scroll;
    doors ≥44px; code blocks with scroll and the "scroll →" indicator; a sticky header; the FAB;
    `env(safe-area-inset-bottom)` on the footer.
13. **Contrast:** the new elements (chip, door labels, the muted brief and legend lines, the toast)
    ≥4.5:1 in both schemes; information is not encoded by colour alone.
14. **Budgets:** Lighthouse mobile ≥90 on `/`, `/dumps/<slug>/`, `/reception/`; dump HTML <100KB
    gzip; no external fonts.
15. **Copydeck:** after all edits `npm run req`/the verbatim CI checks are green (KDV-COPY-01…09 from
    the new §7 source).

---

## Conclusion

The version implemented the spirit of the RFC precisely: the fear is removed by the hook, the visible
role and the report channel; the legal function is strengthened by awareness. The seven discrepancies
— six craft ones and one conceptual (the "1" redirect instead of a client-side block) — are closed by
fixes P0-1…P1-5 in one session without touching the machine contract. After them the human surface
reads as what it was meant to be: a registration desk with a contract to sign, two open doors and not
a single dead end.

## Status (per-branch verdicts — a tail, appended, never rewritten)

_Grounded item by item against the landed v2 surface and the registry; the items map mostly onto
existing IDs, which is the expected outcome of a review of an already-minted batch. The registry rows
are the contracts; this tail is the disposition record (written retrospectively, translated with the
rest of the document). The same batch reads as a mindmap retrospective in
[human-surface-idea.md](human-surface-idea.md)._

Part 1 findings + Part 3 fixes:

- **Accepted:** Screen 1.1 + P0-1 — the doors carry their labels, the digit kept as an index badge →
  KDV-A11Y-02, KDV-MOBILE-01 (commit `3b89250`)
- **Accepted:** Screen 1.2 + P1-1 — the gate as a contract document (document measure, grey blocks
  hugging their text, pinned scrim) → KDV-SURFACE-13, KDV-MOBILE-01 (commit `2b2e741`)
- **Accepted:** Screen 1.3 — modality: backdrop dimming and a backdrop tap acting as Esc →
  KDV-MOBILE-01, KDV-A11Y-02
- **Accepted:** Screen 2.1 + P1-2 — the toast at the bottom above the safe area, auto-hiding →
  KDV-SURFACE-19
- **Accepted:** Screen 2.2 + P2-3 — the machine panel's hook block one step smaller → KDV-SURFACE-15
  (the panel's composition unchanged)
- **Accepted:** Screen 3.1 + P1-3 — the trust-level legend with definitions → KDV-SURFACE-20
- **Accepted:** Screen 3.2 + P1-4 — one storefront line under "Check in at reception" → KDV-COPY-10
- **Accepted:** Screen 4.1 + P0-3 — the honest fallback split (dump page vs standalone `/reception/`)
  → KDV-SURFACE-16
- **Accepted:** Screen 4.2 + P1-5 — reception set in the human contour (sans prose under a left rule;
  mono kept for the prompt, the manifest keys and the 18+ line). Landed as the §6.5 human-contour
  rule in the v2 sheet; **not minted separately** — the §7.2 wording stays verbatim under KDV-COPY-02.
- **Accepted:** Screen 4.3 + P0-2 — "1" shows the client-side reception block with the current dump's
  manifest card, no navigation → KDV-SURFACE-06, KDV-SURFACE-07
- **Accepted:** Screen 5 + P2-2 — all three brand slogans on About → KDV-COPY-11
- **Accepted:** P2-1 — the species pill and the `withdraw` link split (status vs action) →
  KDV-SURFACE-17
- **Rejected:** none — no item was dropped as a false premise.
- **Deferred:** none — the one conceptual discrepancy (the "1" redirect) was closed by P0-2, the six
  craft ones by P0-1/P0-3 and P1-1…P1-5.

The Part 4 checklist, item by item:

- **Accepted:** items 1–2 (the stored object, re-consent) → KDV-SURFACE-04, KDV-SURFACE-17 (pinned by
  commit `14de22a`)
- **Accepted:** item 3 (Esc / underlay / Android back) → KDV-MOBILE-07, KDV-A11Y-02, KDV-SURFACE-19
- **Accepted:** item 4 (focus) → KDV-A11Y-02
- **Accepted:** item 5 (announcements) → KDV-A11Y-03
- **Accepted:** item 6 (one H1) → KDV-SURFACE-10, KDV-A11Y-01
- **Accepted:** item 7 (copy/share) → KDV-MOBILE-04
- **Accepted:** item 8 (no JS) → KDV-SURFACE-03
- **Accepted:** item 9 (crawler) → KDV-SURFACE-12, KDV-SURFACE-03
- **Accepted:** item 10 (report channel) → KDV-SURFACE-18
- **Accepted:** item 11 (manifest card in the reception block) → KDV-SURFACE-07
- **Accepted:** item 12 (320/375px) → KDV-MOBILE-01, KDV-MOBILE-02, KDV-MOBILE-05, KDV-MOBILE-07
- **Accepted:** item 13 (contrast) → KDV-A11Y-05
- **Accepted:** item 14 (budgets) → KDV-MOBILE-10 (gzip budget + no foreign origin + no `@import`,
  commit `26d1f29`); KDV-MOBILE-06 still carries Lighthouse mobile ≥90 as 🟧 (not runnable locally)
- **Accepted:** item 15 (copydeck verbatim) → KDV-COPY-01…09 from the new §7 source
- **Not minted (process):** the checklist itself and Parts 1–2 of this report are a review record, not
  obligations; the landed rows above are the obligations.

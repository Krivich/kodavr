# The architecture map: teaching an agent not to break cross-cutting flows or route around them

This is a self-contained setup guide for the **architecture-awareness** half of an agent-driven
repository: a PlantUML map of the code tree and its cross-cutting flows, a linter that keeps the map
honest against the code, and a design-time hook that forces the map to be consulted before a new
feature is written. It is the companion to *The requirements machine* —
https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/ — and it **extends** that registry:
the hook below lives inside the registry's coverage check (`npm run req`). Apply the requirements
machine first.

The problem it solves is not "the agent cannot read files". It is that an agent, working one file at a
time, cannot see the *shape* of the system — so the shortest line to its goal often cuts across a
shared step, and that shortcut is locally green and globally a second source of truth that drifts.
The map is the helicopter view that lets the agent see the forest; the linter is what makes the map
worth trusting; the hook is what makes the agent open it.

All sources are inlined in §6. Paths: `<project>` = the root of your repository, `~` = your home
directory. The example map and the palette are from the author's project (Kodavr, a static site);
treat them as a worked example, not as your architecture — your drawers, processes and classes differ.

## 0. The failure this addresses

Long agent sessions fail in a specific architectural way. The agent is asked for a small feature. It
reads the file in front of it, finds the fastest correct-looking path, and takes it — a direct call
from the page renderer to the copy module, bypassing the i18n registry that is supposed to own every
string; a fresh write path next to the existing one instead of through the shared publishing engine.
Each shortcut passes its own tests. What breaks is a **cross-cutting flow**: a concern that is owned
by one shared step (a registry, an engine, an audit gate) and that every feature is supposed to route
through. Two write paths drift; the registry stops being the single truth.

A diagram in the prompt does not fix this by itself:

*   if it is **expensive to read**, the agent skips it — a wall of boxes is noise in the context window;
*   if it **rots**, the agent learns the map lies and stops trusting it — the worst outcome, because
    then even a correct map is ignored;
*   if nothing **forces** the agent to consult it, a map is a nice document nobody opens at design time.

So the design has three parts, and they only work together: a **cheap convention** (§2), a
**linter that makes the map true** (§3), and a **hook that makes the map get used** (§4).

## 1. The two halves and the forcing function

```text
<project>/
 ├── docs/
 │   ├── workflow-arrows.puml          # the map: the machine source the agent reads (this dump)
 │   └── workflow-arrows.svg           # its human render (generated; never hand-edited)
 ├── scripts/
 │   └── tooling/
 │       ├── workflow-map/
 │       │   ├── workflow-arrows-lint.mjs   # the linter: the map vs the code tree (this dump)
 │       │   └── workflow-arrows-svg.mjs    # injects the .svg hover block (this dump)
 │       └── quality-gates/
 │           └── req-coverage.js            # the registry check + the flow-impact hook (base + this dump)
 ├── AGENTS/
 │   ├── workflow-arrows.md            # the convention doc the agent reads (this dump)
 │   └── requirements.md               # registry protocol with the flow subsection (base + this dump)
 ├── AGENTS.md                         # the startup digest that points at the map (base + this dump)
 └── tests/
     └── unit/workflow-arrows.test.js  # pins P1-P3 with synthetic diagrams (this dump)
```

*   **`docs/workflow-arrows.puml`** is plain text the agent can read and you can edit; the linter
    checks it. **`.svg`** is only for human eyes and is generated — one artifact, two files.
*   The map **starts empty and grows with the code**: a drawer when a first-party directory appears,
    a brick when a module appears, a numbered arrow when a flow appears (see *When lint fails* in
    §6.5). You do not draw your whole system up front; you grow the map as you touch the code.

## 2. The convention — a map an agent can read for the price of a glance

The agent does not "see" a diagram; it reads the `.puml` as text. What it needs is to answer two
questions cheaply: *who is in which directory*, and *what calls what*. Everything else is human
garnish. Design the notation around those two facts and keep it small.

Be honest about what this is, and is not. It is **not** a complete architecture diagram and does not
try to be one — someone will always object that a map this sparse is "not real architecture". That is
the wrong test. This is a **helicopter view**: an altitude deliberately chosen so an agent can hold the
whole system in a few thousand tokens. Its only job is to make the agent see the forest before it edits
one tree, so it widens an existing flow instead of cutting a new path across it. Judge it by whether
that works, not by how complete it looks.

### 2.1 Drawers and bricks

*   A **drawer** is a first-party code directory, drawn as a `package "<dir>\n<why it exists>"` block
    — the header states why the directory exists.
*   A **brick** is one file, carrying its drawer's stereotype and a link to its file
    (`[[../<path>#symbol <label>]]`, symbol optional).
*   Externals (the user, the engine, CI, dev tools) are top-level bricks stereotyped `<<ext>>`.

### 2.2 One label grammar (name → what it does → `--` → members)

Every brick and drawer uses exactly one grammar, so the reader is never confused about which line is
which:

```plantuml
component "build.mjs
the one build pipeline (controller)
--
buildProject" as BUILD
```

Name first, then one or more lines of **what it does** (business meaning), then — only when there are
exported symbols to list — a `--` divider and the **members**. A brick whose meaning line already
names its single method needs no members line. The old shape (members above the line, a description
below it) is drift: check **J** rejects it. This is small, but it is the difference between a map an
agent parses in one pass and a map it mis-reads.

### 2.3 Numbered arrows are the flow

*   the map's numbered steps (`1..N`) are the **cross-cutting flow**: the journey a unit of work takes
    through the system;
*   label line 1 is `N · callee.method()` — the API method **of the target** brick (the callee);
*   label line 2 is plain text: **why** the call happens;
*   **solid** `-->` is a call, **dashed** `..>` is a return or a push;
*   a **return** carries the number and no link (`N ⟵ ...`); a numbered **call** carries a link.

### 2.4 Colour is the business process

Each arrow is coloured by the business process it belongs to, from a small fixed palette, and the
numbered flow is **grouped by process rank**: all rank-1 steps before rank-2, and so on. This is how
an agent, holding one requirement, sees which slice of the map it is touching. The palette lives in
one place — `PROCESSES` at the top of the linter — and is exported, so the registry hook (§4) uses the
same names (one truth per entity).

| # | Process example | Colour | Covers |
|---|---|---|---|
| 1 | PR review | `#00897B` teal | a contribution arrives and is validated |
| 2 | Publish | `#1E88E5` blue | build → engine → artifact |
| 3 | Notify | `#8E24AA` purple | mirroring / notifications |
| 4 | Consume | `#43A047` green | machine + human reads |
| 5 | Engineering | `#6D4C41` brown | local dev / tooling |

Grey `#9E9E9E` is **structural glue** (plain imports, assets): never a process, never a numbered step.

### 2.5 Actors and no orphans

Every non-exempt brick must be reachable from an actor by following the drawn arrows (dashed
included). An orphan brick is a sign the map is decorative rather than a flow: it means something
exists that nothing calls, which is either a missing arrow or dead code. Check **P3** enforces it.

### 2.6 The escape hatch, with proof required

A linter that cannot be satisfied by hand gets disabled, and a linter that can be silenced silently
becomes self-deception. So there is exactly one way to suppress a finding, and it must **justify
itself**: an `@lint-ignore` block embedded in the `.puml`:

```plantuml
' @lint-ignore
' [I] IGN -> CTRL_DUMPS  # by-path: spawned by path, not imported
' @end
```

*   it may suppress only **cheap-validation** codes (`I`, `P1`, `P2`, `P3`) — never a structural one;
*   every mask must carry `# <mechanism>: <reason>`, where the mechanism is from a closed vocabulary
    (`by-path`, `dynamic`, `transitive`, `non-module`) — so a mask asserts *why* it is a false
    positive, not merely that the author is tired;
*   an **unused** mask is itself an error (so a real fix forces the mask away);
*   suppressed findings are **reported, not hidden**: the CLI prints `suppressed N (see @lint-ignore)`.

The point is that a suppression is a claim a reviewer can check, not a silence.

### 2.7 Helicopter altitude (keep it cheap)

The map is not an exhaustive call graph. Its job is the altitude at which an agent can see the whole
system for a few thousand tokens. Concretely, the rules that keep it cheap:

*   do not draw every plumbing edge — draw the **flows** that matter and the **imports** that carry
    meaning;
*   a drawer is file-covered (`cover: files`: every matching file must appear as one brick) or dir-only
    (`cover: dir`: bricks are illustrative) — use dir-only where box-by-box coverage would only add noise;
*   the model for the agent is two facts (membership + directed edges); styling is for humans.

If a map becomes too heavy to read in one pass, it has stopped being architectural glue and become
another file the agent skips.

## 3. The linter — what makes the map trustworthy

The linter is the part that turns a document into a mechanism. It is a pure function —
`lintDiagram({ text, pumlDir, repoRoot })` — so it is testable without the filesystem, and it runs both
locally and in CI.

| check | what it holds |
|---|---|
| **A** | drawer coverage both ways — declared drawers ↔ the configured first-party dirs |
| **B** | file coverage both ways for code drawers — every file is exactly one brick; every brick link exists; no file drawn twice |
| **C** | every `[[...]]` link resolves, relative to `docs/` |
| **D** | a link's `#symbol` is declared in the target file |
| **E** | step numbers are exactly `1..N`, unique and contiguous |
| **F** | a brick's stereotype equals its drawer's |
| **G** | a numbered **call** to a module carries a `[[file#symbol]]` link; a numbered **return** carries none |
| **I** | **a drawn edge between two module bricks is a real import in one direction** — the linter builds the first-party import graph and flags a drawn edge the code does not have |
| **J** | one label grammar (name → meaning → `--` → members); a linked `#symbol` must be a member |
| **P1** | every arrow carries a palette colour or the structural grey |
| **P2** | a numbered step carries a process colour and the process rank is non-decreasing in draw order |
| **P3** | every non-exempt brick is reachable from an actor — no orphans |
| **M** | the `@lint-ignore` block is well-formed; guards (`unused mask`, unknown mechanism, no reason) are never suppressible |

**Checks A–H are structural** (the map matches the tree). **P1–P3 are semantic** (the map reads as a
flow) and are additionally pinned by synthetic diagrams in `tests/unit/workflow-arrows.test.js`, so
the linter's own behaviour is contracted by tests, the same way any other requirement is.

**Check `I` is the one that earns trust.** A map is most dangerous not when it is incomplete but when
it is *confidently wrong*. In the author's repository, the first run of `I` failed on an edge the map
drew between the page layer and the copy module: the code did not import it. The map was lying, and
the linter said so — which is exactly the class of lie an agent cannot detect by reading one file. The
fix is never to delete the edge; it is to fix the map (or, if the code change was unintended, the
code): retarget the arrow to the real import, and add the arrow that keeps the target reachable.

## 4. The forcing function — every requirement names the process it touches

A true, cheap map is still a document. For the agent to use it *at design time*, the consultation has
to be part of a step every feature already passes. In the companion setup that step is the
requirements registry: every obligation lives as one row in `REQUIREMENTS.md` with a stable ID and a
test. So the hook is one field on the row:

*   every row carries `flow:` — the business process(es) it extends or touches, `none`, or (for
    grandfathered rows) `legacy`;
*   the value is a comma-separated list of the palette process names, so it shares one vocabulary
    with the map (the linter exports `PROCESSES`);
*   `npm run req` **fails** a new row without a valid `flow:`, or with an unknown process.

The agent cannot reason about which process a feature touches without looking at the map — so merely
filling the field opens the map. That is the whole trick: not a reminder in the prompt, but a required
field whose value comes from the map.

**The exemption is frozen in code, not in a list.** Rows that predate the hook carry `flow: legacy`.
The set is anchored by `LEGACY = { count, sha256 }` inside the coverage script: the check recomputes
the legacy set and fails if it changed. So a new row cannot dodge the hook by writing `legacy` — that
grows the set and trips the anchor. Changing the set is a deliberate, reviewable edit of the constant,
not a quiet marker.

*(Implementation note for the inlined script: the 64-character digest literal is replaced by a
placeholder in §6.4, both because it is meaningless to a stranger and because a long hex run trips the
dump's own secret-entropy scan. Compute your own with the one-liner in §6.4.)*

## 5. Installation order

1. Apply *The requirements machine* first (the registry, `npm run req`, the `AGENTS.md` digest).
2. Create `docs/workflow-arrows.puml` — start from the empty skeleton, not from a full map.
3. Add the linter `scripts/tooling/workflow-map/workflow-arrows-lint.mjs` and the SVG injector
   `workflow-arrows-svg.mjs`; wire the npm scripts in §6.8.
4. Extend `req-coverage.js` with the flow-impact hook (§6.4) and export `PROCESSES` from the linter
   (one truth for the palette).
5. Add the convention doc `AGENTS/workflow-arrows.md` (§6.5) and the digest sections in `AGENTS.md`
   (§6.6); add the flow subsection to `AGENTS/requirements.md` (§6.7).
6. Add the tests `tests/unit/workflow-arrows.test.js` and run `npm test`.
7. Verify: `npm run workflow-arrows:lint` exits 0 (silent) on the starter map.

## 6. Files inlined

Everything below is copied verbatim from the working repository, except where a note says otherwise
(the palette, drawer list and PREFIX are the author's; the legacy digest is a placeholder). Fenced
blocks use four backticks where the inlined file itself contains code fences.

### 6.1 The example map — `docs/workflow-arrows.puml`

The worked example: a real, linted map. Read it as the demonstration of §2, not as your map. It has
one `@startuml`, drawers as `package` blocks, bricks with the label grammar, the numbered flow grouped
by process colour, a legend, and an `@lint-ignore` block with two guarded masks.

````plantuml
@startuml
' workflow-arrows — the linted map of kodavr's code tree and the numbered flow.
' How to read / maintain / lint / render: AGENTS/workflow-arrows.md.
' Never edit the .svg. scripts/tooling/workflow-map/workflow-arrows-lint.mjs fails on any drift:
' drawers, file coverage of code dirs, links, symbols, stereotypes, step numbers.
!pragma layout smetana
' Hover colour source (PlantUML native, QA-5453). The whole-arrow highlight + linger
' is injected into the rendered .svg by `npm run workflow-arrows:svg`; visible only in a
' browser, never in PNG/IDE preview. See AGENTS/workflow-arrows.md.
skinparam pathHoverColor #C62828
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam linetype ortho
skinparam ArrowFontSize 12
skinparam ArrowFontColor #263238
skinparam DefaultFontSize 12
skinparam nodesep 18
skinparam ranksep 28
' Stereotype themes: one per drawer; <<ext>> is reserved for external actors/systems.
skinparam component {
  BackgroundColor<<ext>> #FAFAFA
  BorderColor<<ext>> #9E9E9E
  BackgroundColor<<lib>> #E3F2FD
  BorderColor<<lib>> #1E88E5
  BackgroundColor<<cli>> #FFF3E0
  BorderColor<<cli>> #FB8C00
  BackgroundColor<<audit>> #FFF8E1
  BorderColor<<audit>> #F9A825
  BackgroundColor<<ctrl>> #E8F5E9
  BorderColor<<ctrl>> #43A047
  BackgroundColor<<view>> #EDE7F6
  BorderColor<<view>> #7E57C2
  BackgroundColor<<asset>> #FCE4EC
  BorderColor<<asset>> #D81B60
  BackgroundColor<<content>> #E0F2F1
  BorderColor<<content>> #00897B
}
left to right direction

title kodavr — drawers, bricks and the numbered flow (number · callee method · why)

' ── externals ──────────────────────────────────────────────────────────────────
actor "Author\n(opening a PR)" as AUTHOR
actor "AI agent\n(the reader)" as AGENT
actor "Human\n(a visitor)" as HUMAN
actor "Maintainer\n(merging a PR)" as MAINTAINER
actor "Developer\n(local tools)" as DEVELOPER
component "Ignition engine\nvendor/ignition-ssg\nHandlebars SSG: input/ + data → output/public" as ENGINE <<ext>>
' GitHub = Actions (the workflows) + Pages (the served artifact). Drawn as a
' rectangle, not a package: a package would read as a first-party drawer.
rectangle "GitHub" as GH {
  component "Pages\nserves output/public at kodavr.xyz" as GH_PAGES <<ext>>
  component "validate.yml\nPR + push main\nnpm ci · validate · test · contract · arrows-lint" as WF_VALIDATE <<ext>>
  component "deploy.yml\npush main\nvalidate · build → upload-pages-artifact → Pages" as WF_DEPLOY <<ext>>
  component "audit.yml\npull_request (same-repo)\nvalidate + the advisory audit (model key = a repo secret)" as WF_AUDIT <<ext>>
  component "dump-manifest.yml\npull_request (same-repo)\nposts the sticky manifest card" as WF_MANIFEST <<ext>>
  component "publish-telegram.yml\nworkflow_run ⇐ deploy (success)\nmirrors newly published dumps" as WF_TG <<ext>>
}
component "Playwright (dev)\nrasterizes the OG card and the touch icon" as PW <<ext>>

' ── drawers ────────────────────────────────────────────────────────────────────
package "scripts/lib\nthe smart controller: content, machine contracts, build steps" as P_LIB {
  component "build.mjs\nthe one build pipeline (controller)\n--\nbuildProject" as BUILD <<lib>> [[../scripts/lib/build.mjs#buildProject]]
  component "dumps.mjs\ncontent/dumps/* → engine datasets\n--\nreadDumps · toDataset" as DUMPS <<lib>> [[../scripts/lib/dumps.mjs#readDumps]]
  component "markdown.mjs\nmarkdown → sanitized HTML\n--\nrenderMarkdown" as MD <<lib>> [[../scripts/lib/markdown.mjs#renderMarkdown]]
  component "pages.mjs\nroute datasets: copydeck, SEO, JSON-LD\n--\nbuildRouteDatasets · buildNav" as PAGES <<lib>> [[../scripts/lib/pages.mjs#buildRouteDatasets]]
  component "copy.mjs\nsingle source of truth for every human string" as COPY <<lib>> [[../scripts/lib/copy.mjs]]
  component "i18n-en.mjs\nEnglish bundle: copydeck keys, values referenced verbatim" as I18N_EN <<lib>> [[../scripts/lib/i18n-en.mjs]]
  component "i18n-ru.mjs\nRussian bundle: a draft translation of every copydeck key" as I18N_RU <<lib>> [[../scripts/lib/i18n-ru.mjs]]
  component "i18n-zh-Hans.mjs\nSimplified Chinese bundle: a draft translation of every copydeck key" as I18N_ZH <<lib>> [[../scripts/lib/i18n-zh-Hans.mjs]]
  component "i18n-es.mjs\nSpanish bundle: a draft translation of every copydeck key" as I18N_ES <<lib>> [[../scripts/lib/i18n-es.mjs]]
  component "i18n.mjs\nthe locale registry and the loud keyed translator\n--\nLOCALES · t · assertComplete" as I18N <<lib>> [[../scripts/lib/i18n.mjs#t]]
  component "jsonld.mjs\nsafe schema.org @graph per page\n--\nserializeJsonLd" as JSONLD <<lib>> [[../scripts/lib/jsonld.mjs#serializeJsonLd]]
  component "machine.mjs\nindex.json, schemas, well-known, feeds, tags, sitemap\n--\nwriteMachineFiles · writeSitemap" as MACHINE <<lib>> [[../scripts/lib/machine.mjs#writeMachineFiles]]
  component "schema.mjs\nself-describing JSON Schemas for index/manifest\n--\nbuildIndexSchema · buildManifestSchema" as SCHEMA <<lib>> [[../scripts/lib/schema.mjs#buildIndexSchema]]
  component "ignition.mjs\nspawns the vendored engine\n--\nrunIgnition" as IGN <<lib>> [[../scripts/lib/ignition.mjs#runIgnition]]
  component "relativize.mjs\nhost-agnostic internal links\n--\nrelativizeSite" as REL <<lib>> [[../scripts/lib/relativize.mjs#relativizeSite]]
  component "verbatim.mjs\nverbatim robots/humans\n--\nROBOTS_TXT · HUMANS_TXT" as VERB <<lib>> [[../scripts/lib/verbatim.mjs]]
  component "static-server.mjs\nlocal preview server\n--\ncreateStaticServer" as SSRV <<lib>> [[../scripts/lib/static-server.mjs#createStaticServer]]
  component "manifest-card.mjs\nmanifest.json → the PR reviewer's card\n--\nrenderManifestCard" as MCARD <<lib>> [[../scripts/lib/manifest-card.mjs#renderManifestCard]]
  component "telegram-mirror.mjs\nmanifest + brief → a Telegram mirror post\n--\nrenderMirrorPost" as TGMIRROR <<lib>> [[../scripts/lib/telegram-mirror.mjs#renderMirrorPost]]
}

package "scripts/product\nthe product processes: site build, PR review, telegram, brand media" as P_PRODUCT {
  package "scripts/product/site-build\nthe one build pipeline's entry point" as P_SITE {
    component "build.mjs\nnpm run build → output/public" as CLI_BUILD <<cli>> [[../scripts/product/site-build/build.mjs]]
  }
  package "scripts/product/pr-review\nthe PR surface: the manifest card and the audit entry points" as P_PR {
    component "pr-manifest-card.mjs\nposts the sticky manifest card on a PR" as CLI_CARD <<cli>> [[../scripts/product/pr-review/pr-manifest-card.mjs]]
    component "pr.mjs\nposts the advisory PR audit comment and status" as CLI_AUDIT <<cli>> [[../scripts/product/pr-review/pr.mjs]]
    component "local.mjs\nruns the audit pipeline over our own dumps (npm run audit:local)" as CLI_AUDIT_LOCAL <<cli>> [[../scripts/product/pr-review/local.mjs]]
    component "judge.mjs\nruns the Layer-4 judge over our own dumps (npm run audit:judge)" as CLI_AUDIT_JUDGE <<cli>> [[../scripts/product/pr-review/judge.mjs]]
  }
  package "scripts/product/pr-review/audit\nthe deterministic audit engine: envelope → detectors → policy → report" as P_AUDIT {
    component "channel.mjs\nchannel output schema + allowlist validator\n--\nmakeSpan · validateChannelResult" as AUDIT_CH <<audit>> [[../scripts/product/pr-review/audit/channel.mjs#validateChannelResult]]
    component "detectors.mjs\nLayer-1 structural detectors (invisible, base64, homoglyph, hidden)\n--\nstructuralChannel" as AUDIT_DET <<audit>> [[../scripts/product/pr-review/audit/detectors.mjs#structuralChannel]]
    component "forensic.mjs\nconverged top-N span map for the human\n--\nbuildForensicMap" as AUDIT_FOR <<audit>> [[../scripts/product/pr-review/audit/forensic.mjs#buildForensicMap]]
    component "policy.mjs\ndeterministic envelope + channels -> decision\n--\nevaluatePolicy" as AUDIT_POL <<audit>> [[../scripts/product/pr-review/audit/policy.mjs#evaluatePolicy]]
    component "envelope.mjs\nLayer-0 envelope: diff shape + author signals (no content text)\n--\ncheckDiffShape · evaluateEnvelope" as AUDIT_ENV <<audit>> [[../scripts/product/pr-review/audit/envelope.mjs#evaluateEnvelope]]
    component "report.mjs\nadvisory PR comment: forensic map, no scores, escaped\n--\nrenderAuditComment" as AUDIT_REP <<audit>> [[../scripts/product/pr-review/audit/report.mjs#renderAuditComment]]
    component "pr.mjs\nPR audit orchestration: API inputs -> envelope + policy (shadow)\n--\nrunAudit" as AUDIT_PR <<audit>> [[../scripts/product/pr-review/audit/pr.mjs#runAudit]]
    component "local.mjs\nlocal harness: our own dumps -> the pipeline's verdicts\n--\ndumpToPr · auditDumps" as AUDIT_LOCAL <<audit>> [[../scripts/product/pr-review/audit/local.mjs#dumpToPr]]
  }
  package "scripts/product/pr-review/audit/llm\nthe LLM audit layers: judge, trace/meta, channel composition" as P_AUDIT_LLM {
    component "llm.mjs\nthe LLM provider client: credentials + one strict-JSON call\n--\nproviderFromAuth · callAuditLLM" as AUDIT_LLM <<audit>> [[../scripts/product/pr-review/audit/llm/llm.mjs#callAuditLLM]]
    component "judge.mjs\nLayer-4 LLM judge: data frame, allowlist schema, ensemble\n--\nframeContent · judgeChannel" as AUDIT_JUDGE <<audit>> [[../scripts/product/pr-review/audit/llm/judge.mjs#judgeChannel]]
    component "trace.mjs\nLayer-5 deterministic residue classifier + non-LLM quote-masker\n--\ndetectTraceResidue · quoteMask" as AUDIT_TRACE <<audit>> [[../scripts/product/pr-review/audit/llm/trace.mjs#detectTraceResidue]]
    component "meta.mjs\nLayer-5 LLM meta-reviewer over a quote-masked trace (witness channel)\n--\nbuildMetaMessages · metaReviewChannel" as AUDIT_META <<audit>> [[../scripts/product/pr-review/audit/llm/meta.mjs#metaReviewChannel]]
    component "llm-channels.mjs\ncompose the LLM channels: judge + ensemble + trace/meta, degrade visibly\n--\nbuildLlmChannels" as AUDIT_LLM_CH <<audit>> [[../scripts/product/pr-review/audit/llm/llm-channels.mjs#buildLlmChannels]]
  }
  package "scripts/product/telegram\nthe Telegram mirror entry point" as P_TG {
    component "telegram-mirror.mjs\nmirrors newly published dumps to Telegram" as CLI_TGMIRROR <<cli>> [[../scripts/product/telegram/telegram-mirror.mjs]]
  }
  package "scripts/product/brand-media\nthe brand-image generators (OG card, touch icon)" as P_MEDIA {
    component "generate-og-image.mjs\nrasterizes the OG card" as CLI_OG <<cli>> [[../scripts/product/brand-media/generate-og-image.mjs]]
    component "generate-touch-icon.mjs\nrasterizes the touch icon" as CLI_TI <<cli>> [[../scripts/product/brand-media/generate-touch-icon.mjs]]
  }
}

package "scripts/tooling\nthe development tooling: quality gates, the map, dev tools" as P_TOOLING {
  package "scripts/tooling/quality-gates\nthe CI gates: content validation, requirements, contracts" as P_GATES {
    component "validate.mjs\nKDV-CI gate over content/dumps\n--\nvalidateContent · validateManifest" as CLI_VAL <<cli>> [[../scripts/tooling/quality-gates/validate.mjs#validateContent]]
    component "req-coverage.js\nreconcile tests ↔ REQUIREMENTS.md" as CLI_REQ <<cli>> [[../scripts/tooling/quality-gates/req-coverage.js]]
    component "contract.mjs\nguards the module index (contract headers)\n--\nvalidateAll" as CLI_CONTRACT <<cli>> [[../scripts/tooling/quality-gates/contract.mjs#validateAll]]
  }
  package "scripts/tooling/workflow-map\nthe map itself: its drift alarm and hover injection" as P_MAP {
    component "workflow-arrows-lint.mjs\nthis map's drift alarm\n--\nlintDiagram" as CLI_LINT <<cli>> [[../scripts/tooling/workflow-map/workflow-arrows-lint.mjs#lintDiagram]]
    component "workflow-arrows-svg.mjs\nadds the map's hover block\n--\ninjectHover" as CLI_SVGHOVER <<cli>> [[../scripts/tooling/workflow-map/workflow-arrows-svg.mjs#injectHover]]
  }
  package "scripts/tooling/dev-tools\nlocal developer conveniences" as P_DEV {
    component "serve.mjs\nlocal static server" as CLI_SERVE <<cli>> [[../scripts/tooling/dev-tools/serve.mjs]]
    component "state-diet.mjs\nSTATE.md chronicle → docs/history" as CLI_DIET <<cli>> [[../scripts/tooling/dev-tools/state-diet.mjs]]
  }
}

package "input/controllers\nclient controllers injected by the engine" as P_CTRL {
  component "dumps.js\nthe gate, the hall, the reception toggle" as CTRL_DUMPS <<ctrl>> [[../input/controllers/dumps.js]]
  component "reception.js\nthe reception page behaviour" as CTRL_REC <<ctrl>> [[../input/controllers/reception.js]]
}

package "input/templates\nHandlebars layouts + partials (the HTML projection)" as P_VIEW {
  component "home.hbs · about.hbs · dumps.hbs\nreception.hbs · contribute.hbs\nthe human-surface layouts" as VIEW_PAGES <<view>> [[../input/templates/home.hbs]]
  component "site/gate.hbs · site/reception-block.hbs\nthe consumption-contract partials" as VIEW_GATE <<view>> [[../input/templates/site/gate.hbs]]
}

package "static/assets\nstylesheet, client JS and brand assets" as P_ASSET {
  component "styles.css · site.js\nstyling + the copy-button behaviour" as ASSET <<asset>> [[../static/assets/styles.css]]
  component "logo.svg · og-default.png\ntouch-icon-192.png\nthe wordmark and social/touch images" as ASSET_IMG <<asset>> [[../static/logo.svg]]
}

package "content/dumps\nthe dumps themselves: manifest.json + raw.md per slug" as P_CONTENT {
  component "2026-09-14-kodavr-manifesto/\nmanifest.json + raw.md\nthe launch dump: demo + platform manifesto" as DUMP1 <<content>> [[../content/dumps/2026-09-14-kodavr-manifesto/manifest.json]]
}

' ── flow ───────────────────────────────────────────────────────────────────────
' One arrow colour = one business process; N = global step order 1 to 37. The five
' processes run in dependency order (prerequisites first): PR review (teal, 1-9),
' Publish (blue, 10-25), Notify (purple, 26-27), Consume (green, 28-30),
' Engineering (brown, 31-37); grey #9E9E9E is structural glue, never a numbered step.

' ── rank 1 — PR review (#00897B): a dump arrives as a validated PR.
AUTHOR -[#00897B]-> WF_VALIDATE : 1 · validate.yml\nPR opens → the validate workflow
WF_VALIDATE -[#00897B]-> CLI_VAL : [[../scripts/tooling/quality-gates/validate.mjs#validateContent 2 · validateContent()]]\nthe content gate
WF_VALIDATE -[#00897B]-> CLI_CONTRACT : [[../scripts/tooling/quality-gates/contract.mjs#validateAll 3 · validateAll()]]\nthe module-index gate
WF_VALIDATE -[#00897B]-> CLI_LINT : [[../scripts/tooling/workflow-map/workflow-arrows-lint.mjs#lintDiagram 4 · lintDiagram()]]\nthe map-drift gate
WF_VALIDATE -[#00897B]-> CLI_REQ : [[../scripts/tooling/quality-gates/req-coverage.js 5 · req-coverage]]\ntests ↔ requirements
AUTHOR -[#00897B]-> WF_AUDIT : 6 · audit.yml\nthe same PR → the audit workflow
WF_AUDIT -[#00897B]-> CLI_AUDIT : [[../scripts/product/pr-review/pr.mjs 7 · pr.mjs]]\nthe advisory audit
AUTHOR -[#00897B]-> WF_MANIFEST : 8 · dump-manifest.yml\nthe same PR → the card workflow
WF_MANIFEST -[#00897B]-> CLI_CARD : [[../scripts/product/pr-review/pr-manifest-card.mjs 9 · pr-manifest-card.mjs]]\nthe sticky manifest card

' The advisory audit's internal wiring (dashed, unnumbered, same process).
CLI_AUDIT -[#00897B]..> AUDIT_PR : fetches the diff + author signals via the API\nand runs the deterministic audit
CLI_AUDIT -[#00897B]..> AUDIT_LLM_CH : builds the LLM channels from env\nand passes them to the pure audit
AUDIT_PR -[#00897B]..> AUDIT_ENV : builds the Layer-0 envelope from the diff shape
AUDIT_PR -[#00897B]..> AUDIT_DET : scans the API patch with the Layer-1 detectors
AUDIT_PR -[#00897B]..> AUDIT_POL : reduces envelope + channels to a recommendation
AUDIT_PR -[#00897B]..> AUDIT_REP : renders the advisory comment (marker, no scores)
AUDIT_ENV -[#00897B]..> AUDIT_POL : the envelope feeds the decision
AUDIT_POL -[#00897B]..> AUDIT_CH : evaluates every channel's result
AUDIT_POL -[#00897B]..> AUDIT_FOR : requests the forensic map for the human
AUDIT_DET -[#00897B]..> AUDIT_CH : each detector emits a channel result
AUDIT_LLM_CH -[#00897B]..> AUDIT_LLM : resolves the provider from env\nand retries transient errors
AUDIT_LLM_CH -[#00897B]..> AUDIT_JUDGE : runs the judge, plus a second run for the ensemble
AUDIT_LLM_CH -[#00897B]..> AUDIT_TRACE : reads the primary run's reasoning trace deterministically
AUDIT_LLM_CH -[#00897B]..> AUDIT_META : and asks the meta-reviewer over the masked trace
AUDIT_JUDGE -[#00897B]..> AUDIT_LLM : one strict-JSON chat call per judge run
AUDIT_JUDGE -[#00897B]..> AUDIT_CH : normalizes the judge verdict into a channel result
CLI_CARD -[#00897B]..> MCARD : renders content/dumps/<slug>/manifest.json

' ── rank 2 — Publish (#1E88E5): build → engine → artifact.
MAINTAINER -[#1E88E5]-> WF_DEPLOY : 10 · deploy.yml\nmerge to main
WF_DEPLOY -[#1E88E5]-> CLI_VAL : [[../scripts/tooling/quality-gates/validate.mjs#validateContent 11 · validateContent()]]\nthe same gate before the build
WF_DEPLOY -[#1E88E5]-> CLI_BUILD : [[../scripts/product/site-build/build.mjs 12 · build.mjs]]\nnpm run build
CLI_BUILD -[#1E88E5]-> BUILD : [[../scripts/lib/build.mjs#buildProject 13 · buildProject()]]\nthe one build pipeline (controller)
BUILD -[#1E88E5]-> DUMPS : [[../scripts/lib/dumps.mjs#readDumps 14 · readDumps()]]\nread every content/dumps/*
BUILD -[#1E88E5]-> DUMPS : [[../scripts/lib/dumps.mjs#toDataset 15 · toDataset()]]\nmerge the manifest, turn the body into HTML
DUMPS -[#1E88E5]-> MD : [[../scripts/lib/markdown.mjs#renderMarkdown 16 · renderMarkdown()]]\nsanitize before markdown becomes HTML
BUILD -[#1E88E5]-> PAGES : [[../scripts/lib/pages.mjs#buildRouteDatasets 17 · buildRouteDatasets()]]\nassemble every route's dataset
PAGES -[#1E88E5]-> I18N_EN : [[../scripts/lib/i18n-en.mjs#EN 18 · EN — the English copydeck]]\nthe copydeck source: i18n-en re-exports copy.mjs
PAGES -[#1E88E5]-> JSONLD : [[../scripts/lib/jsonld.mjs#serializeJsonLd 19 · serializeJsonLd()]]\nper-page schema.org @graph
BUILD -[#1E88E5]-> IGN : [[../scripts/lib/ignition.mjs#runIgnition 20 · runIgnition()]]\nhand input/ + data to the engine
IGN -[#1E88E5]-> ENGINE : 21 · engine build\nthe SSG renders output/public
BUILD -[#1E88E5]-> REL : [[../scripts/lib/relativize.mjs#relativizeSite 22 · relativizeSite()]]\nrewrite internal links per page depth
BUILD -[#1E88E5]-> MACHINE : [[../scripts/lib/machine.mjs#writeMachineFiles 23 · writeMachineFiles()]]\nindex.json, well-known, feeds, tags
BUILD -[#1E88E5]-> MACHINE : [[../scripts/lib/machine.mjs#writeSitemap 24 · writeSitemap()]]\nsitemap.xml over the pretty URLs
MACHINE -[#1E88E5]..> GH_PAGES : 25 ⟵ output/public\nthe artifact GitHub Pages serves

' ── rank 3 — Notify (#8E24AA): mirror / card posts on completion.
WF_DEPLOY -[#8E24AA]-> WF_TG : 26 · publish-telegram.yml\non completion (workflow_run) → mirror newly published dumps
WF_TG -[#8E24AA]-> CLI_TGMIRROR : [[../scripts/product/telegram/telegram-mirror.mjs 27 · telegram-mirror.mjs]]\nmirror newly published dumps
CLI_TGMIRROR -[#8E24AA]..> TGMIRROR : renders the mirror post from manifest + brief

' ── rank 4 — Consume (#43A047): machine + human reads.
AGENT -[#43A047]-> MACHINE : [[../scripts/lib/machine.mjs 28 · GET /index.json]]\nthe agent picks dumps by field
AGENT -[#43A047]-> DUMP1 : [[../content/dumps/2026-09-14-kodavr-manifesto/manifest.json 29 · manifest.json + raw]]\nfetch the contract and the body
HUMAN -[#43A047]-> CTRL_DUMPS : [[../input/controllers/dumps.js 30 · dumps.js]]\ncheck in, or hand the dump to an agent

' ── rank 5 — Engineering (#6D4C41): local dev / tooling.
DEVELOPER -[#6D4C41]-> CLI_SERVE : [[../scripts/tooling/dev-tools/serve.mjs 31 · serve.mjs]]\nnpm run serve
DEVELOPER -[#6D4C41]-> CLI_DIET : [[../scripts/tooling/dev-tools/state-diet.mjs 32 · state-diet.mjs]]\nnpm run state:diet
DEVELOPER -[#6D4C41]-> CLI_OG : [[../scripts/product/brand-media/generate-og-image.mjs 33 · generate-og-image.mjs]]\nnpm run og-image
DEVELOPER -[#6D4C41]-> CLI_TI : [[../scripts/product/brand-media/generate-touch-icon.mjs 34 · generate-touch-icon.mjs]]\nnpm run touch-icon
DEVELOPER -[#6D4C41]-> CLI_AUDIT_LOCAL : [[../scripts/product/pr-review/local.mjs 35 · local.mjs]]\nnpm run audit:local
DEVELOPER -[#6D4C41]-> CLI_AUDIT_JUDGE : [[../scripts/product/pr-review/judge.mjs 36 · judge.mjs]]\nnpm run audit:judge
DEVELOPER -[#6D4C41]-> CLI_SVGHOVER : [[../scripts/tooling/workflow-map/workflow-arrows-svg.mjs#injectHover 37 · injectHover()]]\nnpm run workflow-arrows:svg
CLI_SERVE -[#6D4C41]..> SSRV : serves output/public locally
CLI_OG -[#6D4C41]..> PW : rasterizes the OG card
CLI_TI -[#6D4C41]..> PW : rasterizes the touch icon
CLI_AUDIT_LOCAL -[#6D4C41]..> AUDIT_LOCAL : reads content/dumps/* locally\nand prints what the pipeline says
CLI_AUDIT_JUDGE -[#6D4C41]..> AUDIT_JUDGE : frames our own dumps as data\nand runs the Layer-4 judge locally
CLI_AUDIT_JUDGE -[#6D4C41]..> AUDIT_LLM : resolves the provider from env, auth or a work-flow config\n(never a hardcoded key)

' Structural edges (dashed, unnumbered, grey #9E9E9E): imports, assets and glue —
' the things that anchor every remaining brick to the flow (no orphans).
BUILD -[#9E9E9E]..> ASSET : publishes static/ into the artifact
BUILD -[#9E9E9E]..> ASSET_IMG : and the brand images
IGN -[#9E9E9E]..> VIEW_PAGES : the engine renders the layouts
IGN -[#9E9E9E]..> VIEW_GATE : and the consumption-contract partials
IGN -[#9E9E9E]..> CTRL_DUMPS : injects the page controller
IGN -[#9E9E9E]..> CTRL_REC : injects the reception controller
PAGES -[#9E9E9E]..> MACHINE : reads buildIndexEntry / buildWellKnown
MACHINE -[#9E9E9E]..> SCHEMA : embeds + serves the index/manifest JSON Schemas
MACHINE -[#9E9E9E]..> VERB : writes robots.txt / humans.txt verbatim
BUILD -[#9E9E9E]..> I18N : assembles the copydeck + locale bundles
I18N -[#9E9E9E]..> I18N_EN : English: the source bundle
I18N -[#9E9E9E]..> I18N_RU : Russian: a draft translation
I18N -[#9E9E9E]..> I18N_ZH : Simplified Chinese: a draft translation
I18N -[#9E9E9E]..> I18N_ES : Spanish: a draft translation
I18N_EN -[#9E9E9E]..> COPY : re-exports the copydeck (the single source)

legend right
  **how to read an arrow**
  line 1 (colored link):  N · callee.method()  — the API method
  of the TARGET brick this arrow calls (the callee), N = global order 1 to 37
  line 2 (plain text):    why the call happens (business intent)
  solid = call · dashed = return · dashed to an actor = a push
  click a brick → its file · click a call → the method's source
  each brick: name → what it does → -- → members
  **colour = business process**: teal #00897B PR review (rank 1)
  blue #1E88E5 Publish (2) · purple #8E24AA Notify (3)
  green #43A047 Consume (4) · brown #6D4C41 Engineering (5)
  grey #9E9E9E = structural glue (imports/assets), never a numbered step
  **drawers** = first-party code dirs; the code drawers are covered
  file-by-file (scripts/lib, scripts/product/**, scripts/tooling/**, input/controllers)
  **linted idioms** (workflow-arrows-lint): a brick's stereotype =
  its drawer; every numbered call links the callee method,
  returns carry no link; step numbers are exactly 1..N grouped by rank
  steps are grouped by process in dependency order (prerequisites first);
  every brick is reachable from an actor (no orphans)
endlegend

' ── lint suppressions ─────────────────────────────────────────────────────────
' The ignition engine injects the client controllers by path, never by import.
' @lint-ignore
' [I] IGN -> CTRL_DUMPS  # by-path: the controller is spawned by path, not imported
' [I] IGN -> CTRL_REC    # by-path: the controller is spawned by path, not imported
' @end

@enduml
````

### 6.2 The linter — `scripts/tooling/workflow-map/workflow-arrows-lint.mjs`

The utility at the centre of the setup: palette, `DRAWERS`, checks A–H, P1–P3, I, J, M, the
`@lint-ignore` parser, and a CLI that prints `suppressed N` and exits non-zero on unsuppressed drift.
It exports `PROCESSES`, `MASKABLE_CODES`, `lintDiagram`, `lintProblems` and the helpers the tests use.

````js
#!/usr/bin/env node
/**
 * CONTRACT: scripts/tooling/workflow-map/workflow-arrows-lint.mjs
 * ROLE: the drift alarm for docs/workflow-arrows.puml against the code tree
 * EXPORTS:
 *   DRIFT_GUIDANCE — the guidance printed before the DRIFT lines
 *   MASKABLE_CODES — the codes an @lint-ignore mask may suppress (I, P1–P3)
 *   PROCESSES — the 5 business processes: colour = process, rank = global step order
 *   STRUCTURAL_COLOR — the grey used by imports/assets/glue, never a numbered step
 *   actorAliases — the Set of actor aliases declared in the diagram
 *   bricks — the diagram's component bricks with their drawer and link
 *   declaredDrawers — the drawer paths declared in the diagram
 *   formatProblem — render a structured problem as "CODE: subject — message"
 *   lintDiagram — the pure linter over the diagram text (formatted strings)
 *   lintProblems — the structured linter: { problems, suppressed, ignoreErrors }
 *   main — the CLI entry point
 *   missingScriptDrawers — dirs under scripts/ (recursively) not declared drawers
 *   parseArrows — every arrow line as { source, target, operator, color, label }
 *   parseLinks — every [[url]] with its file and #symbol
 *   symbolDeclared — true when a #symbol is declared or called in a file
 * CONSUMES:
 *   node:fs — read the diagram and the linked files
 *   node:path — resolve links and the trees
 *   node:url — find the repo root and detect the entry point
 * INVARIANTS:
 *   — a red lint names the drift and exits 1; it is never weakened to pass
 */

// workflow-arrows-lint — linter for docs/workflow-arrows.puml (kodavr).
//
// The diagram is a hand-drawn map of kodavr's code tree:
//   * drawer blocks  — package "<dir>\n<why>" for each first-party code dir;
//   * module bricks  — component "<file>\n<meaning>\n--\n<members>" as X <<st>> [[<link>]];
//     one grammar (J): NAME → business meaning → `--` → members; the `--` only
//     when members exist, and a linked #symbol must be one of the members;
//   * a numbered flow — labels `N · call` (with a link) / `N ⟵ return` (no link).
// Everything in it points at real things; the linter is the drift alarm:
//
//   (A) drawer coverage both ways — declared drawers vs the configured first-party dirs
//   (B) file coverage both ways for code drawers — every file is a brick, every
//       brick link exists, and no file is drawn twice
//   (C) every [[url]] resolves to an existing file (relative to docs/)
//   (D) a link's #symbol is declared in the target file
//   (E) the flow's step numbers are exactly 1..N, unique and contiguous
//   (F) a brick's stereotype equals its drawer's stereotype
//   (G) T3 idiom — a numbered call to a module brick carries a [[file#symbol]]
//       link; a numbered return carries none
//   (H) every directory under scripts/ (recursively) is a declared drawer, so a
//       new role subfolder or nested process folder cannot be added without
//       drawing it (KDV-STRUCT-09)
//   (I) a drawn edge between two MODULE bricks is a real import in one direction:
//       a by-path spawn (the engine injects the controllers) or a stale map edge
//       is drift; non-modules (.css/.svg/.png/.hbs/...) and unresolved links are
//       other checks' business (KDV-CI-24)
//   (J) every brick/drawer label follows one grammar — NAME, then the business
//       meaning, then `--` and the members (`--` only when members exist):
//       members never sit above the line, a `--` needs a meaning above it and
//       members below it, and a linked #symbol must be one of the members
//       (KDV-CI-26)
//   (P1) every arrow carries a process colour from the palette (or the structural
//       grey) — the colour names the business process
//   (P2) a numbered step carries a process colour (never the structural grey) and
//       the process rank is non-decreasing in draw order: steps grouped by process
//   (P3) every non-exempt brick is reachable from an actor by the drawn arrows
//       (dashed included): no orphan bricks
//   (M) the @lint-ignore block itself is well-formed: a mask may target ONLY a
//       cheap-validation code (I, P1–P3), must cite a reason mechanism
//       (by-path|dynamic|transitive|non-module), and must actually match a
//       problem — an unused, unreasoned or structural-targeting mask is drift
//
// Suppression — a mask is proof of a false positive, never a way to hide a
// structural gap. The block lives in the same puml text:
//   ' @lint-ignore
//   ' [I] IGN -> CTRL_DUMPS  # by-path: spawned by path, not imported
//   ' [P1] arrow *  # transitive: the glue arrow elides the chain
//   ' @end
// A `'`-line without `[CODE]` is a plain comment. The glob matches the problem
// key "CODE: subject" gitignore-style: `*` any run, `?` one char, `!` un-ignores
// keys matched earlier (last match wins). Structural codes (A–H, M) are never
// suppressible.
//
// lintDiagram() is pure over `text`; it reads the filesystem only to resolve
// links and list drawer files. An empty array means clean. The CLI exits 1 on
// any problem and stays silent when the diagram is clean.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_PUML = path.join(ROOT, 'docs', 'workflow-arrows.puml');

// The first-party code drawers. A drawer is a directory block in the map.
// `cover: 'files'` (with `ext`) → every matching file must appear as exactly one
// brick, and every brick link must point at a file in that drawer.
// `cover: 'dir'` → the folder is declared/checked, bricks are illustrative.
const DRAWERS = [
  { path: 'scripts/lib', st: 'lib', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product', st: 'pack', ext: [], cover: 'dir' },
  { path: 'scripts/product/site-build', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/pr-review', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/pr-review/audit', st: 'audit', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/pr-review/audit/llm', st: 'audit', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/telegram', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/product/brand-media', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/tooling', st: 'pack', ext: [], cover: 'dir' },
  { path: 'scripts/tooling/quality-gates', st: 'cli', ext: ['.mjs', '.js'], cover: 'files' },
  { path: 'scripts/tooling/workflow-map', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'scripts/tooling/dev-tools', st: 'cli', ext: ['.mjs'], cover: 'files' },
  { path: 'input/controllers', st: 'ctrl', ext: ['.js'], cover: 'files' },
  { path: 'input/templates', st: 'view', ext: ['.hbs'], cover: 'dir' },
  { path: 'static/assets', st: 'asset', ext: [], cover: 'dir' },
  { path: 'content/dumps', st: 'content', ext: [], cover: 'dir' },
];

// A link carries a scheme when it is not a repo-relative file reference.
const SCHEME = /^(?:www\.|https?:|mailto:|about:)/i;
// Stereotypes that are not a drawer theme: external actors/systems and packs.
const EXEMPT_STEREOTYPES = new Set(['ext', 'pack', 'p_pack']);

// The member-line grammar (KDV-CI-26): identifier-only symbols, ` · `-separated,
// each with an optional `()`. A file list (`home.hbs · about.hbs`) or prose is
// NOT a member line — the dot/space rules them out.
const MEMBER_LINE = /^[A-Za-z_$][\w$]*(\(\))?(?: · [A-Za-z_$][\w$]*(\(\))?)*$/;

// The business processes: the arrow COLOUR names the process and the RANK fixes
// the global step order — all rank-1 steps precede rank-2, and so on (P1/P2).
// One truth: this table is the palette the linter and the diagram share.
export const PROCESSES = [
  { name: 'PR review', rank: 1, color: '#00897B' }, // teal
  { name: 'Publish', rank: 2, color: '#1E88E5' }, // blue
  { name: 'Notify', rank: 3, color: '#8E24AA' }, // purple
  { name: 'Consume', rank: 4, color: '#43A047' }, // green
  { name: 'Engineering', rank: 5, color: '#6D4C41' }, // brown
];

// Grey: imports, assets and glue — a valid arrow colour, but NOT a process and
// never carried by a numbered step.
export const STRUCTURAL_COLOR = '#9E9E9E';

// The guidance a red lint prints BEFORE the DRIFT lines. A failing check must
// send the reader to the rules (fix the diagram / the code), never to a weakened
// check. Exported so a project test can pin the pointer.
export const DRIFT_GUIDANCE = [
  'workflow-arrows-lint: docs/workflow-arrows.puml has drifted from the code.',
  'Maintenance rules + how to read it: AGENTS/workflow-arrows.md',
  'then make the diagram match the code — or fix the code if the change was',
  'unintended. Never weaken/skip this check or erase bricks; re-render the .svg.',
].join('\n');

// The check codes an @lint-ignore mask may suppress — only the cheap validations.
// Everything else (A–H and M) is STRUCTURAL: a mask naming it is itself an error,
// so a structural gap can never be hidden. `I` is the module-edge check: a
// by-path spawn or a dynamic import is a legitimate false positive.
export const MASKABLE_CODES = new Set(['I', 'P1', 'P2', 'P3']);

// The closed vocabulary of reasons a mask may cite. The mechanism states WHY the
// drawn thing is not a real edge, so a mask asserts a falsifiable fact.
const MECHANISMS = new Set(['by-path', 'dynamic', 'transitive', 'non-module']);

// formatProblem(p) → "CODE: subject — message" (the CLI/test rendering).
export function formatProblem(p) {
  return `${p.code}: ${p.subject} — ${p.message}`;
}

// globToRegex(glob) → an unanchored RegExp for a gitignore-style mask: `*` = any
// run, `?` = one char, every other character literal (regex metachars escaped).
function globToRegex(glob) {
  let out = '';
  for (const ch of glob) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out);
}

// parseIgnoreBlock(text) → { masks, errors }. A block is:
//   ' @lint-ignore
//   ' [P1] arrow *  # transitive: ...
//   ' @end
// Only lines between the markers are read; a `'`-line with no `[CODE]` is a
// comment. Every rule is validated here — a maskable code, a reason with a known
// mechanism — and an invalid rule is an M error and is NEVER applied.
const IGNORE_START = /^\s*'\s*@lint-ignore\b/;
const IGNORE_END = /^\s*'\s*@end\b/;

function parseIgnoreBlock(text) {
  const masks = [];
  const errors = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!IGNORE_START.test(lines[i])) continue;
    const startLine = i + 1;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (IGNORE_END.test(lines[j])) {
        end = j;
        break;
      }
    }
    if (end === -1) {
      errors.push({ code: 'M', subject: `line ${startLine}`, message: '@lint-ignore without @end' });
      break;
    }
    for (let k = i + 1; k < end; k++) {
      const raw = lines[k];
      if (!raw.trim()) continue;
      if (!/^\s*'/.test(raw)) {
        errors.push({
          code: 'M',
          subject: `line ${k + 1}`,
          message: "ignore-block line is not a puml comment (must start with ')",
        });
        continue;
      }
      const body = raw.replace(/^\s*'\s?/, '').trim();
      if (!body) continue;
      const rule = body.match(/^\[([A-Za-z0-9]+)\]\s+(.+)$/);
      if (!rule) {
        // A `[`-opening line is meant to be a rule and failed to parse; anything
        // else is a plain comment.
        if (body.startsWith('[')) {
          errors.push({
            code: 'M',
            subject: `line ${k + 1}`,
            message: "malformed mask (expected '[CODE] <glob>  # <mechanism>: <reason>')",
          });
        }
        continue;
      }
      const code = rule[1];
      const rest = rule[2];
      const hash = rest.indexOf('#');
      const globRaw = (hash === -1 ? rest : rest.slice(0, hash)).trim();
      const reason = hash === -1 ? '' : rest.slice(hash + 1);
      const label = `[${code}] ${globRaw}`;

      if (!MASKABLE_CODES.has(code)) {
        errors.push({ code: 'M', subject: label, message: `mask targets a structural check ${code}` });
        continue; // structural targets are never applied
      }
      const mech = reason.match(/^\s*([A-Za-z][\w-]*)\s*:/);
      if (!mech) {
        errors.push({ code: 'M', subject: label, message: "mask has no reason (expected '# <mechanism>: ...')" });
        continue;
      }
      if (!MECHANISMS.has(mech[1])) {
        errors.push({
          code: 'M',
          subject: label,
          message: `unknown mechanism '${mech[1]}' (allowed: by-path|dynamic|transitive|non-module)`,
        });
        continue;
      }
      const negated = globRaw.startsWith('!');
      const glob = negated ? globRaw.slice(1).trim() : globRaw;
      if (!glob) {
        errors.push({ code: 'M', subject: label, message: 'mask has no glob' });
        continue;
      }
      masks.push({ code, glob, negated, regex: globToRegex(glob), label, used: false });
    }
    i = end;
  }
  return { masks, errors };
}

// pkgPath(name) → the drawer path (the title line before the `\n====` divider)
function pkgPath(name) {
  return (name ?? '').split('\\n')[0].trim();
}

// immediateFiles(dir, exts) → sorted direct file names ([] if absent / no match)
function immediateFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && (!exts || !exts.length || exts.some((x) => e.name.endsWith(x))))
    .map((e) => e.name)
    .sort();
}

// declaredDrawers(text) → the drawer paths from `package "<path>..."`
export function declaredDrawers(text) {
  return [
    ...new Set(
      [...text.matchAll(/^\s*package\s+"([^"]*)"/gm)]
        .map((m) => pkgPath(m[1]))
        .filter((p) => p && !p.startsWith('npm:')),
    ),
  ].sort();
}

// parseLinks(text) → [{ raw, url, file, symbol }]. The puml wraps a link as
// [[<url>[ <label>]]]; the URL ends at the first space (the label may hold the
// step number). `file` drops the fragment; `symbol` is the fragment (or null).
export function parseLinks(text) {
  const out = [];
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const raw = m[1];
    const sp = raw.indexOf(' ');
    const url = sp === -1 ? raw : raw.slice(0, sp);
    const hash = url.indexOf('#');
    out.push({
      raw,
      url,
      file: hash === -1 ? url : url.slice(0, hash),
      symbol: hash === -1 ? null : url.slice(hash + 1),
    });
  }
  return out;
}

// The arrow-line grammar: `A -[#c]-> B : label`, `A --> B : label`,
// `A ..> B : label`, `A -[#c]..> B : label`. The operator is captured whole so
// the colour and the solid/dashed shape stay inspectable.
const ARROW_LINE = /^(\w+)\s+(-\[[^\]]+\](?:->|\.\.>)|-->|\.\.>)\s+(\w+)\s*:\s*(.*)$/;

// parseArrows(text) → [{ source, target, operator, color, label }] for every
// arrow line, in draw order. `color` is the normalized `#RRGGBB` or null.
export function parseArrows(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ARROW_LINE);
    if (!m) continue;
    const c = m[2].match(/#([0-9A-Fa-f]{6})/);
    out.push({
      source: m[1],
      target: m[3],
      operator: m[2],
      color: c ? `#${c[1].toUpperCase()}` : null,
      label: m[4],
    });
  }
  return out;
}

// actorAliases(text) → the Set of aliases declared as `actor "..." as X`.
export function actorAliases(text) {
  return new Set([...text.matchAll(/^\s*actor\s+"[^"]*"\s+as\s+(\w+)/gm)].map((m) => m[1]));
}

// missingScriptDrawers(subdirNames, declaredDrawers) → `scripts/<name>` paths still
// missing a drawer declaration. `subdirNames` are relative to scripts/ (a nested
// subpath like `product/site-build` works too), so EVERY directory under scripts/
// recursively — not just the immediate children — must be drawn.
export function missingScriptDrawers(subdirNames, declaredDrawers) {
  return subdirNames
    .map((n) => `scripts/${n}`)
    .filter((p) => !declaredDrawers.includes(p));
}

// scriptDirNames(scriptsDir) → every directory under scripts/, as posix paths
// relative to scripts/ without the `scripts/` prefix (`lib`, `product`,
// `product/pr-review/audit/llm`, …), sorted. The walk is recursive; symlinks are
// not followed (a symlinked dir is skipped), and a missing tree yields [].
function scriptDirNames(scriptsDir) {
  if (!fs.existsSync(scriptsDir)) return [];
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      out.push(child);
      walk(path.join(dir, e.name), child);
    }
  };
  walk(scriptsDir, '');
  return out.sort();
}

// bricks(text) → the components with their enclosing drawer: [{ alias, st, pkg, file }].
// A simple brace-depth scan keeps the innermost open `package "..."` frame;
// `skinparam package { ... }` carries no quoted name and is skipped. `file` is
// the brick's own [[link]] target (the first link on the component line), or null.
export function bricks(text) {
  const out = [];
  const stack = [];
  let depth = 0;
  for (const line of text.split(/\r?\n/)) {
    const pkg = line.match(/^\s*package\s+"([^"]*)"/);
    const comp = line.match(/component\s+"[^"]*"\s+as\s+(\w+)\s*<<(\w+)>>(.*)$/);
    if (pkg) stack.push({ name: pkg[1], depth });
    if (comp) {
      const link = (comp[3].match(/\[\[([^\]]+)\]\]/) || [])[1] ?? null;
      const url = link ? link.split(' ')[0] : null;
      out.push({
        alias: comp[1],
        st: comp[2],
        pkg: stack.length ? stack[stack.length - 1].name : null,
        file: url ? url.split('#')[0] : null,
      });
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    while (stack.length && depth <= stack[stack.length - 1].depth) stack.pop();
  }
  return out;
}

// labelBlocks(text) → every component/package label as { kind, subject, text,
// symbol }: `subject` is the brick alias (or the drawer path), `text` the raw
// quoted label, `symbol` the `#fragment` of the brick's [[link]] (or null). One
// parser feeds check (J), so a brick and a drawer are held to one grammar.
function labelBlocks(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const comp = line.match(/^\s*component\s+"([^"]*)"\s+as\s+(\w+)\s*<<\w+>>(.*)$/);
    if (comp) {
      const link = (comp[3].match(/\[\[([^\]]+)\]\]/) || [])[1] ?? null;
      const url = link ? link.split(' ')[0] : null;
      const hash = url ? url.indexOf('#') : -1;
      out.push({
        kind: 'component',
        subject: comp[2],
        text: comp[1],
        symbol: hash === -1 ? null : url.slice(hash + 1),
      });
      continue;
    }
    const pkg = line.match(/^\s*package\s+"([^"]*)"/);
    if (pkg) {
      out.push({ kind: 'package', subject: pkgPath(pkg[1]), text: pkg[1], symbol: null });
    }
  }
  return out;
}

// symbolDeclared(src, symbol) → true when the symbol is a declaration or a call
// site (a reference alone is not enough: `#handleChat` must be a real member,
// not a mention in a comment). This is what catches a renamed method.
export function symbolDeclared(src, symbol) {
  const s = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${s}\\s*\\(|(?:function|class|const|let|var)\\s+${s}\\b`).test(src);
}

// importSpecifiers(src) → the module specifiers a file imports: static `from`
// clauses (re-exports included), side-effect imports and dynamic `import(...)`,
// deduped. Bare/node specifiers are kept here and filtered later by
// resolveSpecifier (only relative ones are part of our graph).
function importSpecifiers(src) {
  const out = new Set();
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) out.add(m[1]);
  return out;
}

// resolveSpecifier(spec, fromFile) → the absolute file a RELATIVE specifier points
// at, trying the path, `+'.mjs'`, `+'.js'`, `/index.mjs`, `/index.js`; null when
// the specifier is bare / `node:` or nothing exists (not a first-party edge).
function resolveSpecifier(spec, fromFile) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.mjs`, `${base}.js`, path.join(base, 'index.mjs'), path.join(base, 'index.js')];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// moduleFiles(dir) → every `.mjs`/`.js` file under dir, recursively (absolute).
function moduleFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...moduleFiles(p));
    else if (e.isFile() && /\.(?:mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

// buildImportGraph(repoRoot) → Map<absFile, Set<abs imported file>> for every
// first-party module under scripts/ and input/ (relative specifiers resolved).
function buildImportGraph(repoRoot) {
  const graph = new Map();
  const files = [...moduleFiles(path.join(repoRoot, 'scripts')), ...moduleFiles(path.join(repoRoot, 'input'))];
  for (const f of files) {
    const imported = new Set();
    graph.set(f, imported);
    let src;
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const spec of importSpecifiers(src)) {
      const resolved = resolveSpecifier(spec, f);
      if (resolved) imported.add(resolved);
    }
  }
  return graph;
}

// lintProblems(text, { pumlDir, repoRoot }) → { problems, suppressed, ignoreErrors }.
// `problems` = the real problems no mask hides, plus every M (ignore-block) error;
// `suppressed` = { count, list } of the real problems a mask moved out. M errors
// are never suppressible. Pure over `text`.
export function lintProblems(text, { pumlDir = path.dirname(DEFAULT_PUML), repoRoot = ROOT } = {}) {
  const problems = [];
  const all = bricks(text);
  const arrows = parseArrows(text);

  // (A) drawers: the first-party tree, both directions
  const declared = declaredDrawers(text);
  for (const d of DRAWERS) if (!declared.includes(d.path)) problems.push({ code: 'A', subject: d.path, message: 'drawer not drawn' });
  for (const p of declared) {
    if (!DRAWERS.some((d) => d.path === p)) {
      problems.push({ code: 'A', subject: p, message: 'phantom drawer (not a configured first-party dir)' });
    }
  }

  // (H) every directory under scripts/ (recursively) must be a declared drawer
  const scriptsDir = path.join(repoRoot, 'scripts');
  const scriptSubdirs = scriptDirNames(scriptsDir);
  for (const p of missingScriptDrawers(scriptSubdirs, declared)) {
    problems.push({ code: 'H', subject: p, message: 'drawer not drawn (scripts/ subfolder)' });
  }

  // (B) file coverage for code drawers, both directions + no double-draw
  for (const d of DRAWERS) {
    if (d.cover !== 'files') continue;
    const onDisk = immediateFiles(path.join(repoRoot, d.path), d.ext);
    const drawn = all.filter((b) => pkgPath(b.pkg) === d.path && b.file).map((b) => path.basename(b.file));
    for (const f of onDisk) if (!drawn.includes(f)) problems.push({ code: 'B', subject: `${d.path}/${f}`, message: 'file not drawn' });
    for (const f of drawn) if (!onDisk.includes(f)) problems.push({ code: 'B', subject: `${d.path}/${f}`, message: 'phantom brick file' });
    for (const f of new Set(drawn)) {
      if (drawn.filter((x) => x === f).length > 1) {
        problems.push({ code: 'B', subject: `${d.path}/${f}`, message: 'drawn more than once' });
      }
    }
  }

  // (C) + (D) links resolve, and their #symbol is declared in the target
  for (const link of parseLinks(text)) {
    if (SCHEME.test(link.url)) continue;
    const target = path.resolve(pumlDir, link.file);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      problems.push({ code: 'C', subject: link.file, message: 'link target not found' });
      continue;
    }
    if (link.symbol && !symbolDeclared(fs.readFileSync(target, 'utf8'), link.symbol)) {
      problems.push({ code: 'D', subject: `${link.file}#${link.symbol}`, message: `link symbol "${link.symbol}" not declared` });
    }
  }

  // (E) step numbers: the labels must carry exactly 1..N, unique
  const nums = [...text.matchAll(/(\d+)\s*(?:·|⟵)/g)].map((m) => Number(m[1]));
  const seen = new Set();
  const dupes = new Set();
  for (const n of nums) {
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  if (dupes.size) {
    problems.push({ code: 'E', subject: 'flow', message: `step numbering has duplicates: ${[...dupes].sort((a, b) => a - b).join(', ')}` });
  }
  const max = seen.size ? Math.max(...seen) : 0;
  const missing = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length) problems.push({ code: 'E', subject: 'flow', message: `step numbering has gaps: missing ${missing.join(', ')}` });

  // (F) a brick's stereotype must equal its drawer's stereotype
  for (const b of all) {
    const d = DRAWERS.find((x) => x.path === pkgPath(b.pkg));
    if (d && b.st !== d.st) {
      problems.push({
        code: 'F',
        subject: b.alias,
        message: `stereotype <<${b.st}>> mismatches drawer ${d.path} (expect <<${d.st}>>)`,
      });
    }
  }

  // (G) T3 idiom: a numbered call to a module brick must carry a
  // [[file#symbol]] link; a numbered return must carry none. Module bricks are
  // the bricks whose stereotype is not an exempt external/pack one.
  const modules = new Set(all.filter((b) => !EXEMPT_STEREOTYPES.has(b.st)).map((b) => b.alias));
  for (const a of arrows) {
    const target = a.target;
    const label = a.label;
    const hasLink = label.includes('[[');
    if (/(\d+)\s*·/.test(label) && modules.has(target) && !hasLink) {
      problems.push({ code: 'G', subject: `${a.source} -> ${a.target}`, message: `numbered call to module "${target}" lacks a [[file#symbol]] link (T3)` });
    }
    if (/\d+\s*⟵/.test(label) && hasLink) {
      problems.push({ code: 'G', subject: `${a.source} -> ${a.target}`, message: `numbered return to "${target}" must not carry a link (T3)` });
    }
  }

  // (I) a drawn edge between two MODULE bricks must be a real import in one
  // direction. A brick link on a `.mjs`/`.js` file on both ends is checked
  // against the first-party import graph; a by-path spawn or a stale map edge
  // is drift (mask it only with a justified @lint-ignore). Non-module targets
  // (.css/.svg/.png/.hbs/.json) and unresolved links are skipped — other checks
  // own them.
  const MODULE_FILE = /\.(?:mjs|js)$/;
  const byAlias = new Map(all.map((b) => [b.alias, b]));
  const graph = buildImportGraph(repoRoot);
  const seenEdges = new Set();
  for (const a of arrows) {
    const src = byAlias.get(a.source);
    const dst = byAlias.get(a.target);
    if (!src || !dst || !src.file || !dst.file) continue;
    if (!MODULE_FILE.test(src.file) || !MODULE_FILE.test(dst.file)) continue;
    const key = `${a.source} -> ${a.target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    const srcFile = path.resolve(pumlDir, src.file);
    const dstFile = path.resolve(pumlDir, dst.file);
    let bothExist = false;
    try {
      bothExist = fs.statSync(srcFile).isFile() && fs.statSync(dstFile).isFile();
    } catch {
      bothExist = false;
    }
    if (!bothExist) continue; // unresolved links are check (C)'s business
    const forward = graph.get(srcFile) ?? new Set();
    const backward = graph.get(dstFile) ?? new Set();
    if (!forward.has(dstFile) && !backward.has(srcFile)) {
      problems.push({ code: 'I', subject: key, message: 'drawn edge is not a real import in either direction' });
    }
  }

  // (J) one label grammar for every brick and drawer (KDV-CI-26): NAME, then the
  // business meaning, then `--` and the members — the `--` only when members
  // exist. Members never sit above the line; a `--` needs a meaning above it and
  // members below it; a linked #symbol must be one of those members.
  for (const b of labelBlocks(text)) {
    const lines = b.text.split('\\n');
    const separators = lines.filter((l) => l === '--').length;
    if (separators > 1) {
      problems.push({ code: 'J', subject: b.subject, message: 'more than one -- separator' });
      continue;
    }
    const sep = lines.indexOf('--');
    const above = sep === -1 ? lines.slice(1) : lines.slice(1, sep);
    const below = sep === -1 ? [] : lines.slice(sep + 1);
    if (above.some((l) => MEMBER_LINE.test(l))) {
      problems.push({ code: 'J', subject: b.subject, message: 'members must sit below the -- separator' });
    }
    if (sep === -1) continue;
    if (!above.some((l) => !MEMBER_LINE.test(l))) {
      problems.push({ code: 'J', subject: b.subject, message: 'the -- needs a meaning line above it' });
    }
    if (!below.length) {
      problems.push({
        code: 'J',
        subject: b.subject,
        message: 'the -- has no members below it (drop the -- when there are no members)',
      });
      continue;
    }
    if (b.symbol) {
      const sym = b.symbol.replace(/\(\)$/, '');
      const members = new Set();
      for (const ml of below) for (const tok of ml.split(' · ')) members.add(tok.replace(/\(\)$/, ''));
      if (!members.has(sym)) {
        problems.push({
          code: 'J',
          subject: b.subject,
          message: `the linked symbol '${sym}' is not listed among the members below --`,
        });
      }
    }
  }

  // (P1) a process colour: every arrow names its business process (or is grey glue)
  const palette = new Set([...PROCESSES.map((p) => p.color), STRUCTURAL_COLOR]);
  for (const a of arrows) {
    if (!a.color) problems.push({ code: 'P1', subject: `arrow ${a.source} -> ${a.target}`, message: 'has no process colour' });
    else if (!palette.has(a.color)) {
      problems.push({
        code: 'P1',
        subject: `arrow ${a.source} -> ${a.target}`,
        message: `colour ${a.color} is not in the process palette`,
      });
    }
  }

  // (P2) rank order: a numbered step carries a process colour, and the process
  // rank never decreases in draw order — steps are grouped by process.
  const byColor = new Map(PROCESSES.map((p) => [p.color, p]));
  const numbered = [];
  for (const a of arrows) {
    const s = a.label.match(/(\d+)\s*(?:·|⟵)/);
    if (s) numbered.push({ ...a, step: Number(s[1]) });
  }
  for (const a of numbered) {
    if (a.color === STRUCTURAL_COLOR) {
      problems.push({
        code: 'P2',
        subject: `step ${a.step}`,
        message: `(${a.source} -> ${a.target}) carries the structural colour ${STRUCTURAL_COLOR} — numbered arrows must use a process colour`,
      });
    }
  }
  let prev = null;
  for (const a of numbered) {
    const proc = byColor.get(a.color);
    if (!proc) continue;
    if (prev && proc.rank < prev.proc.rank) {
      problems.push({
        code: 'P2',
        subject: `step ${a.step}`,
        message: `step ${prev.step} (${prev.proc.name}, rank ${prev.proc.rank}) precedes step ${a.step} (${proc.name}, rank ${proc.rank}) — steps must be grouped by process rank`,
      });
      break;
    }
    prev = { step: a.step, proc };
  }

  // (P3) no orphan bricks: BFS from the actors over the drawn arrows (dashed
  // edges included); every non-exempt brick must be reachable.
  const reached = new Set(actorAliases(text));
  const edges = new Map();
  for (const a of arrows) {
    if (!edges.has(a.source)) edges.set(a.source, []);
    edges.get(a.source).push(a.target);
  }
  const queue = [...reached];
  while (queue.length) {
    for (const t of edges.get(queue.shift()) ?? []) {
      if (!reached.has(t)) {
        reached.add(t);
        queue.push(t);
      }
    }
  }
  for (const b of all) {
    if (EXEMPT_STEREOTYPES.has(b.st)) continue;
    if (!reached.has(b.alias)) problems.push({ code: 'P3', subject: `brick ${b.alias}`, message: 'is not reachable from any actor' });
  }

  // One truth per issue: collapse exact duplicates before masking.
  const seenKeys = new Set();
  const real = problems.filter((p) => {
    const k = formatProblem(p);
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });

  // Apply the @lint-ignore masks (last match wins) and collect the M errors,
  // which are never suppressible.
  const { masks, errors: ignoreErrors } = parseIgnoreBlock(text);
  const suppressed = [];
  const kept = [];
  for (const p of real) {
    const key = `${p.code}: ${p.subject}`;
    let ignored = false;
    for (const mask of masks) {
      if (mask.regex.test(key)) {
        mask.used = true;
        ignored = !mask.negated;
      }
    }
    (ignored ? suppressed : kept).push(p);
  }
  for (const mask of masks) {
    if (!mask.used) ignoreErrors.push({ code: 'M', subject: mask.label, message: 'unused mask' });
  }

  return {
    problems: [...kept, ...ignoreErrors],
    suppressed: { count: suppressed.length, list: suppressed },
    ignoreErrors,
  };
}

// lintDiagram(text, opts) → formatProblem()ed problems ([] = clean). The string
// API stays for callers/tests that read the DRIFT lines.
export function lintDiagram(text, opts) {
  return lintProblems(text, opts).problems.map(formatProblem);
}

// CLI: read the diagram, print problems, exit 1 on any. Silent when clean.
export function main({ puml = DEFAULT_PUML, pumlDir = path.dirname(puml), repoRoot = ROOT } = {}) {
  let text;
  try {
    text = fs.readFileSync(puml, 'utf8');
  } catch (e) {
    console.error(`workflow-arrows-lint: cannot read ${puml}: ${e.message}`);
    process.exit(1);
    return;
  }
  const { problems, suppressed } = lintProblems(text, { pumlDir, repoRoot });
  if (problems.length) {
    console.error(DRIFT_GUIDANCE);
    console.error(problems.map((p) => `DRIFT ${formatProblem(p)}`).join('\n'));
  }
  if (suppressed.count > 0) console.error(`suppressed ${suppressed.count} (see @lint-ignore)`);
  if (problems.length) process.exit(1);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
````

### 6.3 The hover injector — `scripts/tooling/workflow-map/workflow-arrows-svg.mjs`

A small post-render step: after PlantUML writes the `.svg`, this injects a block that lights a whole
arrow (line, head, label) on hover. Plain-JS detail, but it is part of what makes the *human* render
usable for long cross-cutting arrows.

````js
#!/usr/bin/env node
/**
 * CONTRACT: scripts/tooling/workflow-map/workflow-arrows-svg.mjs
 * ROLE: post-processes the rendered docs/workflow-arrows.svg to add the hover highlight
 * EXPORTS:
 *   injectHover — adds the whole-arrow hover CSS block to an SVG string
 *   parseHoverColor — reads `skinparam pathHoverColor` from the .puml
 *   main — the CLI entry point
 * CONSUMES:
 *   node:fs — read the .puml, rewrite the .svg
 *   node:path — resolve the diagram files
 *   node:url — find the repo root and detect the entry point
 * INVARIANTS:
 *   — injection is idempotent: the block carries a marker and is replaced, never doubled
 *   — the hover colour has one source: skinparam pathHoverColor in the .puml
 */
// workflow-arrows-svg — the hover step for the code map (docs/workflow-arrows.svg).
//
// PlantUML's `skinparam pathHoverColor` emits only `path:hover { stroke: … }`: the
// arrow line is stroke-width 1 (hard to hit), and its head is a <polygon> and its
// label an <a><text> — neither recolours. So after rendering, we append a small
// CSS block that lights the WHOLE arrow (`g.link:hover` — line, head, label),
// thickens the line, and LINGERS on hover-out (a transition delay) so a long arrow
// stays lit while the reader scrolls to its far end. Hover works only in a
// CSS-capable viewer (a browser), never in a PNG or a static IDE preview.
//
// Usage: render the .puml, then `npm run workflow-arrows:svg` (see the doc).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT_SVG = path.join(ROOT, 'docs', 'workflow-arrows.svg');
const DEFAULT_PUML = path.join(ROOT, 'docs', 'workflow-arrows.puml');

// A CSS comment marks the injected block so a re-run replaces it instead of doubling it.
const MARK = '/* workflow-arrows-hover */';
const LINGER_DEFAULT = 5;

// parseHoverColor(puml) → the `skinparam pathHoverColor` value (or the default red).
export function parseHoverColor(puml) {
  const m = puml.match(/^\s*skinparam\s+pathHoverColor\s+(\S+)/im);
  return m ? m[1] : '#C62828';
}

// hoverCss(color, lingerSeconds) → the CSS block: whole-arrow highlight + linger.
function hoverCss(color, lingerSeconds) {
  const t = `.6s ${lingerSeconds}s`;
  return [
    MARK,
    `g.link path,g.link polygon{transition:stroke ${t},fill ${t},stroke-width ${t}}`,
    `g.link:hover path{stroke:${color} !important;stroke-width:2;transition:none}`,
    `g.link:hover polygon{fill:${color} !important;stroke:${color} !important;transition:none}`,
  ].join('\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// injectHover(svg, { color, lingerSeconds }) → the SVG with the hover block appended
// inside its existing <style> (a fresh one is added when the render carries none).
export function injectHover(svg, { color = '#C62828', lingerSeconds = LINGER_DEFAULT } = {}) {
  // Replace any previous injection (marker up to the style's end) so re-runs converge.
  let out = svg.replace(new RegExp(`\\n?${escapeRe(MARK)}[\\s\\S]*?(?=]]></style>|</style>)`), '');
  const block = `\n${hoverCss(color, lingerSeconds)}\n`;
  if (out.includes(']]></style>')) return out.replace(']]></style>', `${block}]]></style>`);
  if (out.includes('</style>')) return out.replace('</style>', `${block}</style>`);
  return out.replace(/(<svg\b[^>]*>)/, `$1<style type="text/css"><![CDATA[${block}]]></style>`);
}

// CLI: read the .puml + .svg, inject the hover block, write the .svg back.
export function main({ svg = DEFAULT_SVG, puml = DEFAULT_PUML, color, lingerSeconds = LINGER_DEFAULT } = {}) {
  let pumlText;
  let svgText;
  try {
    pumlText = fs.readFileSync(puml, 'utf8');
    svgText = fs.readFileSync(svg, 'utf8');
  } catch (e) {
    console.error(`workflow-arrows-svg: ${e.message}`);
    process.exit(1);
    return;
  }
  const c = color || parseHoverColor(pumlText);
  const out = injectHover(svgText, { color: c, lingerSeconds });
  if (out === svgText) {
    console.log('workflow-arrows-svg: hover block already present');
    return;
  }
  fs.writeFileSync(svg, out);
  console.log(`workflow-arrows-svg: hover block written to ${path.relative(ROOT, svg)} (color ${c}, linger ${lingerSeconds}s)`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
````

### 6.4 The flow-impact hook — `scripts/tooling/quality-gates/req-coverage.js`

The requirements-machine coverage check, extended with the `flow:` pass: `checkFlow`, the frozen
`LEGACY` anchor, and the hardened `FLOW` regex (the field must be delimited by `(` or `;`, so prose
mentioning `flow:` is never mistaken for the field).

**Note (the only deliberate edit):** the `sha256` literal in `LEGACY` is replaced by a placeholder.
On a fresh project your legacy set is empty; compute your own anchor and paste it in:

```bash
node -e "const {createHash}=require('node:crypto'); console.log(createHash('sha256').update('').digest('hex'))"
```

````js
#!/usr/bin/env node
/**
 * CONTRACT: scripts/tooling/quality-gates/req-coverage.js
 * ROLE: reconciles requirement IDs between REQUIREMENTS.md and the tests, and enforces the flow-impact hook on every row
 * EXPORTS:
 *   checkFlow — flow: problems for every row, against a frozen legacy exemption anchor
 *   LEGACY — the frozen { count, sha256 } anchor of the grandfathered `flow: legacy` set
 * CONSUMES:
 *   ../workflow-map/workflow-arrows-lint.mjs — the PROCESSES palette (one truth)
 *   node:crypto — sha256 of the sorted legacy ID set (the frozen anchor)
 *   node:fs — read the registry and the tests
 *   node:path — join paths
 *   node:url — find the repo root and detect the entry point
 * INVARIANTS:
 *   — a ✅ row without a test, or a test ID absent from the registry, exits 1
 *   — every row carries a valid flow: (`<process>[,…]` | none | legacy)
 *   — the `flow: legacy` set must match LEGACY exactly, so it cannot silently grow
 */

// scripts/tooling/quality-gates/req-coverage.js — reconcile requirement IDs between REQUIREMENTS.md and tests.
// Exit 1 on: an ID used in a test but absent from the registry; a ✅ row with no test;
// a row without a valid `flow:` field; the frozen `flow: legacy` exemption set changing.
// The exemption set is anchored in code (LEGACY count + sha256), not a file, so a new
// row cannot dodge the hook by writing `legacy` — that changes the set and fails loudly.
// Prefix/suffix are project-specific: set PREFIX and TESTS_DIR below.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PROCESSES } from "../workflow-map/workflow-arrows-lint.mjs"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const PREFIX = "KDV" // ← your registry prefix
const TESTS_DIR = join(ROOT, "tests")

// LEGACY — the frozen anchor of the grandfathered `flow: legacy` set (rows that
// predate the hook). `count` = number of such rows; `sha256` = hex digest of the
// sorted legacy IDs joined by "\n". Changing this set is a deliberate, reviewable
// act: edit the constant only when the change is intentional.
export const LEGACY = {
  count: 0, // <- your grandfathered rows; a fresh project starts at 0
  sha256: "<<fill in the anchor for your legacy set - see the note above>>",
}

// Group codes may contain digits (e.g. KDV-A11Y), so the class is [A-Z0-9].
// One grammar for both the coverage pass and the flow pass (one truth per row).
const ROW = new RegExp(`^-\\s*(✅|🟧|⬜|❓)\\s*\\*\\*(${PREFIX}-[A-Z0-9]+-\\d+)\\*\\*[^\\n]*`, "gm")
// The optional flow: field. It MUST be delimited — preceded by `(` or `;` (the
// reference block's separators) — so prose that merely mentions "flow:" (or a
// `workflow:` token) is never mistaken for the field. The capture stops at `;`
// (reference separator) and `)` (when the field is the last reference).
const FLOW = /[(;]\s*flow:\s*([^;)]+)/
const FLOW_NONE = "none"
const FLOW_LEGACY = "legacy"

// isValidFlow(value, allowed) → true for `none`, `legacy`, or a comma-separated
// list of palette process names (case-sensitive, trimmed). The keywords never mix
// with names or each other: `none, Publish` is invalid because `none` is not a
// palette name and the keyword branch short-circuits only for the bare keyword.
function isValidFlow(value, allowed) {
  if (value === FLOW_NONE || value === FLOW_LEGACY) return true
  const names = value.split(",").map((s) => s.trim()).filter(Boolean)
  return names.length > 0 && names.every((n) => allowed.has(n))
}

// checkFlow(registryText, processNames, frozen) → the flow-impact problems
// ([] = clean). EVERY row must carry a valid `flow:`; the rows declaring
// `flow: legacy` are the grandfathered exemption set, which must match the frozen
// anchor `{ count, sha256 }` exactly — otherwise a new row could dodge by writing
// `legacy`. Pure over its arguments (sha256 via node:crypto).
export function checkFlow(registryText, processNames, frozen) {
  const allowed = new Set(processNames)
  const problems = []
  const legacyIds = []
  for (const m of registryText.matchAll(ROW)) {
    const id = m[2]
    const fm = m[0].match(FLOW)
    if (!fm) {
      problems.push(`requirement ${id} has no flow: field (name a process, 'none', or 'legacy')`)
      continue
    }
    const value = fm[1].trim()
    if (!isValidFlow(value, allowed)) {
      problems.push(
        `requirement ${id} has an unknown flow: '${value}' (allowed: ${[...allowed, FLOW_NONE, FLOW_LEGACY].join(", ")})`,
      )
      continue
    }
    if (value === FLOW_LEGACY) legacyIds.push(id)
  }
  legacyIds.sort()
  const digest = createHash("sha256").update(legacyIds.join("\n")).digest("hex")
  if (legacyIds.length !== frozen.count || digest !== frozen.sha256) {
    problems.push(
      `the flow: legacy exemption set changed (frozen ${frozen.count}/${frozen.sha256.slice(0, 8)}…, ` +
        `now ${legacyIds.length}/${digest.slice(0, 8)}…) — a new requirement must name a process or 'none'; ` +
        `if the change is intentional, update LEGACY in req-coverage.js`,
    )
  }
  return problems
}

function main() {
  const registry = readFileSync(join(ROOT, "REQUIREMENTS.md"), "utf8")
  const rows = [...registry.matchAll(ROW)].map((m) => ({ status: m[1], id: m[2] }))

  // The tests directory may not exist yet on a fresh project — treat it as "no tests".
  const files = []
  if (existsSync(TESTS_DIR)) {
    ;(function walk(dir) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        // Playwright specs (`*.e2e.js`) are registry tests too — they carry the
        // requirement ID as the first word of the test title exactly like vitest.
        else if (/\.(test|spec|e2e)\.[cm]?[jt]s$/.test(name)) files.push(p)
      }
    })(TESTS_DIR)
  }

  const tested = new Set()
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(new RegExp(`${PREFIX}-[A-Z0-9]+-\\d+`, "g"))) tested.add(m[0])
  }

  const known = new Set(rows.map((r) => r.id))
  const problems = []
  for (const id of [...tested].sort()) if (!known.has(id)) problems.push(`test uses unknown ID: ${id}`)
  for (const r of rows) if (r.status === "✅" && !tested.has(r.id)) problems.push(`✅ without a test: ${r.id}`)

  problems.push(...checkFlow(registry, PROCESSES.map((p) => p.name), LEGACY))

  if (problems.length) {
    console.error("req-coverage FAILED:\n  " + problems.join("\n  "))
    process.exit(1)
  }
  console.log(`req-coverage OK (${rows.length} rows, ${tested.size} IDs tested)`)
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) main()
````

### 6.5 The convention doc — `AGENTS/workflow-arrows.md`

This is the file the **agent** reads: how to interpret the map, the palette, the drawers table, the
linted idioms, the checks, how to suppress a false positive, and how to maintain and render. Drop it
into your `AGENTS/` and point at it from `AGENTS.md` (§6.6). If you keep only one file from this dump,
keep this one — the rest are its machinery.

````md
# workflow-arrows — the workflow map (`docs/workflow-arrows.puml` → `.svg`)

Two files, one artifact:

- **`docs/workflow-arrows.puml`** — the machine source: plain text, the thing you
  edit, checked by the linter.
- **`docs/workflow-arrows.svg`** — the human render: generated from the `.puml`,
  the thing people look at. Never edit it by hand. A fresh project has no `.svg`
  until the map has content and is rendered once.

The map starts empty and grows with the code: add a drawer when a first-party code
directory appears, a brick when a module appears, a numbered arrow when a
cross-cutting flow appears. The linter (`scripts/tooling/workflow-map/workflow-arrows-lint.mjs`) keeps it
from rotting, locally and in CI.

## Why a trustworthy map

Code maps usually rot: they show whatever modules someone happened to open last.
This one is linted against the code tree, so it either matches the code or the lint
goes red. That matters when you touch a cross-cutting flow: you can see the whole
picture at once and extend the flow that already exists instead of adding a parallel
path around it. A map you can trust is what prevents those workarounds.

Think of the code as a park with a few main paths — the cross-cutting flows. A new
feature should widen a path or add a bench, not cut a flowerbed straight across one
because that is the shortest line to the goal: the flowerbed "works" until someone
walks the path, and then it is just broken ground. A shortcut around a shared step
is the same — it routes delivery around the step that owns the concern; locally
green, globally a second truth that drifts. Widening the path is the work; cutting
across it is the bug.

## How to read it

- **Drawers** = first-party code directories, drawn as a `package "<dir>\n<why>"`
  block; the header says why the directory exists. Externals (actors, the engine,
  GitHub, dev tools) are top-level bricks stereotyped `<<ext>>`.
- A **brick** = one file, drawn with one label grammar (check J below):
  `NAME` → one or more lines of **what it does** (business meaning) → `--` →
  **members** (its exported symbols). The `--` exists **only** when there are
  members; a brick whose meaning line already names its one method needs no
  members line. It carries its drawer's stereotype and links its file
  (`[[../<path>#symbol <label>]]`, symbol optional).
- **Numbered arrows** = the flow order `1..N`. Label line 1 is
  `N · callee.method()` — the API method **of the target brick** (the callee).
  Label line 2 (plain text) is **why** the call happens.
- **Solid** `-->` = a call; **dashed** `..>` = a return or a push.
- **Colour** = the business process (P1/P2 below): every arrow carries
  `-[#RRGGBB]->` from the palette, and the numbered flow is grouped by process
  rank, so all rank-1 steps come before rank-2, and so on. Grey `#9E9E9E` is
  structural glue (imports, assets), never a process and never a numbered step.
- **No orphans**: every non-exempt brick must be reachable from an actor by
  following the drawn arrows (dashed included).
- **Click targets**: a brick opens its file, a call label opens the callee method
  (in the `.svg` + the IntelliJ PlantUML plugin).

## Process palette

| # | Process | Colour | Covers |
|---|---|---|---|
| 1 | PR review | `#00897B` teal | a dump arrives as a validated PR |
| 2 | Publish | `#1E88E5` blue | build → engine → artifact |
| 3 | Notify | `#8E24AA` purple | mirroring / card posts |
| 4 | Consume | `#43A047` green | machine + human reads |
| 5 | Engineering | `#6D4C41` brown | local dev / tooling |

The table lives in `PROCESSES` (plus `STRUCTURAL_COLOR`) at the top of the linter.

## The drawers (kodavr)

A drawer is either **file-covered** (`cover: files`) or **dir-only** (`cover: dir`).
For a file-covered drawer every matching file must appear as exactly one brick, and
every brick must link a file in that drawer. Dir-only drawers need only be drawn;
their bricks are illustrative.

| Drawer | Stereotype | Coverage |
|---|---|---|
| `scripts/lib` | `<<lib>>` | files `.mjs` — the shared publishing engine |
| `scripts/product` | `<<pack>>` | dir — the product processes |
| `scripts/product/site-build` | `<<cli>>` | files `.mjs` — the site build entry point |
| `scripts/product/pr-review` | `<<cli>>` | files `.mjs` — the PR surface: card + audit entry points |
| `scripts/product/pr-review/audit` | `<<audit>>` | files `.mjs` — the deterministic audit engine |
| `scripts/product/pr-review/audit/llm` | `<<audit>>` | files `.mjs` — the LLM audit layers |
| `scripts/product/telegram` | `<<cli>>` | files `.mjs` — the Telegram mirror entry point |
| `scripts/product/brand-media` | `<<cli>>` | files `.mjs` — the brand-image generators |
| `scripts/tooling` | `<<pack>>` | dir — the development tooling |
| `scripts/tooling/quality-gates` | `<<cli>>` | files `.mjs`, `.js` — the CI gates |
| `scripts/tooling/workflow-map` | `<<cli>>` | files `.mjs` — the map's drift alarm + hover injection |
| `scripts/tooling/dev-tools` | `<<cli>>` | files `.mjs` — local dev conveniences |
| `input/controllers` | `<<ctrl>>` | files `.js` — engine-injected client controllers |
| `input/templates` | `<<view>>` | dir — Handlebars layouts + partials |
| `static/assets` | `<<asset>>` | dir — stylesheet, client JS, brand images |
| `content/dumps` | `<<content>>` | dir — the dumps themselves |

The set lives in `DRAWERS` at the top of the linter. The `scripts/` tree is
two-level — `scripts/<category>/<process>/` with categories `product` and
`tooling` around the shared `lib/` engine; a category and a process folder are
both drawers. Add a directory there when a new first-party tree appears, and draw
its block.

## Linted idioms (T1–T6)

The linter pins these; every new brick or arrow must obey them.

- **T1** — a brick's stereotype equals its drawer's stereotype (exempt: `<<ext>>`).
- **T2** — a drawer's title first line is exactly the directory path.
- **T3** — numbered **call** arrows carry a `[[file#symbol]]` link; **returns carry no link**.
- **T4** — the step number is the label's first token: `N ·` for a call,
  `N ⟵` for a return.
- **T5** — a link's `#symbol` must be declared in the target file.
- **T6** — returns use `..>` and `⟵`.
- **T7** — one label grammar for every brick and drawer: `NAME`, then the business
  meaning, then `--` and the members — the `--` only when members exist. Members
  never sit above the line, and a linked `#symbol` must be one of the members
  (enforced by check J, KDV-CI-26).

## The linter

`scripts/tooling/workflow-map/workflow-arrows-lint.mjs`, pure `lintDiagram({ text, pumlDir, repoRoot })`.
Run it from the project root (silent, exit 0 when clean):

```
npm run workflow-arrows:lint
```

It also runs in CI (`validate.yml`, KDV-CI-12) and is pinned by
`tests/unit/workflow-arrows.test.js`, so `npm test` covers the map too.

Checks:

- **(A)** drawer coverage both ways — declared drawers ↔ the configured first-party dirs.
- **(B)** file coverage both ways for code drawers — every file is exactly one brick,
  every brick link exists, no file drawn twice.
- **(C)** every `[[url]]` resolves relative to `docs/`.
- **(D)** a link's `#symbol` is declared in the target file.
- **(E)** step numbers are exactly `1..N`, unique and contiguous.
- **(F)** a brick's stereotype equals its drawer's (T1).
- **(G)** a numbered **call** to a module brick carries a `[[file#symbol]]` link;
  a numbered **return** carries none (T3).
- **(I)** a drawn edge between two **module** bricks is a real import in one
  direction (KDV-CI-24): the linter builds the first-party import graph over
  `scripts/` + `input/` (static `from`, side-effect `import`, dynamic `import(...)`;
  relative specifiers resolved to `.mjs`/`.js`), and an edge whose two `.mjs`/`.js`
  bricks never import each other is drift. A **by-path** spawn (the engine injects
  `input/controllers/*` by path) or a **dynamic** call is a legitimate false
  positive — mask it with `@lint-ignore`. Non-modules (`.css`/`.svg`/`.png`/`.hbs`/
  `.json`) and unresolved links are other checks' business.
- **(J)** every brick/drawer label follows one grammar (KDV-CI-26, T7): at most
  one `--`; the lines above it (besides the NAME) are business meaning, never
  members; a `--` has a meaning line above it and members below it; and a brick
  whose link carries a `#symbol` must list that symbol among the members below
  the line. The old `NAME / members / -- / meaning` shape is drift.
- **(P1)** every arrow carries a process colour from the palette, or the
  structural grey (no colour, or an unknown colour, is drift).
- **(P2)** a numbered step carries a process colour (never the structural grey)
  and the process rank is non-decreasing in draw order — steps grouped by process.
- **(P3)** every non-exempt brick is reachable from an actor by the drawn arrows
  (dashed included) — no orphan bricks.
- **(M)** the `@lint-ignore` block is well-formed (see below) — a bad mask is
  itself drift.

P1–P3 are pinned independently of the hand-drawn map by synthetic diagrams in
`tests/unit/workflow-arrows.test.js` (KDV-CI-22).

### Suppressing a false positive (`@lint-ignore`)

Some drawn edges are legitimately not imports: a `by-path` controller is spawned
by path, a call is dynamic, a transitive chain is elided, an artifact is no
module. A mask suppresses ONLY such a **cheap-validation** problem — the codes
`I`, `P1`, `P2`, `P3` — and never a structural one (A–H, or the block's own `M`).
**A mask is proof of a false positive, never a way to hide a structural gap.**

Embed the mask block in the `.puml` itself:

```
' @lint-ignore
' [I] IGN -> CTRL_DUMPS  # by-path: spawned by path, not imported
' [P1] arrow *  # transitive: the glue arrow elides the chain
' @end
```

- Only lines between `@lint-ignore` and `@end` are read; a `'`-line with no
  `[CODE]` is a plain comment.
- The glob matches the problem key `CODE: subject` gitignore-style: `*` any run,
  `?` one char, `!` un-ignores a key matched earlier (last match wins).
- Every rule MUST carry `# <mechanism>: <reason>`; the mechanism is one of
  `by-path`, `dynamic`, `transitive`, `non-module` — the closed vocabulary that
  makes a mask assert *why* it is a false positive.
- The guards are themselves `M` problems, never suppressible: a mask targeting a
  structural code, a mask with no reason, an unknown mechanism, an unused mask,
  or an `@lint-ignore` without `@end`.
- Suppressed problems are reported, not hidden: the CLI prints
  `suppressed N (see @lint-ignore)` and exits 0 only when nothing unsuppressed
  remains. After a real code fix, remove the mask so it does not go unused.
- Maskable codes are pinned as `MASKABLE_CODES` in the linter (`I, P1, P2, P3`;
  `I` is the module-edge check of KDV-CI-24).

## When lint fails

A red lint is the drift alarm, not an obstacle. Do this:

1. **Read this file and the `DRIFT` lines** — they name what drifted.
2. **Fix the diagram** so drawers, files, links, symbols, stereotypes and numbers
   match the code: the code is the truth, the map follows it.
3. If the code change was **unintended**, fix the code instead.
4. **Never** weaken or skip the check, and never erase bricks to silence it.
5. **Re-render** the `.svg` after editing.

The linter prints this file's path in the guidance for exactly this reason.

## Maintaining & rendering

**Editing the `.puml` is not finished until `docs/workflow-arrows.svg` is re-rendered
and committed in the SAME change** — source and render are one artifact; an
unrendered `.puml` edit is an incomplete edit.

Render (Smetana layout — no GraphViz needed):

```
java -jar <plantuml.jar> -tsvg -charset UTF-8 docs/workflow-arrows.puml
```

Then confirm the `.svg` holds no `Syntax Error`. Add the hover block (it is part of
the render, not an extra) and commit both files:

```
npm run workflow-arrows:svg
```

- Links are relative **to `docs/`**:
  `[[../scripts/lib/build.mjs#buildProject <label>]]`. The label follows the URL
  after a **space** — not `{}`. No absolute paths, no `file://` (the IntelliJ plugin
  opens neither).
- `====` is gone from drawers: one grammar everywhere — `NAME` → what it does →
  `--` → members; `--` draws the divider inside a brick and exists only when
  members follow (T7, check J).
- **Add a module → add a brick** — otherwise a code drawer fails file coverage.
- `npm run workflow-arrows:svg` injects the **hover block**: the whole arrow lights up
  (line, head, label) in the `.puml`'s `skinparam pathHoverColor` colour, and lingers
  ~5s after the pointer leaves — so a long arrow stays lit while you scroll to its far
  end. It shows only in a CSS-capable viewer (a browser), never in PNG or an IDE
  preview. The committed `.svg` must carry the block (pinned by KDV-CI-21).
- **Commit `.puml` and `.svg` together** — source and render are one artifact.
````

### 6.6 Prompt additions to `AGENTS.md`

Two touch points in the startup digest. First, a principle, so the rule is one of the project's values
and not a footnote:

```markdown
9. **Extend the flow, don't route around it.** A feature is woven into the existing flow that
   owns its concern — never a parallel path that bypasses the common step. Read the flow map
   (`AGENTS/workflow-arrows.md`) before changing a part.
```

Then a structural pointer in the "Structure" section, next to the code map:

```markdown
### Flow map — `docs/workflow-arrows.puml` (AGENTS/workflow-arrows.md)

The linted map of the code tree and the numbered cross-cutting flow. Read it before
changing a part so you extend the flow that already exists instead of adding a parallel
path around it. How to read / maintain / lint / render — **AGENTS/workflow-arrows.md**;
the drift alarm is `npm run workflow-arrows:lint` (silent, exit 0 when clean).
```

And the command, in the digest's command list:

```bash
npm run workflow-arrows:lint  # workflow-map drift alarm (silent when clean)
```

### 6.7 Prompt addition to `AGENTS/requirements.md`

The registry's own protocol gains the flow-impact subsection, so the person (and agent) maintaining the
registry knows why the field exists and how the exemption is anchored:

```markdown
## Flow impact — every requirement names its process

Every row carries a `flow:` field naming the business process(es) it extends or
touches, so the designer consults the workflow map (`docs/workflow-arrows.puml`)
BEFORE writing code. The value is one of:

- `none` — the requirement touches no business process;
- a comma-separated list of palette process names — `PR review`, `Publish`,
  `Notify`, `Consume`, `Engineering` (the palette is exported by the map linter:
  one truth per entity);
- `legacy` — the frozen pre-hook exemption (see below). Never write it on a new row.

`npm run req` enforces it: a row without a valid `flow:` fails, and any row whose
`flow:` value is unknown fails.

**The exemption set is frozen in code.** Rows that predate the hook carry `flow:
legacy`; `req-coverage.js` exports `LEGACY = { count, sha256 }` — the anchor of
that exact set (count + sha256 of the sorted IDs). `npm run req` recomputes the
actual legacy set and fails if it differs, so a new requirement cannot dodge the
hook by writing `legacy`: that grows the set and trips the anchor. Changing the set
is a deliberate, reviewable act — edit `LEGACY` in `req-coverage.js` only when the
change is intentional.
```

### 6.8 npm scripts to wire

```json
{
  "scripts": {
    "workflow-arrows:lint": "node scripts/tooling/workflow-map/workflow-arrows-lint.mjs",
    "workflow-arrows:svg": "node scripts/tooling/workflow-map/workflow-arrows-svg.mjs",
    "req": "node scripts/tooling/quality-gates/req-coverage.js",
    "validate": "node scripts/tooling/quality-gates/validate.mjs",
    "test": "vitest run"
  }
}
```

Rendering the `.svg` (Smetana layout — no GraphViz needed) is a manual step you run after editing the
`.puml`, then the injector:

```bash
java -jar <plantuml.jar> -tsvg -charset UTF-8 docs/workflow-arrows.puml
npm run workflow-arrows:svg
```

Commit the `.puml` and the `.svg` **together** — source and render are one artifact. An unrendered
`.puml` edit is an incomplete edit (the convention doc says this, and it is the one rule that keeps
the two files from diverging).

## 7. What failed, and what is honest

This was built, not designed in one pass; the failures are part of the recipe.

*   **The map was lying.** The first run of check `I` failed on the page → copy edge, which the code
    did not import. The lesson is the check itself: an agent cannot catch a confidently-wrong edge by
    reading one file, so the map needs a mechanical truth check, not a promise to keep it updated.
*   **Orphans happened.** Early maps had bricks with no actor reachable (a controller nothing appeared
    to call). `P3` exists because "draw something" without a flow produces decoration.
*   **The invariant "one grammar" was violated in the real map.** Half the bricks put members above
    the `--` and meaning below; half did the reverse. It was invisible to humans and confusing to a
    reader, so check `J` was added and the whole map transformed in one pass — a big mechanical edit
    that a test then pinned.
*   **Suppressions multiplied without a reason.** The first escape hatch was a bare "ignore"; it hid
    real drift. The mechanism vocabulary (`by-path`/`dynamic`/`transitive`/`non-module`) and the
    "unused mask is an error" guard exist to make a mask a checkable claim.
*   **Honest limit.** What is *proven* here: the map provably matches the code tree (checks A–I are
    executable and pinned by tests), and the coverage check provably refuses a requirement without a
    process. What is *designed but not measured*: that an agent therefore designs better and routes
    around fewer shared steps. That is the intended effect and the reason to build the machine —
    flagged `experimental`, not claimed as a measured outcome.

Rejected alternatives, recorded so you do not re-derive them:

*   **Full parity between the import graph and the map** (every import drawn): it added roughly a third
    more edges, most of them noise or transitive duplicates — a heavier map the agent reads worse. The
    chosen check `I` is one-directional: *a drawn module-to-module edge must be a real import*, not *every
    import must be drawn*.
*   **Silent warnings / a `.mapignore` of whole files**: it removes the discipline. The mask is narrow
    (`I`, `P1`–`P3`), must name a mechanism, and reports itself.
*   **An exemption marker without an anchor**: any new row could write `legacy`. The frozen `count +
    sha256` anchor makes that a loud, reviewable edit.
*   **Cosmetic auto-layout** (grouping boxes for visual tidiness): rejected — the agent reads text, and
    the layout only added to the map's weight.

## 8. Reproduce / verify

From `<project>`:

```bash
npm run workflow-arrows:lint     # the map matches the code (silent, exit 0 when clean)
npm run req                      # the registry: IDs covered AND every row names its process
npm test                         # includes the synthetic diagrams pinning P1-P3
```

To watch the mechanism bite, do the two red tests by hand:

1. Add an edge in the `.puml` between two module bricks that do not import each other, and run
   `npm run workflow-arrows:lint` — check `I` fails and names the edge (the map is lying).
2. Add a registry row with no `flow:` field and run `npm run req` — it fails and names the row; add
   `flow: legacy` and it still fails (the anchor moved).

## 9. Companion dumps

*   **The requirements machine** — https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/ —
    the registry, the coverage check and the idea process this dump extends. **Apply first.**
*   **The agent-control loop** — https://kodavr.xyz/dumps/2026-09-18-opencode-agent-control/ — the
    global OpenCode loop, the `AGENTS.md` digest and the `STATE.md` checkpoint that the flow map hangs
    off.

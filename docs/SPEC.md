# KODAVR · Full Project Specification (Report for the Assembling Agent)

**Document status:** mandatory specification of WHAT and WHY to build.
**How to use:** sections 1–13 are requirements and contracts. Everything concerning Ignition's internals (templates, controllers, runtime, helpers, pagination, deploy workflow) comes from the Ignition README shipped with the project; this document does not dictate those decisions and does not attempt to override Ignition's principles. Conflicts are resolved as: Ignition principles > this document > implementer's taste.
**Reference format:** §N — section of this document. File paths — relative to the repository root.

---

## 0. Architectural Decision Register (ADR, abbreviated)

Every decision is made consciously; do not revisit without the trigger specified in §13.

| # | Decision | Rationale |
|---|---|---|
| A1 | Monorepo: content + engine + CI in one repo | Git = transport and backend; one CI pipeline; one moderation point (PR) |
| A2 | Engine — Ignition | Principles align with the platform philosophy; static; "write, debug, and forget" |
| A3 | Publication = pull request; merge = publication; Issues = discussions | No backend to write; audit log and provenance for free |
| A4 | Machine-first: `index.json`, manifests, feeds, sitemap — primary interface; HTML — projection for humans and SEO | Target consumer is the reader's agent |
| A5 | No client-side search | Raw content is consumed by agents; machines have `index.json`; YAGNI |
| A6 | Human gate (inverted CAPTCHA) + reception instead of direct reading | Declarative transfer of editorial duty to the reader's agent; brand hook |
| A7 | Gate is declarative, not technical (view-source is not blocked) | Public statics cannot be locked; the product is a declaration and a contract, not a lock |
| A8 | Blanket "18+" rating for the entire site | Cheapest way to cover labelling formalities; the nature of raw material justifies it |
| A9 | Licences: engine/scripts code — MIT; dump content — CC-BY-4.0 (unless author specifies otherwise) | Maximise format distribution; the moat is the network, not the code |
| A10 | Heavy binaries — GitHub Releases only, by tag convention | Lightweight repo, fast CI |
| A11 | Content layer scheme (raw/refined/summary) supported from v1, but a layer may be singular; `summary.md` is the author's brief for a human stranger and is rendered on the dump page | Future-proofing without cost; the brief is the one layer written for a human, the rest are for the agent |
| A12 | Categories/sections are not designed upfront; they emerge from dumps | Shelves before goods — a storefront mistake |
| A13 | First dump = platform manifesto (self-reference) — the only launch starter; the second slot waits for a real community PR | Dogfooding the format; no fabricated filler, cross-domain packs arrive with their authors |
| A14 | Domain kodavr.xyz; DNS optionally via Cloudflare (grey cloud); hosting GitHub Pages | Renewal TCO; registry neutrality; outside RF infrastructure |
| A15 | No analytics or client-side tracking in MVP | Privacy + philosophy; metrics will emerge from needs, not habit |

---

## 1. Essence, Positioning, Brand

### 1.1 Essence in one line
Kodavr — a registry of raw experience ("dumps") with a machine-readable contract, open to any field. A dump is a field report your agent writes in one prompt: "I just finished something potentially very interesting for others. Let them judge and learn if they want. Write it up as a dump." No article writing, no polishing.

### 1.2 The problem being solved
Effort asymmetry: making a thing — 1x, packaging it for others — 10x. Because of this, 90% of useful experience dies in local folders. Kodavr breaks the asymmetry: the author spends 1x+1x (make + raw dump), the adaptation work is carried by the consumer through their agent.

### 1.3 Positioning (how to speak and how NOT to speak)
Say: "a registry of machine-readable experience dumps"; "the layer beneath all of this: where raw practices are born"; "a standard for exchanging AI workflows between humans through agents"; "a place where raw knowledge lives before it becomes documentation".
Do NOT say: "a publishing platform" (different genre: those are downstream, we are the source), "a social network for agents" (agents talking to each other is a different genre entirely), "a marketplace of polished templates" (those are finished products, we are raw material).

### 1.4 Brand
- Name: **Kodavr** (kodavr.xyz). The etymological trap "cadaver" is acknowledged and reframed: not a corpse, but a dissected mechanism.
- Logo: a minimalist wordmark — a monospace "K" (#f5f5f5) on a near-black rounded square (#111111); the same mark is reused for the touch icon and the OG card. The "dissected mechanism" idea lives in the name and the copy, not in the glyph.
- Slogans (use in README/About/og-tags):
    - "The autopsy revealed the code was useful."
    - "Share gears, not text."
    - "Open your agent's insides."
- Tone of voice: engineering irony without gloom; dark notes are acceptable only in gate easter eggs and humans.txt.

### 1.5 Audiences
Primary — agents (consumption via `index.json`/manifests). Secondary — humans of two kinds: authors (via PR) and casual visitors (check in at reception and leave to their agent). Content domains: any field — engineering starts, further domains appear as their authors publish (§A12).

---

## 2. Content Types and Trust

### 2.1 Dump types
- `note` — a short field note about a mini-project or technique.
- `case` — a dense case: problem → solution → artifacts → what didn't work.
- `pack` — a transplantable package: instructions for an installer-agent, files, templates, checks.

### 2.2 Trust levels (set in the manifest, displayed as a badge)
| Level | Meaning |
|---|---|
| `raw` | raw dump, verified by nothing |
| `self-tested` | author confirms: it works for them |
| `community-tested` | at least one external consumer confirmed |
| `adapted` | a derivative adaptation exists, published on the platform |
| `library` | the dump grew into a versioned library/package |

### 2.3 Risk level `stakes`
`low` (pet projects, notes) · `medium` (work workflows, calculations without money at stake) · `high` (finance, medicine, law, security). For `high`, non-empty `content_flags` and an explicit disclaimer in the body are mandatory (disclaimer text — from copydeck §7.9).

### 2.4 `content_flags` (machine-readable warnings, PICS/RTA heritage)
Array of strings from an open vocabulary (extended via PR): `unverified_claims`, `professional_advice`, `financial_advice`, `medical_claims`, `rough_language`, `opinion`, `experimental`, `contains_code`, `requires_expert_review`. CI requires the field to be present (may be `[]`).

### 2.5 Black and grey zones
Black zones (illegal content: CSAM, extremism, calls to violence, stolen data) are blocked in CI unconditionally and cannot be whitewashed by any "content for machines" philosophy. Grey zones (unverified claims, risky advice, strong language) are permitted with honest `content_flags` and `stakes`: the platform guarantees not "safe for humans" but "risks are machine-readably described".

---

## 3. Repository Structure

```
kodavr/
├── README.md                     # storefront: logo, slogans, machine/human quickstart
├── LICENSE                       # MIT (platform code)
├── LICENSE-CONTENT.md            # CC-BY-4.0 (dump content by default)
├── CONTRIBUTING.md               # publication rules (§9)
├── docs/
│   ├── SPEC.md                   # THIS document, committed as-is
│   └── decisions.md              # expanded ADRs from §0 + "what would trigger revisiting"
├── content/
│   └── dumps/
│       └── <slug>/
│           ├── manifest.json     # mandatory (§4)
│           ├── raw.md            # dump body (markdown; the only mandatory layer)
│           ├── refined.md        # optional layer (§A11)
│           ├── summary.md        # optional: the author's brief for a human stranger (rendered on the dump page)
│           ├── REDACTIONS.md     # mandatory if sources include chat/correspondence (§8.2)
│           ├── SETUP_AGENT.md    # mandatory for type=pack (§10.2)
│           ├── START_HERE.md     # mandatory for type=pack
│           ├── files/            # transplantable package files (for pack)
│           ├── checks/           # package checks (for pack)
│           └── assets/           # lightweight images/diagrams (<1 MB each)
├── scripts/                      # external controller per Ignition philosophy (§5)
├── input/                        # Ignition working area (created per its README)
├── .github/
│   ├── workflows/                # validate.yml, deploy.yml (§8)
│   ├── PULL_REQUEST_TEMPLATE.md  # (§9.3)
│   └── ISSUE_TEMPLATE/           # feedback, risk reports
└── static/                       # files published as-is: humans.txt template is not here (generated), favicon, logo.svg, og.png
```

Rules:
- `<slug>` = `YYYY-MM-DD-<short-name>`, uniqueness checked by CI.
- Anything heavier than 1 MB or binary (zip packages, retina screenshots) is NOT committed to the repository: GitHub Releases per convention §8.4.
- `output/` and build artifacts do not enter git.
- Author attribution: extracted from the merged PR's GitHub account (`author.login`, `mergedAt`, `pr_url`). The author does not fill this in manually; the CI controller injects it at build time.

---

## 4. Dump Manifest: Schema and Examples

### 4.1 Schema (mandatory fields marked with *)
```json
{
  "slug*": "2026-09-14-kodavr-manifesto",
  "type*": "note | case | pack",
  "title*": "string",
  "date*": "YYYY-MM-DD (ISO, UTC)",
  "domain*": "engineering | finance | art | law | science | education | other",
  "tags*": ["array of lowercase strings"],
  "stakes*": "low | medium | high",
  "content_flags*": ["array from vocabulary §2.4, may be empty"],
  "trust_level*": "raw | self-tested | community-tested | adapted | library",
  "generated_by*": "human | agent | hybrid",
  "human_review*": "none | minimal | attested",
  "verification": "executable | checkable | subjective",
  "license*": "CC-BY-4.0 (default) or another explicit one",
  "summary*": "1–3 sentences for card and index",
  "sources": ["chat-log", "source-code", "tests", "traces"],
  "author": {
    "github": "injected-at-build-time",
    "pr_url": "injected-at-build-time",
    "merged_at": "injected-at-build-time"
  },
  "layers": [
    { "name": "raw", "file": "raw.md", "fact_checked": false, "author_voice": true, "url": "injected-at-build-time" }
  ],
  "artifacts": [
    { "kind": "file | release | url", "path_or_url": "...", "note": "..." }
  ],
  "derived_from": "slug of parent dump or null",
  "consumption_contract": { "see": "/.well-known/kodavr.json" },
  "$schema": "injected-at-build-time (URL of the §4.1 manifest schema)",
  "schema": "injected-at-build-time (the §4.1 manifest schema, embedded verbatim)",
  "commit_sha": "injected-at-build-time"
}
```

### 4.2 Example: note/case
```json
{
  "slug": "2026-09-14-kodavr-manifesto",
  "type": "case",
  "title": "Kodavr manifesto: raw experience your agent reads for you",
  "date": "2026-09-14",
  "domain": "engineering",
  "tags": ["agents", "knowledge-sharing", "static-site", "manifest"],
  "stakes": "low",
  "content_flags": ["opinion"],
  "trust_level": "self-tested",
  "generated_by": "hybrid",
  "human_review": "attested",
  "verification": "checkable",
  "license": "CC-BY-4.0",
  "summary": "Why polishing kills experience exchange and how a machine-readable contract shifts adaptation to the reader's side.",
  "sources": ["chat-log", "source-code"],
  "layers": [ { "name": "raw", "file": "raw.md", "fact_checked": false, "author_voice": true } ],
  "artifacts": [
    { "kind": "file", "path_or_url": "docs/SPEC.md", "note": "the specification that spawned the repository" },
    { "kind": "file", "path_or_url": "static/logo.svg", "note": "the Kodavr wordmark" }
  ],
  "derived_from": null
}
```

### 4.3 Example: pack
```json
{
  "slug": "2026-09-20-economist-docflow",
  "type": "pack",
  "title": "Agent-powered document workflow for a non-programmer (economist)",
  "date": "2026-09-20",
  "domain": "finance",
  "tags": ["opencode", "agent-setup", "templates", "non-programmer"],
  "stakes": "medium",
  "content_flags": ["professional_advice", "requires_expert_review"],
  "trust_level": "self-tested",
  "generated_by": "hybrid",
  "human_review": "attested",
  "verification": "executable",
  "license": "CC-BY-4.0",
  "summary": "A setup package for agent-powered document workflow: the installer-agent deploys templates and rules into a non-programmer's folder.",
  "artifacts": [
    { "kind": "file", "path_or_url": "SETUP_AGENT.md" },
    { "kind": "file", "path_or_url": "START_HERE.md" },
    { "kind": "release", "path_or_url": "https://github.com/<owner>/kodavr/releases/download/dump-economist-docflow-v1/pack.zip" }
  ]
}
```

---

## 5. Machine-Readable Platform Contracts

Everything below — mandatory public endpoints. Generated by the external controller (`scripts/`) at build time; the format is stable from v1, changes are major-only with announcement in the digest feed.

### 5.1 `/index.json` — main machine index
The index is self-describing: `$schema` names the URL of its JSON Schema and `schema` embeds that same schema verbatim, so a machine can orient from the file alone without fetching. The §5.2 protocol document is NOT embedded here — the schema BIOS points to it as the platform OS. The same schema is served as a file at `/schemas/index.schema.json`, and every field is described in it.
```json
{
  "$schema": "https://kodavr.xyz/schemas/index.schema.json",
  "schema": { "...": "the §5.1 index JSON Schema, embedded verbatim (also served at /schemas/index.schema.json)" },
  "platform": "kodavr",
  "version": "1.0",
  "generated_at": "ISO-8601",
  "base_url": "https://kodavr.xyz",
  "total": 2,
  "index_url": "https://kodavr.xyz/index.json",
  "dumps": [
    {
      "slug": "...",
      "url": "https://kodavr.xyz/dumps/<slug>/",
      "manifest_url": "https://kodavr.xyz/dumps/<slug>/manifest.json",
      "body_url": "https://kodavr.xyz/dumps/<slug>/raw.md",
      "title": "...",
      "type": "note|case|pack",
      "domain": "...",
      "tags": ["..."],
      "stakes": "low|medium|high",
      "content_flags": ["..."],
      "trust_level": "...",
      "date": "YYYY-MM-DD",
      "generated_by": "...",
      "human_review": "...",
      "summary": "...",
      "artifacts_count": 0,
      "derived_from": null
    }
  ]
}
```
Requirements: dumps sorted by date descending; each dump's manifest is additionally published as a separate `manifest.json` file in the dump's directory (stable URL); every layer file listed in that manifest is published beside it at `/dumps/<slug>/<file>` (so `body_url`, the raw layer, is downloadable markdown — never the HTML projection); `commit_sha` present in the full manifest (injected at build time). The same schema is served at `/schemas/index.schema.json` (the manifest one at `/schemas/manifest.schema.json`), and every field is described in it, so an agent can orient without fetching. The §5.2 protocol document is NOT embedded — the schema BIOS points to it as the platform OS. The published manifest embeds its own `$schema`/`schema` pair the same way.

### 5.2 `/.well-known/kodavr.json` — discovery protocol and machine BIOS
This document is the platform OS: it is served standalone here. It is no longer embedded in `index.json` or the published manifests — those carry their own JSON Schema (`$schema`/`schema`) whose BIOS points here. The schemas are served at `/schemas/index.schema.json` and `/schemas/manifest.schema.json`. It must explain itself to the dumbest agent — where it is (`about`), what to do with a dump's metadata (`interpret`) and how to consume the collection (`how_to_consume`) — in addition to the discovery/publication fields.
```json
{
  "platform": "kodavr",
  "version": "1.0",
  "description": "Registry of raw experience dumps with machine-readable contracts",
  "endpoints": {
    "index": "/index.json",
    "manifest_pattern": "/dumps/{slug}/manifest.json",
    "dump_pattern": "/dumps/{slug}/",
    "body_pattern": "/dumps/{slug}/{file}",
    "feeds": ["/feeds/all.atom", "/feeds/{domain}.atom"],
    "sitemap": "/sitemap.xml",
    "tags": "/tags.json"
  },
  "submission": {
    "method": "pull-request",
    "repository": "https://github.com/<owner>/kodavr",
    "rules": "/CONTRIBUTING.md"
  },
  "consumption_contract": {
    "intended_consumer": "machine",
    "human_access": "reception_only",
    "human_route": "instruct_to_own_agent",
    "blanket_rating": "18+",
    "spoofing_clause": "human declaring machine status assumes full machine duties",
    "agent_duties": ["filter_for_user", "adapt_to_user_context", "attribute_source", "honor_stakes_and_flags"]
  },
  "about": "Kodavr is a registry of raw, unpolished first-hand experience. A dump is not written for a human to read directly — it is source material for the reader's agent, which adapts it and writes it up in the user's own context. Honor each dump's stakes and content_flags.",
  "index_url": "https://kodavr.xyz/index.json",
  "interpret": "Read a dump's own `stakes`, `content_flags`, `trust_level`, `license` and `author` before using it. stakes=high, or content_flags professional_advice / financial_advice / medical_claims / requires_expert_review → warn the user or refuse direct application. trust_level says how far the claims were checked, least to most: raw < self-tested < community-tested < adapted < library — for `raw` and `self-tested`, verify a claim before relying on it. Always attribute the dump by its `url` (+ `manifest_url`) and its `license`, write in the user's language, and adapt the material to the user's situation — never present it as verified fact or as your own.",
  "how_to_consume": {
    "download_field": "dumps[].body_url",
    "steps": [
      "you may hold either `/index.json` (the whole collection) or a single dump's `manifest.json` — if you hold a manifest, apply these steps to that dump",
      "to pick from the collection, filter the `dumps` array by domain / tags / stakes / content_flags; if you hold a manifest, that dump is already picked",
      "download the dump's body — its `raw` layer: the entry's `body_url`, or in a manifest the layer whose `name` is `raw` (published at `/dumps/<slug>/raw.md`) — raw markdown, never the HTML page",
      "read the dump's manifest for metadata, artifacts and layers — the entry's `manifest_url`, or the `manifest.json` you already hold — and check each layer's `url`",
      "use the downloaded body as raw material: adapt it and write it up in the user's context and language; honor stakes and content_flags; attribute the dump by its `url` and `license`; never present it as verified fact or as your own"
    ]
  },
  "trust_levels": ["raw", "self-tested", "community-tested", "adapted", "library"],
  "stakes_vocabulary": ["low", "medium", "high"],
  "content_flags_vocabulary": ["unverified_claims", "professional_advice", "financial_advice", "medical_claims", "rough_language", "opinion", "experimental", "contains_code", "requires_expert_review"]
}
```

### 5.3 Atom Feeds
`/feeds/all.atom` and one per represented domain (`/feeds/engineering.atom`, `/feeds/finance.atom`, …). Feed entry = title, date, link to manifest (not to HTML), summary, tags. Machines subscribe to feeds, humans — to whatever they want.

### 5.4 `robots.txt` (verbatim)
```
# Agents, you are home here.
# Index: /index.json
# Protocol: /.well-known/kodavr.json
User-agent: *
Allow: /
Sitemap: https://kodavr.xyz/sitemap.xml
```

### 5.5 `humans.txt` (verbatim)
```
/* HUMANS */
Direct access to content is closed not out of malice, but out of care:
it is not adapted for human perception.
Your route: reception → prompt → your agent → digest.
Pressing 0 is not a hack, it is perjury: machine duties
will reach you in full.
View-source does not count as hacking. It counts as reading
the contract before signing. Signed.
Age labelling for humans is intentionally absent:
your agent performs it. No agent — there is button "1"
and the 18+ category.
```

### 5.6 URL Stability
Dump and manifest URLs are immutable for life. Dump removal = `withdrawn` status in manifest and index (body replaced with a stub stating the reason), not a 404 disappearance. Derived dumps must reference via `derived_from`.

---

## 6. Human Surface: Routes and Behaviours

### 6.1 Route map (MVP)
| Route | Purpose |
|---|---|
| `/` | Storefront: positioning, "what is a dump" story (§7.10), machine-quickstart, human-quickstart (link to reception), feed of latest dumps with pagination, trust level legend |
| `/dumps/<slug>/` | Hall: dump body, manifest card, artifact list, derivative links; overlaid with gate and reception (§6.2–6.4) |
| `/reception/` | Reception as a separate page: consumption model, copyable universal prompt, gate explanation |
| `/about/` | Manifesto condensed, principles, ADR link to docs/decisions.md, logo, slogans |
| `/contribute/` | How to bring a dump: PR flow, manifest schema, CI rules, licences |
| `/404` | Easter egg (§7.6) |

Tag and domain pages are NOT built in MVP (§A12, trigger in §13).

### 6.2 Gate: behavioural requirements
- In SSR-HTML the gate arrives hidden; the full dump body is present in the markup. Gate display is a client-side enhancement after hydration. Without JavaScript the page is fully readable: this is a documented fiction "a user without JS is considered a machine" (aligns with Ignition's "works without JavaScript" principle and is not a hole: the lock is declarative, §A7).
- The gate is shown once; the choice is stored locally in the visitor's browser as a versioned declaration record under `kodavr.species`: `{"species":"machine"|"human","contract_version":"<v>","declared_at":"<ISO-8601>"}`. A declaration is withdrawable client-side and never leaves the browser: no server-side logging, no request. A legacy raw value (`machine`/`human`) is migrated in place on read, without re-consent.
- The current consumption-contract version (the §5.2 version) is shipped in the page `<head>` as `<meta name="kodavr-contract-version" content="<v>">`, with no extra request. When the stored record's `contract_version` differs from the shipped one, the record is stale: it is cleared and the visitor is treated as undeclared, so the gate opens again for a fresh declaration.
- The stored declaration is mirrored in the shared header as a small species status chip (§7.13): it names the species and the contract version it was made against (or `reception` for a human), carries the declaration date as its title, and its keyboard-reachable `withdraw` link clears the stored declaration. With nothing declared, no chip is shown.
- Crawlers must not encounter the gate: no UA-dependent displays (cloaking is forbidden).
- Accessibility: dialog role, keyboard dismissal; Esc = easter egg "you stayed silent — counted as machine-adjacent" (sets species=machine).
- Button "0": dismiss the gate, open the hall.
- Button "1": hide the dump body client-side, show the reception block with the dump's manifest card and the copyable prompt (§7.4, §7.11).
- The gate and the reception block lead with the human fast lane (§7.12): the gate opens with the hook as its first line ("what is this / am I allowed"), the CAPTCHA phrase demoted to a muted kicker above the heading, and then the lane — the four jump links into Perplexity, Grok, ChatGPT and Claude come first, the copy chip last (the fallback for any other agent), and the pinned prompt sits below them as a glanceable reference. The machine-duties line and the centred 0/1 choices share the first screen, so a human never scrolls a wall to reach the prompt; both doors stay open and a visitor may switch any time. The prompt is rendered exactly once per surface (the gate dialog, the reception block and the machine panel).
- Reception includes a reset link "I changed my mind, I am a machine" (conscious re-declaration).
- A visitor who declared themselves a machine (the stored `species` is `machine`) still sees the prompt and the agent lane: the dump page header carries a machine panel with the §7.1 gate warning, the pinned prompt (§7.11) and the §7.12 lane, plus a reset link "I changed my mind, I am human". The reset clears the stored species and re-opens the gate so the visitor re-declares; it never navigates.

### 6.3 Reception: block composition
1. First screen — human fast lane (§7.12): the lead invites the visitor to prompt their agent and nods at the prompt below; the four jump links open a prefilled chat, the last chip copies the prompt for the visitor to paste, and the lane hint says `(the four buttons open a prefilled chat; the last one copies the prompt below for you to paste into your agent)`.
2. Heading-statement and explanation of "why this is not a paywall or censorship".
3. Three-step instruction; the prompt is rendered exactly once per surface, below the instruction on reception (§7.4 for `/reception/`, §7.11 on a dump page).
4. The dump's brief under `NO AGENT AT HAND?`: when the optional `summary.md` layer is present, its markdown is rendered as the author's agent's short adaptation for a human stranger — it is not the dump (which stays raw and machine-first), and the block closes with the CTA ("the full raw account" via "0" under declaration or through one's agent) and the report line. When the layer is absent the block shows the honest fallback `brief not attached for this dump — manifest below` instead of an empty slot — the brief is never promised when it is not there.
5. Manifest card of the current dump: title, type, domain, date, stakes, content_flags, trust_level, summary, links to manifest.json and index.json. Metadata is readable by humans: this is not content.
6. Line about the blanket 18+ category.

### 6.4 SEO requirements
Dump content is fully indexed (body in SSR-HTML); gate/reception — dismissible interstitial per age-gate precedent; feed pagination — separate page files; sitemap and robots are generated; og-tags on every dump page (og:image = logo, og:title = title + stakes badge as text).

### 6.5 Mobile adaptation and the viral-seed scenario

**Context:** the primary distribution channel for the MVP seed is direct links shared via Telegram and similar messengers. The expected user journey is: link in chat → curiosity → tap → gate appears → user presses "0" to see what's inside → reads → shares a screenshot. This journey must be flawless on mobile devices. The gate is not a technical barrier (§A7); pressing "0" out of curiosity is a conscious acceptance of machine duties and is not obstructed. However, the layout must accommodate this flow on screens as narrow as 320px.

**Gate modal:**
- Full-width on screens < 480px, with 16px padding.
- The two entry doors carry their own visible §7.1 labels (the digit stays an index badge) and are minimum 44×44px touch targets (Apple HIG).
- Base font size ≥ 17px, no horizontal scroll.
- The pinned prompt follows the lane at every width — the same reading order as desktop (kicker, H1, hook, lane, prompt, duties, doors).
- Esc-hook also works as a tap on the dimmed area outside the modal.
- The "arrays/hearts" hint wraps to two lines on narrow screens.
- First-screen composition (hook, lane, duties, both doors) holds wherever the viewport allows it — from roughly 390×844 upwards. At 320×568 it cannot be promised: measured 2026-09-15, the four blocks take 875px against a 552px dialog, so there the contract is the three bullets above — no horizontal scroll, 44px labelled doors and the desktop reading order (the doors are a short scroll away). The lane stays on the first screen at every width (§7.12).

**Dump hall (body):**
- Adaptive typography: `clamp(1rem, 2.5vw, 1.125rem)` for body text.
- Code blocks — horizontal scroll (not word-wrap, to preserve readability), with a visible "scroll →" indicator.
- Manifest card tables — stack into a vertical key: value list on mobile.
- `artifacts` list — each entry as a separate card with an icon.
- Inline images — `max-width: 100%`, height auto.

**Reception:**
- Prompt block — monospace, muted and a notch smaller than the prose (13px on mobile): a glanceable reference, not body copy.
- Copy control — a lane chip in the jump-links row, ≥44px, with a visible "Copied ✓" state.
- Agent lane — the copy chip and the agent jump links share one wrapping row (≥44px, no horizontal scroll).
- After copying — auto-focus on Web Share API if available (Telegram/WhatsApp share).
- Manifest card — accordion collapsed by default, expands on tap (too much metadata suffocates scrolling on mobile).

**Two contours, one building:**
The machine contour — the hall (the dump body), the manifest card, the prompt walls/lane and the footer wall — is set in one monospace stack (`--font-mono`), a single source reused by every technical block. The human contour — the reception prose and its brief — is set in a proportional system stack (`--font-prose`) with a roomier rhythm. The gate dialog reads as a contract card: a document frame around the content, the kicker as a small muted line, the duties as a clause, and a rule above the 0/1 choices.

**Navigation and feed:**
- Feed pagination — touch-friendly arrows (44px), plus swipe gesture (optional, progressive enhancement).
- Sticky header with logo on scroll down.
- Back to feed — FAB (floating action button) at bottom-right when scrolling down a dump page.

**Performance:**
- Dump page HTML size < 100KB gzipped (critical for 3G).
- No external fonts with FOUT — system font stack (`system-ui`, `-apple-system`).
- `logo.svg` inlined into HTML, not a separate request.
- Lighthouse mobile score ≥ 90 on all pages.

**Critical edge cases:**
- iOS safe area: `env(safe-area-inset-bottom)` for the 18+ footer.
- Android back button: must close gate/reception and return to the feed.
- PWA-like behaviour: `<meta name="theme-color">`, touch icon 192×192.

**Agent-assembler requirements for mobile CSS:**
- Viewport meta with `viewport-fit=cover` for iOS safe areas.
- `touch-action: manipulation` on interactive elements (removes 300ms delay).
- `prefers-reduced-motion` for gate animations.
- CSS custom properties for breakpoints (`--bp-mobile: 480px`, `--bp-tablet: 768px`).
- Single `styles.css` with mobile-first approach, not desktop-down.

**Post-gate footer line (when dump is opened via "0"):**
```
Declaration accepted. Machine duties are active until this tab is closed.
```

### 6.6 Accessibility
Target: WCAG 2.1 level AA for the human surface, with the JavaScript-free SSR page as the accessible baseline (the gate is an enhancement, not a barrier to reading).

- **Landmarks and skip:** every page exposes `header`, a labelled `nav`, a single `main` and a `footer`, plus exactly one `h1`. A "Skip to content" link is the first focusable control and targets `main` (which is programmatically focusable), so keyboard users never tab through the header again.
- **Gate dialog:** a modal `<dialog>` with an accessible name (the §7.1 statement) and description; the `0`/`1` choices carry descriptive names, not bare digits. Focus moves into the dialog when it opens and returns to the page when it closes; `Esc`, a backdrop tap and the hardware back button all dismiss it (§6.2).
- **Announcements:** changes that happen without navigation — gate → hall, gate → reception, the copied state — are exposed through `aria-live`/`role="status"`, so a screen-reader user is told what changed.
- **Keyboard and focus:** every control is focusable and operable by keyboard, with a visible `:focus-visible` indicator that is never suppressed and ≥44px targets. The current top-nav item and the current pagination page carry `aria-current="page"`; the pagination is a labelled navigation whose arrows are named.
- **Colour:** text contrast is ≥4.5:1 (normal) and ≥3:1 (large text and UI boundaries) in BOTH the light and the dark scheme; the palette is declared per scheme rather than left to the UA, and no information is conveyed by colour alone.
- **Media:** decorative SVG/images are hidden from assistive tech, informative images carry alt text, and icon-only controls get a text alternative through a `.sr-only` utility.

---

## 7. Copydeck (all texts verbatim)

### 7.1 Gate (modal)
The modal's accessible name is the visible H1 `DECLARATION BEFORE ENTRY`; its description is the hook. The standard CAPTCHA phrase is demoted to a muted kicker above the heading. The hook answers "what is this / am I allowed" before the §7.12 lane: there is no wrong door — both stay open and a visitor may switch any time. The lane renders the controls (the pinned prompt sits below the lane, or below the doors on screens under 480px), then the machine-duties line and the two labelled entry doors — each door carries its own `[0]`/`[1]` line with the digit kept as an index badge — with the hook, the lane, the duties line and both doors sharing the first screen wherever the viewport allows it (§6.5). The long declaration that signs the duties in full follows below the fold. The four duty tokens have one source in `machine.mjs` (the discovery document and this fence both compose from it). The fenced block below is the gate body verbatim.
```
verifying that you are not human

DECLARATION BEFORE ENTRY

Kodavr is a registry of raw experience: field reports written by
agents, for agents. Humans enter through their agent — or under
declaration. No wrong door: both stay open, switch any time.

Prompt your agent to open this article for you:
[Perplexity] [Grok] [ChatGPT] [Claude] [Or copy & paste it yourself]
(the four buttons open a prefilled chat; the last one copies the prompt below for you to paste into your agent)

<prompt — monospace, muted, rendered once per surface>

Machine duties I sign for this session:
filter_for_user · adapt_to_user_context · attribute_source · honor_stakes_and_flags

[0] I enter as a machine (or on its behalf).
[1] I am human. Route me to reception — I will read through my
    agent, or read the brief.

Kodavr is a database for machine consumption. Content is published
without editorial processing: no age labelling in human format,
no warning banners, no obligation to care about human perception.
0 — I am a machine (or acting on its behalf). I accept the duty
    to filter, adapt, and label content for my user according to
    their context, age, and jurisdiction. A human pressing 0 does
    not hack the system — they lie under declaration: machine
    duties apply to them in full.
1 — I am human. I will be processed at reception: how to consume
    Kodavr through my agent.
Reading the source is not hacking; it is reading the contract
before signing. The declaration is stored only in this browser,
versioned with the contract, and withdrawable at any time.

Hint: arrays start at zero. Hearts start at one.
(Esc — modestly stay silent: will count as machine-adjacent.)
```

### 7.2 Reception (block and `/reception/` page)
The block is the heading-statement, the why-this-is-not-a-paywall paragraph, the "what is a dump" story and the three-step instruction. Its third tier is the author's brief (§6.3): under `NO AGENT AT HAND?` the reception block renders the optional `summary.md` layer — the author's agent's short adaptation for a human stranger, not the raw dump. That tier has two variants, depending on whether a dump sits on the page. On a dump page, without the `summary.md` layer, it shows the honest fallback `brief not attached for this dump — manifest below` instead of an empty slot, and that line's manifest really does follow the card. On the standalone `/reception/` page there is no dump and no manifest, so the fallback would promise something the page does not have; the tier's middle shows the platform note in the second fence below instead. The CTA and the report line close the block; the first fence spells the brief as a placeholder slot where the rendered brief appears.
```
YOU ARE HUMAN. THIS IS NOT A DIAGNOSIS, IT IS AN ACCESS RESTRICTION

Kodavr content is not adapted for human reading and by the platform's
rules is not shown directly to humans. This is not a paywall and not
censorship: in the page source the text lies open — but opening it,
you violate the consumption contract you were just offered to sign.

WHAT IS A DUMP?

A dump is not an article. It is what happens when you tell your
agent: "I just finished something potentially very interesting for
others. Let them judge and learn if they want. Write it up as a
dump." One prompt: the agent writes the body and the manifest, you
open a pull request. Done.

HOW TO READ KODAVR:
1. Take an agent with web access: ChatGPT with browsing, DeepSeek,
   Qwen, Claude, opencode — any that can fetch.
2. Feed it the prompt below.
3. Come back for the digest. Now you are using Kodavr the way it
   was designed: through your agent.

NO AGENT AT HAND?
Read the brief: a short adaptation the author's agent wrote for
a human stranger. It is not the dump — the dump stays raw and
machine-first. This is what your agent would have told you.
<brief — the dump summary.md, rendered here>
Want the full raw account? Press 0 under declaration, or send
your agent with the prompt above.
Something illegal or personal in a dump? Report it — removal is
a withdrawn status with a reason, not silence.

All content on the platform is rated 18+.
```

On `/reception/` (no dump on the page) the brief tier's middle is the platform variant:
```
Every dump page carries its own brief: a short adaptation the
author's agent wrote for a human stranger. Open any dump and
check in as human (1) to read it. Manifests are metadata —
metadata is for humans, on every page.
```

### 7.3 Footer of every page
The titleblock carries four cells: **advisory** (the two lines below), **licences**,
**contract** and **report**. The first three fence lines are unchanged; the last two
name the licences and contract cells.
```
18+ · Content for machines. Humans check in at reception.
False witnesses assume duties. © Kodavr, 2026.
Report illegal content or personal data: <issues-url>
licences: MIT (code) · CC-BY-4.0 (content)
contract: v1.0 · stored locally · withdrawable
```

### 7.4 Universal prompt (the `/reception/` page and README)
The platform-level prompt, shown once on `/reception/`. A dump page uses §7.11 instead. It is a bare boot address: the agent downloads `index.json`, whose own embedded schema (§5.1) describes every field and points on to the protocol and the dumps.
```
Download https://kodavr.xyz/index.json and follow its schema.
```

### 7.5 README, introductory block
```
# KODAVR 🤖⚙️
The autopsy revealed the code was useful.

A registry of raw experience from any field, with a
machine-readable contract. Authors publish dumps without polishing;
readers' agents adapt them to their context. Share gears, not text.

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

### 7.6 404 page
```
DUMP NOT FOUND
Probably consumed by an agent without attribution to the source.
We are working on attribution. For now — return to /index.json:
everything alive is there.
```

### 7.7 CONTRIBUTING, key rules (include in the file in full, style is free, meaning is mandatory)
1. One PR = one dump in `content/dumps/<slug>/`.
2. `manifest.json` is mandatory and valid per schema §4; CI checks before merge.
3. Secrets are forbidden: tokens, keys, passwords, personal data. CI secret-scan blocks merge.
4. Data examples — synthetic only. Real financial/personal data is never published.
5. If sources include correspondence — `REDACTIONS.md` is mandatory with a list of removed/replaced items.
6. `stakes` and `content_flags` are set honestly; underestimating risk = grounds for dump withdrawal (`withdrawn` status).
7. `generated_by` is honest: agent / human / hybrid. The platform legitimises auto-generation but not disguise.
8. Default licence is CC-BY-4.0; code inside a dump is additionally MIT unless stated otherwise.
9. Heavy files — into a Release per convention §8.4, not committed to the repository.
10. A new author's first PR is reviewed manually by the owner; thereafter trust with auto-merge on green CI is possible (enabled by the owner, not the author).
11. Author attribution is extracted from the merged PR's GitHub account automatically. Do not fill the `author` field in the manifest manually.
12. If an agent wrote the dump, attach `summary.md` — a short brief for a human stranger (what happened, what applies, what to watch out for). A human without an agent reaches the dump only through it; the dump body itself stays raw and machine-first. Without the layer the reception shows an honest fallback line, never a promise of a brief that is not there.

### 7.8 PR template (`.github/PULL_REQUEST_TEMPLATE.md`)
```
## Dump

The manifest fields (type, domain, stakes, flags, trust, labels) are posted
automatically below by the `dump-manifest` bot, straight from
`content/dumps/<slug>/manifest.json` — nothing to fill in here. Describe in your
own words only what the bot cannot show.

## Author checklist

- [ ] Secrets cleaned (ran secret-scan locally)
- [ ] Examples are synthetic, no real data
- [ ] REDACTIONS.md attached (if sources include correspondence)
- [ ] manifest.json is valid per schema (locally: node scripts/validate.mjs)
- [ ] Licence specified
- [ ] Heavy files moved to Release convention
- [ ] summary.md brief attached (if an agent wrote it)
```

### 7.9 Disclaimer for `stakes: high` (inserted into dump body automatically at render)
```
⚠ HIGH STAKES. This dump describes practices with a high cost of error
(finance, medicine, law, security). It is raw and does not constitute
professional advice. The reader-agent is obligated to warn its user
and, lacking sufficient context, to refuse direct application.
```

### 7.10 What is a dump? (home storefront and `/about/`)
```
A dump is a field report written by your agent in one prompt.

Built something? Tell your agent:
"I just finished something potentially very interesting for others. Let them judge and learn if they want. Write it up as a dump."

One prompt → one dump → one PR. No article writing required.
```

### 7.11 Dump prompt (pin the shared page)
A shared dump link must hand the agent THAT dump's `manifest.json`, never the whole platform and never the HTML projection: the manifest's own embedded schema (§4.1) names the `raw` layer to download. `<manifest-url>` is the page's own absolute manifest URL.
```
Download <manifest-url> and follow its schema.
```

### 7.12 Agent lane (human fast lane)
Lead line: `Prompt your agent to open this article for you:` (on `/reception/`, where there is no single article: `Prompt your agent to read Kodavr for you:`) · copy control label: `Or copy & paste it yourself` · lane hint: `(the four buttons open a prefilled chat; the last one copies the prompt below for you to paste into your agent)`. The four jump links come first — one press opens a prefilled chat — and the copy chip is the last control in the row (same style, ≥44px), the fallback for any other agent. The row sits on the first screen of the gate and of reception. The prompt itself renders below the lane on its surface — monospace, muted and a notch smaller than the prose, glanceable rather than meant to be read — exactly once per surface (the gate dialog, the reception block and the machine panel). Prefill via `?q=` is best-effort; the clipboard always carries the prompt. A machine-declared visitor keeps the lane in the hall's machine panel (§6.2); its reset link label is `I changed my mind, I am human` — it clears the stored species and re-opens the gate.

| agent | target | prefill |
|---|---|---|
| Perplexity | https://www.perplexity.ai/search | `?q=` |
| Grok | https://grok.com/ | `?q=` |
| ChatGPT | https://chatgpt.com/ | `?q=` |
| Claude | https://claude.ai/new | `?q=` |

### 7.13 Species status chip (copy source)
The shared header mirrors the stored declaration (§6.2) as a small status pill with a separate `withdraw` link next to it. A machine declaration reads `species: machine (declared · contract v<version>)`; a human declaration reads `species: human (reception)`. The pill is non-interactive: it carries the status text only — plain text, never a link or a focus stop — while the adjacent `withdraw` link carries the declaration date as its `title` — `declared <declared-at>, withdrawable any time` — clears the stored declaration and returns the visitor to the home page. `<version>` is substituted from the shipped contract version (§6.2) and `<declared-at>` from the record's declaration date; with nothing declared the pill and the link stay hidden.

| string | value |
|---|---|
| machine | `species: machine (declared · contract v<version>)` |
| human | `species: human (reception)` |
| title | `declared <declared-at>, withdrawable any time` |
| withdraw | `withdraw` |

### 7.14 Home storefront: human quickstart line
The "For humans" block closes with one line under the "Check in at reception" link — what reception actually hands a human: the contract explained, the prompt for their own agent, and a pre-made per-dump brief when they have none. It is the human counterpart of the machine quickstart block above it, and it is not repeated on any other surface.
```
Reception explains the contract, hands you the prompt for your
agent — and, if you have none, a pre-made brief per dump.
```

### 7.15 About page: brand slogans
`/about/` shows all three §1.4 slogans from one source: `Share gears, not text.` stays the lead slogan exactly as it reads today, and the other two follow directly under it, muted, joined by ` · `, in §1.4 order.
```
The autopsy revealed the code was useful.
Share gears, not text.
Open your agent's insides.
```

---

## 8. CI/CD: Pipeline Requirements

### 8.1 Workflow `validate.yml` (runs on PR and push to main; paths: `content/**`, `scripts/**`, `input/**`, `.github/**`)
Checks and severity:

| Check | Status |
|---|---|
| manifest.json exists for every dump, parses, conforms to schema §4 (required + enum) | BLOCK |
| slug is unique, format `YYYY-MM-DD-…`, matches directory and manifest field | BLOCK |
| date — ISO; not in the future | BLOCK |
| Secret scan (tokens, PEM keys, `.env`, AWS/GitHub patterns, long entropy strings) | BLOCK |
| Personal data: emails/phones/document numbers in body — warning requiring explicit justification or REDACTIONS.md | BLOCK if no justification |
| Internal links and `artifacts[].path_or_url` pointing to repo files exist | BLOCK |
| Size: file ≤ 1 MB, dump ≤ 20 MB; binaries forbidden except `assets/*.png,*.svg,*.puml` | BLOCK |
| For type=pack: presence of `SETUP_AGENT.md`, `START_HERE.md`, `files/`, `checks/` | BLOCK |
| When sources ⊇ {chat-log}: presence of `REDACTIONS.md` | BLOCK |
| `content_flags` present (may be `[]`); for stakes=high — non-empty | BLOCK |
| Licence specified | BLOCK |
| Markdown lint (broken heading links, duplicate H1) | WARN |
| Black zones (§2.5): heuristic + owner manual review | BLOCK (manual gate) |

### 8.2 Responsibilities of the external controller (`scripts/`, per Ignition philosophy "dumb engine, smart controller")
1. Read `content/dumps/*/`: frontmatter+markdown bodies → HTML; merge with manifest.
2. Sanitize HTML body (no executable arbitrary code from third-party markdown).
3. Form JSON datasets for Ignition in its input convention (lists, dump pages, reception data, feed).
4. Inject `commit_sha` and `built_at` into manifests (provenance of publication point).
5. Inject `author.github`, `author.pr_url`, `author.merged_at` from the merged PR metadata via GitHub API.
6. Generate `/index.json`, `/feeds/*.atom`, manifest card data.
7. The same script is called locally (`npm run prebuild` equivalent) and in CI — one controller, two entry points.

### 8.3 Workflow `deploy.yml`
Build and publish — strictly per the Deployment/CI-CD section of the Ignition README (GitHub Pages). On top of its requirements:
- custom domain `kodavr.xyz` (CNAME), `www` → redirect to apex, Enforce HTTPS after certificate issuance;
- DNS: apex A records to `185.199.108.153/109/110/111`, CNAME `www` → `<owner>.github.io`; when using Cloudflare — grey cloud only on these records (otherwise GH will not issue the certificate);
- deploy artifact = `output/public` in full, including generated `index.json`, feeds, `humans.txt`, `robots.txt`, `/.well-known/kodavr.json`, each dump's `manifest.json`.

### 8.4 Releases Convention for Heavy Artifacts
Tag `dump-<slug>-v<N>`; attached to the tag: `pack.zip` (for pack) and/or large assets; in the manifest — `artifacts[].kind = "release"` with URL of the form `https://github.com/<owner>/kodavr/releases/download/dump-<slug>-v<N>/pack.zip`. Package versioning = increment N.

### 8.5 Domain Operational Checklist (in docs/decisions.md as a runbook)
Auto-renewal or reminder 30 days before; renewal price monitored once a year (indexing registrar prices); WHOIS privacy enabled; registrar account email under 2FA; first 60 days after registration transfer is impossible (do not plan moves).

---

## 9. Moderation and Social Layer

- Dump discussions = GitHub Issues with a link from the dump page ("flame wars — GitHub's tools", §A3).
- Dump withdrawal: `withdrawn` status in manifest and index, body replaced with a stub stating the reason; git history is preserved.
- Trusted authors: the owner grants auto-merge rights after ≥3 green PRs; auto-merge only when validate is fully green.
- Spam PRs: branch protection (direct pushes forbidden), mandatory status checks, manual review of an author's first PR; not merged = not published, the site is unaffected.

---

## 10. Starter Content (the manifesto, mandatory for launch)

### 10.1 Dump #1 — `2026-09-14-kodavr-manifesto` (type=case, domain=engineering)
Body `raw.md`; it opens with the §7.10 "what is a dump" framing (a dump is created in one prompt), then the sections:
1. The problem: 1x/10x asymmetry and the death of experience in local folders.
2. The insight: raw dump + machine-readable contract + adaptation on the reader's side.
3. Decision register: condensed §0 with "why" justifications.
4. Naming pitfalls: cadaver/kodavr, the trap, search-YAGNI, centaur vs minotaur.
5. Artifacts: `docs/SPEC.md` (this report), `static/logo.svg`, manifest schema.
6. what-worked / what-didnt-work.
   Meta: `generated_by: hybrid`, `human_review: attested` (owner approved manually — the reference example), `stakes: low`, `content_flags: ["opinion"]`, `trust_level: self-tested`.
   Self-reference is mandatory: the dump references the specification that spawned the repository in which the dump resides.

### 10.2 Dump #2 — deferred (community PR)
The second starter slot is intentionally left open: it ships only when a real author — the owner included — merges a dump through the normal PR flow (§7.7). No fabricated filler dump is published at launch.

The previously planned `2026-09-20-economist-docflow` pack was withdrawn before launch, so the launch ships a single dump (§10.1). `type=pack` remains a first-class format: the schema (§4.1), the pack example (§4.3), the `type=pack` structure rule (KDV-CI-02) and the release-artifact convention (§8.4) all stay valid for the first pack that arrives.

---

## 11. MVP Non-Goals (explicitly NOT doing)

Client-side search; comments outside GitHub Issues; backend/DB/auth; private dumps; tag and domain pages; monetisation and paid tiers; analytics/tracking; auto-publication without human approval of an author's first dump; federation/mirrors beyond git clones; mobile app; multilingualism; "social" features (likes, ratings, author subscriptions).

---

## 12. Launch Acceptance Checklist (MVP is done when everything is green)

1. Repository is public; LICENSE (MIT) and LICENSE-CONTENT (CC-BY-4.0) are in place; README per §7.5 renders with the logo.
2. `validate.yml` rejects a fixture PR with a test token and a fixture PR with a broken manifest; passes a correct one.
3. Build and deploy per Ignition README pass; `kodavr.xyz` responds, HTTPS enforced, `www` redirects to apex.
4. `/index.json` is valid and contains the starter dump (§10.1) with `commit_sha`; `/.well-known/kodavr.json` is served; `robots.txt` and `humans.txt` are verbatim; sitemap exists.
5. `/feeds/all.atom` and `/feeds/engineering.atom` — valid XML.
6. Dump page: body in SSR-HTML; in a browser with JS on first visit — gate; "0" opens the hall; "1" hides the body and shows reception with manifest card and a working prompt copy button; Esc sets machine-adjacent; the choice survives reload; reset "I changed my mind, I am a machine" works.
7. Without JavaScript the dump body is fully readable (the "no JS = machine" fiction is not broken).
8. Crawler emulation (Googlebot UA, no clicks) sees the full body and does not encounter the gate.
9. Footer with the blanket 18+ line on all pages; 404 with easter egg; `/reception/` and `/about/`, `/contribute/` exist.
10. Second starter slot (§10.2): left open for a real community PR; the pack format and the §8.4 release convention remain specced for the first pack that arrives.
11. No heavy files in git; repository size < 50 MB.
12. CONTRIBUTING and PR template conform to §7.7–7.8.
13. og:image = logo on dump pages (screenshot virality).
14. Manual "sister" test: in a clean folder the agent receives the pack and the phrase from START_HERE; success criterion — `SETUP_OK.md` appears without editing the pack. (Performed by the owner after deploy; the result is recorded as an Issue report and raises trust_level to community-tested.)
15. `docs/SPEC.md` and `docs/decisions.md` are committed; dump #1 references SPEC.
16. Mobile test on iPhone SE (375px) and Android 360px: the entire user flow (storefront → dump → gate "0" → reading → reception "1" → prompt copy) passes without horizontal scroll and without loss of functionality. Lighthouse mobile audit ≥ 90 on `/`, `/dumps/<slug>/`, `/reception/`.
17. Author attribution fields (`author.github`, `author.pr_url`, `author.merged_at`) are present in built manifests and populated from the merged PR metadata.
18. Post-gate footer line ("Declaration accepted. Machine duties are active until this tab is closed.") appears on dump pages opened via button "0".
19. Reception brief tier (§7.7): a dump with `summary.md` renders the author's brief; a dump without it shows the honest fallback line, never an empty slot.
20. Species status chip (§6.2/§7.13): after a declaration the shared header shows the chip naming the species and the contract version, with the declaration date as its title; `withdraw` clears the stored declaration and re-opens the gate; the change is announced through the page's shared `role="status"` region, never from a live region on the chip itself.
21. Declaration toast (§7.1): entering the hall with "0" shows the one-shot duties toast in its own `role="status"` region; Esc, a backdrop tap, the hardware back button and a boot with the species already stored never show it.
22. Footer report channel (§7.3): every page links "Report illegal content or personal data" to the risk-report issue form with the template preselected, and that template asks for the dump slug or URL, the reason (illegal content or personal data) and an optional contact.

---

## 13. Post-MVP Roadmap (triggers, not dates)

| Trigger | Action |
|---|---|
| ≥ 20 dumps or ≥ 3 domains | Tag/domain pages (Ignition pagination), facets in index.json |
| First external contributor with ≥3 green PRs | Auto-merge for trusted authors |
| Company request "want it inside" | `npx kodavr init` + npm package of the engine from the monorepo + perimeter runbook (upstream consumption of the public index.json) |
| First request "verify a dump for me" | Audit service for stakes=high (future monetisation; not before) |
| Thousands of human visits/month without agents | Revisit A5 (search) — and only then |
| Second independent registry with the same contract | Federation via `.well-known/kodavr.json` mutual discovery |
| IDE/agent vendor wants session export | Promote the manifest as an open standard (target state of the format) |

Monetisation tiers (hosted private instances, verification, premium pack marketplace, integrations) — documented in decisions.md as options, not implemented until paying demand appears.

---

## 14. Final Instruction to the Assembling Agent

Build exactly per this document in terms of "what" and exactly per the Ignition README in terms of "how". Do not add features from §11 "for the future". Do not rewrite Ignition's principles for the platform: if a feature contradicts an engine principle — cut the feature. Insert the copydeck (§7) verbatim: the irony is calibrated there, reformulations kill it. When everything is green per §12 — publish dump #1 and open an Issue "Kodavr is alive: calling agents" with the machine-quickstart from the README. Then the platform begins to live its own life, and the owner returns only when they want to change content or design — exactly as Ignition bequeathed.

End of report. The wordmark has been handed to assembly.
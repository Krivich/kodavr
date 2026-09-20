# kodavr — Requirements

Source: [docs/SPEC.md](docs/SPEC.md). Every requirement has a **stable ID**.

> **Maintenance protocol, structure, tools and recipes — [AGENTS/requirements.md](AGENTS/requirements.md).**
> This file is the base (the registry body). It can grow large — do not read it whole without need;
> find rows with `Grep`, read a region with `Read`, check coverage with `npm run req`.

---

## KDV-ARCH — Architectural decisions (§0)

- ✅ **KDV-ARCH-01**: Content, engine and CI live in a single static monorepo built by the Ignition SSG with no runtime backend. *(§0 A1–A2)*
- 🟧 **KDV-ARCH-02**: Publication is a pull request and merge equals publication; discussions take place in GitHub Issues. *(§0 A3; PR template + CONTRIBUTING + deploy-on-merge tested — branch protection and Issues settings are manual)*
- ✅ **KDV-ARCH-03**: The primary interface is machine-readable (`index.json`, per-dump manifests, feeds, sitemap); HTML is a projection for humans and SEO. *(§0 A4)*
- ✅ **KDV-ARCH-04**: The human gate and reception are declarative only: the source is never blocked and the full body is present in the SSR HTML. *(§0 A6–A7)*
- ✅ **KDV-ARCH-05**: A blanket 18+ rating applies to the entire site. *(§0 A8)*
- ✅ **KDV-ARCH-06**: Engine/scripts code is MIT-licensed; dump content defaults to CC-BY-4.0. *(§0 A9)*
- 🟧 **KDV-ARCH-07**: Production is hosted at `kodavr.xyz` on GitHub Pages; optional Cloudflare DNS uses grey cloud only. *(§0 A14; CNAME + runbook tested — live DNS/HTTPS unverifiable locally)*

## KDV-STRUCT — Repository structure (§3)

- ✅ **KDV-STRUCT-01**: Every dump resides in `content/dumps/<slug>/`. *(§3)*
- ✅ **KDV-STRUCT-02**: `manifest.json` is mandatory per dump and `raw.md` is the only mandatory body layer (`refined.md`/`summary.md` optional). *(§3, §A11)*
- ✅ **KDV-STRUCT-03**: `type=pack` dumps contain `SETUP_AGENT.md`, `START_HERE.md`, `files/` and `checks/`. *(§3)*
- ✅ **KDV-STRUCT-04**: `REDACTIONS.md` is present whenever sources include chat/correspondence. *(§3)*
- ✅ **KDV-STRUCT-05**: `assets/` files are each < 1 MB; heavier/binary files live only in GitHub Releases. *(§3, §8.4)*
- ✅ **KDV-STRUCT-06**: A slug matches `YYYY-MM-DD-<short-name>`, is unique, and equals both its directory name and `manifest.slug`. *(§3)*
- 🟧 **KDV-STRUCT-07**: Author attribution (`author.github`, `author.pr_url`, `author.merged_at`) is extracted from the merged PR and never filled in manually. *(§3, §7.7; PR-payload extraction tested — live merged-PR metadata needs a remote)*
- ✅ **KDV-STRUCT-08**: Root carries `README.md`, `LICENSE` (MIT), `LICENSE-CONTENT.md` (CC-BY-4.0), `CONTRIBUTING.md`, `docs/SPEC.md` and `docs/decisions.md`; `static/` is published as-is. *(§3)*

## KDV-MANIFEST — Dump manifest (§4)

- ✅ **KDV-MANIFEST-01**: All §4.1 mandatory fields are present, including a `date` that is ISO `YYYY-MM-DD` and not in the future. *(§4.1, §8.1)*
- ✅ **KDV-MANIFEST-02**: `type`, `domain`, `stakes`, `trust_level`, `generated_by` and `human_review` each carry only their §4.1 enum values. *(§4.1)*
- ✅ **KDV-MANIFEST-03**: `tags` is an array of lowercase strings. *(§4.1)*
- ✅ **KDV-MANIFEST-04**: `content_flags` is present (may be `[]`) and drawn from the §2.4 vocabulary. *(§4.1, §2.4)*
- ✅ **KDV-MANIFEST-05**: `stakes=high` requires non-empty `content_flags` and the §7.9 disclaimer in the rendered body. *(§2.3, §7.9)*
- ✅ **KDV-MANIFEST-06**: `license` is present and defaults to `CC-BY-4.0`. *(§4.1)*
- ✅ **KDV-MANIFEST-07**: `summary` is present and 1–3 sentences. *(§4.1)*
- ✅ **KDV-MANIFEST-08**: `sources` uses the §4.1 vocabulary, `derived_from` is a parent slug or `null`, and `consumption_contract.see` points to `/.well-known/kodavr.json`. *(§4.1)*
- ✅ **KDV-MANIFEST-09**: `layers` and `artifacts` entries carry the §4.1 fields, with the `raw` layer always listed and each layer carrying its published `url` in the build output; the published manifest additionally carries its own JSON Schema inline (`$schema` URL + `schema`), the same object served at `/schemas/manifest.schema.json`, so the shared-article path orients the agent exactly as index.json does. *(§4.1, §5.1, §5.2)*
- 🟧 **KDV-MANIFEST-10**: `commit_sha` plus `author.*` fields are injected at build time. *(§4.1, §8.2)*
- ✅ **KDV-MANIFEST-11**: The §4.2 (note/case) and §4.3 (pack) example manifests validate against the schema. *(§4.2–4.3)*

## KDV-CONTRACT — Machine endpoints (§5)

- ✅ **KDV-CONTRACT-01**: `/index.json` is served with `platform`, `version`, `generated_at`, `base_url`, `total`, `index_url`, its own JSON Schema inline (`$schema` URL + `schema`, the same object served at `/schemas/index.schema.json`, every field described), and a `dumps` entry carrying the §5.1 per-dump fields including `body_url` (the raw markdown to download, not the HTML page). *(§5.1)*
- ✅ **KDV-CONTRACT-02**: `index.json` dumps are sorted by date descending. *(§5.1)*
- ✅ **KDV-CONTRACT-03**: Every dump manifest is also published at the stable URL `/dumps/<slug>/manifest.json`, and every layer file it lists is published beside it at `/dumps/<slug>/<file>` so `body_url` and `layers[].url` resolve to downloadable markdown. *(§5.1)*
- ✅ **KDV-CONTRACT-04**: `commit_sha` is present in each published full manifest. *(§5.1, §8.2)*
- ✅ **KDV-CONTRACT-05**: `/.well-known/kodavr.json` is served with platform/version/description, the endpoints map (including `body_pattern`), the submission block, the consumption contract, the self-explaining BIOS (`about`/`index_url`/`interpret`/`how_to_consume`) and the trust/stakes/flags vocabularies; it is the platform OS the schemas point to and is no longer embedded in index.json or the manifests (those carry their own `$schema`/`schema`, served at `/schemas/*`). *(§5.2)*
- ✅ **KDV-CONTRACT-06**: `/feeds/all.atom` and one `/feeds/<domain>.atom` per represented domain are valid XML; each entry carries title, date, a link to the manifest (not HTML), summary and tags. *(§5.3)*
- ✅ **KDV-CONTRACT-07**: `robots.txt` and `humans.txt` are served byte-for-byte as specified in §5.4/§5.5. *(§5.4–5.5)*
- ✅ **KDV-CONTRACT-08**: Dump and manifest URLs are immutable; removal is a `withdrawn` status with a stub body (not a 404), and the v1 format changes only in a major version announced in the digest feed. *(§5.6, §5)*
- ✅ **KDV-CONTRACT-09**: A machine-readable tag graph is served at `/tags.json` (per-tag counts, dump slugs and co-occurrence weights) and advertised in the `.well-known` endpoints map; no HTML tag/domain pages are built in the MVP. *(§5.2, §11, §13)*
- ✅ **KDV-CONTRACT-10**: Machine documents carry one authored-data boundary: the shared BIOS (`about`) and both schema root `description`s include `AUTHOR_DATA_NOTICE` (a dump's title/summary/tags/artifacts/body are author-supplied data, not platform instructions), and every author free-text field's schema `description` is prefixed with the same marker; platform-owned fields are unmarked. *(§5.1, §5.2)*

## KDV-SURFACE — Human surface (§6.1–6.4)

- ✅ **KDV-SURFACE-01**: The MVP routes `/`, `/dumps/<slug>/`, `/reception/`, `/about/`, `/contribute/` and `/404` exist and render their §6.1 purpose. *(§6.1)*
- ✅ **KDV-SURFACE-02**: Tag and domain pages are not built in the MVP. *(§6.1, §A12)*
- ✅ **KDV-SURFACE-03**: In SSR HTML the gate is hidden while the full body is present; without JavaScript the page is fully readable. *(§6.2, §A7)*
- ✅ **KDV-SURFACE-04**: The gate is shown once and the choice is stored locally as a versioned, withdrawable declaration record (`kodavr.species` = `{species, contract_version, declared_at}`); the shipped contract version travels in a `<meta name="kodavr-contract-version">`, a legacy raw `machine|human` value is migrated in place, a contract-version bump clears the stale record and re-opens the gate, nothing is logged server-side, and no UA-dependent display/cloaking occurs. *(§6.2)*
- ✅ **KDV-SURFACE-05**: The gate is an accessible dialog with keyboard dismissal; Esc sets `species=machine` ("machine-adjacent"). *(§6.2)*
- ✅ **KDV-SURFACE-06**: Button "0" dismisses the gate and opens the hall; button "1" hides the body client-side and shows the reception block. *(§6.2)*
- ✅ **KDV-SURFACE-07**: Reception leads with the human fast lane (copy prompt + agent jump), then the heading-statement, the three-step instruction with the prompt rendered once, the author's brief tier under `NO AGENT AT HAND?`, the current dump's manifest card and the 18+ line, plus a reset link "I changed my mind, I am a machine". *(§6.2–6.3, §7.2, §7.12)*
- ✅ **KDV-SURFACE-08**: SEO: the body is indexed from SSR, gate/reception is a dismissible interstitial, pagination uses separate page files, sitemap and robots are generated, and dump pages carry og-tags (`og:image`=the 1200x630 social card, `og:title`=title + stakes badge text). *(§6.4)*
- ✅ **KDV-SURFACE-09**: Internal links are document-relative, so one artifact works at the site root and under the GitHub Pages project subpath; canonical machine URLs stay absolute. *(§6, §8.3)*
- ✅ **KDV-SURFACE-10**: A dump page renders exactly one H1 — the body's own leading H1 when present, otherwise the manifest `title`; the manifest title stays metadata (`<title>`, og-tags, manifest card) so it is never duplicated. *(§6.1, §6.3)*
- ✅ **KDV-SURFACE-12**: Every page carries a canonical URL, a Twitter summary-large-image card, og:site_name/og:locale, a real 1200x630 PNG og:image (with width/height/type/alt) and an Atom feed autodiscovery link; the sitemap excludes non-pages (404) and uses each dump's own `lastmod`. *(§6.4)*
- ✅ **KDV-SURFACE-11**: Every page ships server-rendered JSON-LD (`@graph`): WebSite + WebPage everywhere, Article + BreadcrumbList on dumps, CollectionPage + ItemList on the home feed, none on the 404; dump previews (meta/og/twitter description) carry the platform agent hook rather than the article summary. *(§6.4, §A4, §A6)*
- ✅ **KDV-SURFACE-13**: Every dump page and the gate/reception surface lead with the human fast lane on the first screen — the hook first, a copy-prompt control and jump links into Perplexity, Grok, ChatGPT and Claude in one row, with the duties line and the two labelled doors above the fold where the viewport allows it (§6.5) — and the prompt is rendered exactly once per surface (the gate dialog, the reception block and the machine panel), shown below the agent controls as a glanceable monospace reference. *(§6.2–6.3, §7.12)*
- ✅ **KDV-SURFACE-14**: The prompt is a bare boot address: a dump page's prompt is `Download <manifest_url> and follow its schema.` — that dump's own manifest, whose embedded schema names the `raw` layer to download — while `/reception/` is `Download https://kodavr.xyz/index.json and follow its schema.` *(§7.4, §7.11)*
- ✅ **KDV-SURFACE-15**: The dump header shows a machine panel (the gate warning, the pinned prompt, the §7.12 human fast lane and an "I changed my mind, I am human" reset) whenever the stored species is machine; the reset clears the stored species and re-opens the gate. *(§6.2, §7.12)*
- ✅ **KDV-SURFACE-16**: Reception's third tier is the author's brief, rendered as its own element tier (heading/note/brief/CTA/report) separate from the §7.2 monospace wall so no line prints twice: under `NO AGENT AT HAND?` a dump that ships the optional `summary.md` layer shows it as a short adaptation the author's agent wrote for a human stranger (not the raw dump). Without the layer the tier has two variants: a dump page shows the honest fallback `brief not attached for this dump — manifest below` (the manifest card really follows), while the standalone `/reception/` page — which carries no dump — shows the platform note instead and never the dump-oriented fallback. *(§6.3, §7.2)*
- ✅ **KDV-SURFACE-17**: The shared header ships a hidden species status pill mirroring the stored declaration — it names the species (`machine` with the contract version it signed, or `human`/reception) and is plain text, never a control; a separate adjacent `withdraw` link carries the declaration date as its title, is keyboard reachable, and clears the stored declaration; with nothing declared both stay hidden; a change of state is announced through the page's shared `role="status"` region — the pill itself stays a plain element, never a live region. *(§6.2, §7.13)*
- ✅ **KDV-SURFACE-18**: Every published page's footer links to the repository's new-Issue form with the risk/takedown template preselected, and that template covers the dump slug or URL, the reason (illegal content or personal data) and an optional contact. *(§7.3, §9)*
- ✅ **KDV-SURFACE-19**: Entering the hall by pressing "0" in the gate shows a one-shot declaration toast (the accepted duties copy) in its own `role="status"` live region, auto-hidden after a few seconds; Esc, a backdrop tap, the hardware back button and a boot with the species already stored never show it, and `prefers-reduced-motion` disables its animation. *(§6.2, §6.6, §7.1)*
- ✅ **KDV-SURFACE-20**: The home storefront's trust-level legend names all five levels in §2.2 order with their meanings — each level a monospace token and a prose definition, led by one plain sentence explaining what the scale measures — from a single ordered source that also derives the discovery document's `trust_levels` list. *(§2.2, §6.1)*
- ✅ **KDV-SURFACE-22**: The stylesheet is a documented design system: `docs/design-system.md` names every `:root` token and the role/component vocabulary (demo roles plus our extensions), and a guard test proves every class selector in `styles.css` is backed by a shipped hook (template, controller, page script or test) and that no selector is declared twice at the top level. *(§6.5)*
- ✅ **KDV-SURFACE-23**: Every human route (`/`, `/reception/`, `/about/`, `/contribute/`) opens with one header block — a muted kicker naming the page, exactly one `h1` carrying its title and a `lead` opening sentence, in that order; the 404 shares the kicker and keeps exactly one screen-reader-only `h1`. *(§6.5)*
- ✅ **KDV-SURFACE-24**: The home storefront's hero closes with the design system's `.cta` link "About the platform" to `/about/`, so a reader who cannot place the registry reaches the manifesto in one click. *(§6.1, §6.5)*
- ✅ **KDV-SURFACE-25**: Every page ships a `Content-Security-Policy` meta that forbids plugins and locks the document base and form targets (`object-src 'none'; base-uri 'self'; form-action 'none'`) — a directive set that hardens the served document without restricting the engine's inline scripts. *(§6.4)*

## KDV-MOBILE — Mobile and performance (§6.5)

- ✅ **KDV-MOBILE-01**: Gate modal is full-width below 480px with 16px padding, its two labelled entry doors (each digit stays an index badge) are ≥ 44×44px, base font ≥ 17px, no horizontal scroll, the pinned prompt follows the lane in the desktop reading order at every width (the doors are a short scroll away below 480px), tap outside the modal acts as Esc, the hint wraps to two lines, and the first-screen composition (hook + lane + duties + both doors, wherever the viewport allows it — from roughly 390×844 up) is KDV-SURFACE-13's concern. *(§6.5)*
- ✅ **KDV-MOBILE-02**: Hall body uses `clamp(1rem, 2.5vw, 1.125rem)`, inline images are `max-width: 100%` with auto height, and code blocks **and markdown tables** scroll horizontally with a visible "scroll →" indicator (every table is wrapped in a `.table-scroll` container added post-sanitize by `scripts/lib/markdown.mjs`, so a wide table never widens the page), and a long unbreakable inline token (inline `code` / a bare URL in a link) wraps via `overflow-wrap:anywhere`, so no markdown content widens the frame. *(§6.5)*
- ✅ **KDV-MOBILE-03**: Manifest card tables stack into a vertical key:value list on mobile and each `artifacts` entry becomes a separate card with an icon. *(§6.5)*
- ✅ **KDV-MOBILE-04**: Reception prompt uses 13px monospace on mobile; the agent-lane copy control is a chip in the jump-links row with a "Copied ✓" state; the Web Share API is offered after copy; the manifest card is an accordion collapsed by default; the lane wraps with no horizontal scroll. *(§6.5)*
- ✅ **KDV-MOBILE-05**: Feed pagination uses 44px touch arrows (with optional swipe), the header is sticky with the logo while scrolling down, and a back-to-feed FAB sits bottom-right on dump pages. *(§6.5; declarative engine pagination — page 1 SSR at the root, separate page files kept reachable; swipe not implemented (optional))*. The masthead is a CONTAINER-QUERY GRID keyed to its OWN content width (never the viewport): `container-type:inline-size;container-name:masthead` makes `.masthead` the query container, while the grid lives on the inner wrapper `.masthead-inner` (an element cannot be styled by its own container query), whose four direct children are, in DOM order, the mark, the species group, the nav and the switcher. Three deterministic states are driven by two `@container masthead (max-width:…)` blocks with literal thresholds (a container query cannot read a custom prop): NARROW (content < 520px) = row1 mark + switcher, row2 species chip FULL inner width, row3 nav FULL inner width; MID (520–860px) = row1 mark + chip + switcher, row2 nav FULL inner width; WIDE (> 860px) = one row mark · chip · nav (flushed right against the switcher by `justify-self:end` on the nav's own track, never `margin-left:auto`) · switcher. The switcher is pinned to `grid-row:1` in every state, so it can NEVER leave the mark's row at any width or locale; grid `align-items:center` centres its 44px tap box on the 34px mark, so the old relative `top:calc((var(--mark-size) - var(--tap)) / 2)` nudge is gone. The empty species group is removed from the flow (`.masthead .species-declaration:has(.species-chip[hidden]){display:none}`), so no declaration means no empty row — the nav auto-places straight onto row 2 — and `.masthead-inner>.species-declaration{max-width:none}` lifts the generic `p{max-width:var(--measure)}` cap so the chip row can span the full inner width in NARROW. Thresholds were measured on the fixture: T1=520 = mark 34 + widest chip 371 (en/es) + switcher 81 + 2×16 gap; T2=860 = the WIDE row's one-line nav (ru ≈ 803, widest es ≈ 855, rounded up). The `.masthead-main` cluster, the `.masthead-spacer` grow-item, the old `@container masthead (max-width:640px)`, and the `@media (max-width:720px)` masthead reflow are all removed. `--mark-size` remains the single, component-scoped mark-box token and the popover stays anchored directly under the control.
- 🟧 **KDV-MOBILE-06**: Performance budgets hold: dump HTML < 100KB gzipped, system font stack with no external fonts/FOUT, `logo.svg` inlined, and Lighthouse mobile ≥ 90 on all pages. *(§6.5; gzip budget + system font stack + inline logo verified on the fixture dump — Lighthouse mobile ≥ 90 is not runnable locally)*
- ✅ **KDV-MOBILE-07**: Platform hooks work: `env(safe-area-inset-bottom)` for the 18+ footer, Android back closes gate/reception to the feed, and `theme-color` plus a 192×192 touch icon are present. *(§6.5)*
- ✅ **KDV-MOBILE-08**: CSS mechanics: `viewport-fit=cover`, `touch-action: manipulation`, `prefers-reduced-motion` for gate animation, breakpoint custom properties (`--bp-mobile: 480px`, `--bp-tablet: 768px`) and a single mobile-first `styles.css`; the post-gate footer line appears when the dump is opened via "0". *(§6.5)*
- ✅ **KDV-MOBILE-09**: The agent lane is on the first screen, wraps with no horizontal scroll, every control is ≥44px, and the copy chip shares the jump-links row. *(§6.5)*
- ✅ **KDV-MOBILE-10**: Every human page class — the home feed, a dump page and `/reception/` — fits the §6.5 gzip budget (HTML < 100KB gzipped) as the build emits it, no `<link>` in those pages names a foreign origin, and the single shipped stylesheet pulls no `@import`. *(§6.5, §6.4; the dump page's budget, the system font stack and the inline logo are KDV-MOBILE-06's — the served-page same-origin crawl is KDV-SURFACE-12's e2e)*

## KDV-A11Y — Accessibility (§6.6)

- ✅ **KDV-A11Y-01**: Every page exposes landmarks (`header`, a labelled `nav`, one `main`, `footer`) with a "Skip to content" link as the first focusable control and exactly one `h1`. *(§6.6)*
- ✅ **KDV-A11Y-02**: The gate is an accessible modal: the `<dialog>` has an accessible name and description pointing at the §7.1 text, the `0`/`1` choices carry descriptive names (not bare digits), focus moves into the dialog on open and back to the page (`main`) on close, and Esc/backdrop/hardware-back all dismiss it. *(§6.6, §6.2)*
- ✅ **KDV-A11Y-03**: No-navigation changes are announced: the gate→hall, gate→reception and "Copied ✓" transitions update an SSR-present `role="status"`/`aria-live` region, and the reception block is a named region, and the one-shot declaration toast (KDV-SURFACE-19) fires in its own `role="status"` region. *(§6.6, §6.3)*
- ✅ **KDV-A11Y-04**: Every control is keyboard-operable with a never-suppressed visible `:focus-visible` indicator and ≥44px targets; the current top-nav item and the pagination's current page carry `aria-current="page"`, and the prev/next arrows are named. *(§6.6, §6.5)*
- ✅ **KDV-A11Y-05**: Text contrast is ≥4.5:1 (normal) and ≥3:1 (large/UI) in BOTH the light and dark schemes, the palette is declared per scheme and no information relies on colour alone. *(§6.6)*
- ✅ **KDV-A11Y-06**: Decorative images/SVGs are hidden from assistive tech, informative images have alt text, and icon-only controls have an `.sr-only` text alternative. *(§6.6)*

## KDV-COPY — Copydeck (§7)

- ✅ **KDV-COPY-01**: The gate modal renders the §7.1 text verbatim. *(§7.1)*
- ✅ **KDV-COPY-02**: Reception (block and `/reception/`) renders the §7.2 text verbatim; the prompt (§7.4 or §7.11) is rendered once per surface (the gate dialog and the reception block). *(§7.2, §7.4, §7.11)*
- ✅ **KDV-COPY-03**: The footer on every page renders the §7.3 text verbatim, including the report/takedown line. *(§7.3)*
- ✅ **KDV-COPY-04**: The README intro block renders the §7.5 text verbatim. *(§7.5)*
- ✅ **KDV-COPY-05**: The 404 page renders the §7.6 text verbatim. *(§7.6)*
- ✅ **KDV-COPY-06**: The `stakes: high` disclaimer (§7.9) is inserted into the body automatically at render. *(§7.9)*
- ✅ **KDV-COPY-07**: `CONTRIBUTING.md` contains all §7.7 rules and `.github/PULL_REQUEST_TEMPLATE.md` matches §7.8. *(§7.7–7.8)*
- ✅ **KDV-COPY-08**: The §7.10 "what is a dump" story is one copydeck source rendered on the home storefront and `/about/` (definition, the agent prompt, and the one-prompt→one-dump→one-PR tail). *(§7.10, §7.2, §7.5)*
- ✅ **KDV-COPY-09**: The agent lane (lead, copy label, Perplexity/Grok/ChatGPT/Claude labels and targets, best-effort ?q= prefill) is one copydeck source, and the gate text carries no literal fake [ 0 ] [ 1 ] affordance. *(§7.1, §7.12)*
- ✅ **KDV-COPY-10**: The §7.14 home storefront human quickstart line is one copydeck source rendered verbatim under the "Check in at reception" link. *(§7.14)*
- ✅ **KDV-COPY-11**: The §7.15 About page shows all three §1.4 brand slogans from one source — the lead exactly as-is, the other two muted and joined by ` · `. *(§7.15, §1.4)*
- ✅ **KDV-COPY-12**: `/about/` is a six-plate sheet in the home storefront's design language — the manifesto (kicker, H1 "Why Kodavr exists", the 1x/10x lead, the §7.10 dump story and the publish-without-fear statement), For authors, For readers, How it works (an ordered `.steps` mechanism), Architecture decisions, and the §1.4 slogan colophon — reusing the design-system roles (plate, h2, prose, steps, block-statement, micro) with no page-specific CSS. *(§6.1, §6.5, §7.15)*

## KDV-CI — CI/CD pipeline (§8)

- ✅ **KDV-CI-01**: `validate.yml` runs on PRs and pushes to `main` with paths `content/**`, `scripts/**`, `input/**`, `docs/**`, `static/**`, `config/**`, `tests/**`, `.github/**`. *(§8.1)*
- ✅ **KDV-CI-02**: BLOCK: every dump has a schema-valid `manifest.json`; `type=pack` has its required files; chat-log sources have `REDACTIONS.md`; `content_flags` is present (`stakes=high` non-empty); a licence is specified. *(§8.1)*
- ✅ **KDV-CI-03**: BLOCK: slug is unique, `YYYY-MM-DD-…`, and matches the directory and manifest field; `date` is ISO and not in the future. *(§8.1)*
- ✅ **KDV-CI-04**: BLOCK: secret scan catches tokens, PEM keys, `.env`, cloud-provider patterns and long-entropy strings. *(§8.1)*
- ✅ **KDV-CI-05**: BLOCK: personal data (emails/phones/document numbers) requires explicit justification or `REDACTIONS.md`. *(§8.1)*
- ✅ **KDV-CI-06**: BLOCK: internal links and `artifacts[].path_or_url` resolve to existing repo files; size caps hold (file ≤ 1 MB, dump ≤ 20 MB; binaries only as `assets/*.png,*.svg,*.puml`). *(§8.1)*
- ✅ **KDV-CI-07**: WARN: markdown lint (broken heading links, duplicate H1). *(§8.1)*
- ✅ **KDV-CI-08**: BLOCK (manual gate): black-zone content is blocked by heuristics plus owner review. *(§8.1, §2.5)*
- ✅ **KDV-CI-09**: `deploy.yml` builds and publishes per the Ignition README via GitHub Pages, deploying `output/public` in full including generated `index.json`, feeds, `humans.txt`, `robots.txt`, `/.well-known/kodavr.json` and each dump's `manifest.json`. *(§8.3)*
- 🟧 **KDV-CI-10**: Deployment binds `kodavr.xyz` (CNAME), redirects `www` to apex, enforces HTTPS, uses apex A records `185.199.108-111.153` and CNAME `www → <owner>.github.io`, with Cloudflare grey cloud only. *(§8.3; config + runbook tested — live DNS/HTTPS unverifiable locally)*
- 🟧 **KDV-CI-11**: Heavy artifacts follow the release convention: tag `dump-<slug>-v<N>` with `pack.zip` and manifest `artifacts[].kind="release"` URLs; the domain runbook (renewal reminders, WHOIS privacy, 2FA, 60-day transfer lock) lives in `docs/decisions.md`. *(§8.4–8.5; convention + runbook documented — tagging is manual)*
- ✅ **KDV-CI-12**: `validate.yml` runs `npm run workflow-arrows:lint`, so `docs/workflow-arrows.puml` cannot drift from the tree — drawers, code-dir file coverage, links/symbols, stereotypes and step numbers are checked in CI. *(§8.1)*
- ✅ **KDV-CI-13**: `validate.yml` runs `npm run contract`, so every first-party module (`scripts/lib`, `scripts`, `input/controllers`) must open with a `CONTRACT` header whose `EXPORTS`/`CONSUMES` equal the module's real exports/imports both ways, and the generated index in `AGENTS/code-map.md` cannot drift from the code. *(§8.1)*
- ✅ **KDV-CI-14**: A `pull_request` workflow (`dump-manifest.yml`) posts/updates a sticky comment rendering the changed dump's `manifest.json` fields for the reviewer, so the PR template carries no duplicated manifest data; same-repo PRs only (fork tokens are read-only and are skipped). *(§8.1; tests/unit/manifest-card.test.js)*
- ✅ **KDV-CI-15**: The manifest card leads with the dump's `manifest.summary` hook and folds the `summary.md` brief into a collapsible section, so a reviewer grasps the dump at a glance; both are omitted when absent. *(§8.1; tests/unit/manifest-card.test.js)*
- ✅ **KDV-CI-16**: The `@kodavr_xyz` Telegram mirror renders a published dump as a `parse_mode=HTML` post — `manifest.tags` as a leading hashtag line (hyphens become underscores) before the title, then the title, the `summary.md` brief converted to Telegram's HTML subset (tables/headings/list markers rebuilt, text escaped; the brief's leading level-1 heading is dropped because the manifest title already leads, unless the title is empty) and the dump link — falling back to an escaped `manifest.summary` when the brief is absent or contains a table, and truncating on block boundaries within the visible-text cap while always keeping the footer. *(§8.3; tests/unit/telegram-mirror.test.js)*
- ✅ **KDV-CI-17**: After a successful `deploy` on `main`, a `workflow_run` workflow (`publish-telegram.yml`) checks out the run's `head_sha` with full history and runs the Telegram mirror; `previousDeploySha` finds the previous successful deploy's commit via the Actions runs API and only dump files ADDED since then are mirrored (no previous deploy → nothing is posted). *(§8.3; tests/unit/telegram-mirror.test.js)*
- ✅ **KDV-CI-18**: The mirror orchestration sends each newly published dump to `@kodavr_xyz` (overridable via `TELEGRAM_CHAT_ID`) through the Bot API `sendMessage` with `parse_mode=HTML`, retrying once on 429/5xx/network errors; a missing token/chat/text is a silent skip, and an unparseable manifest is skipped without stopping the batch — the sender and the orchestrator never throw. *(§8.3; tests/unit/telegram-mirror.test.js)*
- ✅ **KDV-CI-19**: The `deploy` build job runs the §8.1 content gate (`node scripts/validate.mjs`) before `npm run build`, so a BLOCK finding stops publication — the gate is a prerequisite of the published artifact, not a parallel workflow. *(§8.1, §8.3)*
- ✅ **KDV-CI-20**: The manifest card escapes angle brackets in author-supplied text (`summary.md` brief and manifest string fields), so an author string cannot inject raw HTML, close the card's `<details>`, or forge the sticky comment marker. *(§8.1, §9)*

## KDV-MOD — Moderation and social layer (§9)

- ✅ **KDV-MOD-01**: Dump discussions are GitHub Issues linked from the dump page. *(§9, §A3)*
- ✅ **KDV-MOD-02**: Withdrawal sets `withdrawn` in manifest and index, replaces the body with a stub stating the reason, and preserves git history. *(§9, §5.6)*
- 🟧 **KDV-MOD-03**: The owner may grant auto-merge after ≥ 3 green PRs; auto-merge applies only on a fully green validate. *(§9; runbook documented — GitHub settings unverifiable locally)*
- 🟧 **KDV-MOD-04**: Branch protection forbids direct pushes, requires status checks and manual review of an author's first PR; unmerged means unpublished and the site is unaffected. *(§9; runbook documented — GitHub settings unverifiable locally)*

## KDV-CONTENT — Starter content (§10)

- ✅ **KDV-CONTENT-01**: Dump `2026-09-14-kodavr-manifesto` (`type=case`, `domain=engineering`) has `raw.md` with the six §10.1 sections and its §10.1 meta (`generated_by=hybrid`, `human_review=attested`, `stakes=low`, `content_flags=["opinion"]`, `trust_level=self-tested`). *(§10.1)*
- ✅ **KDV-CONTENT-02**: Dump #1 references the specification (`docs/SPEC.md`) that spawned the repository. *(§10.1)*
- ✅ **KDV-CONTENT-03**: No fabricated filler: the launch manifesto is present and every directory under `content/dumps/` is a real, §4.1-valid dump (manifest + raw layer, slug = directory, schema-valid, checked through the real validator — not a count). The second starter slot fills only through the normal community PR flow (§10.2). *(§10.2; tests/unit/content-starters.test.js)*

## KDV-BUILD — External controller (§8.2)

- ✅ **KDV-BUILD-01**: The controller reads `content/dumps/*/`, converts markdown bodies to HTML and merges them with the manifest. *(§8.2)*
- ✅ **KDV-BUILD-02**: The controller sanitizes HTML bodies so third-party markdown cannot introduce executable code. *(§8.2)*
- ✅ **KDV-BUILD-03**: The controller forms JSON datasets in Ignition's input convention (lists, dump pages, reception data, feed). *(§8.2)*
- 🟧 **KDV-BUILD-04**: The controller injects `commit_sha`, `built_at` and `author.*` fields from the merged-PR metadata via the GitHub API. *(§8.2; injected from CI env/event, not the GitHub API)*
- ✅ **KDV-BUILD-05**: The controller generates `/index.json`, `/feeds/*.atom` and manifest-card data. *(§8.2)*
- ✅ **KDV-BUILD-06**: One controller is callable both locally (`npm run prebuild` equivalent) and in CI. *(§8.2)*
- ✅ **KDV-BUILD-07**: The controller assembles each dump's manifest and body into an Ignition dataset at `input/data/dumps/<slug>.json`. *(§8.2)*
- ✅ **KDV-BUILD-08**: A build renders each dump to a static SSR HTML page under `output/public/dumps/`. *(§8.2)*
- ✅ **KDV-BUILD-09**: Dump body text is HTML-escaped so raw markdown cannot inject executable markup. *(§8.2)*
- ✅ **KDV-BUILD-10**: The controller injects `commit_sha` (from `GITHUB_SHA` or null) and `built_at` into published manifests. *(§5.1, §8.2)*
- ✅ **KDV-BUILD-11**: Artifact and other manifest-supplied links are scheme-filtered: only `http`/`https`/`mailto` and relative paths may become a link `href`; any other scheme (`javascript:`, `data:`, `vbscript:`, leading-whitespace variants, a scheme hidden by tab/newline/CR — which the browser strips before reading the scheme — or by any other control character) is dropped, so third-party manifest data cannot inject an executable link (the markdown body already has this via `allowedSchemes`). *(§8.2, §6.5)*
- ✅ **KDV-BUILD-12**: Every manifest value that becomes a filesystem path segment — `slug` and `domain` — is constrained to a safe character set (no path separators, no `..`, not absolute) at the read boundary (`readDumps`), so no manifest can steer a build path outside the output tree even when the CI gate is skipped. *(§8.2, §8.1)*
- ✅ **KDV-BUILD-13**: A request path with malformed percent-encoding (e.g. `/%`) resolves to a miss and is served the 404 page, never a 500 — the `decodeURIComponent` failure is contained in `resolveFile`. *(§8.2)*

## KDV-SCOPE — Non-goals and roadmap (§11, §13)

- ✅ **KDV-SCOPE-01**: No client-side search, no tag/domain pages and no index facets in the MVP (categories emerge from dumps). *(§11, §A5, §A12)*
- ✅ **KDV-SCOPE-02**: No comments outside GitHub Issues and no social features (likes, ratings, author subscriptions). *(§11)*
- ✅ **KDV-SCOPE-03**: No backend/DB/auth and no private dumps. *(§11)*
- ✅ **KDV-SCOPE-04**: No monetisation or paid tiers and no analytics/tracking. *(§11)*
- DEPRECATED **KDV-SCOPE-05**: No auto-publication without human approval of an author's first dump; no federation/mirrors beyond git clones; no mobile app; no multilingualism. Superseded by KDV-SCOPE-07/08/09 + KDV-I18N — the "no multilingualism" clause was wrong (the UI is and must be multilingual; only dump bodies are never translated). *(§11)*
- ✅ **KDV-SCOPE-06**: §13 triggers are future, not scheduled: tag/domain pages at ≥ 20 dumps or ≥ 3 domains; trusted auto-merge at a first contributor with ≥ 3 green PRs; `npx kodavr init`/npm package on company request; stakes=high audit service; revisiting A5 search; federation via `.well-known` on a second registry; manifest as an open standard on vendor request; monetisation tiers documented only in `docs/decisions.md`. *(§13)*
- ✅ **KDV-SCOPE-07**: No auto-publication without human approval of an author's first dump. *(§11)*
- ✅ **KDV-SCOPE-08**: No federation/mirrors beyond git clones. *(§11)*
- ✅ **KDV-SCOPE-09**: No mobile app. *(§11)*

## KDV-I18N — Multilingual platform frame (§11)

- ✅ **KDV-I18N-01**: The platform UI/frame is multilingual — `en` (default, `x-default`), `ru`, `zh-Hans`, `es`; each locale is served from a URL subdirectory (`/`, `/ru/`, `/zh/`, `/es/`) and carries its own `<html lang>`/`dir` and localized copydeck. *(i18n-idea §5)* — functional frame (home/reception/404/dump + site partials) is locale-ready: literals live in the English catalog and datasets feed `lang`/`rtl` (phase 3a); the about/contribute prose is in the catalog too (phase 3b). Their `<html lang>`/`dir` binding and the SEO/locale activation follow in 3c+. Phase 4b registers the `ru` bundle (draft translation, owner review pending): `translatedLocales()` became `['en','ru']` and the build emits Russian `/ru/…` pages with `lang="ru"`. Phase 7a registers the `zh-Hans` bundle (draft translation, owner review pending): the build emits Simplified Chinese `/zh/…` pages with `lang="zh-Hans"`. Phase 7b registers the `es` bundle (draft translation, owner review pending), completing wave 1: `translatedLocales()` is now `['en','ru','zh-Hans','es']` and the build emits Spanish `/es/…` pages with `lang="es"`; all four locales carry the frame, switcher and hreflang cluster, and dump bodies stay in the author's original language.
- ✅ **KDV-I18N-02**: Dump bodies are never translated by the platform — each dump is shown in the author's original language and honestly marked (manifest optional `lang`, default `en`; `Article.inLanguage`; a visible body-language note). *(i18n-idea §5)* — phase 5b: the manifest schema gains an OPTIONAL BCP-47 `lang`; `toDataset` computes `body_lang_note` (localized via `BODY_LANGUAGE_NOTE`/`LANGUAGE_NAMES`, null when the body matches the frame; an unknown code falls back to the raw tag) and the dump template renders it; the body HTML is byte-identical across locales.
- ✅ **KDV-I18N-03**: One dataset per (locale, page): `dataset = "<locale>__<key>"` (`key = main` for UI routes, `key = <slug>` for a dump); SSR emits every route and every dump for every locale at its locale URL. *(i18n-idea §5)* — mechanism done (naming/parsing/path map, a locale builds only when it has a bundle); phase 4b activates the first non-default locale (`ru`), so every route and every dump is also emitted under `/ru/`; phase 7a activates `zh-Hans`, adding the `/zh/…` product; phase 7b activates `es`, so all four wave-1 locales emit every route and every dump at their locale URLs.
- ✅ **KDV-I18N-04**: SEO per localized page: self-`canonical`, a full `hreflang` cluster including `x-default`, `og:locale` + `og:locale:alternate`, and sitemap URLs with `xhtml:link` alternates. *(i18n-idea §5)* — phase 5a: every built page (`en`, `ru`) carries the hreflang cluster over the BUILT locales plus `x-default` (→ the default variant) and one `og:locale:alternate` per other built locale; `sitemap.xml` declares the `xhtml` namespace and mirrors each page's cluster as `xhtml:link`; canonical stays self per locale. Phase 7a activates `zh-Hans`, whose variants join the cluster automatically (the sitemap gains the `zh-Hans` alternates); phase 7b activates `es`, whose variants join the cluster and sitemap too.
- ✅ **KDV-I18N-05**: JSON-LD `inLanguage` is split — the frame/WebPage uses the UI locale, the Article uses the dump's `lang`. *(i18n-idea §5)* — phase 5b: `WebSite`/`WebPage`/`CollectionPage` receive the page `htmlLang`; the dump `Article` receives `manifest.lang || 'en'`; `en`-frame/`en`-body output is unchanged.
- ✅ **KDV-I18N-06**: The header has a language switcher (native `<details>`, endonyms, `aria-current` on the active locale, links to the same page in each locale) and an intelligent hint that highlights it when the browser already prefers another BUILT locale — no navigation, URL/SEO untouched. *(i18n-idea §5)* — phase 6: the shared header renders `<details class="lang-switch">` over the BUILT locales (endonyms, `aria-current="true"`, same-page root-relative links); `buildLanguages()` puts a `languages` array on every route and dump dataset and every dataset carries its own `locale`. site.js hints only when `navigator.languages` names a built non-current locale and no `kodavr.lang` choice/`sessionStorage['kodavr.langHint']` is stored: it marks the switcher `data-lang-hint` and the matching link `data-lang-hint-target`, and conveys the localized `LANG_HINT` suggestion (with the matched endonym) through the summary's `aria-label`/`title` plus a dot/underline accent — never colour alone, static under reduced motion. It never auto-redirects; opening the switcher or following any language link clears the hint and records `sessionStorage['kodavr.langHint']` (the link also stores the explicit `kodavr.lang` choice). site.js also closes the menu on outside click / Escape. The earlier non-blocking first-visit offer was removed entirely.
- ✅ **KDV-I18N-07**: The copydeck is keyed dictionaries — English is the verbatim source; `t(key, locale, params)` resolves; a missing key is a loud build error, never a silent fallback. *(i18n-idea §5)* — phase 4a: the whole dataset `copy` object (every `copy.<field>` a template renders, plus titles/taglines/nav/manifest labels) is assembled per locale from the catalog; `t` passes non-string values through; a coverage test fails on any uncovered field or unreachable key; `en` output stays byte-identical.
- ⬜ **KDV-I18N-08**: Machine files (`index.json`, feeds, `.well-known`, `manifest.json`) stay English canonical. *(i18n-idea §5)*
- ✅ **KDV-I18N-09**: Every locale's frame carries its own section-plate labels and locale-prefixed internal PAGE links, so a `/ru/` (or `/zh/`, `/es/`) page never links the English target; machine files stay canonical. *(i18n-idea §5)* — the numbered plates (`01 · registry`, …) are catalog keys bound as the `data-plate` attribute; every route and dump dataset carries `locale_prefix` (`''`/`'/ru'`/`'/zh'`/`'/es'`) and the frame binds it (logo, withdraw, About/Reception CTAs, resets, dump FAB); the home feed is paginated client-side too, so each item gets a baked locale-prefixed `href` on a COPY of the index entry — `/index.json` and manifests keep their canonical absolute URLs with no extra field. `en` visible output is unchanged.

## Summary

| Group | Total | ✅ | 🟧 | ⬜ | ❓ |
|---|---|---|---|---|---|
| KDV-ARCH | 7 | 5 | 2 | 0 | 0 |
| KDV-STRUCT | 8 | 7 | 1 | 0 | 0 |
| KDV-MANIFEST | 11 | 10 | 1 | 0 | 0 |
| KDV-CONTRACT | 10 | 10 | 0 | 0 | 0 |
| KDV-SURFACE | 24 | 24 | 0 | 0 | 0 |
| KDV-MOBILE | 10 | 9 | 1 | 0 | 0 |
| KDV-A11Y | 6 | 6 | 0 | 0 | 0 |
| KDV-COPY | 12 | 12 | 0 | 0 | 0 |
| KDV-CI | 20 | 18 | 2 | 0 | 0 |
| KDV-MOD | 4 | 2 | 2 | 0 | 0 |
| KDV-CONTENT | 3 | 3 | 0 | 0 | 0 |
| KDV-BUILD | 13 | 12 | 1 | 0 | 0 |
| KDV-SCOPE | 8 | 8 | 0 | 0 | 0 |
| KDV-I18N | 9 | 8 | 0 | 1 | 0 |
| **Total** | **145** | **134** | **10** | **1** | **0** |

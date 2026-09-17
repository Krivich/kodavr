# Design system — "The Contract Sheet"

One stylesheet ships to the browser: `static/assets/styles.css`. It is built from a
**vocabulary of roles and components** (the v2 "contract sheet" design language), not from
page-specific CSS. New UI reuses a role or a component; a new rule is the last resort.

A page composes roles:

```html
<section class="plate">          <!-- a numbered sheet section -->
  <p class="lead">…</p>          <!-- the opening sentence -->
  <blockquote class="block-statement">…</blockquote>
  <article class="card">…</article>
</section>
```

## Tokens (§01)

Every colour, font, space and measure comes from a token declared on `:root` (with a
dark-scheme override). Component rules never carry new literals.

| token | role |
| --- | --- |
| `--fg` / `--bg` | the AA text and page colours (the only literal hex the a11y tests measure) |
| `--muted` | secondary text |
| `--line` | the structural, AA-safe rule |
| `--pre-bg` | the code/quote block fill |
| `--paper` / `--ink` / `--block` | the demo palette aliases over `--bg` / `--fg` / `--pre-bg` |
| `--ink-2` | a softer body ink for prose |
| `--line-2` | the decorative hairline |
| `--accent` | the signal ochre — interactivity and active state only |
| `--font-mono` | the machine contour (system stack; no FOUT) |
| `--font-prose` | the human contour (system stack; no FOUT) |
| `--sp-1`, `--sp-2`, `--sp-3`, `--sp-4`, `--sp-5`, `--sp-6`, `--sp-7`, `--sp-8` | the 4→72px spacing scale |
| `--measure` | the prose measure (68ch) |
| `--rail` | the gutter that carries a plate's number |
| `--tap` | the 44px minimum touch target |
| `--bp-mobile` / `--bp-tablet` | breakpoint documentation (`@media` cannot read a custom prop) |

## Type roles (§06)

Roles carry meaning, not size: `kicker` (an eyebrow), `lead` (the opening sentence),
`card-h` (a card heading), `meta` (a muted fact line), `micro` (fine print), `summary`
(the feed excerpt), `prose` (a human text column), `legal-group` (a mono/muted tail under
a hairline), `block-statement` (a quoted statement with a left rule), `block-machine` (a
machine artifact: a command, a prompt), `filechip` (a file/kind tag), `kv`, `val` (a
key–value row), `linklist`, `steps`, `checklist`.

Two contours, one sheet: **machine** surfaces (`hall`, `block-machine`, `pre`, a manifest
card) use `--font-mono`; **human** surfaces (reception, prose, statements) use
`--font-prose`. A surface never mixes the two.

## Components (demo vocabulary)

| component | structure |
| --- | --- |
| `sheet` / `sheet-inner` | the page frame and its column |
| `masthead` / `mark` / `nav` | the header, its logo and its route list |
| `plate` | a numbered sheet section (`data-plate`, numbered via `::before`) |
| `card` | the generic framed object; `details.card` is an accordion |
| `row` | a label/value row inside a card |
| `hall` | the machine room body (mono, fluid clamp) |
| `statusline` | the line a gate transition leaves at the top of the hall |
| `resetline` | the "start over" line |
| `flags` | the feed row's flag line |
| `gate` / `door` / `gate-hint` | the entry ceremony (`#gate`, `.gate-*`, `.door*`) |
| `toast` / `fab` / `void` | the transient toast, the floating back button, the 404 mark |
| `titleblock` | the footer's four-cell colophon |
| `pagination` | the touch-sized feed pager |
| `mark-lg` / `slogan-muted` | the About-page masthead mark and slogan group |

## App extensions (no demo equivalent)

These are ours; they follow the same token discipline and live in §15:

- **species chrome** — `species-declaration`, `species-chip`, `species-chip-text`,
  `species-separator`, `species-chip-withdraw` (§7.13 declaration status).
- **reception surface** — `reception-page`, `reception-block`, `reception-brief*`,
  `reception-text`, `reception-rating`, `reception-prompt`.
- **agent lane** — `agent-lane*`, `agent-links`, `agent-link`, `copy-prompt` (§7.12 jump
  links and the copy control).
- **dump page extras** — `dump-feed`, `dump-title`, `dump-discuss`, `dump-prompt`,
  `artifacts`, `artifact-link`, `artifact-note`, `artifacts-empty`, the `#machine-panel`
  hooks, `declaration-toast`.
- **page scope** — `home`, `about`, `dump-page`, `reception-page`, `contribute`,
  `not-found` mark the page a rule belongs to.
- **chrome extras** — `footer-copy`, `footer-report`, `human-quickstart-note`,
  `trust-legend-lead`, `reset-link`, `not-found-text`.

## Rules

1. **One truth per entity.** A fact (a colour, a size, a role) lives in one place;
   duplicates are bugs.
2. **No dead rules.** Every class selector in `styles.css` must be backed by a shipped
   hook — a template (`.hbs`), a controller (`input/controllers`), a page script
   (`static/assets`), or a test. A rule whose last hook is gone is deleted with it.
3. **No top-level duplicate selector.** A selector is declared once; later overrides live
   in an `@media` / `@supports` / print context, never as a second top-level block.
4. **Tokens only.** Component rules use tokens; the a11y contrast tests measure the
   token hex.

Rules 2 and 3 are enforced by the guard test **KDV-SURFACE-22**
(`tests/unit/design-system.test.js`).

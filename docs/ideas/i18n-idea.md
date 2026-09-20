# i18n-idea

**Status:** grounded — design decided, minting into `KDV-I18N-*` (2026-09-20)
**Origin:** discussion 2026-09-20; seed: "мультиязычность платформы — ssr/csr, seo-friendly;
касается страниц и темплейтов, не текстов дампов; дефолт английский, нужны ru/zh/es;
гугл должен видеть контент на языке пользователя".

> **File rule: APPEND, DO NOT EDIT** (branch addresses are permanent). After minting, the
> registry (`REQUIREMENTS.md`) is the source of truth; this doc holds exploration only.

## 0. Ground (verified against the code)

- **The engine has no i18n and no routing-by-locale.** One dataset file = one output page:
  `ignition engine/core/queue.js:58-102`, `engine/core/renderer.js:388,708`. Layouts are
  top-level `input/templates/*.hbs`; data is one level `input/data/<layout>/*.json`;
  subfolders in templates are partials (`renderer.js:496-642`). i18n is explicitly the
  external controller's job (`ignition/AGENTS.md:175`, `TODO.md:135`, `README.md:142`).
- **`dataset` is a free path segment**, so it can carry a coordinate:
  `data/about/ru.json` → `about/ru.html`; paginated `data/home/ru.json` →
  `home/ru/page/1.html` (`renderer.js:388,708`).
- **Client runtime URLs are root-absolute** `/assets`, `/data/<layout>/<dataset>.json`,
  `/templates/<...>.hbs` (`renderer.js:32,105,684`). Unique dataset names ⇒ no collision.
- **The wrapper owns routing**: `ROUTE_PAGES` (`scripts/lib/pages.mjs:180-186`),
  `publishRoutePages` (`scripts/lib/build.mjs:89-111`), pretty URLs (`build.mjs:171-182`).
- **Copydeck is single-language English**: `scripts/lib/copy.mjs`; hardcoded English
  literals in `pages.mjs:110-140,171-173,277,332-391`, `machine.mjs:88-195,342` and the
  `.hbs` layouts. `<html lang="en">` literal in every layout; `og:locale` from
  `SITE_LOCALE='en_US'` (`pages.mjs:173`, `site/head.hbs:19`).
- **JSON-LD `inLanguage` defaults to `'en'`** (`scripts/lib/jsonld.mjs`).
- **Sitemap has no hreflang** (`scripts/lib/machine.mjs:566`). Manifest schema has no
  `lang` field (`scripts/lib/schema.mjs:83,124`).
- **`relativize` is path-segment agnostic** — a locale prefix gains one depth level
  automatically (`scripts/lib/relativize.mjs:84-87`).
- **Scope currently forbids i18n**: `REQUIREMENTS.md` `KDV-SCOPE-05`,
  `tests/unit/scope.test.js:123-147` (bans `i18next`/`vue-i18n` deps, `locales`/`i18n`
  dirs, any `lang="(?!en")`), `docs/SPEC.md` §11 deferred list.

## 1. Pain

The platform frame (nav, gate, reception, footer, labels, meta) is English-only; a
Russian/Chinese/Spanish reader and Googlebot see English chrome. Dump bodies are
third-party content and are **not** translated. We want SSR-rendered, SEO-indexable,
locale-correct frames for every language.

## 2. What it depends on

- Scope change: `KDV-SCOPE-05` amendment + `scope.test.js` + `docs/SPEC.md` §11.
- Copydeck extraction into per-locale dictionaries (English stays the verbatim source).

## 3. Cases

1. A Russian user opens google, searches in Russian, gets a Kodavr page with a Russian
   `title`/description/frame; the body he opens is the original-language dump, honestly
   marked with a language note.
2. An English user lands on `/`; the frame is English, switcher offers Русский / 中文 /
   Español; nothing redirects without consent.
3. Googlebot crawls `/ru/about/`, sees `lang="ru"`, Russian copy, and an `hreflang`
   cluster linking the `en`/`zh-Hans`/`es`/`x-default` variants.

## 4. Value

Localized, indexable frames; a language switcher; honest mixed-language handling; zero
engine changes (all in the external controller, exactly as the engine intends).

## 5. Decided (contracts — mint into IDs)

- **Locales, wave 1** (default first): `en` (default, `x-default`), `ru`, `zh-Hans`, `es`.
  URL prefixes: `''`, `/ru/`, `/zh/`, `/es/`. Later waves (no architecture change):
  `pt-BR`, `hi`, `de`, `fr`, `ja`, `ko`.
- **URL scheme:** subdirectories (one domain, one authority, fits `relativize`).
- **Full SSR × locale, including dump pages.** `N` is a constant (4–5), `M` (dumps) is the
  variable; ×N changes neither the class nor the wall (GH Pages limits) — no premature
  optimization.
- **Dataset coordinate:** `dataset = "<locale>__<key>"`; `key = main` for UI routes,
  `key = <slug>` for a dump. Separator `__` is unambiguous (locale codes have no `_`, slugs
  are `[a-z0-9-]`). The wrapper parses it to publish `/prefix/route/…`.
- **Routes × locales:** `home` (paginated), `reception`, `about`, `contribute`, `notfound`.
- **Dump pages:** full product; body/content unchanged; frame localized. `manifest.json`
  stays **one per dump** (canonical machine contract, not localized).
- **Manifest `lang`** (optional, default `en`) added to the schema → `Article.inLanguage`
  and the honest frame note ("Article body is in <language>").
- **Machine files stay English canonical** (`index.json`, feeds, `.well-known`, manifests).
- **Copydeck:** English source + per-locale dictionaries; `t(key, locale, params)`; a
  missing key is a **loud build error** (fail-visible), never a silent fallback; the English
  strings stay byte-for-byte (SPEC §7 verbatim).
- **SEO per page:** `<html lang>` + `dir`; self-`canonical`; `hreflang` cluster incl.
  `x-default`; `og:locale` + `og:locale:alternate`; JSON-LD `inLanguage` split (frame vs
  article); sitemap carries localized URLs with `xhtml:link` alternates.
- **Header language switcher:** native `<details>` (no-JS), endonyms, `aria-current` on the
  active locale, links to the same page's alternating URL.
- **Intelligent hint (replacing the first-visit offer):** when `navigator.languages`
  names a built locale other than the current page's and no explicit choice is stored,
  highlight the header switcher (accessible name/title + a static accent dot/underline)
  instead of showing a banner; one per session, cleared on engagement, and never an
  auto-redirect.
- **Allowed expectation:** Google may still consolidate near-duplicate bodies; `hreflang` is
  the official mechanism and the frame is indexed per language. Translating bodies is out of
  scope.

## 6. Open questions / deferred

- **Per-locale 404** — GH Pages serves a single `404.html`; a static per-locale 404 is not
  possible. Deferred (return when a host with locale-aware 404s exists, or via JS detect).
- **Body de-duplication** in per-locale data/HTML — deferred until `M` itself is the wall.

## Sketches (UI batch — approve before implementing phase 5)

Header (switcher is a compact `<details>` on the right; endonyms in the list):

```
┌───────────────────────────────────────────────────────────┐
│ [logo]  home reception about contribute   [species chip] 🌐EN ▾ │
└───────────────────────────────────────────────────────────┘
                                     ┌──────────────┐
                                     │ English   ✓  │  ← aria-current="true"
                                     │ Русский      │
                                     │ 中文         │
                                     │ Español      │
                                     └──────────────┘
```

Intelligent hint (replaces the earlier offer — no banner; the header switcher is
highlighted, SSR markup carries the hooks, site.js adds `data-lang-hint`):

```
┌───────────────────────────────────────────────────────────┐
│ [logo]  home reception about contribute   [species chip] •🌐EN ▾ │
└───────────────────────────────────────────────────────────┘
   • = accent dot + underline on the summary; aria-label/title
     carry "Language — Also available in Русский". No navigation.
```

## Phases (delegated one at a time)

0. **Scope + registry** — amend `KDV-SCOPE-05`, add `KDV-I18N-*`, update `scope.test.js`,
   `docs/SPEC.md` §11. No functional code.
1. **Copydeck core** — `LOCALES` registry, `t(key, locale, params)`, dictionaries; English
   verbatim; completeness test. No route change.
2. **Product + routing** — generate `<locale>__<key>` datasets; publish per prefix (en-only
   first = no behaviour change), then enable locales.
3. **Templates** — `lang`/`dir` from dataset, every literal from the copydeck.
4. **SEO** — hreflang/x-default, self-canonical, `og:locale`, JSON-LD split, sitemap.
5. **UI** — header switcher + intelligent hint (against the approved sketch).
6. **Translations** — ru / zh-Hans / es dictionaries (human review).
7. **Tests + docs** — unit/integration/e2e, registry statuses, `AGENTS.md`/map updates.

## Entry point for the agent

Read `AGENTS/requirements.md` for the minting protocol. Branch decisions in §5 are
contracts — do not re-decide. Code only on an explicit command.

## Status

- **Accepted:** locale scheme (`en`/`ru`/`zh-Hans`/`es`, subdirs, x-default→en) (2026-09-20)
- **Accepted:** full SSR product incl. dumps (`dataset=<locale>__<key>`) (2026-09-20)
- **Accepted:** manifest `lang` + split `inLanguage` + honest body-language note (2026-09-20)
- **Accepted:** header switcher + intelligent hint (2026-09-20)
- **Deferred:** per-locale 404; body de-duplication (return when the wall is `M`)

## Addendum 2026-09-20 — precise scope (owner clarification)

The old prohibition was never "no UI translation"; its **intent was: we never translate a
dump's body** — a translation on our side would be a distortion of raw first-hand
experience. The UI/frame, on the contrary, **must** be translated.

Therefore in phase 0:
- `KDV-SCOPE-05` is **DEPRECATED** (preserved ID; it bundled a now-wrong "no multilingualism").
  Its still-valid clauses are re-minted precisely as new IDs: no auto-publication of a first
  dump; no federation/mirrors beyond git clones; no mobile app.
- New precise i18n requirements are minted (UI is multilingual; **dump bodies are never
  translated by the platform** and are shown in the author's original language, honestly
  marked). This precise negative is what replaces the vague "no multilingualism".
- `docs/SPEC.md` §11 loses `multilingualism`; the permanent rule "no machine translation of
  dump bodies" is stated where the i18n contract lives.

## Addendum 2026-09-20 — dataset naming (backward-compatible)

`dataset = "<locale>__<key>"` is refined for the DEFAULT locale: to keep the English output
(and its engine-injected client data URLs) byte-stable and to avoid churn in existing tests,
the default locale keeps the **bare key** as its dataset name. So:
- default (`en`): `about/main.json`, `dumps/<slug>.json` (unchanged);
- non-default: `about/ru__main.json`, `dumps/ru__<slug>.json`.
- `parseDataset(name)` → `{ locale, key }`: if `name` splits on `__` and the prefix is a known
  non-default locale code, that locale + the remainder; otherwise `{ locale: DEFAULT, key: name }`.
  Separator `__` is unambiguous (locale codes contain no `_`; keys are `main` or `[a-z0-9-]` slugs).

A locale is **built only when it has a message bundle** (`translatedLocales()`); until then its
`t()` throws (fail-visible). Phase 6 adds `ru`/`zh-Hans`/`es` bundles and thereby activates them.

## Addendum 2026-09-20 — what the locale prefix applies to (content vs frame)

Only the **frame** is localized and locale-prefixed; the **content contract** is not.
- Locale-prefixed: the page URL, `<link rel="canonical">`, `og:url`, nav/footer/link hrefs, and
  all frame copy — for a non-default locale these sit under `/<prefix>/…`.
- NOT prefixed (canonical, shared by every locale): `manifest_url`, the `raw`/layer `body_url`,
  `.well-known`, `index.json`, feeds, and the machine `manifest.json` files. They are published
  once at `/<...>` and are the single source of truth for the dump content; a localized page
  links to the canonical manifest/body (no per-locale copies). This keeps `KDV-I18N-08` intact
  and avoids 404s, since machine files are only ever written canonically.

## Follow-up 2026-09-20 — first-visit offer replaced by an intelligent hint

The first-visit language offer did not match the site's visual language and was
retired. **Decision:** remove the offer entirely and, instead, turn the header
switcher into an intelligent hint — when `navigator.languages` names a BUILT
locale different from the page's and no explicit choice is stored, site.js adds
`data-lang-hint` to `<details class="lang-switch">`, marks the matching menu link
`data-lang-hint-target`, and conveys the suggestion accessibly through the
summary's `aria-label`/`title` (catalog `LANG_HINT` with `{language}` = the
matched endonym) plus a subtle accent dot/underline. It NEVER navigates and the
URL/SEO are untouched. The hint is one per session (`sessionStorage['kodavr.langHint']`)
and clears when the switcher is opened or any language link is followed (which
also stores the explicit `localStorage['kodavr.lang']` choice). Removed with the
offer: its SSR markup (`site/header.hbs`), its `site.js` logic, its `.lang-offer*`
CSS and the `LANG_OFFER_TEXT`/`LANG_OFFER_CTA`/`LANG_OFFER_DISMISS` catalog keys.
Under `prefers-reduced-motion: reduce` the accent stays static (no pulse).

## Follow-up 2026-09-20 — locale-aware frame links + plate labels (KDV-I18N-09)

Two frame-level gaps found in the owner's review of the Russian build:
- **Section-plate labels** (`01 · registry`, …) were hardcoded English in the templates; they
  are now catalog keys (`*_PLATE_*`) bound as the `data-plate` ATTRIBUTE (attribute bindings
  get no reactive `data-ignition-text` sticker).
- **Internal page links** (logo, nav fallback, About/Reception CTAs, resets, the dump FAB and
  the home-feed item link) were unprefixed, so a `/ru/` page linked the English target. Every
  route and dump dataset now carries `locale_prefix` (`''`/`'/ru'`/`'/zh'`/`'/es'`) and the
  frame binds it. Machine files stay canonical (not prefixed).
- The home feed is paginated on the client too (`ignition/pagination` re-renders with only
  `items`/`pagination`), so a top-level `locale_prefix` does not survive; the item link is
  baked as a root-relative locale-prefixed `href` on a COPY of each index entry, keeping
  `/index.json` and manifests free of the extra field.

The `01 · …` plate vocabulary is now the stable catalog contract for this design role.


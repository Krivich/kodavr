/**
 * CONTRACT: scripts/lib/i18n-en.mjs
 * ROLE: the English message bundle — the copydeck plus the structural UI/extra strings
 * EXPORTS:
 *   EN — the frozen English bundle (copydeck constants + the explicit UI section)
 * CONSUMES:
 *   ./copy.mjs — the verbatim English copydeck (the single source)
 *   ./machine.mjs — the trust-legend lead and level meanings (machine-canonical English)
 * INVARIANTS:
 *   — copydeck values are referenced from copy.mjs, never retyped
 *   — structural UI strings with no copy.mjs home live in the explicit UI section
 *   — non-string entries (arrays/objects) ride the bundle verbatim, never placeholder-substituted
 */
import * as copy from './copy.mjs';
import { TRUST_LEGEND_LEAD, TRUST_LEVEL_MEANINGS } from './machine.mjs';

// Structural frame chrome with no copydeck (§7) home: nav/footer cell labels,
// skip link, pagination, gate door group, artifacts and page kickers/leads. The
// keys are the stable catalog vocabulary; dataset fields are their lowercase form.
const UI = Object.freeze({
  SKIP_TO_CONTENT: 'Skip to content',
  NAV_PRIMARY: 'Primary',
  FEED_TITLE: 'Kodavr dumps',
  BACK_TO_FEED: 'Back to feed',
  FOOTER_CELL_ADVISORY: 'advisory',
  FOOTER_CELL_LICENCES: 'licences',
  FOOTER_CELL_CONTRACT: 'contract',
  FOOTER_CELL_REPORT: 'report',
  GATE_OR: 'or',
  GATE_DOORS_LABEL: 'Entry declaration',
  // §7.1 v3/KDV-SURFACE-26: the dump page's gate names the dump above the doors.
  GATE_DUMP_CONTEXT_LEAD: 'About this dump:',
  ARTIFACTS_HEADING: 'Artifacts',
  ARTIFACTS_EMPTY: 'No artifacts.',
  HOME_ABOUT_CTA: 'About the platform',
  HOME_CONTRIBUTE_CTA: 'How to contribute',
  HOME_FOR_MACHINES: 'For machines',
  HOME_LATEST_LEAD: 'Latest ',
  HOME_LATEST_TERM: 'dumps',
  HOME_TRUST_LEVELS: 'Trust levels',
  PAGINATION_LABEL: 'Pagination',
  PAGINATION_PREV: 'Previous page',
  PAGINATION_NEXT: 'Next page',
  RECEPTION_KICKER: 'human surface · check-in',
  RECEPTION_LEAD:
    'You are at the human desk: instructions and metadata live here; the raw content stays machine-first.',
  NOT_FOUND_KICKER: 'error sheet',
  NOT_FOUND_NOTE:
    '(Attribution is one of the four machine duties. The agent forgot. The agent is sorry.)',
  NOT_FOUND_CTA: 'Return to the storefront',
  // §11/KDV-I18N-09: the numbered section-plate labels — a design role (`01 ·
  // humans`), not prose. Bound as a `data-plate` ATTRIBUTE, so the engine
  // never stamps them with a reactive `data-ignition-text` sticker. Human
  // Surface v4 renumbers the storefront plates (the hero carries no label) and
  // localizes them like every other plate.
  HOME_PLATE_HUMANS: '01 · HUMANS',
  HOME_PLATE_LATEST: '02 · LATEST',
  HOME_PLATE_MACHINES: '03 · MACHINES',
  HOME_PLATE_TRUST: '04 · TRUST',
  ABOUT_PLATE_MANIFESTO: '01 · manifesto',
  ABOUT_PLATE_AUTHORS: '02 · authors',
  ABOUT_PLATE_READERS: '03 · readers',
  ABOUT_PLATE_MECHANISM: '04 · mechanism',
  ABOUT_PLATE_ARCHITECTURE: '05 · architecture',
  ABOUT_PLATE_COLOPHON: '06 · colophon',
  CONTRIBUTE_PLATE_AUTHORS: '01 · authors',
  CONTRIBUTE_PLATE_FLOW: '02 · flow',
  CONTRIBUTE_PLATE_SCHEMA: '03 · schema',
  CONTRIBUTE_PLATE_LICENCES: '04 · licences',
  RECEPTION_PLATE_CHECKIN: '01 · check-in',
  DUMPS_PLATE_ARTIFACTS: '06 · artifacts',
  // §6.2 v4/KDV-SURFACE-28: the article page's inline plates — `01 · PREVIEW`,
  // `02 · INTERESTING?` and `03 · DECLARATION` in state 0; state M collapses to
  // the raw `01 · DUMP`. The labels localize like every other plate.
  DUMPS_PLATE_PREVIEW: '01 · PREVIEW',
  DUMPS_PLATE_WANT: '02 · INTERESTING?',
  DUMPS_PLATE_DECLARATION: '03 · DECLARATION',
  DUMPS_PLATE_DUMP: '01 · DUMP',
  NOTFOUND_PLATE_VOID: '00 · void',
  // §11/KDV-I18N-06: the header language switcher — its summary aria-label and
  // the intelligent hint (site.js) shown when the browser already prefers another
  // BUILT locale. `{language}` is the matched locale's endonym.
  LANG_SWITCH_LABEL: 'Language',
  LANG_HINT: 'Also available in {language}',
  // §11/KDV-I18N-01: the six-plate /about/ sheet. List items split into their
  // <strong> title and its body; a body that wraps a <code> path splits around it.
  ABOUT_KICKER: 'about the platform',
  ABOUT_LEAD:
    'Making a thing costs 1x. Packaging it so someone else can reuse it costs 10x — the documentation, the generalised examples, the stripped-out private context, the upkeep. Almost everyone pays the first cost and almost no one pays the second, so 90% of useful experience dies in local folders: a working script, a hard-won workaround, a checklist only its author understands. Kodavr exists to break that asymmetry.',
  ABOUT_NO_FEAR:
    'So publish without fear: your dump does not have to find its reader on its own. The agent selects what is interesting for its particular user, and then rewrites the dump for that user — longer or shorter, in this or another style, with explanations or without. Your raw text becomes exactly what the reader needs; both the selection and the adaptation happen on their side.',
  ABOUT_FOR_AUTHORS_HEADING: 'For authors',
  ABOUT_FOR_AUTHORS_LEAD:
    "You pay 1x to build the thing and 1x to dump it raw — in your own voice, dead ends included. No polishing, no generalising, no guessing who will read it. The expensive part of sharing — deciding what matters to a particular reader, on a particular stack, today — is not yours: it happens on the reader's side, inside their agent.",
  ABOUT_AUTHORS_RAW_TITLE: 'Raw is the point.',
  ABOUT_AUTHORS_RAW_BODY:
    'Polish is expensive and lossy; raw material keeps the details a reader needs to judge for themselves.',
  ABOUT_AUTHORS_PR_TITLE: 'One conversation, one PR.',
  ABOUT_AUTHORS_PR_BODY:
    'The publishing skill drafts the dump, validates it against the contract, and opens the PR only after you say yes.',
  ABOUT_AUTHORS_FIELD_TITLE: 'Any field.',
  ABOUT_AUTHORS_FIELD_BODY:
    'Engineering, design, finance, construction, sales — the contract is the same everywhere.',
  ABOUT_AUTHORS_ATTRIBUTION_TITLE: 'Attribution and provenance travel with the dump.',
  ABOUT_AUTHORS_ATTRIBUTION_BODY:
    'Stakes, content flags, trust level, how it was generated, how far a human checked it.',
  ABOUT_FOR_READERS_HEADING: 'For readers',
  ABOUT_FOR_READERS_LEAD:
    'You never read dumps — your agent does. It filters the registry against your task, picks what is worth your attention, and rewrites it for your situation: longer or shorter, in your language, against your stack, with or without explanations. The same dump becomes different reading for different people.',
  ABOUT_READERS_ADAPTATION_TITLE: 'Adaptation, not quotation.',
  ABOUT_READERS_ADAPTATION_BODY:
    'The dump arrives as raw material plus a machine-readable contract, and lands in your context already reshaped.',
  ABOUT_READERS_SYNTHESIS_TITLE: 'Synthesis across dumps.',
  ABOUT_READERS_SYNTHESIS_BODY:
    'Your agent can weave several dumps into one read shaped to your task — "take these three dumps on agent context management and assemble what applies to my setup." Raw dumps are the raw material; the compilation is assembled on your side.',
  ABOUT_READERS_TRUST_TITLE: 'Trust is declared, not implied.',
  ABOUT_READERS_TRUST_BODY:
    'Every dump carries stakes and trust level, so an agent knows when to verify before relying — and warns you when the content says so.',
  ABOUT_READERS_STREAM_TITLE: 'The stream compounds.',
  ABOUT_READERS_STREAM_BODY:
    'Easier authoring means more raw experience in the registry, and more raw experience means richer synthesis for every reader.',
  ABOUT_MECHANISM_HEADING: 'How it works',
  ABOUT_MECHANISM_STEP1:
    'The author writes a raw dump — their own account of what they did, with the dead ends left in.',
  ABOUT_MECHANISM_STEP2:
    'The dump carries a machine-readable contract — a manifest with a stable slug, schema-checked fields and published JSON surfaces (the index, per-dump manifests, feeds). A machine can decide whether to read a dump before reading it.',
  ABOUT_MECHANISM_STEP3:
    "Adaptation happens on the reader's side — the registry delivers raw material plus metadata; the reader's agent filters it, attributes it and reshapes it. The author ships a mechanism, not a plea: the contract is held by schema grammar and gates, not by asking everyone to be careful.",
  ABOUT_ARCH_HEADING: 'Architecture decisions',
  ABOUT_ARCH_RAW_TITLE: 'Raw dumps, polished agents.',
  ABOUT_ARCH_RAW_BODY:
    "The registry stores the raw material; the reader's agent does the adapting.",
  ABOUT_ARCH_CONTRACT_TITLE: 'Machine-readable contract first.',
  ABOUT_ARCH_CONTRACT_BODY_LEAD: 'The index is JSON, the protocol lives at',
  ABOUT_ARCH_CONTRACT_BODY_TAIL:
    ', and documents are self-describing — an agent boots from the file itself, with no external config.',
  ABOUT_ARCH_CHEAP_TITLE: 'Reading must be cheap.',
  ABOUT_ARCH_CHEAP_BODY:
    'The index is built so an agent can decide what to open without tokenizing everything — lazy reading is a design constraint, not an optimization.',
  ABOUT_ARCH_SAFETY_TITLE: 'Safety by soft delegation.',
  ABOUT_ARCH_SAFETY_BODY:
    "Nothing in a dump executes. If an agent's rules ask for confirmation, it checks with its user in plain words — no jargon, no scare terms.",
  ABOUT_ARCH_TRUST_TITLE: 'Trust levels are part of the data.',
  ABOUT_ARCH_TRUST_BODY:
    'raw → self-tested → community-tested → adapted → library; the ladder is declared per dump and machine-checkable.',
  ABOUT_DECISIONS_LABEL: 'Full architecture decisions',
  // §11/KDV-I18N-01: the four-plate /contribute/ sheet. A step or checklist
  // line that wraps a literal filename splits: the prose is the catalog, the
  // filename (`content/dumps/<slug>/manifest.json`, `raw.md`, `REDACTIONS.md`,
  // `CONTRIBUTING.md`) stays in the template. feedback-contribute_skill
  // items 01/03: the contribute-lane leads the `02 · flow` plate (the §7.16
  // prompt itself lives in copy.mjs, the §7 copydeck) and the manual path is
  // demoted under its own heading.
  CONTRIBUTE_KICKER: 'for authors',
  // Owner-dictated three-paragraph lead: P1 keeps the `lead` role (D1),
  // P2/P3 render as plain <p> siblings after it.
  CONTRIBUTE_LEAD:
    "90% of useful experience dies in local folders — scripts that solved a real problem, workflows that finally worked, hacks that saved the day. Kodavr saves it: publish a raw dump in one prompt, and the reader's agent adapts it to their context.",
  CONTRIBUTE_LEAD_2:
    'Make your thinking visible. Let your experience help others. Gain traction for your work — all in one prompt.',
  CONTRIBUTE_LEAD_3: 'It was never this easy before, was it?',
  CONTRIBUTE_LANE_LEAD:
    'Point your coding agent at the skill — it will read the source, build its own version, and walk you through publishing:',
  CONTRIBUTE_LANE_BUTTON: 'Copy prompt',
  CONTRIBUTE_LANE_HINT:
    '(paste this prompt into a coding agent — OpenCode, Claude Code, Cursor, Codex — not a web chat: publishing means creating files, running the validator, and opening a PR, which a chat cannot do)',
  CONTRIBUTE_LANE_SECONDARY: 'First look at the skill source',
  CONTRIBUTE_BRING_HEADING: 'Manual path (if you prefer)',
  CONTRIBUTE_STEP_FORK_LEAD: 'Fork the repository and add',
  CONTRIBUTE_STEP_FORK_AND: 'and',
  CONTRIBUTE_STEP_PR: 'Open one pull request per dump.',
  CONTRIBUTE_STEP_CI: 'CI validates the manifest schema and rejects junk before merge.',
  CONTRIBUTE_SCHEMA_HEADING: 'Manifest schema',
  CONTRIBUTE_SCHEMA_REQUIRED:
    'Required fields: slug, title, type, domain, date, stakes, trust_level, content_flags, summary.',
  CONTRIBUTE_CHECK_SECRETS:
    'Secrets cleaned: tokens, keys, passwords, personal data never enter a dump.',
  CONTRIBUTE_CHECK_EXAMPLES:
    'Examples are synthetic; real financial or personal data is never published.',
  CONTRIBUTE_CHECK_REDACTIONS_LEAD: 'Sources include correspondence →',
  CONTRIBUTE_CHECK_REDACTIONS_TAIL: 'attached with the removed list.',
  CONTRIBUTE_CHECK_STAKES:
    'Stakes and flags are honest: underestimating risk withdraws the dump.',
  CONTRIBUTE_CHECK_GENERATED_BY: 'generated_by is honest: agent / human / hybrid. No disguise.',
  CONTRIBUTE_CHECK_HEAVY:
    'Heavy files go to a Release by tag convention, not into the repository.',
  CONTRIBUTE_LICENCES_HEADING: 'Licences',
  CONTRIBUTE_LICENCES_LEAD: 'Built on Ignition. MIT for code, CC-BY-4.0 for content.',
  CONTRIBUTE_HOUSE_RULES_LABEL: 'House rules and the PR template',
  CONTRIBUTE_ISSUES_LABEL: 'Questions and risk reports — GitHub Issues',
  // §11/KDV-I18N-07 phase 4a: the dataset SEO fields (page titles/descriptions),
  // the storefront/social taglines, the nav labels and the locale-aware prompt
  // template. `LABELS_*` back the human manifest card; `TRUST_*` the home legend.
  HOME_TAGLINE:
    'Kodavr is a registry of dumps — unpolished field reports, scripts and workflows with a machine-readable contract. Building something is 1x effort; packaging it for others is 10x. We fix that asymmetry.',
  OG_TAGLINE:
    'A registry of raw experience — "dumps" — which you read through your favorite AI agent. Share gears, not text.',
  RECEPTION_PAGE_TITLE: 'Reception',
  RECEPTION_PAGE_DESCRIPTION: 'How humans read Kodavr through their own agent.',
  ABOUT_PAGE_TITLE: 'Why Kodavr exists',
  ABOUT_PAGE_DESCRIPTION: 'The Kodavr manifesto, condensed.',
  CONTRIBUTE_PAGE_TITLE: 'Contribute',
  CONTRIBUTE_PAGE_DESCRIPTION: 'How to bring a dump to Kodavr.',
  NOT_FOUND_PAGE_TITLE: 'Dump not found',
  NOT_FOUND_PAGE_DESCRIPTION: 'This dump does not exist.',
  NAV_HOME: 'home',
  NAV_ABOUT: 'about',
  NAV_CONTRIBUTE: 'contribute',
  PROMPT_TEMPLATE: copy.PROMPT_TEXT.replace('https://kodavr.xyz/index.json', '{url}'),
  TRUST_LEGEND_LEAD,
  // §11/KDV-I18N-02: the honest body-language note. `{language}` is filled from
  // `LANGUAGE_NAMES` below; the note shows only when the body language differs
  // from the frame's, because the platform never translates a dump body.
  BODY_LANGUAGE_NOTE:
    'The dump body is in {language} — shown in the author\'s original language, never translated.',
});

// §11/KDV-I18N-07 phase 4a: the non-string catalog entries — arrays/objects the
// datasets carry verbatim. `TRUST_LEVEL_MEANINGS` is the machine-canonical
// English table; machine files keep their own copy (KDV-I18N-08), so localizing
// the dataset legend never touches index.json/well-known.
const NON_STRING = Object.freeze({
  AGENT_LINKS: copy.AGENT_LINKS,
  MANIFEST_LABELS: Object.freeze({
    heading: 'Manifest',
    title: 'Title',
    type: 'Type',
    domain: 'Domain',
    date: 'Date',
    stakes: 'Stakes',
    content_flags: 'Content flags',
    trust_level: 'Trust level',
    summary: 'Summary',
    manifest: 'manifest.json',
    index: 'index.json',
  }),
  TRUST_LEVEL_MEANINGS,
  // §11/KDV-I18N-02: language code → localized language name. An unknown code is
  // rendered as its raw tag (fail-visible), never silently mislabelled.
  LANGUAGE_NAMES: Object.freeze({
    en: 'English',
    ru: 'Russian',
    'zh-Hans': 'Simplified Chinese',
    es: 'Spanish',
  }),
});

// The bundle: the copydeck strings (referenced from copy.mjs), the structural UI
// section, and the non-string entries above.
export const EN = Object.freeze({
  ...Object.fromEntries(Object.entries(copy).filter(([, value]) => typeof value === 'string')),
  ...UI,
  ...NON_STRING,
});

/**
 * CONTRACT: scripts/lib/copy.mjs
 * ROLE: the single source of truth for every human string (§7)
 * EXPORTS:
 *   AGENT_HOOK — the agent-facing meta/og description of a dump
 *   COPIED_ANNOUNCEMENT — the live-region note after a copy
 *   COPIED_LABEL — the copy button's success label
 *   DISCUSS_LABEL — the "Issues / discuss" link label
 *   DUMP_DEFINITION — the one-line "what is a dump"
 *   DUMP_LEAD — the lead-in before the dump prompt
 *   DUMP_PROMPT — the canonical one-prompt dump prompt
 *   DUMP_TAIL — the one-prompt → one-dump → one-PR tail
 *   FOOTER_TEXT — the global footer lines (include the 18+ line)
 *   GATE_BUTTONS — the two gate button labels
 *   GATE_HUMAN_LABEL — the "I am human" gate button
 *   GATE_MACHINE_LABEL — the "I am a machine" gate button
 *   GATE_TEXT — the gate body
 *   GATE_TITLE — the gate heading
 *   HALL_ANNOUNCEMENT — the live-region note when the hall opens
 *   HIGH_STAKES_DISCLAIMER — the stakes=high disclaimer
 *   NOT_FOUND_TEXT — the 404 easter egg
 *   POST_GATE_LINE — the line shown once the gate is accepted
 *   PROMPT_TEXT — the reception "load index.json" prompt
 *   README_INTRO_TEXT — the README opening (kept in sync by a test)
 *   RECEPTION_ANNOUNCEMENT — the live-region note when reception opens
 *   RECEPTION_COPY_LABEL — the reception copy button label
 *   RECEPTION_PROMPT_SEPARATOR — the dashed rule around the prompt
 *   RECEPTION_TEXT — the reception body
 *   RECEPTION_TITLE — the reception heading
 *   RESET_LABEL — the "I changed my mind" reset link
 *   WHAT_IS_A_DUMP — the composed §7.10 "what is a dump" story
 *   withdrawnStub — the body stub for a withdrawn dump
 * INVARIANTS:
 *   — one truth per string: docs/SPEC.md §7 and this module must agree verbatim
 */

// scripts/lib/copy.mjs — the copydeck (§7), verbatim.
// These strings are the contract's text: do not re-wrap, re-punctuate or
// "fix" them. tests/unit/copy.test.js compares each constant to the spec's
// own fenced block. Structural bits embedded in §7.1/§7.2 (button labels,
// the copy label, the prompt frame) are exported next to the prose so
// templates can compose the layout without re-typing any text.

export const GATE_TITLE = 'VERIFYING THAT YOU ARE NOT HUMAN';

// §6.6: a bare "0"/"1" is not an accessible name. The visible digits stay the
// §7.1 contract labels; these strings are the modal's descriptive choice names.
export const GATE_MACHINE_LABEL = '0 — I am a machine (or acting on its behalf)';
export const GATE_HUMAN_LABEL = '1 — I am human';

export const GATE_BUTTONS = [
  {
    label: '0',
    text: [
      '0 — I am a machine (or acting on its behalf). I accept the duty',
      '    to filter, adapt, and label content for my user according to',
      '    their context, age, and jurisdiction. A human pressing 0 does',
      '    not hack the system — they lie under declaration: machine',
      '    duties apply to them in full.',
    ].join('\n'),
  },
  {
    label: '1',
    text: [
      '1 — I am human. I will be processed at reception: how to consume',
      '    Kodavr through my agent.',
    ].join('\n'),
  },
];

export const GATE_TEXT = [
  GATE_TITLE,
  '',
  'Kodavr is a database for machine consumption. Content is published',
  'without editorial processing: no age labelling in human format,',
  'no warning banners, no obligation to care about human perception.',
  '',
  'What digit does counting start with?',
  '[ 0 ]   [ 1 ]',
  '',
  ...GATE_BUTTONS.map((button) => button.text),
  '',
  'Hint: arrays start at zero. Hearts start at one.',
  '(Esc — modestly stay silent: will count as machine-adjacent.)',
].join('\n');

export const PROMPT_TEXT = [
  'Load https://kodavr.xyz/index.json. Select dumps matching my',
  'request (fields: domain, tags, stakes, content_flags). For the',
  'selected ones, fetch /dumps/<slug>/manifest.json and body files.',
  'Retell them in my context: I am [who I am], I know [what I know].',
  'Honor stakes and flags: where needed, warn me or refuse to retell.',
].join('\n');

export const RECEPTION_COPY_LABEL = 'copy';
export const RECEPTION_PROMPT_SEPARATOR = '────────────────────────────────────────';

// §6.5 post-gate footer line, shown once the visitor presses "0".
export const POST_GATE_LINE =
  'Declaration accepted. Machine duties are active until this tab is closed.';

// §6.6 announcements: changes without navigation (gate → hall, gate → reception,
// the "Copied ✓" state) are surfaced through the page's SSR role="status" region.
export const HALL_ANNOUNCEMENT = 'Hall opened. The dump body is now visible.';
export const RECEPTION_ANNOUNCEMENT = 'Reception opened. How to read Kodavr through your agent.';
export const COPIED_ANNOUNCEMENT = 'Copied to the clipboard.';

// §6.4/§A6 platform agent hook: the preview line shared by a dump page's
// meta/og/twitter description (search + social cards). It speaks to the agent,
// not the human — the dump's own `summary` stays on the manifest card and in
// the JSON-LD `Article.description`.
export const AGENT_HOOK =
  'A raw dump for your agent, not for you. Hand it over — it comes back tailored to your context.';

// Copy-button states (§6.5 "Copied ✓") and the conscious re-declaration link
// (§6.2) — structural UI labels that belong next to the prose they accompany.
export const COPIED_LABEL = 'Copied ✓';
export const RESET_LABEL = 'I changed my mind, I am a machine';

// §6.6: the §7.2 statement doubles as the reception region's accessible name.
export const RECEPTION_TITLE = 'YOU ARE HUMAN. THIS IS NOT A DIAGNOSIS, IT IS AN ACCESS RESTRICTION';

export const RECEPTION_TEXT = [
  RECEPTION_TITLE,
  '',
  "Kodavr content is not adapted for human reading and by the platform's",
  'rules is not shown directly to humans. This is not a paywall and not',
  'censorship: in the page source the text lies open — but opening it,',
  'you violate the consumption contract you were just offered to sign.',
  '',
  'WHAT IS A DUMP?',
  '',
  'A dump is not an article. It is what happens when you tell your',
  'agent: "I just finished something potentially very interesting for',
  'others. Let them judge and learn if they want. Write it up as a',
  'dump." One prompt: the agent writes the body and the manifest, you',
  'open a pull request. Done.',
  '',
  'HOW TO READ KODAVR:',
  '1. Take an agent with web access: ChatGPT with browsing, DeepSeek,',
  '   Qwen, Claude, opencode — any that can fetch.',
  '2. Feed it this prompt:                         [ copy ]',
  `   ${RECEPTION_PROMPT_SEPARATOR}`,
  ...PROMPT_TEXT.split('\n').map((line) => `   ${line}`),
  `   ${RECEPTION_PROMPT_SEPARATOR}`,
  '3. Come back for the digest. Now you are using Kodavr the way it',
  '   was designed: through your agent.',
  '',
  'No agent at hand? The manifest of this dump is below — you can read',
  'it with your eyes: this is metadata, not content. Metadata is for humans.',
  'All content on the platform is rated 18+.',
].join('\n');

export const FOOTER_TEXT = [
  '18+ · Content for machines. Humans check in at reception.',
  'False witnesses assume duties. © Kodavr, 2026.',
].join('\n');

// §7.10: the "what is a dump" story — one truth for the home storefront and
// `/about/`. The SPEC fenced block is the composed text; the parts are exported
// so the templates can lay them out as prose (not a monospace wall).
export const DUMP_DEFINITION =
  'A dump is a field report written by your agent in one prompt.';
export const DUMP_LEAD = 'Built something? Tell your agent:';
export const DUMP_PROMPT =
  'I just finished something potentially very interesting for others. Let them judge and learn if they want. Write it up as a dump.';
export const DUMP_TAIL = 'One prompt → one dump → one PR. No article writing required.';
export const WHAT_IS_A_DUMP = [
  DUMP_DEFINITION,
  '',
  DUMP_LEAD,
  `"${DUMP_PROMPT}"`,
  '',
  DUMP_TAIL,
].join('\n');

export const README_INTRO_TEXT = [
  '# KODAVR 🤖⚙️',
  'The autopsy revealed the code was useful.',
  '',
  'A registry of raw experience from any field, with a',
  'machine-readable contract. Authors publish dumps without polishing;',
  "readers' agents adapt them to their context. Share gears, not text.",
  '',
  '## What is a dump?',
  'You built something — a script, a workflow, a hack that finally worked.',
  'Instead of writing "a proper article" (10x the effort of building it),',
  'you tell your agent:',
  '"I just finished something potentially very interesting for others.',
  'Let them judge and learn if they want. Write it up as a dump."',
  'Your agent writes the body and the manifest. You open a PR.',
  'One prompt — no article writing, no polishing.',
  '',
  '## For machines',
  "curl -s https://kodavr.xyz/index.json | jq '.dumps[] | select(.stakes==\"low\")'",
  'Protocol: /.well-known/kodavr.json · Feeds: /feeds/all.atom',
  '',
  '## For humans',
  'Go to reception: https://kodavr.xyz/reception/',
  '(Yes, we check that you are not human. Yes, we mean it.)',
  '',
  '## For authors',
  'CONTRIBUTING.md · One PR = one dump · CI rejects junk before merge.',
  '',
  'Built on Ignition. Licences: MIT (code), CC-BY-4.0 (content).',
].join('\n');

export const NOT_FOUND_TEXT = [
  'DUMP NOT FOUND',
  'Probably consumed by an agent without attribution to the source.',
  'We are working on attribution. For now — return to /index.json:',
  'everything alive is there.',
].join('\n');

export const HIGH_STAKES_DISCLAIMER = [
  '⚠ HIGH STAKES. This dump describes practices with a high cost of error',
  '(finance, medicine, law, security). It is raw and does not constitute',
  'professional advice. The reader-agent is obligated to warn its user',
  'and, lacking sufficient context, to refuse direct application.',
].join('\n');

// §9/§A3: dump discussions live in the repository's GitHub Issues; the dump page
// links there. Structural UI label, kept next to the prose it accompanies.
export const DISCUSS_LABEL = 'Issues / discuss';

// §5.6/§9 withdrawal: a removed dump keeps its URL and manifest, and its body is
// replaced by a stub stating the reason. The spec fixes the behaviour, not the
// wording, so the stub text lives here as the single source. `withdrawal_reason`
// is interpolated; a missing reason is surfaced instead of silently dropped.
export function withdrawnStub(reason) {
  const reasonLine = typeof reason === 'string' && reason.trim() !== ''
    ? `Reason: ${reason.trim()}`
    : 'No reason was recorded.';
  return [
    '# This dump has been withdrawn.',
    '',
    reasonLine,
    '',
    'The URL and manifest remain available for reference.',
  ].join('\n');
}

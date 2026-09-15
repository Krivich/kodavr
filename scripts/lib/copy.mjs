/**
 * CONTRACT: scripts/lib/copy.mjs
 * ROLE: the single source of truth for every human string (§7)
 * EXPORTS:
 *   AGENT_HOOK — the agent-facing meta/og description of a dump
 *   AGENT_LANE_HINT — the §7.12 note that a button passes on the prompt below
 *   AGENT_LANE_LEAD — the §7.12 human fast-lane lead line
 *   AGENT_LANE_LEAD_KODAVR — the §7.12 lead on /reception/ (no single article there)
 *   AGENT_LINKS — the §7.12 four agent jump targets (prefill capability)
 *   agentLinks — the §7.12 jump links, prompt pre-filled where supported
 *   BRIEF_BLOCK — the §7.2 v2 brief section (heading → report line) as one composition
 *   BRIEF_CTA — the brief block's "full raw account" call to action
 *   BRIEF_FALLBACK — the honest line shown when the optional summary.md layer is absent
 *   BRIEF_HEADING — the §7.2 v2 "NO AGENT AT HAND?" heading
 *   BRIEF_NOTE — the note that the brief is not the dump (which stays machine-first)
 *   BRIEF_REPORT — the report/takedown line closing the brief block
 *   BRIEF_SLOT — the §7.2 fence placeholder where the rendered brief appears
 *   CHIP_HUMAN_LABEL — the §7.13 status chip label for a human declaration
 *   CHIP_MACHINE_TEMPLATE — the §7.13 chip label for a machine declaration (version placeholder)
 *   CHIP_TITLE_TEMPLATE — the §7.13 chip title (declaration-date placeholder)
 *   CHIP_WITHDRAW_LABEL — the §7.13 chip's withdraw link label
 *   chipMachine — the §7.13 machine chip text with the contract version filled in
 *   chipTitle — the §7.13 chip title with the declaration date filled in
 *   COPIED_ANNOUNCEMENT — the live-region note after a copy
 *   COPIED_LABEL — the copy button's success label
 *   DECLARATION_TOAST — the toast shown once the declaration is accepted
 *   DISCUSS_LABEL — the "Issues / discuss" link label
 *   DUMP_DEFINITION — the one-line "what is a dump"
 *   DUMP_LEAD — the lead-in before the dump prompt
 *   DUMP_PROMPT — the canonical one-prompt dump prompt
 *   DUMP_TAIL — the one-prompt → one-dump → one-PR tail
 *   dumpPrompt — the §7.11 dump-pinned prompt (dump URL + index URL)
 *   FOOTER_REPORT_LABEL — the §7.3 report/takedown link label
 *   FOOTER_TEXT — the global footer lines (include the 18+ line)
 *   GATE_BUTTONS — the two §7.1 declaration clauses (0/1) reused below the fold
 *   GATE_CHOICES_BLOCK — the §7.1 [0]/[1] choice lines
 *   GATE_DUTIES — the four machine-duty tokens on one line
 *   GATE_DUTIES_BLOCK — the §7.1 duties line (lead + tokens)
 *   GATE_DUTIES_LEAD — the §7.1 machine-duties lead-in
 *   GATE_HOOK — the §7.1 hook paragraph (what this is / am I allowed)
 *   GATE_HUMAN_LABEL — the "I am human" gate button
 *   GATE_HUMAN_LINE — the §7.1 human choice line
 *   GATE_KICKER — the §7.1 muted CAPTCHA kicker (easter egg)
 *   GATE_LANE_BLOCK — the §7.12 lane as the §7.1 fence spells it
 *   GATE_MACHINE_LABEL — the "I am a machine" gate button
 *   GATE_MACHINE_LINE — the §7.1 machine choice line
 *   GATE_PROMPT_SLOT — the §7.1 prompt placeholder (rendered per surface)
 *   GATE_REST — the §7.1 declaration that sits below the first screen
 *   GATE_TEXT — the composed gate body (§7.1)
 *   GATE_TITLE — the gate heading (the modal's accessible name)
 *   HALL_ANNOUNCEMENT — the live-region note when the hall opens
 *   HIGH_STAKES_DISCLAIMER — the stakes=high disclaimer
 *   NOT_FOUND_TEXT — the 404 easter egg
 *   POST_GATE_LINE — the line shown once the gate is accepted
 *   PROMPT_TEXT — the universal `/reception/` + README prompt
 *   README_INTRO_TEXT — the README opening (kept in sync by a test)
 *   LANE_COPY_LABEL — the agent lane's copy control label
 *   RECEPTION_ANNOUNCEMENT — the live-region note when reception opens
 *   RECEPTION_RATING — the §7.2 18+ line closing the reception block
 *   RECEPTION_TEXT — the reception body composition (wall + brief + rating)
 *   RECEPTION_TITLE — the reception heading
 *   RECEPTION_WALL — the §7.2 monospace wall (statement → three-step instruction)
 *   RESET_HUMAN_LABEL — the "I changed my mind, I am human" machine-panel reset link
 *   RESET_LABEL — the "I changed my mind" reset link
 *   WHAT_IS_A_DUMP — the composed §7.10 "what is a dump" story
 *   withdrawnStub — the body stub for a withdrawn dump
 * CONSUMES:
 *   ./machine.mjs — the four machine-duty tokens (one source)
 * INVARIANTS:
 *   — one truth per string: docs/SPEC.md §7 and this module must agree verbatim
 */
import { AGENT_DUTIES } from './machine.mjs';

// scripts/lib/copy.mjs — the copydeck (§7), verbatim.
// These strings are the contract's text: do not re-wrap, re-punctuate or
// "fix" them. tests/unit/copy.test.js compares each constant to the spec's
// own fenced block. Structural bits embedded in §7.1/§7.2 (button labels,
// the copy label, the prompt frame) are exported next to the prose so
// templates can compose the layout without re-typing any text.

// §6.6: a bare "0"/"1" is not an accessible name. The visible digits stay the
// §7.1 contract labels; these strings are the modal's descriptive choice names.
export const GATE_MACHINE_LABEL = '0 — I am a machine (or acting on its behalf)';
export const GATE_HUMAN_LABEL = '1 — I am human';

// §7.1 v2: the visible heading is the declaration itself; the CAPTCHA phrase is
// demoted to a muted kicker, and the hook answers "what is this / am I allowed".
export const GATE_TITLE = 'DECLARATION BEFORE ENTRY';
export const GATE_KICKER = 'verifying that you are not human';
export const GATE_HOOK = [
  'Kodavr is a registry of raw experience: field reports written by',
  'agents, for agents. Humans enter through their agent — or under',
  'declaration. No wrong door: both stay open, switch any time.',
].join('\n');

// §7.1: the two long declaration clauses shown below the fold (0/1). One
// source for the long form, reused verbatim by GATE_REST.
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

// §7.1: the two choice lines as the sketch spells them out. The visible
// controls stay the bare 0/1 digits with the accessible names above.
export const GATE_MACHINE_LINE = '[0] I enter as a machine (or on its behalf).';
export const GATE_HUMAN_LINE = [
  '[1] I am human. Route me to reception — I will read through my',
  '    agent, or read the brief.',
].join('\n');
export const GATE_CHOICES_BLOCK = [GATE_MACHINE_LINE, GATE_HUMAN_LINE].join('\n');

// §7.1: the duties line. The four tokens have one source (machine.mjs); they
// sit on a single line here and in the discovery document.
export const GATE_DUTIES_LEAD = 'Machine duties I sign for this session:';
export const GATE_DUTIES = AGENT_DUTIES.join(' · ');
export const GATE_DUTIES_BLOCK = [GATE_DUTIES_LEAD, GATE_DUTIES].join('\n');

// §7.1: the long machine-duty declaration below the fold: the intro clause, the
// two 0/1 clauses (one source above), the source-reading note, the hint and the
// Esc line.
export const GATE_REST = [
  'Kodavr is a database for machine consumption. Content is published',
  'without editorial processing: no age labelling in human format,',
  'no warning banners, no obligation to care about human perception.',
  ...GATE_BUTTONS[0].text.split('\n'),
  ...GATE_BUTTONS[1].text.split('\n'),
  'Reading the source is not hacking; it is reading the contract',
  'before signing. The declaration is stored only in this browser,',
  'versioned with the contract, and withdrawable at any time.',
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

export const LANE_COPY_LABEL = 'Or copy & paste it yourself';

// §6.5 post-gate footer line, shown once the visitor presses "0".
export const POST_GATE_LINE =
  'Declaration accepted. Machine duties are active until this tab is closed.';

// §7.1: the declaration toast names the duties the signatory accepted. The four
// tokens have one source (machine.mjs); the text is rendered once per dump page
// (dumps.hbs `data-toast-text`) and shown by the controller's showDeclarationToast().
export const DECLARATION_TOAST = 'Declaration accepted. Duties active: ' + AGENT_DUTIES.join(' · ') + '.';

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

// §7.12: the human fast lane. The agent jump links come first (one press opens a
// prefilled chat); the copy control is the last, fallback chip ("not listed?
// take the prompt yourself"). The lead nods at the prompt shown below the lane.
export const AGENT_LANE_LEAD = 'Prompt your agent to open this article for you:';

// §7.12: on /reception/ there is no single article — the prompt is the universal
// index one — so the lead names Kodavr instead.
export const AGENT_LANE_LEAD_KODAVR = 'Prompt your agent to read Kodavr for you:';

// §7.12: what the buttons do, spelled out under the lane.
export const AGENT_LANE_HINT =
  '(the four buttons open a prefilled chat; the last one copies the prompt below for you to paste into your agent)';

export const AGENT_LINKS = [
  { id: 'perplexity', label: 'Perplexity', href: 'https://www.perplexity.ai/search', prefill: 'q' },
  { id: 'grok', label: 'Grok', href: 'https://grok.com/', prefill: 'q' },
  { id: 'chatgpt', label: 'ChatGPT', href: 'https://chatgpt.com/', prefill: 'q' },
  { id: 'claude', label: 'Claude', href: 'https://claude.ai/new', prefill: 'q' },
];

export function agentLinks(prompt) {
  return AGENT_LINKS.map((agent) => ({
    id: agent.id,
    label: agent.label,
    href: agent.prefill
      ? `${agent.href}?${agent.prefill}=${encodeURIComponent(prompt)}`
      : agent.href,
  }));
}

// §7.1 v2: the lane as the fence spells it — lead, the four jump targets and
// the copy chip, then the hint. Built from the one §7.12 source; the real
// controls render through site/agent-lane.hbs.
export const GATE_LANE_BLOCK = [
  AGENT_LANE_LEAD,
  `[${AGENT_LINKS.map((agent) => agent.label).join('] [')}] [${LANE_COPY_LABEL}]`,
  AGENT_LANE_HINT,
].join('\n');

// §7.1: the prompt is a placeholder in the fence; the real prompt renders once
// per surface (§7.12).
export const GATE_PROMPT_SLOT = '<prompt — monospace, muted, rendered once per surface>';

// §7.1 v2: the eight blocks, blank-line separated. tests/unit/copy.test.js
// compares this composition to the SPEC §7.1 fence byte-for-byte.
export const GATE_TEXT = [
  GATE_KICKER,
  GATE_TITLE,
  GATE_HOOK,
  GATE_LANE_BLOCK,
  GATE_PROMPT_SLOT,
  GATE_DUTIES_BLOCK,
  GATE_CHOICES_BLOCK,
  GATE_REST,
].join('\n\n');

// §7.11: a dump page pins the prompt to the shared dump; `/reception/` uses the
// universal PROMPT_TEXT instead. Keep the placeholder tokens EXACTLY as in SPEC
// §7.11 so the verdict test can substitute them.
export function dumpPrompt(dumpUrl, indexUrl) {
  return [
    `Read the dump at ${dumpUrl}. It is raw experience a human shared`,
    'with me. Retell it in my context: I am [who I am], I know',
    '[what I know]. Honor its stakes and content_flags: where needed,',
    `warn me or refuse to retell. If it fits, also check ${indexUrl}`,
    'for other dumps worth my attention.',
  ].join('\n');
}

// Copy-button states (§6.5 "Copied ✓") and the conscious re-declaration link
// (§6.2) — structural UI labels that belong next to the prose they accompany.
export const COPIED_LABEL = 'Copied ✓';
export const RESET_LABEL = 'I changed my mind, I am a machine';
// §6.2: the machine panel's conscious re-declaration link — symmetric with
// RESET_LABEL, back from machine to human.
export const RESET_HUMAN_LABEL = 'I changed my mind, I am human';

// §7.13: the header species status chip mirrors the stored declaration (§6.2).
// Placeholders are substituted from the declaration record — `<version>` from the
// shipped contract version, `<declared-at>` from the record's declaration date —
// so the templates only ever carry the source strings, never a filled-in copy.
export const CHIP_MACHINE_TEMPLATE = 'species: machine (declared · contract v<version>)';
export const CHIP_HUMAN_LABEL = 'species: human (reception)';
export const CHIP_TITLE_TEMPLATE = 'declared <declared-at>, withdrawable any time';
export const CHIP_WITHDRAW_LABEL = 'withdraw';

export function chipMachine(version) {
  return CHIP_MACHINE_TEMPLATE.replace('<version>', version == null ? '' : String(version));
}

export function chipTitle(declaredAt) {
  return CHIP_TITLE_TEMPLATE.replace('<declared-at>', declaredAt == null ? '' : String(declaredAt));
}

// §6.6: the §7.2 statement doubles as the reception region's accessible name.
export const RECEPTION_TITLE = 'YOU ARE HUMAN. THIS IS NOT A DIAGNOSIS, IT IS AN ACCESS RESTRICTION';

// §6.3/§7.2 v2: the third tier of reception — the author's agent brief for a
// human stranger ("NO AGENT AT HAND?"). The optional `summary.md` layer is
// rendered where the fence carries BRIEF_SLOT; without the layer the reception
// block shows BRIEF_FALLBACK instead of an empty slot, so the block never
// promises a brief that is not there. BRIEF_BLOCK is the verbatim tail of the
// §7.2 fence (like GATE_PROMPT_SLOT, the slot is a fence placeholder, not a
// rendered constant).
export const BRIEF_HEADING = 'NO AGENT AT HAND?';
export const BRIEF_NOTE = [
  "Read the brief: a short adaptation the author's agent wrote for",
  'a human stranger. It is not the dump — the dump stays raw and',
  'machine-first. This is what your agent would have told you.',
].join('\n');
export const BRIEF_SLOT = '<brief — the dump summary.md, rendered here>';
export const BRIEF_CTA = [
  'Want the full raw account? Press 0 under declaration, or send',
  'your agent with the prompt above.',
].join('\n');
export const BRIEF_REPORT = [
  'Something illegal or personal in a dump? Report it — removal is',
  'a withdrawn status with a reason, not silence.',
].join('\n');
export const BRIEF_FALLBACK = 'brief not attached for this dump — manifest below';
export const BRIEF_BLOCK = [
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_SLOT,
  BRIEF_CTA,
  BRIEF_REPORT,
].join('\n');

// §7.2 v1 wall: the heading-statement, the why-not-a-paywall paragraph, the
// "what is a dump" story and the three-step instruction. This is what the
// monospace `.reception-text` `<pre>` holds; the brief tier is NOT part of it,
// so no line of it is typed on the screen twice.
export const RECEPTION_WALL = [
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
  '2. Feed it the prompt below.',
  '3. Come back for the digest. Now you are using Kodavr the way it',
  '   was designed: through your agent.',
].join('\n');

// §7.2: the blanket 18+ line closes the block once, as its own element after
// the brief tier — never buried in the wall.
export const RECEPTION_RATING = 'All content on the platform is rated 18+.';

// §7.2 v2: the composition the fence spells out — the wall, the brief tier and
// the rating, blank-line separated. tests/unit/copy.test.js compares this to
// the spec's own fenced block byte-for-byte.
export const RECEPTION_TEXT = [RECEPTION_WALL, BRIEF_BLOCK, RECEPTION_RATING].join('\n\n');

export const FOOTER_TEXT = [
  '18+ · Content for machines. Humans check in at reception.',
  'False witnesses assume duties. © Kodavr, 2026.',
].join('\n');

// §7.3/§9: the report/takedown link label. The pages controller pairs it with the
// repository's new-Issue URL (risk template preselected) so the §7.3 fence's third
// line — `<label>: <issues-url>` — renders on every page.
export const FOOTER_REPORT_LABEL = 'Report illegal content or personal data';

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

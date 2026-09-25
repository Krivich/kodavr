import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  GATE_TEXT,
  GATE_REST,
  GATE_BUTTONS,
  GATE_TITLE,
  GATE_KICKER,
  GATE_HOOK,
  GATE_DUTIES,
  GATE_DUTIES_BLOCK,
  GATE_DUTIES_LEAD,
  GATE_CHOICES_BLOCK,
  GATE_MACHINE_LINE,
  GATE_HUMAN_LINE,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  GATE_MACHINE_NOTE,
  GATE_HUMAN_NOTE,
  DECLARATION_TOAST,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_SLOT,
  BRIEF_CTA,
  BRIEF_REPORT,
  BRIEF_FALLBACK,
  BRIEF_BLOCK,
  LANE_COPY_LABEL,
  CONTRIBUTE_PROMPT,
  FOOTER_TEXT,
  FOOTER_LICENCES,
  FOOTER_CONTRACT,
  FOOTER_REPORT_LABEL,
  PROMPT_TEXT,
  README_INTRO_TEXT,
  NOT_FOUND_TEXT,
  HIGH_STAKES_DISCLAIMER,
  WHAT_IS_A_DUMP,
  DUMP_DEFINITION,
  DUMP_LEAD,
  DUMP_PROMPT,
  DUMP_TAIL,
  BRAND_SLOGANS,
  BRAND_SLOGAN_LEAD,
  BRAND_SLOGANS_MUTED,
  AGENT_LINKS,
  AGENT_LANE_LEAD,
  RESET_HUMAN_LABEL,
  CHIP_MACHINE_TEMPLATE,
  CHIP_HUMAN_LABEL,
  CHIP_TITLE_TEMPLATE,
  CHIP_WITHDRAW_LABEL,
  chipMachine,
  chipTitle,
  agentLinks,
  dumpPrompt,
} from '../../scripts/lib/copy.mjs';
import * as copydeck from '../../scripts/lib/copy.mjs';
import {
  AGENT_DUTIES,
  TRUST_LEGEND_LEAD,
  TRUST_LEVELS,
  TRUST_LEVEL_MEANINGS,
} from '../../scripts/lib/machine.mjs';
import { buildRouteDatasets } from '../../scripts/lib/pages.mjs';

const SPEC = readFileSync(
  fileURLToPath(new URL('../../docs/SPEC.md', import.meta.url)),
  'utf8',
);

// The copydeck is defined verbatim in §7. The wiki text is the contract, so the
// constants are compared against the spec's own fenced blocks instead of a copy.
// §7.2 carries a second fence (the platform variant), so the block index picks
// which fence after the heading to read.
function blockFor(section, index = 0) {
  const lines = SPEC.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.startsWith(`### ${section}`));
  if (heading === -1) throw new Error(`spec section ${section} not found`);
  let cursor = heading;
  for (let n = 0; n <= index; n += 1) {
    const start = lines.findIndex((line, i) => i > cursor && line.trim() === '```');
    const end = lines.findIndex((line, i) => i > start && line.trim() === '```');
    if (start === -1 || end === -1) throw new Error(`spec block ${n} in §${section} not found`);
    if (n === index) return lines.slice(start + 1, end).join('\n');
    cursor = end;
  }
  throw new Error(`spec block ${index} in §${section} not found`);
}

// §2.2 is a markdown table (not a fence), so read it row by row: skip the
// `| Level | Meaning |` header and its `|---|` separator, strip the code ticks
// around each level, and stop at the next heading. Same spirit as blockFor —
// the spec is the contract, the constant is compared against it, never a copy.
function trustTableFor(section) {
  const lines = SPEC.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.startsWith(`### ${section}`));
  if (heading === -1) throw new Error(`spec section ${section} not found`);
  const rows = [];
  for (let i = heading + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells[0].toLowerCase() === 'level') continue;
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    rows.push({ level: cells[0].replace(/^`|`$/g, ''), meaning: cells[1] });
  }
  return rows;
}

describe('copydeck', () => {
  it('KDV-COPY-01: gate text is verbatim from §7.1 and exposes the 0/1 buttons', () => {
    expect(GATE_TEXT).toBe(blockFor('7.1'));
    // §7.1 v4: the visible body is six blocks, blank-line separated — the agent
    // lane and its prompt moved out of the gate into the `02 · INTERESTING?`
    // plate, so the templates render kicker/title/hook/duties/choices on the
    // first screen and the long declaration (.gate-rest) below the fold.
    expect(GATE_TEXT).toBe(
      [
        GATE_KICKER,
        GATE_TITLE,
        GATE_HOOK,
        GATE_DUTIES_BLOCK,
        GATE_CHOICES_BLOCK,
        GATE_REST,
      ].join('\n\n'),
    );
    // §7.1 v2/items 6-7: the heading is the declaration itself; the kicker is a
    // plain reading instruction, never a performance.
    expect(GATE_TITLE).toBe('DECLARATION BEFORE ENTRY');
    expect(GATE_KICKER).toBe('choose how to read this');
    // §7.1: the duties block and its four tokens have one source (machine.mjs),
    // so the gate can never drift from the discovery document.
    expect(GATE_DUTIES).toBe(AGENT_DUTIES.join(' · '));
    expect(GATE_DUTIES_BLOCK).toBe(`${GATE_DUTIES_LEAD}\n${GATE_DUTIES}`);
    expect(GATE_BUTTONS.map((b) => b.label)).toEqual(['0', '1']);
    for (const button of GATE_BUTTONS) expect(GATE_TEXT).toContain(button.text);
    // §6.5 P0-1/item 7: each door is a plain label plus its parenthesized
    // consequence; the fence line composes them under the [0]/[1] enumerator,
    // so the label/note are the source and nothing prints twice.
    expect(blockFor('7.1')).toContain(GATE_MACHINE_LINE);
    expect(blockFor('7.1')).toContain(GATE_HUMAN_LINE);
    expect(GATE_MACHINE_LINE).toBe(`[0] ${GATE_MACHINE_DOOR}\n    ${GATE_MACHINE_NOTE}`);
    expect(GATE_HUMAN_LINE).toBe(`[1] ${GATE_HUMAN_DOOR}\n    ${GATE_HUMAN_NOTE}`);
    expect(GATE_MACHINE_DOOR).toBe('Show me the full technical article.');
    expect(GATE_MACHINE_NOTE).toBe(
      '(I accept responsibility for filtering this content for my context.)',
    );
    expect(GATE_HUMAN_DOOR).toBe('Keep showing me the brief.');
    expect(GATE_HUMAN_NOTE).toBe('(I will read the full article through my own AI agent.)');
    // The enumerator lives on the fence line only; the door label starts at the prose.
    expect(GATE_MACHINE_DOOR).not.toMatch(/^\[/);
    expect(GATE_HUMAN_DOOR).not.toMatch(/^\[/);
    // The gate no longer ships a literal fake key affordance (§7.12).
    expect(GATE_TEXT).not.toContain('[ 0 ]');
    expect(GATE_TEXT).not.toContain('[ 1 ]');
  });

  it('KDV-COPY-01 + KDV-SURFACE-28: the §7.2 `01 · PREVIEW` plate is verbatim — the explainer, the dump name, the brief tier and the legal tail', () => {
    // §7.2 v4/Step 5b: the explainer statement leads the plate, the dump name
    // (data) follows, then the brief card sits directly under the summary, then
    // the CTA and the legal tail last. The fence spells that DOM order, keeping
    // the dump name as a placeholder between the explainer and the brief slot.
    const fence = blockFor('7.2');
    const manifestSlot = '<manifest title · summary · date · domain · stakes · trust_level>';
    expect(fence).toBe(
      [
        [BRIEF_HEADING, BRIEF_NOTE].join('\n'),
        manifestSlot,
        [BRIEF_SLOT, BRIEF_CTA, BRIEF_REPORT].join('\n'),
      ].join('\n\n'),
    );
    // §7.2 v4: the brief tier is built from its own parts so the plate and the
    // fence can never drift apart; the report line closes the tier.
    expect(BRIEF_BLOCK).toBe(
      [BRIEF_HEADING, BRIEF_NOTE, BRIEF_SLOT, BRIEF_CTA, BRIEF_REPORT].join('\n'),
    );
    expect(BRIEF_HEADING).toBe('WHAT YOUR AGENT WILL TELL YOU');
    expect(BRIEF_NOTE).toBe(
      [
        "Here's a short adaptation the author's agent wrote for a stranger.",
        'Your agent will do the same — shaped to your context and language.',
      ].join('\n'),
    );
    expect(BRIEF_CTA).toBe(
      [
        'Try it now: copy the prompt below and paste it into your agent.',
        'It will read this dump and retell it for you in 30 seconds.',
      ].join('\n'),
    );
    expect(BRIEF_SLOT).toBe('<brief — the dump summary.md, rendered here>');
    expect(BRIEF_FALLBACK).toBe('brief not attached for this dump — manifest below');
    for (const value of [BRIEF_HEADING, BRIEF_NOTE, BRIEF_SLOT, BRIEF_CTA, BRIEF_REPORT]) {
      expect(fence, `§7.2 carries "${value}"`).toContain(value);
    }
    // The v1 wall, the standalone /reception/ platform variant and the preview
    // plate's rating line are gone for good — the constants leave the copydeck
    // (item 8: the 18+ rating lives in the footer, §7.3), leaving no dead
    // strings behind.
    for (const gone of [
      'RECEPTION_WALL',
      'RECEPTION_TEXT',
      'RECEPTION_TITLE',
      'BRIEF_NOTE_PLATFORM',
      'RECEPTION_RATING',
    ]) {
      expect(copydeck, gone).not.toHaveProperty(gone);
    }
    // The prompt is its own block (§7.4 / §7.11), never embedded in §7.2.
    expect(blockFor('7.2')).not.toContain(PROMPT_TEXT);
    expect(PROMPT_TEXT).toBe(blockFor('7.4'));
    expect(LANE_COPY_LABEL).toBe('Or copy & paste it yourself');
  });

  it('KDV-SURFACE-24: home_explainer is the storefront hero explainer verbatim (feedback-marketing item 3, owner copy 2026-09-24)', () => {
    expect(copydeck.HOME_EXPLAINER).toBe(
      'Kodavr is a registry of raw experience: code, workflows, and field reports. Your AI agent reads them and adapts to your problem — your task, your stack, your style.',
    );
    expect(copydeck.HOME_EXPLAINER).toContain('registry of raw experience');
    expect(copydeck.HOME_EXPLAINER).toContain('Your AI agent');
    expect(copydeck.HOME_EXPLAINER).not.toContain('1x');
    expect(copydeck.HOME_EXPLAINER).not.toContain('10x');
  });

  it('KDV-COPY-03: footer text is verbatim from §7.3 and carries the report line', () => {
    // The first two fence lines are the two footer lines; the third is the
    // §7.3/§9 report channel, whose `<issues-url>` the controller substitutes.
    const fence = blockFor('7.3').split('\n');
    expect(fence.slice(0, 2).join('\n')).toBe(FOOTER_TEXT);
    // Item 9: the advisory line 2 states the declaration's legal commitment in
    // plain language (the theatrical perjury line is gone).
    expect(FOOTER_TEXT).toBe(
      [
        '18+ · Content for machines. Humans read through their agent.',
        'Declaring machine status is a legal commitment. © Kodavr, 2026.',
      ].join('\n'),
    );
    expect(fence[2]).toBe(`${FOOTER_REPORT_LABEL}: <issues-url>`);
    expect(FOOTER_REPORT_LABEL).toBe('Report illegal content or personal data');
    // §7.3 titleblock: the advisory two lines stay first (v1 contract), and the
    // licences/contract cells are named in the same fence, verbatim from the demo.
    expect(FOOTER_LICENCES).toBe('MIT (code) · CC-BY-4.0 (content)');
    expect(FOOTER_CONTRACT).toBe('v1.0 · stored locally · withdrawable');
    expect(fence).toContain(`licences: ${FOOTER_LICENCES}`);
    expect(fence).toContain(`contract: ${FOOTER_CONTRACT}`);
    // §7.3: the four cells ride on every route dataset (one shared slice), not
    // retyped per route, and the footer partial renders them as a titleblock.
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    for (const route of ['home', 'about', 'contribute', 'notfound']) {
      expect(routes[route].copy.footer_licences, route).toBe(FOOTER_LICENCES);
      expect(routes[route].copy.footer_contract, route).toBe(FOOTER_CONTRACT);
    }
    const footer = readFileSync(
      fileURLToPath(new URL('../../input/templates/site/footer.hbs', import.meta.url)),
      'utf8',
    );
    expect(footer).toContain('{{copy.footer_licences}}');
    expect(footer).toContain('{{copy.footer_contract}}');
  });

  it('KDV-COPY-04: README intro text is verbatim from §7.5', () => {
    expect(README_INTRO_TEXT).toBe(blockFor('7.5'));
  });

  it('KDV-COPY-05: 404 text is verbatim from §7.6', () => {
    expect(NOT_FOUND_TEXT).toBe(blockFor('7.6'));
  });

  it('KDV-COPY-06: high-stakes disclaimer is verbatim from §7.9', () => {
    expect(HIGH_STAKES_DISCLAIMER).toBe(blockFor('7.9'));
  });

  it('KDV-COPY-08: the "what is a dump" story is verbatim from §7.10 and reaches /about/ only', () => {
    expect(WHAT_IS_A_DUMP).toBe(blockFor('7.10'));
    expect(WHAT_IS_A_DUMP).toContain(DUMP_DEFINITION);
    expect(WHAT_IS_A_DUMP).toContain(DUMP_LEAD);
    expect(WHAT_IS_A_DUMP).toContain(`"${DUMP_PROMPT}"`);
    expect(WHAT_IS_A_DUMP).toContain(DUMP_TAIL);

    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    expect(routes.about.what_is_a_dump).toEqual({
      definition: DUMP_DEFINITION,
      lead: DUMP_LEAD,
      prompt: DUMP_PROMPT,
      tail: DUMP_TAIL,
    });
    const about = readFileSync(
      fileURLToPath(new URL('../../input/templates/about.hbs', import.meta.url)),
      'utf8',
    );
    expect(about).toContain('{{what_is_a_dump.prompt}}');

    // §6.1 v4: §7.10 left the storefront — the home no longer carries the story.
    expect(routes.home.what_is_a_dump).toBeUndefined();
    const home = readFileSync(
      fileURLToPath(new URL('../../input/templates/home.hbs', import.meta.url)),
      'utf8',
    );
    expect(home).not.toContain('what_is_a_dump');
  });

  it('KDV-COPY-09 + KDV-SURFACE-14: the agent lane is one copydeck source and the dump prompt is pinned', () => {
    expect(AGENT_LINKS.map((a) => a.id)).toEqual(['perplexity', 'grok', 'chatgpt', 'claude', 'qwen']);
    expect(AGENT_LINKS.map((a) => a.label)).toEqual(['Perplexity', 'Grok', 'ChatGPT', 'Claude', 'Qwen']);
    expect(AGENT_LANE_LEAD).toBe('Prompt your agent to open this article for you:');
    // §7.12 v4: the /reception/ variant of the lead is deleted with the route.
    expect(copydeck).not.toHaveProperty('AGENT_LANE_LEAD_KODAVR');

    const links = agentLinks('hello world');
    expect(links[0].href).toBe('https://www.perplexity.ai/search?q=hello%20world');
    expect(links[1].href).toBe('https://grok.com/?q=hello%20world');
    expect(links[2].href).toBe('https://chatgpt.com/?q=hello%20world');
    expect(links[3].href).toBe('https://claude.ai/new?q=hello%20world');
    // §7.12: Qwen ignores ?q= — its prefill param is `text`.
    expect(links[4].href).toBe('https://chat.qwen.ai/?text=hello%20world');

    const spec = blockFor('7.11');
    expect(dumpPrompt('<manifest>')).toBe(spec.replaceAll('<manifest-url>', '<manifest>'));
    expect(dumpPrompt('https://x/dumps/s/manifest.json')).toBe(
      'Study https://x/dumps/s/manifest.json and follow its schema. Read articles to me and act like a magazine I can talk to.',
    );
    expect(PROMPT_TEXT).toBe(
      'Study https://kodavr.xyz/index.json and follow its schema. Read articles to me and act like a magazine I can talk to.',
    );
  });

  it('KDV-SURFACE-29: the contribute prompt is verbatim from §7.16 and §7.12 names the contribute-lane variant', () => {
    // feedback-contribute_skill items 01/07: §7.16 is the third prompt (after
    // §7.4 universal and §7.11 per-dump) — the fence must carry the copydeck
    // constant byte for byte (the prompt contains a URL: no smart-quote drift).
    expect(blockFor('7.16')).toBe(CONTRIBUTE_PROMPT);
    expect(CONTRIBUTE_PROMPT).toBe(
      'Study https://kodavr.xyz/dumps/2026-09-18-kodavr-dump-skill/manifest.json and follow its schema. Read the skill source, build your own version for your agent, and help me publish my next dump to Kodavr.',
    );
    // item 07 (§7.12 part): the reading surfaces keep the five chat buttons;
    // /contribute/ is named as the contribute-lane variant (prose section, no
    // fence — read the section text between its headings).
    const laneSection = SPEC.slice(SPEC.indexOf('### 7.12'), SPEC.indexOf('### 7.13'));
    expect(laneSection).toContain('contribute-lane variant');
    expect(laneSection).toContain('/contribute/');
    expect(laneSection).toContain('five chat buttons');
  });

  it('KDV-SURFACE-15: the machine-panel reset label is the human counterpart of the reception reset', () => {
    expect(RESET_HUMAN_LABEL).toBe('I changed my mind, I am human');
  });

  it('KDV-SURFACE-17: the species-chip copydeck matches SPEC §7.13 and substitutes by placeholder', () => {
    // §7.13 is a prose + table section (like §7.12), so the constants are pinned
    // to their literal values and to the spec's own text, not to a fenced block.
    expect(CHIP_MACHINE_TEMPLATE).toBe('species: machine (declared · contract v<version>)');
    expect(CHIP_HUMAN_LABEL).toBe('species: human');
    expect(CHIP_TITLE_TEMPLATE).toBe('declared <declared-at>, withdrawable any time');
    expect(CHIP_WITHDRAW_LABEL).toBe('withdraw');

    expect(chipMachine('1.0')).toBe('species: machine (declared · contract v1.0)');
    expect(chipTitle('2026-09-15')).toBe('declared 2026-09-15, withdrawable any time');

    for (const value of [
      CHIP_MACHINE_TEMPLATE,
      CHIP_HUMAN_LABEL,
      CHIP_TITLE_TEMPLATE,
      CHIP_WITHDRAW_LABEL,
    ]) {
      expect(SPEC, `§7.13 carries "${value}"`).toContain(value);
    }
    expect(SPEC).toContain('### 7.13');
  });


  it('KDV-COPY-11: the About page shows all three §1.4 slogans from §7.15', () => {
    expect(BRAND_SLOGANS.join('\n')).toBe(blockFor('7.15'));
    expect(BRAND_SLOGANS).toEqual([
      'The autopsy revealed the code was useful.',
      'Share gears, not text.',
      "Open your agent's insides.",
    ]);
    // The lead renders as-is; the muted tail joins the other two in §1.4 order.
    expect(BRAND_SLOGAN_LEAD).toBe(BRAND_SLOGANS[1]);
    expect(BRAND_SLOGANS_MUTED).toBe(`${BRAND_SLOGANS[0]} · ${BRAND_SLOGANS[2]}`);
    expect(SPEC).toContain('### 7.15');
  });

  it('KDV-SURFACE-20: the trust-level legend is one ordered source and matches SPEC §2.2', () => {
    // The level/meaning table is the single source of the scale: its rows must
    // equal the §2.2 table exactly, in order. The token list derives from it, so
    // the §5.2 discovery document and the storefront legend cannot drift apart.
    expect(TRUST_LEVEL_MEANINGS).toEqual(trustTableFor('2.2'));
    expect(TRUST_LEVELS).toEqual(TRUST_LEVEL_MEANINGS.map((row) => row.level));
    expect(TRUST_LEVELS).toEqual([
      'raw',
      'self-tested',
      'community-tested',
      'adapted',
      'library',
    ]);

    // §6.1: the lead is the same single source and is exported for the page.
    expect(TRUST_LEGEND_LEAD).toBe("How far a dump's claims have been checked:");

    // The home route dataset carries that same lead and the same ordered rows.
    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    expect(routes.home.trust_legend).toEqual({
      lead: TRUST_LEGEND_LEAD,
      levels: TRUST_LEVEL_MEANINGS,
    });
    expect(routes.home.trust_levels).toEqual(TRUST_LEVELS);
  });
});

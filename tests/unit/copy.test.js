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
  GATE_LANE_BLOCK,
  GATE_PROMPT_SLOT,
  GATE_DUTIES,
  GATE_DUTIES_BLOCK,
  GATE_DUTIES_LEAD,
  GATE_CHOICES_BLOCK,
  GATE_MACHINE_LINE,
  GATE_HUMAN_LINE,
  GATE_MACHINE_DOOR,
  GATE_HUMAN_DOOR,
  DECLARATION_TOAST,
  RECEPTION_RATING,
  RECEPTION_TEXT,
  RECEPTION_TITLE,
  RECEPTION_WALL,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_SLOT,
  BRIEF_CTA,
  BRIEF_REPORT,
  BRIEF_FALLBACK,
  BRIEF_NOTE_PLATFORM,
  BRIEF_BLOCK,
  LANE_COPY_LABEL,
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
  HOME_HUMAN_LINE,
  BRAND_SLOGANS,
  BRAND_SLOGAN_LEAD,
  BRAND_SLOGANS_MUTED,
  AGENT_LINKS,
  AGENT_LANE_LEAD,
  AGENT_LANE_LEAD_KODAVR,
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
    // §7.1 v2: the visible body is the eight blocks, blank-line separated — the
    // templates render kicker/title/hook/lane/prompt/duties/choices on the first
    // screen and the long declaration (.gate-rest) below the fold.
    expect(GATE_TEXT).toBe(
      [
        GATE_KICKER,
        GATE_TITLE,
        GATE_HOOK,
        GATE_LANE_BLOCK,
        GATE_PROMPT_SLOT,
        GATE_DUTIES_BLOCK,
        GATE_CHOICES_BLOCK,
        GATE_REST,
      ].join('\n\n'),
    );
    // §7.1 v2: the heading is the declaration itself; the standard CAPTCHA
    // phrase is demoted to the muted kicker above it.
    expect(GATE_TITLE).toBe('DECLARATION BEFORE ENTRY');
    expect(GATE_KICKER).toBe('verifying that you are not human');
    // §7.1: the duties block and its four tokens have one source (machine.mjs),
    // so the gate can never drift from the discovery document.
    expect(GATE_DUTIES).toBe(AGENT_DUTIES.join(' · '));
    expect(GATE_DUTIES_BLOCK).toBe(`${GATE_DUTIES_LEAD}\n${GATE_DUTIES}`);
    expect(GATE_BUTTONS.map((b) => b.label)).toEqual(['0', '1']);
    for (const button of GATE_BUTTONS) expect(GATE_TEXT).toContain(button.text);
    // §6.5 P0-1: the two doors render the §7.1 choice lines as their visible
    // labels, with the [0]/[1] enumerator split off into a separate badge. Pin
    // the derivation and the literals to the fence line so they cannot drift.
    expect(blockFor('7.1')).toContain(GATE_MACHINE_LINE);
    expect(blockFor('7.1')).toContain(GATE_HUMAN_LINE);
    expect(GATE_MACHINE_DOOR).toBe(GATE_MACHINE_LINE.replace(/^\[\d\]\s*/, ''));
    expect(GATE_HUMAN_DOOR).toBe(GATE_HUMAN_LINE.replace(/^\[\d\]\s*/, ''));
    expect(GATE_MACHINE_DOOR).toBe('I enter as a machine (or on its behalf).');
    expect(GATE_HUMAN_DOOR).toBe(
      'I am human. Route me to reception — I will read through my\n    agent, or read the brief.',
    );
    // The marker lives on the fence line only; the door label starts at the prose.
    expect(GATE_MACHINE_DOOR).not.toMatch(/^\[/);
    expect(GATE_HUMAN_DOOR).not.toMatch(/^\[/);
    // The gate no longer ships a literal fake key affordance (§7.12).
    expect(GATE_TEXT).not.toContain('[ 0 ]');
    expect(GATE_TEXT).not.toContain('[ 1 ]');
  });

  it('KDV-COPY-02 + KDV-SURFACE-16: reception text is verbatim from §7.2, composes the brief tier and renders the prompt once per surface', () => {
    expect(RECEPTION_TEXT).toBe(blockFor('7.2'));
    // §7.2 v2: one composition, three separately-rendered parts — the wall, the
    // brief tier and the 18+ rating — so each reaches the screen exactly once.
    expect(RECEPTION_TEXT).toBe([RECEPTION_WALL, BRIEF_BLOCK, RECEPTION_RATING].join('\n\n'));
    expect(RECEPTION_RATING).toBe('All content on the platform is rated 18+.');
    // The wall is the v1 text: it never carries the brief tier or the rating,
    // which the block renders as their own elements (no duplication).
    expect(RECEPTION_WALL.startsWith(RECEPTION_TITLE)).toBe(true);
    for (const value of [BRIEF_BLOCK, BRIEF_HEADING, BRIEF_NOTE, BRIEF_CTA, RECEPTION_RATING]) {
      expect(RECEPTION_WALL, `wall must not carry "${value}"`).not.toContain(value);
    }
    // §7.2 v2: the brief tier is the tail of the composition, built from its
    // own parts so the block and the fence can never drift apart.
    expect(BRIEF_BLOCK).toBe(
      [BRIEF_HEADING, BRIEF_NOTE, BRIEF_SLOT, BRIEF_CTA, BRIEF_REPORT].join('\n'),
    );
    expect(RECEPTION_TEXT).toContain(BRIEF_BLOCK);
    expect(RECEPTION_TEXT.endsWith(`\n\n${BRIEF_BLOCK}\n\n${RECEPTION_RATING}`)).toBe(true);
    expect(RECEPTION_TITLE).toBe(
      'YOU ARE HUMAN. THIS IS NOT A DIAGNOSIS, IT IS AN ACCESS RESTRICTION',
    );
    // §7.2 v2 brief constants, pinned to their literal value and the spec text.
    expect(BRIEF_HEADING).toBe('NO AGENT AT HAND?');
    expect(BRIEF_SLOT).toBe('<brief — the dump summary.md, rendered here>');
    expect(BRIEF_FALLBACK).toBe('brief not attached for this dump — manifest below');
    // §7.2 v2: the second fence is the /reception/ platform variant. It is the
    // honest middle when the page has no dump; the dump-page fallback and this
    // note are mutually exclusive per surface.
    expect(BRIEF_NOTE_PLATFORM).toBe(blockFor('7.2', 1));
    expect(BRIEF_NOTE_PLATFORM).toBe(
      [
        'Every dump page carries its own brief: a short adaptation the',
        "author's agent wrote for a human stranger. Open any dump and",
        'check in as human (1) to read it. Manifests are metadata —',
        'metadata is for humans, on every page.',
      ].join('\n'),
    );
    expect(BRIEF_NOTE_PLATFORM).not.toBe(BRIEF_FALLBACK);
    expect(BRIEF_BLOCK).not.toContain(BRIEF_NOTE_PLATFORM);
    for (const value of [BRIEF_HEADING, BRIEF_NOTE, BRIEF_SLOT, BRIEF_CTA, BRIEF_REPORT]) {
      expect(RECEPTION_TEXT, `§7.2 carries "${value}"`).toContain(value);
    }
    // The old stand-alone manifest sentence folded into the brief tier.
    expect(RECEPTION_TEXT).not.toContain('No agent at hand? The manifest of this dump is below');
    // The prompt is its own block (§7.4 / §7.11), never embedded in §7.2.
    expect(RECEPTION_TEXT).not.toContain(PROMPT_TEXT);
    expect(PROMPT_TEXT).toBe(blockFor('7.4'));
    expect(LANE_COPY_LABEL).toBe('Or copy & paste it yourself');
  });

  it('KDV-COPY-03: footer text is verbatim from §7.3 and carries the report line', () => {
    // The first two fence lines are the two footer lines; the third is the
    // §7.3/§9 report channel, whose `<issues-url>` the controller substitutes.
    const fence = blockFor('7.3').split('\n');
    expect(fence.slice(0, 2).join('\n')).toBe(FOOTER_TEXT);
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
    for (const route of ['home', 'reception', 'about', 'contribute', 'notfound']) {
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

  it('KDV-COPY-08: the "what is a dump" story is verbatim from §7.10 and reaches home + /about/', () => {
    expect(WHAT_IS_A_DUMP).toBe(blockFor('7.10'));
    expect(WHAT_IS_A_DUMP).toContain(DUMP_DEFINITION);
    expect(WHAT_IS_A_DUMP).toContain(DUMP_LEAD);
    expect(WHAT_IS_A_DUMP).toContain(`"${DUMP_PROMPT}"`);
    expect(WHAT_IS_A_DUMP).toContain(DUMP_TAIL);

    const routes = buildRouteDatasets([], { baseUrl: 'https://example.test' });
    for (const route of ['home', 'about']) {
      expect(routes[route].what_is_a_dump).toEqual({
        definition: DUMP_DEFINITION,
        lead: DUMP_LEAD,
        prompt: DUMP_PROMPT,
        tail: DUMP_TAIL,
      });
      const template = readFileSync(
        fileURLToPath(new URL(`../../input/templates/${route}.hbs`, import.meta.url)),
        'utf8',
      );
      expect(template).toContain('{{what_is_a_dump.prompt}}');
    }
  });

  it('KDV-COPY-09 + KDV-SURFACE-14: the agent lane is one copydeck source and the dump prompt is pinned', () => {
    expect(AGENT_LINKS.map((a) => a.id)).toEqual(['perplexity', 'grok', 'chatgpt', 'claude']);
    expect(AGENT_LINKS.map((a) => a.label)).toEqual(['Perplexity', 'Grok', 'ChatGPT', 'Claude']);
    expect(AGENT_LANE_LEAD).toBe('Prompt your agent to open this article for you:');
    expect(AGENT_LANE_LEAD_KODAVR).toBe('Prompt your agent to read Kodavr for you:');

    const links = agentLinks('hello world');
    expect(links[0].href).toBe('https://www.perplexity.ai/search?q=hello%20world');
    expect(links[1].href).toBe('https://grok.com/?q=hello%20world');
    expect(links[2].href).toBe('https://chatgpt.com/?q=hello%20world');
    expect(links[3].href).toBe('https://claude.ai/new?q=hello%20world');

    const spec = blockFor('7.11');
    expect(dumpPrompt('<manifest>')).toBe(spec.replaceAll('<manifest-url>', '<manifest>'));
    expect(dumpPrompt('https://x/dumps/s/manifest.json')).toBe(
      'Download https://x/dumps/s/manifest.json and follow its schema.',
    );
    expect(PROMPT_TEXT).toBe('Download https://kodavr.xyz/index.json and follow its schema.');
  });

  it('KDV-SURFACE-15: the machine-panel reset label is the human counterpart of the reception reset', () => {
    expect(RESET_HUMAN_LABEL).toBe('I changed my mind, I am human');
  });

  it('KDV-SURFACE-17: the species-chip copydeck matches SPEC §7.13 and substitutes by placeholder', () => {
    // §7.13 is a prose + table section (like §7.12), so the constants are pinned
    // to their literal values and to the spec's own text, not to a fenced block.
    expect(CHIP_MACHINE_TEMPLATE).toBe('species: machine (declared · contract v<version>)');
    expect(CHIP_HUMAN_LABEL).toBe('species: human (reception)');
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

  it('KDV-COPY-10: the home human quickstart line is verbatim from §7.14', () => {
    expect(HOME_HUMAN_LINE).toBe(blockFor('7.14'));
    expect(HOME_HUMAN_LINE).toBe(
      [
        'Reception explains the contract, hands you the prompt for your',
        'agent — and, if you have none, a pre-made brief per dump.',
      ].join('\n'),
    );
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

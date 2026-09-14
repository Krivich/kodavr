import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  GATE_TEXT,
  GATE_BUTTONS,
  RECEPTION_TEXT,
  RECEPTION_COPY_LABEL,
  FOOTER_TEXT,
  PROMPT_TEXT,
  README_INTRO_TEXT,
  NOT_FOUND_TEXT,
  HIGH_STAKES_DISCLAIMER,
  WHAT_IS_A_DUMP,
  DUMP_DEFINITION,
  DUMP_LEAD,
  DUMP_PROMPT,
  DUMP_TAIL,
} from '../../scripts/lib/copy.mjs';
import { buildRouteDatasets } from '../../scripts/lib/pages.mjs';

const SPEC = readFileSync(
  fileURLToPath(new URL('../../docs/SPEC.md', import.meta.url)),
  'utf8',
);

// The copydeck is defined verbatim in §7. The wiki text is the contract, so the
// constants are compared against the spec's own fenced blocks instead of a copy.
function blockFor(section) {
  const lines = SPEC.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.startsWith(`### ${section}`));
  if (heading === -1) throw new Error(`spec section ${section} not found`);
  const start = lines.findIndex((line, i) => i > heading && line.trim() === '```');
  const end = lines.findIndex((line, i) => i > start && line.trim() === '```');
  return lines.slice(start + 1, end).join('\n');
}

describe('copydeck', () => {
  it('KDV-COPY-01: gate text is verbatim from §7.1 and exposes the 0/1 buttons', () => {
    expect(GATE_TEXT).toBe(blockFor('7.1'));
    expect(GATE_BUTTONS.map((b) => b.label)).toEqual(['0', '1']);
    for (const button of GATE_BUTTONS) expect(GATE_TEXT).toContain(button.text);
  });

  it('KDV-COPY-02: reception text is verbatim from §7.2 and carries the §7.4 prompt', () => {
    expect(RECEPTION_TEXT).toBe(blockFor('7.2'));

    const lines = blockFor('7.2').split('\n');
    const separators = lines
      .map((line, i) => (line.includes('────') ? i : -1))
      .filter((i) => i !== -1);
    expect(separators).toHaveLength(2);
    const prompt = lines
      .slice(separators[0] + 1, separators[1])
      .map((line) => line.replace(/^ {3}/, ''))
      .join('\n');

    expect(PROMPT_TEXT).toBe(prompt);
    expect(RECEPTION_COPY_LABEL).toBe('copy');
  });

  it('KDV-COPY-03: footer text is verbatim from §7.3', () => {
    expect(FOOTER_TEXT).toBe(blockFor('7.3'));
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
});

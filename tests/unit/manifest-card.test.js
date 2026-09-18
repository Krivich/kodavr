// tests/unit/manifest-card.test.js — the PR manifest card (KDV-CI-14).
// The dump's manifest.json is the single truth; this card renders it into a
// sticky PR comment so a reviewer sees the fields without opening files.
import { describe, it, expect } from 'vitest';
import { renderManifestCard, dumpSlugsFromFiles } from '../../scripts/lib/manifest-card.mjs';

const MANIFEST = {
  slug: '2026-01-01-x',
  title: 'A title',
  type: 'case',
  domain: 'engineering',
  stakes: 'low',
  content_flags: ['contains_code'],
  trust_level: 'self-tested',
  generated_by: 'hybrid',
  human_review: 'attested',
  license: 'CC-BY-4.0',
  sources: ['chat-log', 'source-code'],
};

describe('KDV-CI-14: the PR manifest card', () => {
  it('renders the manifest fields as a sticky markdown table', () => {
    const card = renderManifestCard(MANIFEST, '2026-01-01-x');
    expect(card).toContain('<!-- dump-manifest -->');
    expect(card).toContain('`2026-01-01-x`');
    expect(card).toContain('| Type | case |');
    expect(card).toContain('| Content flags | contains_code |');
    expect(card).toContain('| Sources | chat-log, source-code |');
    expect(card).toContain('manifest.json');
    expect(card).not.toContain('undefined');
  });

  it('omits absent and empty fields, and escapes table pipes', () => {
    const card = renderManifestCard({ type: 'note', tags: [], title: 'a | b' }, 's');
    expect(card).toContain('| Type | note |');
    expect(card).toContain('| Title | a \\| b |');
    expect(card).not.toContain('Domain');
    expect(card).not.toContain('Tags');
  });

  it('finds every dump slug touched by a changed-file list', () => {
    expect(
      dumpSlugsFromFiles([
        'content/dumps/b/raw.md',
        'content/dumps/a/manifest.json',
        'README.md',
        'content/dumps/b/summary.md',
        'scripts/lib/manifest-card.mjs',
      ]),
    ).toEqual(['a', 'b']);
  });

  it('KDV-CI-15: leads with the summary hook and folds the human brief', () => {
    const brief = '## What it is\n\nA thing.\n\n## Why you would want it\n\nBecause.';
    const card = renderManifestCard({ type: 'case', summary: 'A hook line.' }, 's', brief);
    expect(card).toContain('**What it is:** A hook line.');
    expect(card).toContain('<details><summary>Human brief (summary.md)</summary>');
    expect(card).toContain('Because.');
    expect(card).toContain('</details>');
    // A card without a brief (or hook) stays exactly as before — no empty section.
    const bare = renderManifestCard({ type: 'case' }, 's');
    expect(bare).not.toContain('<details>');
    expect(bare).not.toContain('What it is:');
  });
});

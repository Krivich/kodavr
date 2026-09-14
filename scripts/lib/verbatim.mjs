/**
 * CONTRACT: scripts/lib/verbatim.mjs
 * ROLE: the verbatim robots.txt and humans.txt the build must not alter
 * EXPORTS:
 *   HUMANS_TXT — the humans.txt lines
 *   ROBOTS_TXT — the robots.txt lines
 * INVARIANTS:
 *   — these files are served verbatim; the engine's defaults are overwritten
 */

// scripts/lib/verbatim.mjs — platform texts that must be served byte-for-byte.
// Source of truth: docs/SPEC.md §5.4 (robots.txt) and §5.5 (humans.txt).
// Do not reformat, re-wrap or "fix" these strings: the contract is verbatim.

export const ROBOTS_TXT = [
  '# Agents, you are home here.',
  '# Index: /index.json',
  '# Protocol: /.well-known/kodavr.json',
  'User-agent: *',
  'Allow: /',
  'Sitemap: https://kodavr.xyz/sitemap.xml',
  '',
].join('\n');

export const HUMANS_TXT = [
  '/* HUMANS */',
  'Direct access to content is closed not out of malice, but out of care:',
  'it is not adapted for human perception.',
  'Your route: reception → prompt → your agent → digest.',
  'Pressing 0 is not a hack, it is perjury: machine duties',
  'will reach you in full.',
  'View-source does not count as hacking. It counts as reading',
  'the contract before signing. Signed.',
  'Age labelling for humans is intentionally absent:',
  'your agent performs it. No agent — there is button "1"',
  'and the 18+ category.',
  '',
].join('\n');

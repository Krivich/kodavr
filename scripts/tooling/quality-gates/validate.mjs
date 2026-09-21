/**
 * CONTRACT: scripts/tooling/quality-gates/validate.mjs
 * ROLE: the KDV-CI content gate over content/dumps (§8.1)
 * EXPORTS:
 *   loadBlackZoneCategories — loads the black-zone heuristic config
 *   shannonEntropy — Shannon entropy, for the secret scan
 *   validateContent — validates every dump directory
 *   validateManifest — validates one manifest against §4.1
 * CONSUMES:
 *   ../../lib/machine.mjs — the shared vocabularies and constants
 *   node:fs/promises — walk and read the content
 *   node:path — join paths
 *   node:url — find the repo root
 * INVARIANTS:
 *   — a BLOCK finding exits non-zero; nothing is published on a red gate
 */

// scripts/tooling/quality-gates/validate.mjs — local content validator (KDV-CI-02..KDV-CI-07, §8.1).
//
// The same rules run in CI (.github/workflows/validate.yml, KDV-CI-01) and
// locally via `node scripts/tooling/quality-gates/validate.mjs`, so a contributor sees a BLOCK before
// a push. Returns { errors, warnings } — errors are BLOCK, warnings are WARN.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_FLAGS_VOCABULARY, CONSUMPTION_CONTRACT_SEE } from '../../lib/machine.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_BLACK_ZONE_CONFIG = join(REPO_ROOT, 'config', 'black-zone.json');

const REQUIRED_FIELDS = [
  'slug',
  'type',
  'title',
  'date',
  'domain',
  'tags',
  'stakes',
  'content_flags',
  'trust_level',
  'generated_by',
  'human_review',
  'summary',
];

const ENUMS = {
  type: ['note', 'case', 'pack'],
  domain: ['engineering', 'finance', 'art', 'law', 'science', 'education', 'other'],
  stakes: ['low', 'medium', 'high'],
  trust_level: ['raw', 'self-tested', 'community-tested', 'adapted', 'library'],
  generated_by: ['human', 'agent', 'hybrid'],
  human_review: ['none', 'minimal', 'attested'],
  verification: ['executable', 'checkable', 'subjective'],
  status: ['published', 'withdrawn'],
};

const SOURCES_VOCAB = ['chat-log', 'source-code', 'tests', 'traces'];
const ARTIFACT_KINDS = ['file', 'release', 'url'];
const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ASSET_RE = /^assets\/[^/]+\.(png|svg|puml)$/i;

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB
const MAX_DUMP_BYTES = 20 * 1024 * 1024; // 20 MB

const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.json', '.jsonc', '.yml', '.yaml', '.js', '.mjs',
  '.cjs', '.ts', '.tsx', '.jsx', '.sh', '.bash', '.ps1', '.py', '.rb', '.go',
  '.rs', '.java', '.c', '.h', '.cpp', '.css', '.html', '.htm', '.xml', '.toml',
  '.ini', '.cfg', '.conf', '.svg', '.puml', '.csv', '.env',
]);

// --- secret heuristics (KDV-CI-04) --------------------------------------

// Each pattern carries a cheap `hint` substring: the regex only runs when the
// hint is present. This keeps the scan linear on large uniform files (a naive
// unbounded pattern backtracks quadratically on a 1 MB line of `x`).
const SECRET_PATTERNS = [
  { name: 'PEM PRIVATE KEY block', hint: 'PRIVATE KEY', re: /-----BEGIN (?:[A-Z0-9 ]{1,40} )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', hint: '_', re: /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { name: 'OpenAI key', hint: 'sk-', re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Slack token', hint: 'xox', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', hint: 'AIza', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Stripe secret key', hint: '_live_', re: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'credentialed URL', hint: '://', re: /\b[a-z][a-z0-9+.-]{1,12}:\/\/[^/\s:@]{1,64}:[^/\s:@]{1,64}@/i },
];

const ENV_ASSIGN_RE = /^[ \t]*([A-Z][A-Z0-9_]{2,80})[ \t]*=[ \t]*(['"]?)([^\s'"]{1,200})\2[ \t]*$/gm;
const SECRET_KEY_RE = /(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|ACCESS_KEY|PRIVATE|CREDENTIAL)/;
const ENTROPY_TOKEN_RE = /[A-Za-z0-9+=_-]{32,}/g;
const ENTROPY_MIN_BITS = 3.5;

export function shannonEntropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

// Deterministic "random-looking token" heuristic: long, high Shannon entropy,
// and shaped like a secret rather than an identifier. A pure hex run (SHA/HMAC
// digests, ≈3.9 bits/char) or a mixed upper+lower+digit token (base64url, JWT)
// qualifies; lowercase kebab/snake identifiers (slugs, variable names) do not.
function highEntropyToken(token) {
  if (token.length < 32) return false;
  if (!/[0-9]/.test(token) || !/[A-Za-z]/.test(token)) return false;
  const isHex = /^[0-9a-fA-F]+$/.test(token);
  const mixedCase = /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token);
  if (!isHex && !mixedCase) return false;
  return shannonEntropy(token) >= ENTROPY_MIN_BITS;
}

function scanSecrets(content) {
  const hits = new Set();
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) hits.add(name);
  }
  for (const match of content.matchAll(ENV_ASSIGN_RE)) {
    if (SECRET_KEY_RE.test(match[1])) hits.add(`.env assignment ${match[1]}`);
  }
  for (const match of content.matchAll(ENTROPY_TOKEN_RE)) {
    if (highEntropyToken(match[0])) hits.add('long high-entropy string');
  }
  return [...hits];
}

// --- personal data heuristics (KDV-CI-05) -------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d(?:[\s.-]?\d){8,14}/g;
const DOC_RE = /\b\d{3}-\d{2}-\d{4}\b|\b\d{4}\s\d{6}\b|\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b/g;

function scanPersonalData(content) {
  const hits = new Set();
  for (const match of content.matchAll(EMAIL_RE)) hits.add(`email ${match[0]}`);
  for (const match of content.matchAll(PHONE_RE)) {
    const digits = (match[0].match(/\d/g) ?? []).length;
    if (digits < 10 || digits > 15) continue;
    if (DATE_RE.test(match[0].trim())) continue;
    hits.add(`phone number ${match[0]}`);
  }
  for (const match of content.matchAll(DOC_RE)) hits.add(`document number ${match[0]}`);
  return [...hits];
}

// --- black-zone heuristics (KDV-CI-08) ----------------------------------
//
// §2.5: black zones (CSAM, extremism, calls to violence, stolen data) are
// blocked unconditionally. The categories and their patterns are declarative
// (config/black-zone.json), not code. The scan is deliberately conservative:
// the real gate is owner manual review, so a hit is reported as a BLOCK that
// must be handed to a human, and a missing/broken config fails visible.

export async function loadBlackZoneCategories(configPath) {
  const raw = await readFile(configPath, 'utf8'); // ENOENT propagates
  const parsed = JSON.parse(raw); // SyntaxError propagates
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('black-zone config must be a JSON object');
  }
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
    throw new Error('black-zone config `categories` must be a non-empty array');
  }
  return parsed.categories.map((category, i) => {
    if (!category || typeof category !== 'object' || Array.isArray(category)) {
      throw new Error(`black-zone category ${i} must be an object`);
    }
    for (const field of ['id', 'label', 'description']) {
      if (typeof category[field] !== 'string' || category[field].trim() === '') {
        throw new Error(`black-zone category ${i} needs a non-empty \`${field}\``);
      }
    }
    if (!Array.isArray(category.patterns) || category.patterns.length === 0) {
      throw new Error(`black-zone category ${i} (\`${category.label}\`) needs a non-empty \`patterns\` array`);
    }
    const patterns = category.patterns.map((source, j) => {
      if (typeof source !== 'string' || source.trim() === '') {
        throw new Error(`black-zone category ${i} pattern ${j} must be a non-empty string`);
      }
      try {
        return new RegExp(source, 'i');
      } catch (err) {
        throw new Error(`black-zone category ${i} pattern ${j} is not a valid regex (${err.message})`);
      }
    });
    return { id: category.id, label: category.label, description: category.description, patterns };
  });
}

function scanBlackZones(content, categories) {
  const hits = [];
  for (const category of categories) {
    if (category.patterns.some((re) => re.test(content))) hits.push(category.label);
  }
  return hits;
}

function displayPath(root, target) {
  if (!root) return target;
  const rel = relative(root, target);
  return rel && !rel.startsWith('..') ? rel.split(sep).join('/') : target;
}

// --- markdown helpers (KDV-CI-06 links, KDV-CI-07 lint) -----------------

function fenceStates(markdown) {
  const states = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      states.push(true);
      inFence = !inFence;
    } else {
      states.push(inFence);
    }
  }
  return states;
}

function slugifyHeading(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function analyzeMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const fences = fenceStates(markdown);
  let h1Count = 0;
  const anchors = new Set();
  const inPageLinks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (fences[i]) continue;
    const heading = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (heading[1].length === 1) h1Count += 1;
      anchors.add(slugifyHeading(heading[2]));
    }
    for (const link of lines[i].matchAll(/\]\(#([^)\s]+)\)/g)) inPageLinks.push(link[1]);
  }
  return { h1Count, anchors, inPageLinks };
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

function stripFragment(target) {
  return target.split('#')[0].split('?')[0];
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listDumpFiles(dir, root = dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listDumpFiles(abs, root)));
    } else if (entry.isFile()) {
      const info = await stat(abs);
      files.push({ abs, rel: relative(root, abs).split(sep).join('/'), size: info.size });
    }
  }
  return files;
}

// --- manifest schema (KDV-CI-02) ----------------------------------------

// §4.1 summary is "1–3 sentences". Count sentence terminators that end a word
// group; abbreviations without following whitespace (AGENTS.md) do not split.
function summarySentenceCount(summary) {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function validateManifest(manifest, rel, errors) {
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    errors.push(`KDV-CI-02 ${rel}/manifest.json: manifest must be a JSON object`);
    return;
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in manifest)) {
      errors.push(`KDV-CI-02 ${rel}/manifest.json: missing required field \`${field}\` (§4.1)`);
    }
  }
  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (field in manifest && !allowed.includes(manifest[field])) {
      errors.push(
        `KDV-CI-02 ${rel}/manifest.json: \`${field}\` must be one of ${allowed.join(' | ')} (got ${JSON.stringify(manifest[field])})`,
      );
    }
  }
  if ('tags' in manifest) {
    const bad = !Array.isArray(manifest.tags) || manifest.tags.some((t) => typeof t !== 'string' || t !== t.toLowerCase());
    if (bad) errors.push(`KDV-CI-02 ${rel}/manifest.json: \`tags\` must be an array of lowercase strings (§4.1)`);
  }
  // KDV-MANIFEST-04/§2.4: content_flags present (may be empty) and from the vocabulary.
  if ('content_flags' in manifest) {
    if (!Array.isArray(manifest.content_flags) || manifest.content_flags.some((f) => typeof f !== 'string')) {
      errors.push(`KDV-CI-02 ${rel}/manifest.json: \`content_flags\` must be an array of strings (§2.4)`);
    } else if (manifest.content_flags.some((f) => !CONTENT_FLAGS_VOCABULARY.includes(f))) {
      errors.push(`KDV-CI-02 ${rel}/manifest.json: \`content_flags\` must be drawn from the §2.4 vocabulary`);
    }
  }
  // KDV-MANIFEST-07/§4.1: summary is 1–3 sentences.
  if (typeof manifest.summary === 'string') {
    const sentences = summarySentenceCount(manifest.summary);
    if (sentences < 1 || sentences > 3) {
      errors.push(`KDV-CI-02 ${rel}/manifest.json: \`summary\` must be 1–3 sentences (§4.1, got ${sentences})`);
    }
  }
  // KDV-MANIFEST-08/§4.1: sources vocabulary, derived_from, consumption_contract.
  if ('sources' in manifest) {
    const ok = Array.isArray(manifest.sources) && manifest.sources.every((s) => SOURCES_VOCAB.includes(s));
    if (!ok) errors.push(`KDV-CI-02 ${rel}/manifest.json: \`sources\` must use ${SOURCES_VOCAB.join(' | ')} (§4.1)`);
  }
  if ('derived_from' in manifest && manifest.derived_from !== null) {
    if (typeof manifest.derived_from !== 'string' || !SLUG_RE.test(manifest.derived_from)) {
      errors.push(`KDV-CI-02 ${rel}/manifest.json: \`derived_from\` must be a parent slug or null (§4.1)`);
    }
  }
  if ('consumption_contract' in manifest && manifest.consumption_contract?.see !== CONSUMPTION_CONTRACT_SEE) {
    errors.push(`KDV-CI-02 ${rel}/manifest.json: \`consumption_contract.see\` must be ${CONSUMPTION_CONTRACT_SEE} (§4.1)`);
  }
  // KDV-MANIFEST-09/§4.1: layers shape with the raw layer always present.
  if ('layers' in manifest) {
    if (!Array.isArray(manifest.layers) || manifest.layers.length === 0) {
      errors.push(`KDV-CI-02 ${rel}/manifest.json: \`layers\` must be a non-empty array (§4.1)`);
    } else {
      const badLayer = manifest.layers.some(
        (l) =>
          !l ||
          typeof l.name !== 'string' ||
          typeof l.file !== 'string' ||
          typeof l.fact_checked !== 'boolean' ||
          typeof l.author_voice !== 'boolean',
      );
      if (badLayer) {
        errors.push(`KDV-CI-02 ${rel}/manifest.json: \`layers\` entries need name/file/fact_checked/author_voice (§4.1)`);
      } else if (!manifest.layers.some((l) => l.name === 'raw' && l.file === 'raw.md')) {
        errors.push(`KDV-CI-02 ${rel}/manifest.json: \`layers\` must include the raw layer (raw.md) (§4.1)`);
      }
    }
  }
  // KDV-MANIFEST-09/§4.1: artifacts entries carry kind + path_or_url.
  if ('artifacts' in manifest) {
    const badArtifact = !Array.isArray(manifest.artifacts)
      || manifest.artifacts.some((a) => !a || !ARTIFACT_KINDS.includes(a.kind) || typeof a.path_or_url !== 'string');
    if (badArtifact) {
      errors.push(
        `KDV-CI-02 ${rel}/manifest.json: \`artifacts\` entries need kind (${ARTIFACT_KINDS.join(' | ')}) and path_or_url (§4.1)`,
      );
    }
  }
  // KDV-MANIFEST-10/§4.1: author.* is strings (or null) when injected.
  if ('author' in manifest && manifest.author !== null) {
    const a = manifest.author;
    const bad =
      typeof a !== 'object' ||
      Array.isArray(a) ||
      ['github', 'pr_url', 'merged_at'].some((k) => k in a && a[k] !== null && typeof a[k] !== 'string');
    if (bad) errors.push(`KDV-CI-02 ${rel}/manifest.json: \`author\` fields must be strings or null (§4.1)`);
  }
  // §5.6/§9: withdrawal is a `withdrawn` status whose stub must state the reason.
  if (manifest.status === 'withdrawn') {
    if (typeof manifest.withdrawal_reason !== 'string' || manifest.withdrawal_reason.trim() === '') {
      errors.push(
        `KDV-CI-02 ${rel}/manifest.json: status=withdrawn requires a non-empty \`withdrawal_reason\` (§5.6)`,
      );
    }
  }
}

// --- per-dump validation ------------------------------------------------

async function validateDump({ root, contentDir, name, rootHasLicense, slugOwners, blackZones }) {
  const errors = [];
  const warnings = [];
  const absDir = join(root, contentDir, name);
  const rel = `${contentDir}/${name}`;
  const manifestPath = join(absDir, 'manifest.json');

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    const reason = err.code === 'ENOENT' ? 'manifest.json is missing' : `manifest.json does not parse (${err.message})`;
    errors.push(`KDV-CI-02 ${rel}: ${reason}`);
    return { errors, warnings };
  }

  validateManifest(manifest, rel, errors);

  // KDV-CI-02: licence — manifest field or a root LICENSE*/CONTENT-LICENSE* file.
  const licenseField = manifest.license ?? manifest.licence;
  if (typeof licenseField !== 'string' || licenseField.trim() === '') {
    if (!rootHasLicense) {
      errors.push(
        `KDV-CI-02 ${rel}/manifest.json: no licence — set a \`license\` field or add a root LICENSE*/CONTENT-LICENSE* file`,
      );
    }
  }

  // KDV-CI-02: type=pack required structure.
  if (manifest.type === 'pack') {
    for (const file of ['SETUP_AGENT.md', 'START_HERE.md']) {
      if (!(await pathExists(join(absDir, file)))) {
        errors.push(`KDV-CI-02 ${rel}: type=pack requires ${file} (§3)`);
      }
    }
    for (const dir of ['files', 'checks']) {
      const info = await stat(join(absDir, dir)).catch(() => null);
      if (!info || !info.isDirectory()) errors.push(`KDV-CI-02 ${rel}: type=pack requires ${dir}/ (§3)`);
    }
  }

  // KDV-CI-02: chat-log sources require REDACTIONS.md.
  if (Array.isArray(manifest.sources) && manifest.sources.includes('chat-log')) {
    if (!(await pathExists(join(absDir, 'REDACTIONS.md')))) {
      errors.push(`KDV-CI-02 ${rel}: sources include chat-log, so REDACTIONS.md is required (§8.2)`);
    }
  }

  // KDV-CI-02: stakes=high requires non-empty content_flags.
  if (manifest.stakes === 'high' && Array.isArray(manifest.content_flags) && manifest.content_flags.length === 0) {
    errors.push(`KDV-CI-02 ${rel}/manifest.json: stakes=high requires non-empty content_flags (§2.3)`);
  }

  // KDV-CI-03: slug format, directory and manifest agreement, uniqueness.
  if (typeof manifest.slug === 'string' && !SLUG_RE.test(manifest.slug)) {
    errors.push(`KDV-CI-03 ${rel}: slug must match YYYY-MM-DD-<short-name> (got ${JSON.stringify(manifest.slug)})`);
  }
  if (manifest.slug !== name) {
    errors.push(`KDV-CI-03 ${rel}: slug must equal the directory name (manifest: ${JSON.stringify(manifest.slug)})`);
  }
  if (typeof manifest.slug === 'string') {
    const owner = slugOwners.get(manifest.slug);
    if (owner) errors.push(`KDV-CI-03 ${rel}: duplicate slug ${JSON.stringify(manifest.slug)} (also in ${owner})`);
    else slugOwners.set(manifest.slug, rel);
  }

  // KDV-CI-03: date is ISO and not in the future.
  if (typeof manifest.date !== 'string' || !DATE_RE.test(manifest.date)) {
    errors.push(`KDV-CI-03 ${rel}/manifest.json: date must be ISO YYYY-MM-DD (got ${JSON.stringify(manifest.date)})`);
  } else if (new Date(`${manifest.date}T00:00:00Z`).toISOString().slice(0, 10) !== manifest.date) {
    errors.push(`KDV-CI-03 ${rel}/manifest.json: date ${manifest.date} is not a real calendar date`);
  } else if (manifest.date > new Date().toISOString().slice(0, 10)) {
    errors.push(`KDV-CI-03 ${rel}/manifest.json: date ${manifest.date} is in the future`);
  }

  // KDV-CI-06: files, sizes, binary placement.
  const files = await listDumpFiles(absDir);
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`KDV-CI-06 ${rel}/${file.rel}: file is ${file.size} bytes (> 1 MB cap, §3)`);
    }
    const ext = file.rel.slice(file.rel.lastIndexOf('.')).toLowerCase();
    const isText = file.rel === 'manifest.json' || TEXT_EXTENSIONS.has(ext);
    if (!isText && !ASSET_RE.test(file.rel)) {
      errors.push(`KDV-CI-06 ${rel}/${file.rel}: binary allowed only as assets/*.png|*.svg|*.puml (§8.1)`);
    }
  }
  if (totalBytes > MAX_DUMP_BYTES) {
    errors.push(`KDV-CI-06 ${rel}: dump is ${totalBytes} bytes (> 20 MB cap, §8.1)`);
  }

  // KDV-CI-04: secret scan over the dump's text files.
  for (const file of files) {
    const ext = file.rel.slice(file.rel.lastIndexOf('.')).toLowerCase();
    if (!(file.rel === 'manifest.json' || TEXT_EXTENSIONS.has(ext))) continue;
    const content = await readFile(file.abs, 'utf8');
    for (const hit of scanSecrets(content)) {
      errors.push(`KDV-CI-04 ${rel}/${file.rel}: possible secret — ${hit}`);
    }
  }

  // KDV-CI-08: black-zone heuristics over the dump's text files (§2.5). A hit is
  // a BLOCK that hands the dump to the owner for manual review; the heuristic is
  // best-effort and cannot be whitewashed by "content for machines" framing.
  for (const file of files) {
    const ext = file.rel.slice(file.rel.lastIndexOf('.')).toLowerCase();
    if (!(file.rel === 'manifest.json' || TEXT_EXTENSIONS.has(ext))) continue;
    const content = await readFile(file.abs, 'utf8');
    for (const category of scanBlackZones(content, blackZones)) {
      errors.push(
        `KDV-CI-08 ${rel}/${file.rel}: black-zone content (${category}) detected — BLOCKED, owner manual review required; no "content for machines" framing can whitewash this (§2.5)`,
      );
    }
  }

  // KDV-CI-05: personal data requires a justification or REDACTIONS.md.
  const justification = typeof manifest.personal_data_justification === 'string' && manifest.personal_data_justification.trim() !== '';
  const hasRedactions = await pathExists(join(absDir, 'REDACTIONS.md'));
  if (!justification && !hasRedactions) {
    for (const file of files.filter((f) => f.rel.endsWith('.md'))) {
      for (const hit of scanPersonalData(await readFile(file.abs, 'utf8'))) {
        errors.push(
          `KDV-CI-05 ${rel}/${file.rel}: ${hit} needs justification — add REDACTIONS.md or \`personal_data_justification\` in the manifest`,
        );
      }
    }
  }

  // KDV-CI-06: internal links and artifacts[].path_or_url resolve.
  for (const file of files.filter((f) => f.rel.endsWith('.md'))) {
    const content = await readFile(file.abs, 'utf8');
    const lines = content.split(/\r?\n/);
    const fences = fenceStates(content);
    for (let i = 0; i < lines.length; i += 1) {
      if (fences[i]) continue;
      for (const link of lines[i].matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = stripFragment(link[1]);
        if (!target || isExternalTarget(target)) continue;
        if (!(await pathExists(join(absDir, target))) && !(await pathExists(join(root, target)))) {
          errors.push(`KDV-CI-06 ${rel}/${file.rel}:${i + 1}: internal link does not resolve — ${link[1]}`);
        }
      }
    }
  }
  for (const artifact of Array.isArray(manifest.artifacts) ? manifest.artifacts : []) {
    const target = artifact?.path_or_url;
    if (typeof target !== 'string' || isExternalTarget(target)) continue;
    const clean = stripFragment(target);
    if (!(await pathExists(join(absDir, clean))) && !(await pathExists(join(root, clean)))) {
      errors.push(`KDV-CI-06 ${rel}/manifest.json: artifact path does not resolve — ${target}`);
    }
  }

  // KDV-CI-07: markdown lint (WARN only) over markdown layers.
  for (const file of files.filter((f) => f.rel.endsWith('.md'))) {
    const { h1Count, anchors, inPageLinks } = analyzeMarkdown(await readFile(file.abs, 'utf8'));
    if (h1Count > 1) warnings.push(`KDV-CI-07 ${rel}/${file.rel}: duplicate H1 (${h1Count} top-level headings)`);
    for (const anchor of inPageLinks) {
      if (!anchors.has(anchor.toLowerCase())) {
        warnings.push(`KDV-CI-07 ${rel}/${file.rel}: in-page link points at missing heading #${anchor}`);
      }
    }
  }

  return { errors, warnings };
}

// --- public API ---------------------------------------------------------

export async function validateContent({ root, contentDir = 'content/dumps', blackZoneConfig = DEFAULT_BLACK_ZONE_CONFIG } = {}) {
  const errors = [];
  const warnings = [];

  // KDV-CI-08: load the declarative black-zone config. A missing or malformed
  // config is a visible error, never a silent skip (fail-visible, §2.5).
  let blackZones = [];
  try {
    blackZones = await loadBlackZoneCategories(blackZoneConfig);
  } catch (err) {
    const reason = err.code === 'ENOENT' ? 'file is missing' : err.message;
    errors.push(
      `KDV-CI-08 ${displayPath(root, blackZoneConfig)}: black-zone config could not be loaded — ${reason}; heuristics cannot run, owner manual review required (§2.5)`,
    );
  }

  const dumpsRoot = join(root, contentDir);

  let entries;
  try {
    entries = await readdir(dumpsRoot, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return { errors, warnings };
    throw err;
  }

  const rootEntries = await readdir(root).catch(() => []);
  const rootHasLicense = rootEntries.some((entry) => /^(CONTENT-)?LICEN[CS]E/i.test(entry));
  const slugOwners = new Map();

  const names = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    const result = await validateDump({ root, contentDir, name, rootHasLicense, slugOwners, blackZones });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { errors, warnings };
}

// --- CLI ----------------------------------------------------------------

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { errors, warnings } = await validateContent({ root: REPO_ROOT });
  for (const warning of warnings) console.warn(`WARN  ${warning}`);
  for (const error of errors) console.error(`ERROR ${error}`);
  console.log(`validate: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

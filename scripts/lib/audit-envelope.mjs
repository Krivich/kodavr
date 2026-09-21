/**
 * CONTRACT: scripts/lib/audit-envelope.mjs
 * ROLE: Layer-0 deterministic envelope over git metadata and author signals (reads no content text)
 * EXPORTS:
 *   DUMPS_ROOT — the repository-relative root every dump directory lives under
 *   DEFAULT_MIN_ACCOUNT_AGE_DAYS — the default minimum account age in days
 *   DEFAULT_MAX_PRS_PER_DAY — the default per-author daily PR/auto-merge cap
 *   checkDiffShape — PR files → additions-only + single-new-dump-directory conditions
 *   checkAuthorSignals — author signals → account-age, rate-limit, fork and first-PR conditions
 *   evaluateEnvelope — diff shape + author signals + content gate + Layer-1 → the §4.1 envelope verdict
 * CONSUMES:
 *   ./audit-policy.mjs — envelopeAllPass (the all-true gate)
 * INVARIANTS:
 *   — the envelope never reads content text; it works on metadata and schema only
 *   — a missing or malformed input is a FAILED condition, never a thrown error
 */
import { envelopeAllPass } from './audit-policy.mjs';

export const DUMPS_ROOT = 'content/dumps/';
export const DEFAULT_MIN_ACCOUNT_AGE_DAYS = 30;
export const DEFAULT_MAX_PRS_PER_DAY = 5;

const MS_PER_DAY = 86400000;

// withRootSlash(root) → the root normalised to end in exactly one '/'
const withRootSlash = (root) => {
  const s = String(root);
  return s.endsWith('/') ? s : `${s}/`;
};

// isUnderRoot(filename, root) → true when the path lies at or below `root`
const isUnderRoot = (filename, root) =>
  typeof filename === 'string' && filename.startsWith(withRootSlash(root));

// containingDir(filename) → the directory part of a repo-relative path ('' at the repo root)
const containingDir = (filename) => {
  const s = String(filename);
  const slash = s.lastIndexOf('/');
  return slash <= 0 ? '' : s.slice(0, slash);
};

// dirSlug(dir, root) → the <slug> of `root<slug>`, or null when `dir` is not a dump directory
const dirSlug = (dir, root) => {
  const prefix = withRootSlash(root);
  if (!dir.startsWith(prefix)) return null;
  const rest = dir.slice(prefix.length);
  return rest && !rest.includes('/') ? rest : null;
};

// checkDiffShape(files,{dumpsRoot}) → {ok,slug,conditions,violations}.
// files = [{filename,status}] with GitHub's PR-file status. Conditions: the PR adds
// only new files, all inside exactly one new content/dumps/<slug>/ directory.
export function checkDiffShape(files, { dumpsRoot = DUMPS_ROOT } = {}) {
  const list = Array.isArray(files) ? files : [];
  const entries = list.map((f) => ({
    filename: f && f.filename !== undefined ? String(f.filename) : '',
    status: f ? f.status : undefined,
    dir: containingDir(f && f.filename !== undefined ? f.filename : ''),
  }));

  const dirs = new Set(entries.map((e) => e.dir));
  const uniqueDir = dirs.size === 1 ? [...dirs][0] : null;
  const slug = uniqueDir !== null ? dirSlug(uniqueDir, dumpsRoot) : null;
  const outside = entries.filter((e) => !isUnderRoot(e.filename, dumpsRoot));

  const additionsOnly = list.length > 0 && entries.every((e) => e.status === 'added');
  const singleNewDirectory = list.length > 0 && slug !== null;
  const insideDumpsRoot = list.length > 0 && outside.length === 0;

  const conditions = { additionsOnly, singleNewDirectory, insideDumpsRoot };
  const violations = [];

  for (const e of entries) {
    if (e.status !== 'added') {
      violations.push({
        filename: e.filename,
        rule: 'additions-only',
        reason: `status is '${e.status}', expected 'added'`,
      });
    }
  }
  for (const e of outside) {
    violations.push({
      filename: e.filename,
      rule: 'inside-dumps-root',
      reason: `outside ${withRootSlash(dumpsRoot)}`,
    });
  }
  if (!singleNewDirectory) {
    for (const e of entries) {
      violations.push({
        filename: e.filename,
        rule: 'single-new-directory',
        reason:
          uniqueDir === null
            ? 'changes span more than one directory'
            : `${uniqueDir} is not a single ${withRootSlash(dumpsRoot)}<slug>/ directory`,
      });
    }
  }

  return { ok: additionsOnly && singleNewDirectory && insideDumpsRoot, slug, conditions, violations };
}

// checkAuthorSignals({createdAt,prsToday,hasMergedPr,isFork},{...}) → {ok,ageDays,conditions}.
// The incoming PR is counted in the rate limit (prsToday + 1 <= maxPrsPerDay).
export function checkAuthorSignals(
  { createdAt, prsToday, hasMergedPr, isFork } = {},
  {
    minAccountAgeDays = DEFAULT_MIN_ACCOUNT_AGE_DAYS,
    maxPrsPerDay = DEFAULT_MAX_PRS_PER_DAY,
    now = new Date(),
  } = {},
) {
  let ageDays = null;
  let accountAge = false;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      ageDays = Math.floor((now.getTime() - created.getTime()) / MS_PER_DAY);
      accountAge = ageDays >= minAccountAgeDays;
    }
  }

  const rateLimit = Number.isInteger(prsToday) && prsToday >= 0 && prsToday + 1 <= maxPrsPerDay;
  const notFork = isFork !== true;
  const notFirstPr = hasMergedPr === true;

  const conditions = { accountAge, rateLimit, notFork, notFirstPr };
  return { ok: accountAge && rateLimit && notFork && notFirstPr, ageDays, conditions };
}

// evaluateEnvelope({diffShape,authorSignals,contentGate,layer1Clean}) → {ok,slug,conditions,failed}.
// Assembles the §4.1 conditions under their exact keys; every missing input is false
// (fail-visible, never thrown). layer1Clean is the caller's structuralChannel verdict.
export function evaluateEnvelope({ diffShape, authorSignals, contentGate = {}, layer1Clean } = {}) {
  const shape = (diffShape && diffShape.conditions) || {};
  const author = (authorSignals && authorSignals.conditions) || {};
  const gate = contentGate && typeof contentGate === 'object' ? contentGate : {};

  const conditions = {
    additionsOnly: shape.additionsOnly === true,
    singleNewDirectory: shape.singleNewDirectory === true,
    insideDumpsRoot: shape.insideDumpsRoot === true,
    assetsOk: gate.assetsOk === true,
    secretsOk: gate.secretsOk === true,
    personalDataOk: gate.personalDataOk === true,
    manifestOk: gate.manifestOk === true,
    slugDateOk: gate.slugDateOk === true,
    layer1Clean: layer1Clean === true,
    accountAgeOk: author.accountAge === true,
    rateLimitOk: author.rateLimit === true,
    notFork: author.notFork === true,
    notFirstPr: author.notFirstPr === true,
  };

  const failed = Object.keys(conditions).filter((key) => conditions[key] !== true);
  return {
    ok: envelopeAllPass(conditions),
    slug: (diffShape && diffShape.slug) ?? null,
    conditions,
    failed,
  };
}

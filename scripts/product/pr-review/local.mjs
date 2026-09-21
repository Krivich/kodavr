#!/usr/bin/env node
/**
 * CONTRACT: scripts/product/pr-review/local.mjs
 * ROLE: CLI — runs the audit pipeline over the repository's own dumps and prints the verdicts
 * CONSUMES:
 *   node:fs — read every text file under content/dumps/<slug>/
 *   node:path — resolve the dumps root and file extensions
 *   ./audit/local.mjs — TRUSTED_AUTHOR, auditDumps, summarizeRuns
 * INVARIANTS:
 *   — offline: no network and no token; everything reads the local content/dumps tree
 *   — the forensic map is printed without numeric scores, at most once per dump
 *   — exit 0 by default; --strict is the only path to a non-zero exit
 */

// scripts/product/pr-review/local.mjs — run the PR audit over OUR OWN dumps, locally.
// It reads content/dumps/<slug>/, synthesizes an addition-only single-directory
// PR per dump, feeds the real text through the deterministic pipeline and prints
// what the pipeline says: the decision, the failed envelope conditions and the
// forensic map. The author signals describe a trusted, non-fork author so the
// envelope passes and the CONTENT channels are actually exercised. This is the
// repeatable way to see the audit's behavior against the real corpus.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { TRUSTED_AUTHOR, auditDumps, summarizeRuns } from './audit/local.mjs';

const DUMPS_DIR = 'content/dumps';
const MS_PER_DAY = 86400000;
const AUTHOR_AGE_DAYS = 365;
// A file whose extension is not listed here is read as UTF-8 text.
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.pdf', '.zip',
]);
// The envelope's content-gate keys; all true by default (the dumps are validator-green).
const CONTENT_GATE_FLAGS = ['assetsOk', 'secretsOk', 'personalDataOk', 'manifestOk', 'slugDateOk'];

function log(message) {
  console.log(`audit-local: ${message}`);
}

// readDumpFiles(dir, base) → [{name,text}]. Recurses into subdirectories; binary
// files are skipped, every other file is read as UTF-8. `name` is relative to the
// dump directory (posix separators).
function readDumpFiles(dir, base = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readDumpFiles(full, name));
      continue;
    }
    if (!entry.isFile()) continue;
    if (BINARY_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    files.push({ name, text: readFileSync(full, 'utf8') });
  }
  return files;
}

// readDumps(dumpsDir) → [{slug,files}] for every directory under the dumps root.
function readDumps(dumpsDir) {
  const dumps = [];
  for (const entry of readdirSync(dumpsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    dumps.push({ slug: entry.name, files: readDumpFiles(path.join(dumpsDir, entry.name)) });
  }
  return dumps.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

// option(flag) → the value after `--flag`, or null when the flag is absent.
function option(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1] ?? null;
}

// printRun(run) → the human block for one dump: decision, failed envelope and map.
function printRun(run) {
  const decision = run.result.policy.decision;
  console.log(`${run.slug}: ${decision}`);
  const failed = run.result.envelope.failed;
  if (failed.length) console.log(`  envelope failed: ${failed.join(', ')}`);
  for (const finding of run.result.policy.findings) {
    const span = `${finding.file}:${finding.start}-${finding.end}`;
    const channels = finding.channels.join(',');
    console.log(`  ${span} [${channels}] ${finding.reasons.join('; ')}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const slugFilter = option(args, '--slug');
  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const gateFail = args.includes('--content-gate-fail');

  const now = new Date();
  const createdAt = new Date(now.getTime() - AUTHOR_AGE_DAYS * MS_PER_DAY).toISOString();
  const authorSignals = { ...TRUSTED_AUTHOR, createdAt };
  const contentGate = CONTENT_GATE_FLAGS.reduce((gate, flag) => ({ ...gate, [flag]: !gateFail }), {});

  const all = readDumps(path.resolve(process.cwd(), DUMPS_DIR));
  const dumps = slugFilter ? all.filter((d) => d.slug === slugFilter) : all;
  if (slugFilter && dumps.length === 0) log(`no dump matched --slug ${slugFilter}`);

  const runs = auditDumps(dumps, { authorSignals, contentGate });
  const summary = summarizeRuns(runs);

  if (json) {
    console.log(
      JSON.stringify(
        {
          dumps: runs.map((run) => ({
            slug: run.slug,
            decision: run.result.policy.decision,
            failed: run.result.envelope.failed,
            findings: run.result.policy.findings,
          })),
          summary,
        },
        null,
        2,
      ),
    );
  } else {
    log(`${summary.total} dumps under ${DUMPS_DIR}/`);
    for (const run of runs) printRun(run);
    const { total, byDecision } = summary;
    console.log(
      `summary: ${total} total / ${byDecision.MERGE} MERGE / ${byDecision.THINK} THINK / ${byDecision.MANUAL} MANUAL / ${byDecision.DECLINE} DECLINE`,
    );
    const flagged = summary.flagged.length
      ? summary.flagged.map((f) => `${f.slug} (${f.decision})`).join(', ')
      : 'none';
    console.log(`flagged: ${flagged}`);
  }

  if (strict && summary.flagged.length) process.exitCode = 1;
}

main();

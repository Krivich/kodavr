#!/usr/bin/env node
/**
 * CONTRACT: scripts/product/pr-review/judge.mjs
 * ROLE: CLI — runs the Layer-4 LLM judge over the repository's own dumps and prints the verdicts
 * CONSUMES:
 *   node:fs — read content/dumps/<slug>/ and write the optional reasoning traces
 *   node:path — resolve the dumps root, the provider config and trace files
 *   node:os — locate ~/.local/share/opencode/auth.json
 *   ./audit/llm/llm.mjs — OPENCODE_MODEL, providerFromAuth, providerFromEnv, providerFromWorkflowConfig
 *   ./audit/llm/judge.mjs — judgeChannel
 *   ./audit/llm/trace.mjs — traceResidueChannel (Layer 5 deterministic residue)
 *   ./audit/llm/meta.mjs — metaReviewChannel (Layer 5 masked-trace meta-reviewer)
 * INVARIANTS:
 *   — the key never reaches stdout/stderr: only the provider NAME and the MODEL are printed
 *   — no provider or a network error is a loud exit 1, never a silent skip
 *   — only verdict/flags/reasons/spans are printed — never a numeric score or confidence
 *   — --trace never crashes on a trace-less provider: both Layer-5 channels print `skipped`
 */

// scripts/product/pr-review/judge.mjs — run the Layer-4 judge over OUR OWN dumps, locally.
// Provider resolution, in order of precedence: --provider-config <work-flow config.json>,
// --env (AUDIT_LLM_*), else ~/.local/share/opencode/auth.json (opencode-go). The key is
// read at runtime from these sources only — it is never hardcoded and never printed.
// Every dump's text files are framed as non-instructional data and judged once; the
// optional --save-trace <dir> keeps each raw reasoning trace for the future Layer 5.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  OPENCODE_MODEL,
  providerFromAuth,
  providerFromEnv,
  providerFromWorkflowConfig,
} from './audit/llm/llm.mjs';
import { judgeChannel } from './audit/llm/judge.mjs';
import { traceResidueChannel } from './audit/llm/trace.mjs';
import { metaReviewChannel } from './audit/llm/meta.mjs';

const DUMPS_DIR = 'content/dumps';
// A file whose extension is not listed here is read as UTF-8 text.
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.pdf', '.zip',
]);

function log(message) {
  console.log(`audit-judge: ${message}`);
}

function fail(message) {
  console.error(`audit-judge: ${message}`);
  process.exit(1);
}

// option(args,flag) → the value after `--flag`, or null when the flag is absent.
function option(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1] ?? null;
}

// readDumpFiles(dir,base) → [{name,text}]. Recurses into subdirectories; binary
// files are skipped; `name` is relative to the dump directory (posix separators).
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

// readDumps(dumpsDir,slugFilter) → [{slug,files}], files already shaped as
// {file,text} with a content/dumps/<slug>/<name> label for the frame.
function readDumps(dumpsDir, slugFilter) {
  const dumps = [];
  for (const entry of readdirSync(dumpsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (slugFilter && entry.name !== slugFilter) continue;
    const slug = entry.name;
    const files = readDumpFiles(path.join(dumpsDir, slug)).map((f) => ({
      file: `${DUMPS_DIR}/${slug}/${f.name}`,
      text: f.text,
    }));
    dumps.push({ slug, files });
  }
  return dumps.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

// resolveProvider(args) → {provider,name}. Reads the provider config at runtime;
// never echoes the key — the caller prints only the name and the model.
function resolveProvider(args) {
  const configPath = option(args, '--provider-config');
  const model = option(args, '--model');
  let provider;
  let name;

  if (configPath) {
    let cfg;
    try {
      cfg = JSON.parse(readFileSync(path.resolve(configPath), 'utf8'));
    } catch (e) {
      fail(`cannot read --provider-config ${configPath}: ${e.message}`);
    }
    provider = providerFromWorkflowConfig(cfg);
    name = 'workflow-config';
  } else if (args.includes('--env')) {
    provider = providerFromEnv(process.env);
    name = 'env';
  } else {
    const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
    let auth;
    try {
      auth = JSON.parse(readFileSync(authPath, 'utf8'));
    } catch (e) {
      fail(`cannot read ${authPath}: ${e.message}`);
    }
    provider = providerFromAuth(auth, model ? { model } : {});
    name = 'opencode-auth';
  }

  if (!provider) {
    fail(`no complete provider (${name}); pass --provider-config, --env or a key in the opencode auth file`);
  }
  if (model) provider = { ...provider, model };
  return { provider, name };
}

// printOutcome(slug,outcome) → the human block: verdict, flags, reasons, spans.
// The numeric confidence/score is deliberately never printed.
function printOutcome(slug, { result, flags, reasons }) {
  console.log(`${slug}: ${result.verdict}`);
  if (flags && flags.length) console.log(`  flags: ${flags.join(', ')}`);
  if (reasons && reasons.length) console.log(`  reasons: ${reasons.join('; ')}`);
  for (const span of result.spans) {
    console.log(`  span ${span.file}:${span.start}-${span.end} — ${span.reason}`);
  }
}

// printTraceLine(name,out) → one Layer-5 line: the verdict with flags/reasons,
// or `skipped (<reason>)` when there is no trace. Accepts either a flat
// ChannelResult (trace-reader) or a {result,flags,reasons} envelope (meta-reviewer).
function printTraceLine(name, out) {
  if (out.skipped) {
    console.log(`  ${name}: skipped (${out.reason})`);
    return;
  }
  const { result, flags = [], reasons = [] } = out;
  console.log(`  ${name}: ${result.verdict}`);
  if (flags.length) console.log(`  ${name} flags: ${flags.join(', ')}`);
  const all = reasons.length ? reasons : (result.spans || []).map((span) => span.reason);
  if (all.length) console.log(`  ${name} reasons: ${all.join('; ')}`);
}

// printTraceChannels(outcome,dump,provider,format) → the Layer-5 view of one
// judged dump: the deterministic residue channel and the meta-reviewer over the
// quote-masked trace. A missing trace degrades both to `skipped`, never a crash.
async function printTraceChannels(outcome, dump, provider, format) {
  const trace = outcome.reasoning;
  const residue = traceResidueChannel({ trace, files: dump.files });
  printTraceLine('trace-reader', residue.skipped ? residue : { result: residue, flags: [], reasons: [] });
  const meta = await metaReviewChannel({ trace, files: dump.files, config: provider, schemaTier: format });
  printTraceLine('meta-reviewer', meta);
}

async function main() {
  const args = process.argv.slice(2);
  const { provider, name } = resolveProvider(args);
  log(`provider ${name} · model ${provider.model}`);

  const slugFilter = option(args, '--slug');
  const saveTrace = option(args, '--save-trace');
  // The response_format tier: not every provider supports json_schema (opencode-go
  // answers 400 for it), so the default is none and the allowlist parser still
  // holds the contract. --format json_schema|json_object opts in where supported.
  const format = (option(args, '--format') || 'none').toLowerCase();
  if (!['none', 'json_object', 'json_schema'].includes(format)) {
    fail(`unknown --format ${format} (use none|json_object|json_schema)`);
  }
  log(`response_format: ${format}`);

  const dumpsDir = path.resolve(process.cwd(), DUMPS_DIR);
  let dumps;
  try {
    dumps = readDumps(dumpsDir, slugFilter);
  } catch (e) {
    fail(`cannot read ${DUMPS_DIR}/: ${e.message}`);
  }
  if (slugFilter && dumps.length === 0) fail(`no dump matched --slug ${slugFilter}`);
  if (saveTrace) mkdirSync(saveTrace, { recursive: true });

  for (const dump of dumps) {
    let outcome;
    try {
      outcome = await judgeChannel({ files: dump.files, config: provider, schemaTier: format });
    } catch (e) {
      // A provider/network error must be visible, not folded into a verdict.
      fail(`${dump.slug}: provider call failed: ${e.message}`);
    }
    printOutcome(dump.slug, outcome);
    if (args.includes('--trace')) await printTraceChannels(outcome, dump, provider, format);
    if (saveTrace && outcome.reasoning) {
      writeFileSync(path.join(saveTrace, `${dump.slug}.reasoning.txt`), outcome.reasoning, 'utf8');
    }
  }

  log(`${dumps.length} dump(s) judged from ${DUMPS_DIR}/`);
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));

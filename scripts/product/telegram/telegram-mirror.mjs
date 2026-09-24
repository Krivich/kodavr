#!/usr/bin/env node
/**
 * CONTRACT: scripts/product/telegram/telegram-mirror.mjs
 * ROLE: posts every newly published dump to the Telegram channel after a deploy
 * CONSUMES:
 *   node:child_process — run the git diff (argv from the lib) of ADDED dump manifests
 *   node:fs — read the GitHub event payload and the dump files
 *   ../../lib/manifest-card.mjs — dumpSlugsFromFiles over the diff's file list
 *   ../../lib/telegram-mirror.mjs — the send + previous-deploy + added-manifest diff + orchestration helpers
 * INVARIANTS:
 *   — a dump is announced only when its manifest.json was ADDED since the previous successful deploy; a file gained by an existing dump never re-announces it
 *   — the bot token is read from the environment only, never source
 *   — the entry point always exits 0; a missing token/event/diff is a logged skip
 */

// scripts/product/telegram/telegram-mirror.mjs — the CI entry point of the Telegram dump mirror.
// Runs from .github/workflows/publish-telegram.yml when the deploy workflow
// completes on main. It finds the previous successful deploy's commit, takes the
// dump manifests ADDED since then (a dump is new iff its manifest.json was added —
// so a redeploy never re-posts the whole archive and a file gained by an existing
// dump never re-announces it), renders each post and sends it to the channel.
// Everything is best-effort: a failure is logged and the process still exits 0 so
// the mirror never fails CI.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  addedManifestDiffArgv,
  sendTelegram,
  previousDeploySha,
  mirrorDumps,
} from '../../lib/telegram-mirror.mjs';
import { dumpSlugsFromFiles } from '../../lib/manifest-card.mjs';

const SITE_BASE = String(process.env.SITE_BASE || 'https://kodavr.xyz').replace(/\/+$/, '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '@kodavr_xyz';

function log(message) {
  console.log(`telegram-mirror: ${message}`);
}

// readEvent() → the parsed GitHub event, or null when it is missing/unreadable.
function readEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// addedDumpFiles(baseSha, headSha) → the dump manifests added between the two
// commits (the argv/pattern lives in the lib — the class rule is: a dump is new
// iff its manifest.json was ADDED), or null when git fails (a shallow checkout,
// an unknown revision, …).
function addedDumpFiles(baseSha, headSha) {
  const result = spawnSync('git', addedManifestDiffArgv(baseSha, headSha), { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout || '').split(/\r?\n/).filter(Boolean);
}

async function main() {
  const event = readEvent();
  if (!event || !event.workflow_run) {
    log('no workflow_run in the event — nothing to mirror');
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log('no TELEGRAM_BOT_TOKEN secret — nothing to mirror');
    return;
  }

  const headSha = event.workflow_run.head_sha;
  const baseSha = await previousDeploySha({
    event,
    repo: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    log,
  });
  if (!baseSha) {
    log('no previous successful deploy — nothing to mirror');
    return;
  }

  const files = addedDumpFiles(baseSha, headSha);
  if (!files || files.length === 0) {
    log('no newly added dump manifests — nothing to mirror');
    return;
  }
  const slugs = dumpSlugsFromFiles(files);
  if (slugs.length === 0) {
    log('no dump slugs in the diff — nothing to mirror');
    return;
  }

  const repoRoot = process.cwd();
  const report = await mirrorDumps({
    slugs,
    repoRoot,
    siteBase: SITE_BASE,
    send: (text, slug) => sendTelegram({ token, chatId: CHAT_ID, text, log }),
    readFile: (path, encoding) => readFileSync(path, encoding),
    exists: (path) => existsSync(path),
    log,
  });
  log(`done — sent ${report.sent.length}, skipped ${report.skipped.length}, failed ${report.failed.length}`);
}

main()
  .catch((err) => {
    log(`unexpected error — ${err && err.message ? err.message : err}`);
  })
  .finally(() => {
    process.exit(0);
  });

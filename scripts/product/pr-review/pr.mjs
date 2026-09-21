#!/usr/bin/env node
/**
 * CONTRACT: scripts/product/pr-review/pr.mjs
 * ROLE: audits a pull request via the GitHub REST API and posts the advisory comment and status
 * CONSUMES:
 *   node:fs — read the GitHub event payload
 *   ./audit/pr.mjs — STATUS_CONTEXT, normalizePrFiles, authorSignalsFromApi, runAudit
 *   ./audit/report.mjs — AUDIT_MARKER (the sticky-comment marker)
 *   ./audit/llm/llm-channels.mjs — buildLlmChannels (the LLM channels, or [] when unconfigured)
 *   ./audit/llm/llm.mjs — providerFromEnv (log the model name only, never the key)
 * INVARIANTS:
 *   — no checkout: the diff and author signals come from the REST API only
 *   — fork PRs are skipped (read-only token): same-repo only, never posted to
 *   — an unexpected error is printed and the process exits 1 (fail-visible)
 */

// scripts/product/pr-review/pr.mjs — the CI entry point of the PR security audit (shadow).
// Runs from .github/workflows/audit.yml on a same-repo pull_request. It fetches
// the changed files (the diff is the API `patch`, no checkout), the author and
// their PR history, runs the deterministic envelope + policy, and publishes the
// advisory sticky comment and the `pr-audit` status check. Phase 0: the policy
// only advises — the comment always reads MANUAL and a human decides.
import { existsSync, readFileSync } from 'node:fs';
import { STATUS_CONTEXT, normalizePrFiles, authorSignalsFromApi, runAudit } from './audit/pr.mjs';
import { AUDIT_MARKER } from './audit/report.mjs';
import { buildLlmChannels } from './audit/llm/llm-channels.mjs';
import { providerFromEnv } from './audit/llm/llm.mjs';

const API = 'https://api.github.com';

// The envelope's content-gate keys; all true only on a green CI validator run.
const CONTENT_GATE_FLAGS = ['assetsOk', 'secretsOk', 'personalDataOk', 'manifestOk', 'slugDateOk'];

function log(message) {
  console.log(`audit-pr: ${message}`);
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

// github(path,token,init) → the parsed JSON response; a non-2xx is a loud error.
async function github(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kodavr-pr-audit',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// contentGate() → every flag true only when the content validator handed us a
// green gate; anything else is all-false (fail-safe: the envelope then fails).
function contentGate() {
  const ok = process.env.AUDIT_CONTENT_GATE_OK === '1';
  return CONTENT_GATE_FLAGS.reduce((gate, flag) => ({ ...gate, [flag]: ok }), {});
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const event = readEvent();
  const pr = event && event.pull_request;
  const sha = pr && pr.head && pr.head.sha;
  const number = pr && pr.number;
  if (!token || !repo || !number || !sha) {
    log('no token/repo/event — nothing to audit');
    return;
  }

  const headRepo = pr.head && pr.head.repo && pr.head.repo.full_name;
  const baseRepo = pr.base && pr.base.repo && pr.base.repo.full_name;
  if (!headRepo || !baseRepo || headRepo !== baseRepo) {
    log('fork PR — same-repo only (KDV-CI-14), nothing to post');
    return;
  }

  const login = pr.user && pr.user.login;
  const apiFiles = await github(`/repos/${repo}/pulls/${number}/files?per_page=100`, token);
  const list = Array.isArray(apiFiles) ? apiFiles : [];
  const prFiles = normalizePrFiles(apiFiles);
  // The API `patch` is the only text we get without a checkout; gaps are ''.
  const scanFiles = list.map((f) => ({
    file: f && typeof f.filename === 'string' ? f.filename : '',
    text: f && typeof f.patch === 'string' ? f.patch : '',
  }));

  // The LLM channels (Layers 4+5) are built here from env and handed to the pure
  // runAudit. A missing provider is fine ([] — deterministic-only); a configured
  // but failing one becomes a visible `llm-error` flag channel (THINK), never a
  // crash. Only the model name(s) are logged — the key never is.
  const files = scanFiles.filter((f) => f.file && f.text);
  const llmChannels = await buildLlmChannels({ files });
  const provider = providerFromEnv(process.env);
  if (provider) {
    const models = [provider.model, process.env.AUDIT_LLM_MODEL_2].filter(Boolean).join(', ');
    log(`llm channels: ${llmChannels.length} (model: ${models})`);
  } else {
    log('llm disabled (no provider) — deterministic channels only');
  }

  const user = login ? await github(`/users/${login}`, token) : null;
  const pulls = await github(`/repos/${repo}/pulls?state=all&per_page=100`, token);
  const authorSignals = authorSignalsFromApi({ user, pulls, isFork: false, currentNumber: number });

  // No checkout: the manifest content is unavailable, so facts stay empty and
  // the content gate is the only content signal (from the sibling CI job).
  const result = runAudit({ prFiles, scanFiles, authorSignals, contentGate: contentGate(), facts: {}, extraChannels: llmChannels });

  const issue = `/repos/${repo}/issues/${number}/comments`;
  const existing = (await github(`${issue}?per_page=100`, token)).find((c) =>
    c && typeof c.body === 'string' ? c.body.includes(AUDIT_MARKER) : false,
  );
  if (existing) {
    await github(`/repos/${repo}/issues/comments/${existing.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body: result.comment }),
    });
    log(`updated advisory comment ${existing.id}`);
  } else {
    const created = await github(issue, token, { method: 'POST', body: JSON.stringify({ body: result.comment }) });
    log(`posted advisory comment ${created.id}`);
  }

  await github(`/repos/${repo}/statuses/${sha}`, token, {
    method: 'POST',
    body: JSON.stringify(result.status),
  });
  log(`status ${STATUS_CONTEXT}: ${result.status.state}`);
}

main().catch((err) => {
  console.error(`audit-pr failed: ${err && err.message ? err.message : err}`);
  process.exit(1);
});

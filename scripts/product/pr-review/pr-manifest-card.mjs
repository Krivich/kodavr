/**
 * CONTRACT: scripts/product/pr-review/pr-manifest-card.mjs
 * ROLE: posts or updates the sticky manifest-card comment on a pull request
 * CONSUMES:
 *   ../../lib/manifest-card.mjs — the card renderer and changed-file finder
 *   node:fs — read the changed-file list, manifest and event payload
 *   node:path — resolve dump paths
 * INVARIANTS:
 *   — the manifest and summary.md are the only source; the comment is a render, never an input
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_MARKER, dumpSlugsFromFiles, renderManifestCard } from '../../lib/manifest-card.mjs';

const API = 'https://api.github.com';

function changedFiles() {
  const path = process.env.CHANGED_FILES_FILE || 'changed.txt';
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
}

function pullRequestNumber() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    const event = JSON.parse(readFileSync(path, 'utf8'));
    return event.pull_request?.number ?? null;
  } catch {
    return null;
  }
}

function buildBody(slugs) {
  const cards = [];
  for (const slug of slugs) {
    const dir = join('content', 'dumps', slug);
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const summaryPath = join(dir, 'summary.md');
    const brief = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8') : '';
    cards.push(renderManifestCard(manifest, slug, brief));
  }
  return cards.join('\n');
}

async function github(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kodavr-dump-manifest',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const number = pullRequestNumber();
  if (!token || !repo || !number) {
    console.log('dump-manifest: no token/repo/PR number — skipping (forks are read-only)');
    return;
  }

  const body = buildBody(dumpSlugsFromFiles(changedFiles()));
  if (!body) {
    console.log('dump-manifest: no dump manifest changed in this PR — nothing to post');
    return;
  }

  const issue = `/repos/${repo}/issues/${number}/comments`;
  const existing = (await github(`${issue}?per_page=100`, token)).find((c) => c.body?.includes(CARD_MARKER));
  if (existing) {
    await github(`/repos/${repo}/issues/comments/${existing.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
    console.log(`dump-manifest: updated comment ${existing.id}`);
  } else {
    const created = await github(issue, token, { method: 'POST', body: JSON.stringify({ body }) });
    console.log(`dump-manifest: posted comment ${created.id}`);
  }
}

main().catch((err) => {
  console.error(`dump-manifest failed: ${err.message}`);
  process.exit(1);
});

// tests/unit/telegram-mirror.test.js — the pure Telegram mirror renderer (KDV-CI-16).
// Step 1 is rendering only: a dump's manifest + summary.md brief become a Telegram
// parse_mode=HTML string. Sending/triggering is a later step and is not tested here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIRROR_LIMIT,
  toTelegramHtml,
  renderMirrorPost,
  sendTelegram,
  previousDeploySha,
  mirrorDumps,
} from '../../scripts/lib/telegram-mirror.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const MANIFEST = {
  slug: '2026-01-01-x',
  title: 'A title',
  summary: 'A short safe hook.',
};

// Telegram counts the visible text, so the test measures the post after tags.
const visibleLength = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').length;

describe('KDV-CI-16: the Telegram dump mirror renderer', () => {
  it('KDV-CI-16: drops the brief leading H1 (the manifest title already leads)', () => {
    const brief = ['# A title — a short brief', '', '## What it is', '', 'A body.'].join('\n');
    const post = renderMirrorPost(MANIFEST, brief, {});
    expect(post).not.toContain('a short brief');
    expect(post).toContain('<b>A title</b>');
    expect(post).toContain('<b>What it is</b>');
    expect(post).toContain('A body.');
  });

  it('KDV-CI-16: keeps the brief leading H1 when the manifest title is empty', () => {
    const brief = ['# A title — a short brief', '', 'A body.'].join('\n');
    const post = renderMirrorPost({ ...MANIFEST, title: '' }, brief, {});
    expect(post).toContain('<b>A title — a short brief</b>');
    expect(post).toContain('A body.');
  });

  it('KDV-CI-16: renders a usable brief as title + body + dump link', () => {
    const brief = ['## What it is', '', 'A thing worth mirroring.', '', '- one', '- two'].join('\n');
    const post = renderMirrorPost(MANIFEST, brief, {});
    expect(post).toContain('<b>A title</b>');
    expect(post).toContain('<b>What it is</b>');
    expect(post).toContain('A thing worth mirroring.');
    expect(post).toContain('• one');
    expect(post).toContain('• two');
    expect(post).toContain('https://kodavr.xyz/dumps/2026-01-01-x/');
    expect(post).not.toContain('Read the dump');
    expect(post).not.toContain('<h2');
    expect(post).not.toContain('<table');
  });

  it('KDV-CI-16: publishes manifest.tags as a leading hashtag line above the title', () => {
    const manifest = { ...MANIFEST, tags: ['bios-pattern', 'json-schema', 'ai-agents'] };
    const post = renderMirrorPost(manifest, '', {});
    expect(post.split('\n')[0]).toBe('#bios_pattern #json_schema #ai_agents');
    expect(post.indexOf('#bios_pattern')).toBeLessThan(post.indexOf('<b>A title</b>'));
  });

  it('KDV-CI-16: keeps the hashtag line first when the brief is truncated', () => {
    const manifest = { ...MANIFEST, tags: ['bios-pattern', 'json-schema'] };
    const brief = Array.from(
      { length: 20 },
      (_, i) => `Paragraph number ${i} with a few more words to make it long.`,
    ).join('\n\n');
    const post = renderMirrorPost(manifest, brief, { limit: 160 });
    expect(visibleLength(post)).toBeLessThanOrEqual(160);
    expect(post.split('\n')[0]).toBe('#bios_pattern #json_schema');
    expect(post).toContain('https://kodavr.xyz/dumps/2026-01-01-x/');
  });

  it('KDV-CI-16: renders no hashtag line without manifest.tags', () => {
    const post = renderMirrorPost(MANIFEST, '', {});
    expect(post.startsWith('<b>A title</b>')).toBe(true);
    expect(post).not.toContain('#');
  });

  it('KDV-CI-16: falls back to manifest.summary when the brief contains a table', () => {
    const brief = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n');
    const post = renderMirrorPost(MANIFEST, brief, {});
    expect(post).toContain('A short safe hook.');
    expect(post).not.toContain('<table');
    expect(post).not.toContain('| A |');
  });

  it('KDV-CI-16: falls back to manifest.summary when the brief is missing or empty', () => {
    expect(renderMirrorPost(MANIFEST, '', {})).toContain('A short safe hook.');
    expect(renderMirrorPost(MANIFEST, undefined, {})).toContain('A short safe hook.');
    expect(renderMirrorPost(MANIFEST, '   \n  ', {})).toContain('A short safe hook.');
  });

  it('KDV-CI-16: truncates an overlong brief on block boundaries, keeping the footer', () => {
    const brief = Array.from(
      { length: 20 },
      (_, i) => `Paragraph number ${i} with a few more words to make it long.`,
    ).join('\n\n');
    const post = renderMirrorPost(MANIFEST, brief, { limit: 160 });
    expect(visibleLength(post)).toBeLessThanOrEqual(160);
    expect(post).toContain('https://kodavr.xyz/dumps/2026-01-01-x/');
    expect(post).not.toContain('Read the dump');
    expect(post).toContain('…');
    expect(post).toContain('Paragraph number 0');
    expect(post).not.toContain('Paragraph number 19');
  });

  it('KDV-CI-16: escapes manifest.summary in the fallback (no raw markup)', () => {
    const manifest = { ...MANIFEST, summary: 'Use <b> & "quotes" <script> now.' };
    const post = renderMirrorPost(manifest, '', {});
    expect(post).toContain('&lt;b&gt;');
    expect(post).toContain('&amp;');
    expect(post).not.toContain('<b> &');
    expect(post).not.toContain('<script>');
  });

  it('KDV-CI-16: converts sanitized HTML into the Telegram subset', () => {
    const { html, hasTable } = toTelegramHtml(
      '<h2>T</h2><p>a <strong>b</strong> <em>c</em> <del>d</del> <code>e</code></p>'
        + '<ul><li>i</li></ul><hr><img src="/x.png">',
    );
    expect(html).toContain('<b>T</b>');
    expect(html).toContain('<b>b</b>');
    expect(html).toContain('<i>c</i>');
    expect(html).toContain('<s>d</s>');
    expect(html).toContain('<code>e</code>');
    expect(html).toContain('• i');
    expect(html).toContain('————');
    expect(html).toContain('/x.png');
    expect(html).not.toContain('<h2');
    expect(hasTable).toBe(false);
    expect(toTelegramHtml('<table><tr><td>x</td></tr></table>').hasTable).toBe(true);
  });

  it('KDV-CI-16: quotes blockquote lines and escapes text without double-escaping', () => {
    const { html } = toTelegramHtml(
      '<blockquote><p>one<br>two</p></blockquote><p>a &lt; b &amp; c</p>',
    );
    expect(html).toContain('> one\n> two');
    expect(html).toContain('a &lt; b &amp; c');
    expect(html).not.toContain('<blockquote');
  });

  it('KDV-CI-16: MIRROR_LIMIT stays under the Telegram hard cap', () => {
    expect(MIRROR_LIMIT).toBe(3800);
  });
});

describe('KDV-CI-17: the publish trigger and the previous-deploy lookup', () => {
  it('KDV-CI-17: publish-telegram.yml runs on deploy success on main and checks out the run head', () => {
    const yml = readFileSync(join(ROOT, '.github', 'workflows', 'publish-telegram.yml'), 'utf8');
    expect(yml).toMatch(/^name:\s*publish-telegram/m);
    expect(yml).toMatch(/workflow_run:/);
    expect(yml).toMatch(/workflows:\s*\[\s*deploy\s*\]/);
    expect(yml).toMatch(/types:\s*\[\s*completed\s*\]/);
    expect(yml).toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(yml).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(yml).toMatch(/fetch-depth:\s*0/);
    expect(yml).toMatch(/ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/);
    expect(yml).toContain('node scripts/product/telegram/telegram-mirror.mjs');
    expect(yml).toContain('secrets.TELEGRAM_BOT_TOKEN');
  });

  it('KDV-CI-17: previousDeploySha picks the newest successful run with id < current', async () => {
    const event = { workflow_run: { id: 300, head_sha: 'head' } };
    let authorization = null;
    const fetchImpl = async (url, init) => {
      expect(url).toContain('/actions/workflows/deploy.yml/runs');
      expect(url).toContain('status=success');
      authorization = init.headers.Authorization;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          workflow_runs: [
            { id: 500, head_sha: 'too-new' },
            { id: 250, head_sha: 'previous' },
            { id: 200, head_sha: 'older' },
            { id: 100, head_sha: 'oldest' },
          ],
        }),
      };
    };
    await expect(previousDeploySha({ event, repo: 'own/repo', token: 'tok', fetchImpl })).resolves.toBe('previous');
    expect(authorization).toBe('Bearer tok');
  });

  it('KDV-CI-17: previousDeploySha returns null without a candidate or without credentials', async () => {
    const event = { workflow_run: { id: 300, head_sha: 'head' } };
    const newerOnly = async () => ({ ok: true, status: 200, json: async () => ({ workflow_runs: [{ id: 900, head_sha: 'x' }] }) });
    await expect(previousDeploySha({ event, repo: 'own/repo', token: 'tok', fetchImpl: newerOnly })).resolves.toBeNull();

    let called = false;
    const mustNotFetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; };
    await expect(previousDeploySha({ event, repo: '', token: 'tok', fetchImpl: mustNotFetch })).resolves.toBeNull();
    await expect(previousDeploySha({ event, repo: 'own/repo', token: '', fetchImpl: mustNotFetch })).resolves.toBeNull();
    expect(called).toBe(false);
  });
});

describe('KDV-CI-18: the Telegram sender and the mirror orchestration', () => {
  it('KDV-CI-18: sendTelegram skips without a token and never calls fetch', async () => {
    let called = false;
    const fetchImpl = async () => { called = true; return { ok: true }; };
    await expect(sendTelegram({ token: '', chatId: '@kodavr_xyz', text: 'hi', fetchImpl })).resolves.toEqual({ ok: false, skipped: true });
    await expect(sendTelegram({ token: 'tok', chatId: '', text: 'hi', fetchImpl })).resolves.toEqual({ ok: false, skipped: true });
    await expect(sendTelegram({ token: 'tok', chatId: '@kodavr_xyz', text: '   ', fetchImpl })).resolves.toEqual({ ok: false, skipped: true });
    expect(called).toBe(false);
  });

  it('KDV-CI-18: sendTelegram sends once and posts parse_mode=HTML on success', async () => {
    let calls = 0;
    let sent = null;
    const fetchImpl = async (url, init) => { calls += 1; sent = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200 }; };
    await expect(sendTelegram({ token: 'tok', chatId: '@kodavr_xyz', text: '<b>hi</b>', fetchImpl })).resolves.toEqual({ ok: true });
    expect(calls).toBe(1);
    expect(sent.url).toContain('/bottok/sendMessage');
    expect(sent.body).toEqual({ chat_id: '@kodavr_xyz', text: '<b>hi</b>', parse_mode: 'HTML', disable_web_page_preview: false });
  });

  it('KDV-CI-18: sendTelegram retries once on 500 via sleep, then returns { ok:false } without throwing', async () => {
    let calls = 0;
    const sleeps = [];
    const fetchImpl = async () => { calls += 1; return { ok: false, status: 500 }; };
    const result = await sendTelegram({
      token: 'tok',
      chatId: '@kodavr_xyz',
      text: 'hi',
      fetchImpl,
      sleep: async (ms) => { sleeps.push(ms); },
    });
    expect(calls).toBe(2);
    expect(sleeps).toEqual([1000]);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('KDV-CI-18: sendTelegram does not retry a non-retryable 4xx', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return { ok: false, status: 403 }; };
    const result = await sendTelegram({ token: 'tok', chatId: '@kodavr_xyz', text: 'hi', fetchImpl, sleep: async () => {} });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it('KDV-CI-18: mirrorDumps skips an unparseable manifest and still sends a valid one', async () => {
    const files = {
      '/repo/content/dumps/bad/manifest.json': '{ not json',
      '/repo/content/dumps/good/manifest.json': JSON.stringify({ slug: 'good', title: 'Good', summary: 'A hook.' }),
      '/repo/content/dumps/good/summary.md': '## Brief\n\nA body.',
    };
    const sent = [];
    const report = await mirrorDumps({
      slugs: ['bad', 'good'],
      repoRoot: '/repo/',
      siteBase: 'https://kodavr.xyz',
      send: async (text, slug) => { sent.push({ slug, text }); return { ok: true }; },
      readFile: (path) => {
        if (!(path in files)) throw new Error(`no file ${path}`);
        return files[path];
      },
      exists: (path) => path in files,
    });
    expect(report.skipped).toEqual(['bad']);
    expect(report.sent).toEqual(['good']);
    expect(report.failed).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(sent[0].slug).toBe('good');
    expect(sent[0].text).toContain('Good');
  });

  it('KDV-CI-18: mirrorDumps records a failed send and keeps going, never throwing', async () => {
    const files = {
      '/repo/content/dumps/a/manifest.json': JSON.stringify({ slug: 'a', title: 'A' }),
      '/repo/content/dumps/b/manifest.json': JSON.stringify({ slug: 'b', title: 'B' }),
    };
    const report = await mirrorDumps({
      slugs: ['a', 'b'],
      repoRoot: '/repo',
      siteBase: 'https://kodavr.xyz',
      send: async (text, slug) => (slug === 'a' ? { ok: false, error: 'boom' } : { ok: true }),
      readFile: (path) => files[path],
      exists: (path) => path in files,
    });
    expect(report.sent).toEqual(['b']);
    expect(report.failed).toEqual(['a']);
    expect(report.skipped).toEqual([]);
  });
});

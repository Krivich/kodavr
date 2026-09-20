/**
 * CONTRACT: scripts/lib/telegram-mirror.mjs
 * ROLE: renders a dump manifest + human brief as a Telegram post and sends the batch
 * EXPORTS:
 *   MIRROR_LIMIT — the soft cap on the post's visible length, under Telegram's 4096
 *   toTelegramHtml — sanitized dump HTML → the Telegram HTML subset (reports tables)
 *   renderMirrorPost — manifest + summary.md brief (+ site option) → a mirror post
 *   sendTelegram — POST one parse_mode=HTML message via the Bot API (retries once)
 *   previousDeploySha — the prior successful deploy.yml run's head_sha, via the GitHub API
 *   mirrorDumps — render + send every newly added dump; reports sent/skipped/failed
 * CONSUMES:
 *   ./markdown.mjs — the sanitized markdown → HTML renderer
 * INVARIANTS:
 *   — the result is valid Telegram HTML: balanced tags, no tables/headings, escaped text
 *   — renderMirrorPost, sendTelegram, previousDeploySha and mirrorDumps never throw
 */

// scripts/lib/telegram-mirror.mjs — the pure rendering layer of the Telegram mirror.
// Telegram's parse_mode=HTML is a small subset: no tables, no headings, no markdown
// lists. This module parses the sanitized dump HTML, rebuilds it from that subset
// (so the output is always balanced, never echoing an unbalanced source tag), then
// assembles a post that fits Telegram's visible-text limit while never dropping the
// dump link. The sending/triggering layer (sendTelegram / previousDeploySha /
// mirrorDumps) sits below; it is pure over the network so it can be unit-tested.
import { renderMarkdown } from './markdown.mjs';

// Soft cap under Telegram's hard 4096-character limit, leaving room for entities.
export const MIRROR_LIMIT = 3800;

const VOID_TAGS = new Set([
  'br', 'hr', 'img', 'meta', 'link', 'input', 'area', 'base', 'col', 'embed',
  'source', 'track', 'wbr',
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)(\/?)>/y;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
};

// decodeEntities(text) → the characters behind the common named/numeric entities.
// Text nodes are decoded on parse so that escaping at render is unconditional and
// can never double-escape (`&amp;` → `&` → `&amp;`).
function decodeEntities(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      try {
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      } catch {
        return match;
      }
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)
      ? NAMED_ENTITIES[body]
      : match;
  });
}

// escapeText(value) → Telegram-safe text content.
function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// escapeAttr(value) → a double-quoted attribute value.
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// parseAttrs(raw) → a lowercase attribute map (entity-decoded).
function parseAttrs(raw) {
  const attrs = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')|([a-zA-Z_:][\w:.-]*)/g;
  let m;
  while ((m = re.exec(raw))) {
    if (m[4]) attrs[m[4].toLowerCase()] = '';
    else if (m[1]) attrs[m[1].toLowerCase()] = decodeEntities(m[2] !== undefined ? m[2] : m[3]);
  }
  return attrs;
}

// safeHref(href) → an absolute Telegram-friendly URL, or '' for anything else.
function safeHref(href) {
  const value = String(href ?? '').trim();
  return /^(?:https?:|mailto:|tg:)/i.test(value) ? value : '';
}

// parseHtml(html) → a tag tree. Malformed input is absorbed: a stray '<' is text,
// a close without an open is ignored, an unclosed open keeps its children.
function parseHtml(html) {
  const root = { children: [] };
  const stack = [root];
  const pushText = (parent, value) => {
    if (value) parent.children.push({ type: 'text', value: decodeEntities(value) });
  };
  let pos = 0;
  while (pos < html.length) {
    const lt = html.indexOf('<', pos);
    if (lt === -1) {
      pushText(stack[stack.length - 1], html.slice(pos));
      break;
    }
    if (lt > pos) pushText(stack[stack.length - 1], html.slice(pos, lt));
    TAG_RE.lastIndex = lt;
    const m = TAG_RE.exec(html);
    if (!m) {
      pushText(stack[stack.length - 1], '<');
      pos = lt + 1;
      continue;
    }
    pos = TAG_RE.lastIndex;
    const name = m[2].toLowerCase();
    if (m[1] === '/') {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].name === name) {
          stack.length = i;
          break;
        }
      }
    } else if (m[4] === '/' || VOID_TAGS.has(name)) {
      stack[stack.length - 1].children.push({
        type: 'tag', name, attrs: parseAttrs(m[3] || ''), children: [],
      });
    } else {
      const node = {
        type: 'tag', name, attrs: parseAttrs(m[3] || ''), children: [],
      };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }
  return root;
}

// renderPlain(nodes) → raw text with formatting dropped (for pre/code bodies).
function renderPlain(nodes) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') out += node.value;
    else if (node.name === 'br') out += '\n';
    else if (node.name === 'img') out += node.attrs.src || '';
    else out += renderPlain(node.children);
  }
  return out;
}

// normalize(text) → collapse the block separators the renderer emits.
function normalize(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// renderChildren(nodes) → every child rendered in order.
function renderChildren(nodes) {
  let out = '';
  for (const node of nodes) out += renderNode(node);
  return out;
}

// renderNode(node) → one node as Telegram HTML. Tags are always regenerated, never
// echoed, so an unbalanced source still yields balanced output.
function renderNode(node) {
  if (node.type === 'text') return escapeText(node.value);
  const { name, attrs, children } = node;
  switch (name) {
    case 'br': return '\n';
    case 'hr': return '\n\n————\n\n';
    case 'p': return '\n\n' + renderChildren(children) + '\n\n';
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return '\n\n<b>' + renderChildren(children) + '</b>\n\n';
    case 'strong': case 'b':
      return '<b>' + renderChildren(children) + '</b>';
    case 'em': case 'i':
      return '<i>' + renderChildren(children) + '</i>';
    case 'del': case 's': case 'strike':
      return '<s>' + renderChildren(children) + '</s>';
    case 'code':
      return '<code>' + escapeText(renderPlain(children)) + '</code>';
    case 'pre':
      return '\n\n<pre>' + escapeText(renderPlain(children).replace(/^\n+|\n+$/g, '')) + '</pre>\n\n';
    case 'a': {
      const href = safeHref(attrs.href);
      const inner = renderChildren(children);
      return href ? `<a href="${escapeAttr(href)}">${inner}</a>` : inner;
    }
    case 'img':
      return escapeText(attrs.src || '');
    case 'blockquote': {
      const inner = normalize(renderChildren(children));
      const quoted = inner
        .split('\n')
        .map((line) => (line.trim() ? `> ${line.trim()}` : ''))
        .join('\n');
      return '\n\n' + quoted + '\n\n';
    }
    case 'ul': case 'ol': {
      const items = children
        .filter((child) => child.type === 'tag' && child.name === 'li')
        .map(renderNode);
      return '\n\n' + items.join('\n') + '\n\n';
    }
    case 'li':
      return '• ' + renderChildren(children);
    default:
      return renderChildren(children);
  }
}

// htmlToText(html) → the visible text (tags dropped, entities decoded).
function htmlToText(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ''));
}

// visibleLength(html) → the length Telegram charges, measured on visible text.
function visibleLength(html) {
  return htmlToText(html).length;
}

// toTelegramHtml(html) → { html, hasTable } for sanitized dump HTML.
export function toTelegramHtml(html) {
  const source = String(html ?? '');
  const hasTable = /<table[\s>]/i.test(source);
  try {
    const tree = parseHtml(source);
    return { html: normalize(renderChildren(tree.children)), hasTable };
  } catch {
    return { html: normalize(escapeText(htmlToText(source))), hasTable };
  }
}

// splitBlocks(markdown) → paragraphs separated on blank lines; a fenced code block
// (```/~~~) is ONE atomic block even when it contains blank lines.
function splitBlocks(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const blocks = [];
  let current = [];
  let inFence = false;
  let fenceChar = '';
  for (const line of lines) {
    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (inFence) {
      current.push(line);
      if (fence && fence[1][0] === fenceChar) inFence = false;
      continue;
    }
    if (fence) {
      inFence = true;
      fenceChar = fence[1][0];
      current.push(line);
      continue;
    }
    if (line.trim() === '') {
      if (current.length) {
        blocks.push(current.join('\n'));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

// stripTrailingSlash(value) → a site base without its trailing slashes.
function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}

// stripLeadingH1(markdown) → the brief without a leading level-1 heading. The
// manifest title already leads the post, so a summary.md that opens with `# …`
// would otherwise render as a second bold heading. Leading blank lines are
// skipped; the H1 line and one following blank line are removed. A non-string or
// a brief that does not start with a level-1 heading passes through unchanged.
function stripLeadingH1(markdown) {
  if (typeof markdown !== 'string') return '';
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i >= lines.length || !/^#\s+\S/.test(lines[i])) return markdown;
  lines.splice(i, 1);
  if (i < lines.length && lines[i].trim() === '') lines.splice(i, 1);
  return lines.join('\n');
}

// hashtags(tags) → a leading hashtag line for manifest tags, or ''. Tags are
// lowercase kebab strings; Telegram hashtags break on '-', so a hyphen becomes an
// underscore and any character outside letters/digits/underscore is dropped.
// Duplicates are removed preserving order; an empty result yields ''.
function hashtags(tags) {
  if (!Array.isArray(tags)) return '';
  const seen = new Set();
  const out = [];
  for (const entry of tags) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().replace(/-/g, '_').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(`#${cleaned}`);
  }
  return out.join(' ');
}

// assemble(titleLine, body, footer) → blank-line separated post sections.
function assemble(titleLine, body, footer) {
  const parts = [];
  if (titleLine) parts.push(titleLine);
  if (body && body.trim()) parts.push(body);
  if (footer) parts.push(footer);
  return parts.join('\n\n');
}

// bodyBudget(titleLine, footer, limit) → visible characters left for the body,
// including the two separators and the truncation ellipsis.
function bodyBudget(titleLine, footer, limit) {
  const overhead = visibleLength(assemble(titleLine, '\u0001', footer)) - 1;
  return Math.max(0, limit - overhead);
}

// fitPlain(titleLine, summary, footer, limit) → the escaped fallback summary, sliced
// on visible text when it is itself too long.
function fitPlain(titleLine, summary, footer, limit) {
  const whole = assemble(titleLine, escapeText(summary), footer);
  if (visibleLength(whole) <= limit) return whole;
  const budget = bodyBudget(titleLine, footer, limit);
  const slice = [...summary].slice(0, Math.max(0, budget - 1)).join('');
  return assemble(titleLine, (slice ? escapeText(slice) : '') + '…', footer);
}

// hardSlice(titleLine, blockHtml, footer, limit) → the last resort when even the
// first block does not fit: its visible text, escaped and cut, plus `…`.
function hardSlice(titleLine, blockHtml, footer, limit) {
  const budget = bodyBudget(titleLine, footer, limit);
  const slice = [...htmlToText(blockHtml)].slice(0, Math.max(0, budget - 1)).join('');
  return assemble(titleLine, (slice ? escapeText(slice) : '') + '…', footer);
}

// fitBlocks(titleLine, brief, footer, limit) → the brief rendered block by block,
// greedy on whole blocks; dropped blocks leave `…` on the last kept one.
function fitBlocks(titleLine, brief, footer, limit) {
  const rendered = [];
  for (const block of splitBlocks(brief)) {
    const out = toTelegramHtml(renderMarkdown(block)).html;
    if (out.trim()) rendered.push(out);
  }
  if (!rendered.length) return assemble(titleLine, '', footer);
  const whole = assemble(titleLine, rendered.join('\n\n'), footer);
  if (visibleLength(whole) <= limit) return whole;

  const kept = [];
  for (const block of rendered) {
    const candidate = assemble(titleLine, [...kept, block].join('\n\n') + '…', footer);
    if (visibleLength(candidate) <= limit) kept.push(block);
    else break;
  }
  if (kept.length) return assemble(titleLine, kept.join('\n\n') + '…', footer);
  return hardSlice(titleLine, rendered[0], footer, limit);
}

// lastResort(title, url) → the never-throw tail: escaped title + the dump link.
function lastResort(title, url) {
  try {
    const parts = [];
    if (title) parts.push(`<b>${escapeText(title)}</b>`);
    parts.push(`<a href="${escapeAttr(url)}">${escapeText(url)}</a>`);
    return parts.join('\n\n');
  } catch {
    return String(url || '');
  }
}

// renderMirrorPost(manifest, brief, options) → a ready-to-send Telegram post.
// options: { siteBase = 'https://kodavr.xyz', limit = MIRROR_LIMIT }.
// Never throws; the last resort is the escaped title plus the dump link.
export function renderMirrorPost(manifest, brief, options = {}) {
  try {
    const m = manifest && typeof manifest === 'object' ? manifest : {};
    const opts = options && typeof options === 'object' ? options : {};
    const title = typeof m.title === 'string' ? m.title : '';
    const slug = typeof m.slug === 'string' ? m.slug : '';
    const summary = typeof m.summary === 'string' ? m.summary : '';
    const siteBase = stripTrailingSlash(
      opts.siteBase === undefined || opts.siteBase === null ? 'https://kodavr.xyz' : opts.siteBase,
    );
    const limit = Number.isFinite(opts.limit) ? opts.limit : MIRROR_LIMIT;
    const url = `${siteBase}/dumps/${encodeURIComponent(slug)}/`;

    const titleLine = title ? `<b>${escapeText(title)}</b>` : '';
    const footer = `<a href="${escapeAttr(url)}">${escapeText(url)}</a>`;
    // manifest.tags lead the post as hashtags so a reader can judge at a glance.
    // The tags line and the title form the always-kept head, never truncated.
    const tagsLine = hashtags(m.tags);
    const head = [tagsLine, titleLine].filter(Boolean).join('\n\n');

    const rawBrief = typeof brief === 'string' ? brief : '';
    // The manifest title leads, so drop the brief's own leading H1 — but only when
    // there is a title to lead; an empty title keeps the brief's only heading.
    const briefText = title ? stripLeadingH1(rawBrief) : rawBrief;
    if (briefText.trim() === '') return fitPlain(head, summary, footer, limit);

    const rendered = toTelegramHtml(renderMarkdown(briefText));
    if (rendered.hasTable) return fitPlain(head, summary, footer, limit);
    return fitBlocks(head, briefText, footer, limit);
  } catch {
    try {
      const m = manifest && typeof manifest === 'object' ? manifest : {};
      const opts = options && typeof options === 'object' ? options : {};
      const title = typeof m.title === 'string' ? m.title : '';
      const slug = typeof m.slug === 'string' ? m.slug : '';
      const siteBase = stripTrailingSlash(
        opts.siteBase === undefined || opts.siteBase === null ? 'https://kodavr.xyz' : opts.siteBase,
      );
      return lastResort(title, `${siteBase}/dumps/${encodeURIComponent(slug)}/`);
    } catch {
      return '';
    }
  }
}

// --- sending layer ------------------------------------------------------------

const TELEGRAM_API = 'https://api.telegram.org';

// isRetryable(status) → Telegram-side or transient failures worth one retry.
function isRetryable(status) {
  return status === 429 || (status >= 500 && status < 600);
}

// sendTelegram({ token, chatId, text, fetchImpl, sleep, log }) → { ok, skipped?, status?, error? }.
// The token comes only from the environment; there is no fallback and no throw. A
// missing token/chat/text is a silent skip, a 429/5xx/network failure is retried
// once after a capped backoff, any other 4xx is final.
export async function sendTelegram({
  token,
  chatId,
  text,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
} = {}) {
  const body = typeof text === 'string' ? text : '';
  if (!token || !chatId || body.trim() === '') {
    log('telegram: skipped — missing token, chat id or text');
    return { ok: false, skipped: true };
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: chatId,
    text: body,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });

  const attempt = async () => {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      return { res };
    } catch (err) {
      return { networkError: err && err.message ? err.message : String(err) };
    }
  };

  let last = await attempt();
  const status = last.res && Number.isFinite(last.res.status) ? last.res.status : undefined;
  if (last.networkError || isRetryable(status)) {
    const retryAfter = last.res && Number.isFinite(last.res.retry_after) ? last.res.retry_after : 1000;
    const wait = Math.min(retryAfter || 1000, 3000);
    log(`telegram: send failed (${last.networkError || `HTTP ${status}`}) — retrying once in ${wait}ms`);
    await sleep(wait);
    last = await attempt();
  }

  if (last.networkError) {
    log(`telegram: send failed — ${last.networkError}`);
    return { ok: false, error: last.networkError };
  }
  const res = last.res;
  if (res && res.ok) {
    log('telegram: sent');
    return { ok: true };
  }
  const finalStatus = res && Number.isFinite(res.status) ? res.status : undefined;
  const error = `Telegram sendMessage failed (HTTP ${finalStatus ?? 'unknown'})`;
  log(`telegram: ${error}`);
  return { ok: false, ...(finalStatus !== undefined ? { status: finalStatus } : {}), error };
}

// previousDeploySha({ event, repo, token, fetchImpl, log }) → the head_sha of the
// newest successful deploy.yml run older than this workflow_run, or null. Never
// throws: any missing input or API error degrades to null (nothing to mirror).
export async function previousDeploySha({
  event,
  repo,
  token,
  fetchImpl = fetch,
  log = () => {},
} = {}) {
  try {
    const currentId = event && event.workflow_run ? event.workflow_run.id : null;
    if (!token || !repo || !currentId) return null;

    const url = `https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=20`;
    const res = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'kodavr-telegram-mirror',
      },
    });
    if (!res || !res.ok) {
      log(`mirror: deploy runs API returned ${res && res.status}`);
      return null;
    }
    const data = await res.json();
    const runs = Array.isArray(data && data.workflow_runs) ? data.workflow_runs : [];
    let best = null;
    for (const run of runs) {
      if (!run || !Number.isFinite(run.id) || run.id >= currentId) continue;
      if (!best || run.id > best.id) best = run;
    }
    return best && typeof best.head_sha === 'string' ? best.head_sha : null;
  } catch (err) {
    log(`mirror: previous deploy lookup failed — ${err && err.message ? err.message : err}`);
    return null;
  }
}

// mirrorDumps({ slugs, repoRoot, siteBase, send, readFile, exists, log })
// → { sent, skipped, failed }. Reads each dump, renders its post and sends it; a
// missing/unparseable manifest is skipped, a failed send is recorded, and one bad
// slug never stops the batch. Never throws.
export async function mirrorDumps({
  slugs,
  repoRoot,
  siteBase,
  send,
  readFile,
  exists,
  log = () => {},
} = {}) {
  const report = { sent: [], skipped: [], failed: [] };
  const root = String(repoRoot === undefined || repoRoot === null ? '' : repoRoot).replace(/[\\/]+$/, '');

  for (const slug of Array.isArray(slugs) ? slugs : []) {
    try {
      const dir = `${root}/content/dumps/${slug}`;
      const manifestPath = `${dir}/manifest.json`;
      if (!exists(manifestPath)) {
        report.skipped.push(slug);
        log(`mirror: ${slug} — no manifest, skipped`);
        continue;
      }
      let manifest;
      try {
        manifest = JSON.parse(readFile(manifestPath, 'utf8'));
      } catch {
        report.skipped.push(slug);
        log(`mirror: ${slug} — manifest unparseable, skipped`);
        continue;
      }
      const summaryPath = `${dir}/summary.md`;
      const brief = exists(summaryPath) ? readFile(summaryPath, 'utf8') : '';
      const text = renderMirrorPost(manifest, brief, { siteBase });
      const result = await send(text, slug);
      if (result && result.ok) report.sent.push(slug);
      else report.failed.push(slug);
    } catch (err) {
      report.failed.push(slug);
      log(`mirror: ${slug} failed — ${err && err.message ? err.message : err}`);
    }
  }
  return report;
}

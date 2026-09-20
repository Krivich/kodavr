/**
 * CONTRACT: scripts/lib/markdown.mjs
 * ROLE: markdown → sanitized HTML for dump bodies
 * EXPORTS:
 *   renderMarkdown — renders markdown, dropping any executable markup
 * CONSUMES:
 *   marked — the markdown parser
 *   sanitize-html — the HTML allow-list sanitizer
 * INVARIANTS:
 *   — third-party markdown can never inject executable markup
 */

// scripts/lib/markdown.mjs — dump body markdown → sanitized HTML.
// Two layers of defence (§8.2): marked never passes raw HTML through, then
// sanitize-html enforces a strict tag/attribute/URL allowlist so third-party
// markdown cannot introduce executable code. Dangerous parts are stripped;
// visible text is preserved wherever possible.
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Raw HTML in the source is dropped, not passed through. Text inside a
    // dropped block (e.g. a <script> body) survives as inert text.
    html() {
      return '';
    },
  },
});

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'strong', 'em', 'del',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    img: ['src', 'alt', 'title'],
    code: ['class'],
    th: ['align', 'scope'],
    td: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer' },
    }),
  },
};

export function renderMarkdown(markdown) {
  const source = String(markdown ?? '');
  const rawHtml = marked.parse(source);
  const sanitized = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
  // KDV-MOBILE-02: a wide GFM table must not widen the page — give every table a
  // horizontal-scroll container (static/assets/styles.css `.table-scroll`). The
  // wrapper is added AFTER sanitize-html, so the allow-list never sees the `div`
  // and the security posture is unchanged (the class is ours, not input). Marked
  // emits flat, non-nested tables and the non-greedy match stops at the first
  // `</table>`, so one replacement per table is exact; `&lt;table&gt;` escaped
  // inside a code block has no literal tag and is not matched.
  return sanitized.replace(/<table[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll">${table}</div>`);
}

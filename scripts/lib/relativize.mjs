/**
 * CONTRACT: scripts/lib/relativize.mjs
 * ROLE: rewrites internal links to be host-agnostic (root or Pages subpath)
 * EXPORTS:
 *   htmlDepth — the depth of an HTML file under the public root
 *   relativizeHtml — rewrites one HTML document's root-relative links
 *   relativizeSite — rewrites every built HTML page in place
 * CONSUMES:
 *   ./machine.mjs — collect the built HTML files
 *   node:fs — read and write HTML
 *   node:fs/promises — walk the output tree
 *   node:path — compute relative paths
 * INVARIANTS:
 *   — machine files and og:* stay absolute; only HTML links are rewritten
 */

// scripts/lib/relativize.mjs — host-agnostic internal links (§8.3).
//
// The engine has no basePath: it emits root-relative URLs (`/assets/...`,
// `/data/...`) and the controller's own prose links are server-absolute. One
// built artifact must run unchanged at the domain root (`https://kodavr.xyz/`),
// under a GitHub Pages project subpath (`https://krivich.github.io/kodavr/`)
// and on localhost — so every internal HTML navigation/asset URL is rewritten
// to a document-relative one, keyed by how deep the page sits in the tree
// (`index.html` → 0, `reception/index.html` → 1, `dumps/<slug>/index.html` → 2).
//
// Machine files (index.json, per-dump manifests, Atom feeds, sitemap.xml) and
// `og:*` metadata stay ABSOLUTE: they are consumed out of context, where a
// relative URL is meaningless. Only the HTML surface is relativized.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { collectHtmlFiles, REPOSITORY_BRANCH } from './machine.mjs';

// Only `href` and `src`, and only values that start with a SINGLE `/`.
// `//host`, `http://…`, `https://…`, `data:`, `mailto:` and `#anchor` are not
// paths under the site root and must be left untouched.
const ROOT_RELATIVE_ATTR = /(href|src)="(\/(?!\/)[^"]*)"/g;

/**
 * Rewrite root-relative `href`/`src` values to document-relative ones.
 * `depth` is the number of directory levels between the public root and the
 * page that carries the markup.
 *
 * P4c: when a `resolve` callback is supplied it is asked first for each
 * root-absolute path; a non-empty answer is used verbatim (e.g. a GitHub blob
 * URL for a repo-only file). `null`/undefined falls through to the ordinary
 * document-relative rewrite, so published targets are unaffected.
 */
export function relativizeHtml(html, { depth = 0, resolve = null } = {}) {
  const prefix = '../'.repeat(depth);
  return html.replace(ROOT_RELATIVE_ATTR, (_match, attr, value) => {
    if (resolve && value.length > 1) {
      const replacement = resolve(value);
      if (replacement) return `${attr}="${replacement}"`;
    }
    const rest = value.slice(1);
    // A bare `/` has no rest: climb out (`../..`) or stay (`./`) at depth 0.
    const target = rest ? `${prefix}${rest}` : prefix || './';
    return `${attr}="${target}"`;
  });
}

// P4c: a root-absolute href whose target is absent from the published tree but
// present in the repository checkout is a repo-only file (docs/SPEC.md,
// static/logo.svg, a dump-local schema): point it at the GitHub blob instead of
// a page-relative path that would 404. Published targets and bare `/` return
// null, keeping the existing document-relative behaviour.
function makeRepoResolver(publicDir, repoRoot, repoUrl) {
  return (value) => {
    const hashAt = value.search(/[#?]/);
    const pathPart = (hashAt >= 0 ? value.slice(0, hashAt) : value).replace(/^\/+|\/+$/g, '');
    if (!pathPart) return null;
    if (existsSync(join(publicDir, pathPart))) return null;
    if (!existsSync(join(repoRoot, pathPart))) return null;
    const suffix = hashAt >= 0 ? value.slice(hashAt) : '';
    return `${repoUrl}/blob/${REPOSITORY_BRANCH}/${pathPart}${suffix}`;
  };
}

/**
 * Depth of an HTML file below the public root, in directory levels.
 */
export function htmlDepth(publicDir, file) {
  const rel = relative(publicDir, file).split(sep).join('/');
  return rel.split('/').length - 1;
}

// 404.html is deliberately kept root-relative. GitHub Pages serves it for
// arbitrary missing URLs, so a document-relative link would resolve against
// whatever bogus path the visitor requested — root-relative at least points at
// the artifact's own root. Every other page is safe to relativize.
const ROOT_RELATIVE_PAGES = new Set(['404.html']);

/**
 * Walk every published `.html` file and relativize its internal links in place.
 * When `repoRoot`/`repoUrl` are given, repo-only targets become GitHub blob
 * URLs (P4c). Returns the number of files actually rewritten.
 */
export async function relativizeSite(publicDir, { repoRoot = null, repoUrl = null } = {}) {
  const files = await collectHtmlFiles(publicDir);
  const resolve = repoRoot && repoUrl ? makeRepoResolver(publicDir, repoRoot, repoUrl) : null;
  let rewritten = 0;
  for (const file of files) {
    if (ROOT_RELATIVE_PAGES.has(basename(file))) continue;
    const html = await readFile(file, 'utf8');
    const next = relativizeHtml(html, { depth: htmlDepth(publicDir, file), resolve });
    if (next !== html) {
      await writeFile(file, next, 'utf8');
      rewritten += 1;
    }
  }
  return rewritten;
}

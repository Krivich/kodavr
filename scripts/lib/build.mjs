/**
 * CONTRACT: scripts/lib/build.mjs
 * ROLE: the one build pipeline: content → datasets → engine → machine files
 * EXPORTS:
 *   buildProject — runs the whole build and returns the dump count
 * CONSUMES:
 *   ./dumps.mjs — read the dumps and build their datasets
 *   ./i18n.mjs — the active locales and the dataset coordinate
 *   ./ignition.mjs — spawn the vendored engine
 *   ./machine.mjs — write index.json, feeds, tags, sitemap
 *   ./pages.mjs — route datasets, SEO, the logo
 *   ./relativize.mjs — host-agnostic internal links
 *   node:fs/promises — the filesystem
 *   node:module — resolve the handlebars asset
 *   node:path — join paths
 * INVARIANTS:
 *   — one build timestamp for every artifact (article:modified_time, manifest built_at, machine files)
 *   — static/ is the only author-owned tree the build copies into the public root
 */

import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readDumps, toDataset } from './dumps.mjs';
import { datasetName, parseDataset, translatedLocales } from './i18n.mjs';
import { runIgnition } from './ignition.mjs';
import { writeMachineFiles, writeSitemap, resolveAuthorFromCi, resolveRepository } from './machine.mjs';
import { buildRouteDatasets, readLogoSvg, routeOutputPath, ROUTE_PAGES } from './pages.mjs';
import { relativizeSite } from './relativize.mjs';

const require = createRequire(import.meta.url);

// The engine's own copyUniversalAssets looks for handlebars under
// node_modules/ignition-ssg/node_modules (which does not exist) and merely logs
// the failure. The client runtime is required for the gate (P2b), so we publish
// handlebars.min.js ourselves and verify both assets loudly afterwards.
async function publishClientAssets(publicDir) {
  const assetsDir = join(publicDir, 'assets');
  await mkdir(assetsDir, { recursive: true });

  let handlebarsSrc;
  try {
    handlebarsSrc = join(dirname(require.resolve('handlebars')), '..', 'dist', 'handlebars.min.js');
  } catch (err) {
    throw new Error(`Cannot resolve the handlebars package: ${err.message}`);
  }

  try {
    await copyFile(handlebarsSrc, join(assetsDir, 'handlebars.min.js'));
  } catch (err) {
    throw new Error(`Failed to publish handlebars.min.js from ${handlebarsSrc}: ${err.message}`);
  }

  for (const asset of ['handlebars.min.js', 'ignition-runtime.js']) {
    const assetPath = join(assetsDir, asset);
    try {
      await stat(assetPath);
    } catch {
      throw new Error(`Required client asset was not published: ${assetPath}`);
    }
  }
}

// Recursively publish author-owned static assets (logo, stylesheet) into the
// public root. A missing tree is not an error: static assets are optional.
async function publishStaticTree(fromDir, toDir) {
  let entries;
  try {
    entries = await readdir(fromDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  await mkdir(toDir, { recursive: true });
  for (const entry of entries) {
    const from = join(fromDir, entry.name);
    const to = join(toDir, entry.name);
    if (entry.isDirectory()) await publishStaticTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

// Move each dump from the engine's `dumps/<dataset>.html` to the pretty URL its
// dataset coordinate maps to (`<prefix>/dumps/<slug>/index.html`). The dataset
// name returned by the engine is parsed with `parseDataset` before mapping, so
// `<locale>__<slug>` lands under the locale prefix.
async function publishDumpPages(publicDir, dumps, activeLocales) {
  for (const locale of activeLocales) {
    for (const dump of dumps) {
      const name = datasetName(locale, dump.slug);
      const { locale: parsedLocale, key } = parseDataset(name);
      const to = routeOutputPath({ locale: parsedLocale, layout: 'dumps', key });
      const toPath = join(publicDir, ...to.split('/'));
      const from = join(publicDir, 'dumps', `${name}.html`);
      try {
        await mkdir(dirname(toPath), { recursive: true });
        await rename(from, toPath);
      } catch (err) {
        throw new Error(`Failed to publish pretty URL for dump "${dump.slug}": ${err.message}`);
      }
    }
  }
}

// Move each single-page route from the engine's `<layout>/<dataset>.html` to its
// spec URL and drop the leftover source dir for moved pages.
//
// A paginated route is different: the engine emits no `<layout>/<dataset>.html`,
// only `<layout>/<dataset>/page/N.html`. Page 1 is COPIED to the spec URL so the
// site root stays server-rendered (SEO, §6.4) while page file 1 stays in place
// for the pagination "1"/prev links; the rest of the page files stay at their
// engine URLs and are picked up by relativizeSite / the sitemap like any other
// HTML. Each active locale's dataset is parsed back from its generated name, so
// the engine output is the single source of the emitted coordinate.
async function publishRoutePages(publicDir, activeLocales) {
  for (const locale of activeLocales) {
    for (const page of ROUTE_PAGES) {
      const name = datasetName(locale, page.dataset ?? 'main');
      const { locale: parsedLocale, key } = parseDataset(name);
      const to = routeOutputPath({
        locale: parsedLocale,
        layout: page.layout,
        key,
        paginated: page.paginated,
      });
      if (!to) continue; // deferred per-locale 404: never emitted
      const toPath = join(publicDir, ...to.split('/'));
      if (page.paginated) {
        const from = join(publicDir, page.layout, name, 'page', '1.html');
        try {
          await mkdir(dirname(toPath), { recursive: true });
          await copyFile(from, toPath);
        } catch (err) {
          throw new Error(`Failed to publish paginated route "${to}" from ${from}: ${err.message}`);
        }
        continue;
      }
      const from = join(publicDir, page.layout, `${name}.html`);
      try {
        await mkdir(dirname(toPath), { recursive: true });
        await rename(from, toPath);
      } catch (err) {
        throw new Error(`Failed to publish route "${to}" from ${from}: ${err.message}`);
      }
      if (page.cleanup) {
        await rm(join(publicDir, page.cleanup), { recursive: true, force: true });
      }
    }
  }
}

export async function buildProject({
  root,
  contentDir,
  sourceDir = 'input',
  outputDir = 'output',
  domain,
  commitSha = process.env.GITHUB_SHA ?? null,
  author = resolveAuthorFromCi(),
  repoUrl = resolveRepository(),
}) {
  const contentRoot = join(root, contentDir);
  const dataRoot = join(root, sourceDir, 'data');
  const dumpsDataDir = join(dataRoot, 'dumps');
  const publicDir = join(root, outputDir, 'public');

  const dumps = await readDumps(contentRoot);

  // One build timestamp for every artifact: `article:modified_time`, the
  // manifest `built_at` and machine files all agree.
  const generatedAt = new Date().toISOString();

  // §6.5: the header logo is inlined into every page. Read the trusted asset
  // once from the author-owned `static/` tree being built.
  const logoSvg = await readLogoSvg(join(root, 'static'));

  await rm(dataRoot, { recursive: true, force: true });
  await mkdir(dumpsDataDir, { recursive: true });

  // §11: a locale is built only when it has a message bundle; until then its
  // `t()` throws (fail-visible). Only `en` has a bundle in this phase, so every
  // written file and every published path is exactly today's.
  const activeLocales = translatedLocales();

  for (const locale of activeLocales) {
    for (const dump of dumps) {
      const dataset = toDataset(dump, {
        baseUrl: domain,
        logo: logoSvg,
        repoRoot: root,
        repoUrl,
        builtAt: generatedAt,
        locale,
      });
      await writeFile(join(dumpsDataDir, `${datasetName(locale, dump.slug)}.json`), JSON.stringify(dataset, null, 2), 'utf8');
    }
  }

  // Static human-surface routes: one `main` dataset per layout per active locale.
  // Datasets carry the copydeck slices and SEO fields the templates render. The
  // deferred per-locale 404 (no mapped path) is never written, so the engine
  // cannot emit it.
  for (const locale of activeLocales) {
    const routeDatasets = buildRouteDatasets(dumps, { baseUrl: domain, logo: logoSvg, locale });
    for (const layout of Object.keys(routeDatasets)) {
      if (!routeOutputPath({ locale, layout, key: 'main' })) continue;
      const layoutDir = join(dataRoot, layout);
      await mkdir(layoutDir, { recursive: true });
      await writeFile(join(layoutDir, `${datasetName(locale, 'main')}.json`), JSON.stringify(routeDatasets[layout], null, 2), 'utf8');
    }
  }

  // Clean stale generated public output before the engine build.
  await rm(publicDir, { recursive: true, force: true });

  await runIgnition({ cwd: root, source: sourceDir, output: outputDir, domain });

  await publishClientAssets(publicDir);

  // Author-owned static assets land in the public root (logo, stylesheet).
  await publishStaticTree(join(root, 'static'), publicDir);

  // Pretty URLs — the engine writes dumps/<dataset>.html, we own the mapped path.
  await publishDumpPages(publicDir, dumps, activeLocales);

  // Single-page routes: engine `<layout>/<dataset>.html` → spec URLs.
  await publishRoutePages(publicDir, activeLocales);

  // Host-agnostic internal links (P2c): once every HTML page sits at its final
  // depth, rewrite root-relative href/src to document-relative so the same
  // artifact works at the domain root and under a GitHub Pages project subpath.
  // P4c: a path that is not published but exists in the checkout becomes a
  // GitHub blob URL instead. Machine files and og:* stay absolute — they run
  // after this pass.
  await relativizeSite(publicDir, { repoRoot: root, repoUrl });

  await writeMachineFiles({ outputDir: publicDir, dumps, baseUrl: domain, generatedAt, commitSha, author });
  await writeSitemap({ outputDir: publicDir, baseUrl: domain, dumps, generatedAt });

  // GitHub Pages runs Jekyll by default, and Jekyll ignores dot-files/dirs —
  // which would silently drop /.well-known/kodavr.json. `.nojekyll` serves the
  // artifact verbatim, keeping the site purely static.
  await writeFile(join(publicDir, '.nojekyll'), '', 'utf8');

  return { count: dumps.length };
}

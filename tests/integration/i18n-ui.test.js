// tests/integration/i18n-ui.test.js — KDV-I18N-06: the built SSR markup for the
// header language switcher and its intelligent-hint hooks. The hint itself is a
// client behaviour (site.js); SSR ships the hooks and no offer. The switcher must
// link the same page in every built locale and mark the current one.
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, cp, readFile, rm } from 'node:fs/promises';
import { buildProject } from '../../scripts/lib/build.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const BASE_URL = 'https://example.test';

let tmpRoot = null;

afterEach(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

async function buildFixtureSite() {
  const tmpBase = join(ROOT, 'tmp');
  await mkdir(tmpBase, { recursive: true });
  tmpRoot = await mkdtemp(join(tmpBase, 'i18n-ui-'));
  await cp(join(FIXTURES, 'sample-dump'), join(tmpRoot, 'content', 'dumps', 'sample-dump'), {
    recursive: true,
  });
  await cp(join(ROOT, 'input', 'templates'), join(tmpRoot, 'input', 'templates'), { recursive: true });
  await cp(join(ROOT, 'input', 'controllers'), join(tmpRoot, 'input', 'controllers'), { recursive: true });
  await cp(join(ROOT, 'static'), join(tmpRoot, 'static'), { recursive: true });
  await buildProject({
    root: tmpRoot,
    contentDir: 'content/dumps',
    sourceDir: 'input',
    outputDir: 'output',
    domain: BASE_URL,
    commitSha: 'deadbeef',
  });
  return join(tmpRoot, 'output', 'public');
}

describe('built i18n header switcher + intelligent hint hooks (KDV-I18N-06)', () => {
  it('KDV-I18N-06: the en home carries the switcher (en current, ru linked) and hint hooks', async () => {
    const publicDir = await buildFixtureSite();
    const enHome = await readFile(join(publicDir, 'index.html'), 'utf8');

    // The switcher is real markup, not a JS-only widget.
    expect(enHome).toContain('class="lang-switch"');
    expect(enHome).toMatch(/<span class="lang-switch-current"[^>]*>English<\/span>/);
    expect(enHome).toMatch(/href="\.\/"[^>]*hreflang="en"[^>]*data-lang-code="en"[^>]*aria-current="true"/);
    expect(enHome).toMatch(/href="ru\/"[^>]*hreflang="ru"[^>]*data-lang-code="ru"/);
    expect(enHome).toContain('>Русский</a>');
    expect(enHome).toMatch(/href="zh\/"[^>]*hreflang="zh-Hans"[^>]*data-lang-code="zh-Hans"/);
    expect(enHome).toContain('>中文</a>');
    expect(enHome).toMatch(/href="es\/"[^>]*hreflang="es"[^>]*data-lang-code="es"/);
    expect(enHome).toContain('>Español</a>');

    // KDV-I18N-06: the intelligent-hint hooks ship SSR; the old offer is gone.
    expect(enHome).toMatch(
      /<details class="lang-switch" data-current-locale="en" data-lang-hint-template="Also available in \{language\}">/,
    );
    expect(enHome).not.toContain('lang-offer');
  });

  it('KDV-I18N-06: the ru home marks ru current, links the en page and carries the ru hint template', async () => {
    const publicDir = await buildFixtureSite();
    const ruHome = await readFile(join(publicDir, 'ru', 'index.html'), 'utf8');

    expect(ruHome).toMatch(/<html lang="ru">/);
    expect(ruHome).toMatch(/<span class="lang-switch-current"[^>]*>Русский<\/span>/);
    expect(ruHome).toMatch(/href="\.\.\/ru\/"[^>]*hreflang="ru"[^>]*data-lang-code="ru"[^>]*aria-current="true"/);
    expect(ruHome).toMatch(/href="\.\.\/"[^>]*hreflang="en"[^>]*data-lang-code="en"/);
    expect(ruHome).toContain('>English</a>');
    expect(ruHome).toContain('data-lang-hint-template="Доступно также: {language}"');
    expect(ruHome).not.toContain('lang-offer');
  });

  it('KDV-I18N-06: the dump page carries the switcher for the same dump in each locale', async () => {
    const publicDir = await buildFixtureSite();
    const dump = await readFile(join(publicDir, 'dumps', 'sample-dump', 'index.html'), 'utf8');

    expect(dump).toContain('class="lang-switch"');
    expect(dump).toMatch(/href="\.\.\/\.\.\/dumps\/sample-dump\/"[^>]*hreflang="en"[^>]*data-lang-code="en"[^>]*aria-current="true"/);
    expect(dump).toMatch(/href="\.\.\/\.\.\/ru\/dumps\/sample-dump\/"[^>]*hreflang="ru"[^>]*data-lang-code="ru"/);
    expect(dump).toMatch(/href="\.\.\/\.\.\/zh\/dumps\/sample-dump\/"[^>]*hreflang="zh-Hans"[^>]*data-lang-code="zh-Hans"/);
  });
});

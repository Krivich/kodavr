// tests/unit/i18n.test.js — the keyed copydeck core: registry, translation, completeness.
import { describe, it, expect } from 'vitest';
import {
  GATE_TITLE,
  GATE_KICKER,
  RECEPTION_TITLE,
  FOOTER_TEXT,
  PROMPT_TEXT,
  DUMP_DEFINITION,
} from '../../scripts/lib/copy.mjs';
import { LOCALES, DEFAULT_LOCALE, translatedLocales, t, assertComplete } from '../../scripts/lib/i18n.mjs';
import { EN } from '../../scripts/lib/i18n-en.mjs';

describe('i18n copydeck core (§11)', () => {
  it('KDV-I18N-07: English is the verbatim copydeck source', () => {
    const sampled = [
      ['GATE_TITLE', GATE_TITLE],
      ['GATE_KICKER', GATE_KICKER],
      ['RECEPTION_TITLE', RECEPTION_TITLE],
      ['FOOTER_TEXT', FOOTER_TEXT],
      ['PROMPT_TEXT', PROMPT_TEXT],
      ['DUMP_DEFINITION', DUMP_DEFINITION],
    ];
    for (const [key, value] of sampled) {
      expect(t(key, 'en'), key).toBe(value);
    }
    expect(Object.keys(EN).length).toBeGreaterThan(40);
  });

  it('KDV-I18N-07: a missing key or an unknown locale is a loud error', () => {
    expect(() => t('NO_SUCH_KEY')).toThrow();
    // An unknown locale code is never accepted (fail-visible).
    expect(() => t('GATE_TITLE', 'xx')).toThrow();
    // Every registered locale has a bundle now (KDV-I18N-01), so a known code
    // resolves instead of throwing.
    expect(() => t('GATE_TITLE', 'es')).not.toThrow();
    expect(() => t('GATE_TITLE', 'zh-Hans')).not.toThrow();
  });

  it('KDV-I18N-07: every translated locale covers every English key', () => {
    for (const locale of translatedLocales()) {
      expect(() => assertComplete(locale), locale).not.toThrow();
    }
    expect(LOCALES[0].code).toBe(DEFAULT_LOCALE);
    expect(LOCALES.map((locale) => locale.code)).toEqual(['en', 'ru', 'zh-Hans', 'es']);
    expect(LOCALES.map((locale) => locale.prefix)).toEqual(['', '/ru', '/zh', '/es']);
    expect(new Set(LOCALES.map((locale) => locale.code)).size).toBe(LOCALES.length);
    expect(LOCALES.filter((locale) => locale.xDefault)).toHaveLength(1);
    expect(translatedLocales()).toEqual(['en', 'ru', 'zh-Hans', 'es']);
    // §11/KDV-I18N-01 phase 4b: the ru bundle is a real translation, not a copy.
    expect(t('GATE_TITLE', 'ru')).not.toBe(t('GATE_TITLE', 'en'));
    expect(t('MANIFEST_LABELS', 'ru').heading).toBe('Манифест');
    // §11/KDV-I18N-01 phase 7a: the zh-Hans bundle is a real translation too.
    expect(t('GATE_TITLE', 'zh-Hans')).not.toBe(t('GATE_TITLE', 'en'));
    expect(t('MANIFEST_LABELS', 'zh-Hans').heading).toBe('清单');
    expect(t('LANGUAGE_NAMES', 'zh-Hans')['zh-Hans']).toBe('简体中文');
    // §11/KDV-I18N-01 phase 7b: the es bundle is a real translation, completing
    // the wave-1 locales.
    expect(t('GATE_TITLE', 'es')).not.toBe(t('GATE_TITLE', 'en'));
    expect(t('MANIFEST_LABELS', 'es').heading).toBe('Manifiesto');
    expect(t('LANGUAGE_NAMES', 'es').es).toBe('español');
    expect(assertComplete('es')).toBeUndefined();
  });
});

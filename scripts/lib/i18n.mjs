/**
 * CONTRACT: scripts/lib/i18n.mjs
 * ROLE: the locale registry and the loud keyed translator over the copydeck
 * EXPORTS:
 *   LOCALES — the ordered locale registry (default first)
 *   DEFAULT_LOCALE — the default locale code ('en')
 *   getLocale — the LOCALES entry for a code, or a loud error
 *   translatedLocales — the codes that have a non-empty message bundle
 *   datasetName — the `<locale>__<key>` dataset coordinate (bare key for the default locale)
 *   parseDataset — a dataset name → `{ locale, key }`
 *   t — resolves a keyed value for a locale, loud on any miss
 *   assertComplete — fails listing every English key missing from a locale
 * CONSUMES:
 *   ./i18n-en.mjs — the English bundle
 *   ./i18n-ru.mjs — the Russian bundle
 *   ./i18n-zh-Hans.mjs — the Simplified Chinese bundle
 *   ./i18n-es.mjs — the Spanish bundle
 * INVARIANTS:
 *   — no silent fallback: an unknown locale, a bundle-less locale or a missing key throws
 *   — non-string values pass through verbatim; {placeholder} substitution applies to strings only
 */
import { EN } from './i18n-en.mjs';
import { RU } from './i18n-ru.mjs';
import { ZH_HANS } from './i18n-zh-Hans.mjs';
import { ES } from './i18n-es.mjs';

export const LOCALES = [
  { code: 'en', htmlLang: 'en', ogLocale: 'en_US', prefix: '', endonym: 'English', dir: 'ltr', xDefault: true },
  { code: 'ru', htmlLang: 'ru', ogLocale: 'ru_RU', prefix: '/ru', endonym: 'Русский', dir: 'ltr' },
  { code: 'zh-Hans', htmlLang: 'zh-Hans', ogLocale: 'zh_CN', prefix: '/zh', endonym: '中文', dir: 'ltr' },
  { code: 'es', htmlLang: 'es', ogLocale: 'es_ES', prefix: '/es', endonym: 'Español', dir: 'ltr' },
];

export const DEFAULT_LOCALE = 'en';

// A locale is built only once its bundle is registered here (KDV-I18N-03).
const BUNDLES = { en: EN, ru: RU, 'zh-Hans': ZH_HANS, es: ES };

// getLocale(code) → the registry entry, or a loud error for an unknown code.
export function getLocale(code) {
  const entry = LOCALES.find((locale) => locale.code === code);
  if (!entry) throw new Error(`i18n: unknown locale "${code}"`);
  return entry;
}

// translatedLocales() → the codes whose message bundle is present (non-empty).
export function translatedLocales() {
  return LOCALES.map((locale) => locale.code).filter((code) => BUNDLES[code]);
}

// datasetName(localeCode, key) → the dataset coordinate. The default locale keeps
// the bare key (byte-stable English output); every other locale is `<locale>__<key>`.
export function datasetName(localeCode, key) {
  return localeCode === DEFAULT_LOCALE ? key : `${localeCode}__${key}`;
}

// parseDataset(name) → { locale, key }. A known locale prefix is split off
// (`ru__main`, or the accepted `en__main`); anything else is a default-locale key.
export function parseDataset(name) {
  const sep = name.indexOf('__');
  if (sep > 0) {
    const code = name.slice(0, sep);
    if (LOCALES.some((locale) => locale.code === code)) {
      return { locale: code, key: name.slice(sep + 2) };
    }
  }
  return { locale: DEFAULT_LOCALE, key: name };
}

// t(key, locale, params) → the localized value. Never falls back: a missing
// bundle or key throws instead of silently returning the English text. A
// non-string value (array/object/boolean) is returned verbatim — placeholder
// substitution is a string operation and must not touch structured entries.
export function t(key, locale = DEFAULT_LOCALE, params) {
  const entry = getLocale(locale);
  const bundle = BUNDLES[entry.code];
  if (!bundle) {
    throw new Error(`i18n: locale "${entry.code}" has no message bundle yet (key: "${key}")`);
  }
  if (!Object.prototype.hasOwnProperty.call(bundle, key)) {
    throw new Error(`i18n: key "${key}" is missing in locale "${entry.code}"`);
  }
  const value = bundle[key];
  if (typeof value !== 'string' || !params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

// assertComplete(locale) → loud error listing every English key absent from the locale.
export function assertComplete(locale) {
  const entry = getLocale(locale);
  const bundle = BUNDLES[entry.code];
  if (!bundle) throw new Error(`i18n: locale "${entry.code}" has no message bundle yet`);
  const missing = Object.keys(EN).filter((key) => !Object.prototype.hasOwnProperty.call(bundle, key));
  if (missing.length) {
    throw new Error(`i18n: locale "${entry.code}" is missing ${missing.length} key(s): ${missing.join(', ')}`);
  }
}

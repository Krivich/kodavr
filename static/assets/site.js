// static/assets/site.js — Kodavr's shared client helpers.
//
// A plain IIFE (no modules) loaded synchronously from <head>, so window.Kodavr
// exists before the auto-injected controllers run. It owns the locally stored
// species choice, the copy-to-clipboard buttons and the §6.6 live-region
// announcement helper. All copydeck text reaches the DOM through the dataset;
// this file only flips UI state.
(function () {
  'use strict';

  var SPECIES_KEY = 'kodavr.species';
  // §11/KDV-I18N-06: the remembered language-switcher choice. A stored locale
  // code also silences the intelligent hint for good.
  var LANG_KEY = 'kodavr.lang';
  // §11/KDV-I18N-06: the session-scoped "hint already shown" flag — one hint per
  // session, so it does not nag on every navigation.
  var LANG_HINT_KEY = 'kodavr.langHint';
  // §6.2: the shipped consumption-contract version is in the SSR <head>, so the
  // client can invalidate a declaration made against an older contract without
  // an extra request.
  var CONTRACT_VERSION_META = 'kodavr-contract-version';
  var COPIED_MS = 2000;

  function isSpecies(value) {
    return value === 'machine' || value === 'human';
  }

  function shippedVersion() {
    var meta = document.querySelector('meta[name="' + CONTRACT_VERSION_META + '"]');
    var content = meta && meta.getAttribute('content');
    return content ? content : null;
  }

  function writeDeclaration(record) {
    try {
      window.localStorage.setItem(SPECIES_KEY, JSON.stringify(record));
    } catch (err) {
      // Non-persistent session: the choice still applies for this page life.
    }
  }

  // §6.2: the stored value is a versioned declaration record
  // `{species, contract_version, declared_at}`. This reads it, migrating a
  // legacy raw `machine`/`human` value in place (no re-consent) and treating a
  // record stamped with a different contract version as undeclared — the stale
  // record is cleared so the gate opens again for a fresh declaration. Returns
  // the record or null; never throws.
  function readDeclaration() {
    var raw;
    try {
      raw = window.localStorage.getItem(SPECIES_KEY);
    } catch (err) {
      // Storage can throw (private mode / blocked cookies): no declaration.
      return null;
    }
    if (!raw) return null;

    var shipped = shippedVersion();
    if (isSpecies(raw)) {
      var migrated = {
        species: raw,
        contract_version: shipped,
        declared_at: new Date().toISOString(),
      };
      writeDeclaration(migrated);
      return migrated;
    }

    var stored;
    try {
      stored = JSON.parse(raw);
    } catch (err) {
      // Malformed value: nothing trustworthy to honour.
      clearSpecies();
      return null;
    }
    if (!stored || !isSpecies(stored.species)) {
      clearSpecies();
      return null;
    }
    if (shipped && stored.contract_version !== shipped) {
      clearSpecies();
      return null;
    }
    return {
      species: stored.species,
      contract_version: typeof stored.contract_version === 'string' ? stored.contract_version : null,
      declared_at: typeof stored.declared_at === 'string' ? stored.declared_at : null,
    };
  }

  function getSpecies() {
    var record = readDeclaration();
    return record ? record.species : null;
  }

  // §6.2: the declaration is withdrawable; this returns the full record.
  function getDeclaration() {
    return readDeclaration();
  }

  function setSpecies(species) {
    writeDeclaration({
      species: species,
      contract_version: shippedVersion(),
      declared_at: new Date().toISOString(),
    });
  }

  // §6.2: the machine panel's reset link forgets the stored choice so the next
  // gate open asks the visitor to declare again. Storage can throw (private
  // mode / blocked cookies) — there is simply nothing persisted to clear.
  function clearSpecies() {
    try {
      window.localStorage.removeItem(SPECIES_KEY);
    } catch (err) {
      // Storage unavailable: no persisted choice to forget.
    }
  }

  function copyViaClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('clipboard unavailable'));
  }

  // Fallback for insecure contexts / older browsers: an off-screen textarea
  // plus the legacy selection + execCommand copy path.
  function copyViaSelection(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  // §6.6: surface a change that happens without navigation (the "Copied ✓"
  // state, an overlay opening) through the page's SSR-present role="status"
  // region. A dump page also carries the §6.2 declaration toast as a second
  // role="status", so the shared region is addressed by its stable id first;
  // the role fallback covers a page that ships a region without that id. No
  // region on the page => silent no-op.
  function announce(text) {
    if (!text) return;
    var region = document.getElementById('a11y-status') || document.querySelector('[role="status"]');
    if (!region) return;
    region.textContent = text;
  }

  // Progressive enhancement: hand the prompt to the OS share sheet when the
  // environment exposes Web Share (mostly mobile). Failures are silent — the
  // clipboard write has already happened.
  function maybeShare(text) {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    try {
      var result = navigator.share({ text: text });
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (err) {
      // Share dismissed/unsupported — the copy still counts.
    }
  }

  function initCopyButtons(root) {
    var scope = root || document;
    var buttons = scope.querySelectorAll('[data-copy-target]');
    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        if (button.__kodavrCopyBound) return;
        button.__kodavrCopyBound = true;

        button.addEventListener('click', function () {
          var selector = button.getAttribute('data-copy-target');
          var target = document.getElementById(selector) || document.querySelector(selector);
          if (!target) return;

          var text = target.textContent;
          var original = button.textContent;
          var copied = button.getAttribute('data-copied-label') || 'Copied ✓';
          // §7.12: agent jump links are also copy controls, but the OS share
          // sheet must not hijack the navigation to the chosen agent.
          var shareOff = button.getAttribute('data-copy-share') === 'off';

          var done = function () {
            button.textContent = copied;
            announce(button.getAttribute('data-copied-announcement'));
            window.setTimeout(function () {
              button.textContent = original;
            }, COPIED_MS);
            if (!shareOff) maybeShare(text);
          };

          var attempt = copyViaClipboard(text);
          attempt.then(done, function () {
            if (copyViaSelection(text)) done();
          });
        });
      })(buttons[i]);
    }
  }

  // §6.2/§7.13: the header's species status pill and its separate withdraw
  // link. SSR ships both hidden and empty, with the copydeck labels in data
  // attributes; this fills the pill's visible text from the stored declaration
  // (machine → the versioned label, human → the reception label), carries the
  // declaration date as the withdraw link's title and reveals the pill. Nothing
  // declared (or a stale/malformed record, which readDeclaration clears) means
  // both stay hidden. The withdraw link clears the stored declaration and lets
  // the anchor navigate home. Never throws.
  function chipFill(template, token, value) {
    return String(template).split(token).join(value == null ? '' : String(value));
  }

  function initSpeciesChip() {
    var chip = document.getElementById('species-chip');
    if (!chip) return;
    var text = chip.querySelector('.species-chip-text');
    // §7.13: the withdraw action is a sibling of the pill, never inside it.
    var group = chip.parentNode;
    var withdraw = group && group.querySelector ? group.querySelector('[data-withdraw]') : null;

    var record = readDeclaration();
    if (!record) {
      chip.hidden = true;
      if (withdraw) withdraw.hidden = true;
      return;
    }

    var machineTemplate = chip.getAttribute('data-machine-label') || '';
    var humanLabel = chip.getAttribute('data-human-label') || '';
    var titleTemplate = chip.getAttribute('data-title-template') || '';
    var version = record.contract_version || shippedVersion() || '';
    var label = record.species === 'machine'
      ? chipFill(machineTemplate, '<version>', version)
      : humanLabel;
    if (text) text.textContent = label;

    // §7.13: the title is the declaration date only (ISO prefix), not the full
    // timestamp — the tooltip stays human-sized. It sits on the withdraw link
    // (the pill is plain text).
    var declaredAt = record.declared_at ? String(record.declared_at).slice(0, 10) : '';
    if (declaredAt && titleTemplate && withdraw) {
      withdraw.setAttribute('title', chipFill(titleTemplate, '<declared-at>', declaredAt));
    }

    chip.hidden = false;
    if (withdraw) {
      withdraw.hidden = false;
      if (!withdraw.__kodavrWithdrawBound) {
        withdraw.__kodavrWithdrawBound = true;
        withdraw.addEventListener('click', function () {
          clearSpecies();
          chip.hidden = true;
          withdraw.hidden = true;
        });
      }
    }
  }

  // §7.13: the gate/reception controllers call this after setSpecies()/
  // clearSpecies() so the chip follows the declaration without a page reload.
  function refreshSpeciesChip() {
    initSpeciesChip();
  }

  // §11/KDV-I18N-06: the remembered language choice (localStorage) and the
  // session-scoped hint flag. Storage can throw (private mode / blocked cookies);
  // every access is guarded and never throws.
  function readLangChoice() {
    try {
      return window.localStorage.getItem(LANG_KEY);
    } catch (err) {
      return null;
    }
  }

  function writeLangChoice(value) {
    try {
      window.localStorage.setItem(LANG_KEY, value);
    } catch (err) {
      // Non-persistent session: the choice is not remembered, but nothing breaks.
    }
  }

  function hintShownThisSession() {
    try {
      return window.sessionStorage.getItem(LANG_HINT_KEY) !== null;
    } catch (err) {
      // Storage unavailable: treat as not shown.
      return false;
    }
  }

  function markLangHintShown() {
    try {
      window.sessionStorage.setItem(LANG_HINT_KEY, '1');
    } catch (err) {
      // Non-persistent session: the hint may repeat, but nothing breaks.
    }
  }

  // The switcher entries (the same page in each BUILT locale), from the SSR menu.
  function langLinks() {
    var anchors = document.querySelectorAll('.lang-switch-menu a[data-lang-code]');
    var links = [];
    for (var i = 0; i < anchors.length; i++) {
      links.push({
        code: anchors[i].getAttribute('data-lang-code'),
        endonym: (anchors[i].textContent || '').trim(),
        href: anchors[i].getAttribute('href'),
      });
    }
    return links;
  }

  function primarySubtag(tag) {
    return String(tag || '').toLowerCase().split('-')[0];
  }

  // Pick the first browser language that names a built locale OTHER than the
  // current page's. `navigator.languages` is ordered by preference; a full tag
  // matches first, then the primary subtag (ru-RU → ru, zh-CN → zh-Hans).
  function matchBrowserLocale(current, links) {
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language];
    for (var i = 0; i < langs.length; i++) {
      var tag = String(langs[i] || '').toLowerCase();
      if (!tag) continue;
      for (var j = 0; j < links.length; j++) {
        var link = links[j];
        var code = String(link.code).toLowerCase();
        if (code !== current && (code === tag || primarySubtag(code) === primarySubtag(tag))) {
          return link;
        }
      }
    }
    return null;
  }

  // §11/KDV-I18N-06: clear the hint and record the session flag. The switcher's
  // default (SSR) accessible name is restored from `data-lang-label`, the target
  // marker and the title are dropped, and the accent attribute is removed.
  function clearLangHint(details) {
    if (!details || !details.hasAttribute('data-lang-hint')) return;
    details.removeAttribute('data-lang-hint');
    var target = details.querySelector('[data-lang-hint-target]');
    if (target) target.removeAttribute('data-lang-hint-target');
    var summary = details.querySelector('summary');
    if (summary) {
      var label = summary.getAttribute('data-lang-label');
      if (label) summary.setAttribute('aria-label', label);
      summary.removeAttribute('title');
    }
    markLangHintShown();
  }

  // §11/KDV-I18N-06: the intelligent hint. When the browser prefers a BUILT
  // locale (the SSR menu lists only built ones) other than this page's, and no
  // explicit choice or earlier hint is stored, highlight the switcher: an accent
  // attribute marks the state, the matching menu link is marked as the target,
  // and the summary carries the localized suggestion in its accessible name and
  // title — so it is never conveyed by colour alone. It never navigates.
  function initLangHint(details) {
    if (details.hasAttribute('data-lang-hint')) return;
    if (readLangChoice()) return;
    if (hintShownThisSession()) return;

    var current = String(details.getAttribute('data-current-locale') || '').toLowerCase();
    var match = matchBrowserLocale(current, langLinks());
    if (!match) return;

    var template = details.getAttribute('data-lang-hint-template') || '';
    var hint = chipFill(template, '{language}', match.endonym);
    var summary = details.querySelector('summary');
    if (summary) {
      var label = summary.getAttribute('aria-label') || '';
      // Keep the plain label so clearLangHint can restore the SSR name.
      summary.setAttribute('data-lang-label', label);
      summary.setAttribute('aria-label', label ? label + ' — ' + hint : hint);
      summary.setAttribute('title', hint);
    }

    var anchors = details.querySelectorAll('.lang-switch-menu a[data-lang-code]');
    for (var i = 0; i < anchors.length; i++) {
      if (anchors[i].getAttribute('data-lang-code') === match.code) {
        anchors[i].setAttribute('data-lang-hint-target', '');
      }
    }
    details.setAttribute('data-lang-hint', '');
  }

  // §11/KDV-I18N-06: the native <details> switcher needs JS for the niceties —
  // closing on an outside click / Escape, remembering the chosen locale, and the
  // intelligent hint. Without JS it opens and navigates as an ordinary <details>.
  function initLangSwitch() {
    var details = document.querySelector('.lang-switch');
    if (!details) return;

    // §11/KDV-I18N-06: following any language link stores the explicit choice and
    // clears the hint (recording the session flag), so it never fights the target.
    var anchors = details.querySelectorAll('.lang-switch-menu a[data-lang-code]');
    for (var i = 0; i < anchors.length; i++) {
      (function (anchor) {
        anchor.addEventListener('click', function () {
          writeLangChoice(anchor.getAttribute('data-lang-code'));
          clearLangHint(details);
        });
      })(anchors[i]);
    }

    // §11/KDV-I18N-06: opening the switcher means the visitor engaged with the
    // choice — clear the hint and remember that it was shown this session.
    details.addEventListener('toggle', function () {
      if (details.open) clearLangHint(details);
    });

    document.addEventListener('click', function (event) {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (!details.open) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        details.open = false;
        var summary = details.querySelector('summary');
        if (summary) summary.focus();
      }
    });

    initLangHint(details);
  }

  function initLangUI() {
    initLangSwitch();
  }

  window.Kodavr = {
    SPECIES_KEY: SPECIES_KEY,
    LANG_KEY: LANG_KEY,
    getSpecies: getSpecies,
    getDeclaration: getDeclaration,
    setSpecies: setSpecies,
    clearSpecies: clearSpecies,
    initCopyButtons: initCopyButtons,
    refreshSpeciesChip: refreshSpeciesChip,
    announce: announce,
  };

  // The chip and the language UI live in the shared header, parsed after this
  // head-loaded script: fill them once the DOM is ready (a controller may also
  // refresh the chip later).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initSpeciesChip();
      initLangUI();
    });
  } else {
    initSpeciesChip();
    initLangUI();
  }
})();

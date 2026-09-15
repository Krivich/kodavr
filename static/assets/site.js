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

  window.Kodavr = {
    SPECIES_KEY: SPECIES_KEY,
    getSpecies: getSpecies,
    getDeclaration: getDeclaration,
    setSpecies: setSpecies,
    clearSpecies: clearSpecies,
    initCopyButtons: initCopyButtons,
    refreshSpeciesChip: refreshSpeciesChip,
    announce: announce,
  };

  // The chip lives in the shared header, parsed after this head-loaded script:
  // fill it once the DOM is ready (a controller may also refresh it later).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpeciesChip);
  } else {
    initSpeciesChip();
  }
})();

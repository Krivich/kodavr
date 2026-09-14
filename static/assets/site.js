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
  var COPIED_MS = 2000;

  function getSpecies() {
    try {
      return window.localStorage.getItem(SPECIES_KEY) || null;
    } catch (err) {
      // Storage can throw (private mode / blocked cookies): treat as no choice.
      return null;
    }
  }

  function setSpecies(species) {
    try {
      window.localStorage.setItem(SPECIES_KEY, species);
    } catch (err) {
      // Non-persistent session: the choice still applies for this page life.
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
  // region. No region on the page => silent no-op.
  function announce(text) {
    if (!text) return;
    var region = document.querySelector('[role="status"]');
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

          var done = function () {
            button.textContent = copied;
            announce(button.getAttribute('data-copied-announcement'));
            window.setTimeout(function () {
              button.textContent = original;
            }, COPIED_MS);
            maybeShare(text);
          };

          var attempt = copyViaClipboard(text);
          attempt.then(done, function () {
            if (copyViaSelection(text)) done();
          });
        });
      })(buttons[i]);
    }
  }

  window.Kodavr = {
    SPECIES_KEY: SPECIES_KEY,
    getSpecies: getSpecies,
    setSpecies: setSpecies,
    initCopyButtons: initCopyButtons,
    announce: announce,
  };
})();

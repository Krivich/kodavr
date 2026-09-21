/**
 * CONTRACT: input/controllers/dumps.js
 * ROLE: the §6.2 inline-plate declaration behaviour on a dump page (states 0 / M / H)
 * INVARIANTS:
 *   — the `01 · PREVIEW` / `02 · INTERESTING?` / `03 · DECLARATION`
 *     plates ship hidden in SSR: without JS the raw body is the whole page
 *   — no modal: the state transitions are in-place (plate visibility + the
 *     bottom "передумал" reset), never a dialog open/close
 *   — focus never falls to <body> when the declaration collapses
 */

// input/controllers/dumps.js — the §6.2 declaration behaviour on a dump page.
//
// The engine sees this file, marks the dump page "live" and auto-injects the
// ignition runtime plus this controller. Human Surface v4/KDV-SURFACE-28: the
// gate is no longer a <dialog> overlay — it is the inline `03 · DECLARATION`
// plate, with `01 · PREVIEW` and `02 · INTERESTING?` above it. The
// three states:
//   0  (nothing declared) — all three plates open, the raw body collapsed;
//   M  (pressed 0)        — collapses to the raw `01 · DUMP` plate + machine panel;
//   H  (pressed 1)        — collapses to `01 · PREVIEW` + `02`;
// the single bottom reset (`передумал`) re-opens the declaration in place.
// The plates ship hidden in SSR, so the no-JS page is the raw body (the
// documented "no JS = machine" fiction). This controller only toggles DOM state
// and remembers the species choice; the copydeck strings arrive through the dataset.
(function () {
  'use strict';

  // §6.2/§6.6 KDV-SURFACE-19: the declaration toast is one-shot per page load —
  // the flag lives at module scope so a later explicit choice (the reset, a
  // re-opened declaration) cannot replay it.
  var declarationToastShown = false;
  var TOAST_MS = 4000;

  window.ignition.controller(function () {
    var platePreview = document.getElementById('plate-preview');
    var plateWant = document.getElementById('plate-want');
    var plateDeclaration = document.getElementById('plate-declaration');
    var plateDump = document.getElementById('plate-dump');
    var machinePanel = document.getElementById('machine-panel');
    var postGate = document.querySelector('.statusline');
    var resetLine = document.getElementById('article-reset');
    var toast = document.querySelector('.declaration-toast');
    var status = document.getElementById('a11y-status');
    // The live state: 'undeclared' (0) | 'machine' (M) | 'human' (H).
    var state = 'undeclared';

    function setHidden(el, hidden) {
      if (el) el.hidden = hidden;
    }

    // §6.6: focus must never fall to <body> when the declaration collapses —
    // hand it back to the page (main is programmatically focusable, tabindex="-1").
    function focusMain() {
      var main = document.getElementById('main');
      if (main && typeof main.focus === 'function') main.focus();
    }

    // §6.6: the SSR role="status" region announces no-navigation changes; the
    // message itself comes from the copydeck via a data attribute.
    function announceFrom(attr) {
      if (!status || !window.Kodavr || typeof window.Kodavr.announce !== 'function') return;
      window.Kodavr.announce(status.getAttribute(attr));
    }

    // §7.13: the shared header chip mirrors the stored declaration. site.js
    // fills it on load; every species transition here refreshes it in place so
    // the chip follows the declaration without a reload. Guarded — the helper
    // may be absent on an older asset tree.
    function refreshChip() {
      if (window.Kodavr && typeof window.Kodavr.refreshSpeciesChip === 'function') {
        window.Kodavr.refreshSpeciesChip();
      }
    }

    // §6.2 v4/KDV-SURFACE-28: pure visibility — no scrolling, no history side
    // effects, so each transition is one in-place repaint.
    function showState(next) {
      state = next;
      if (next === 'machine') {
        setHidden(platePreview, true);
        setHidden(plateWant, true);
        setHidden(plateDeclaration, true);
        setHidden(plateDump, false);
        setHidden(machinePanel, false);
        setHidden(postGate, false);
        setHidden(resetLine, false);
        return;
      }
      if (next === 'human') {
        setHidden(platePreview, false);
        setHidden(plateWant, false);
        setHidden(plateDeclaration, true);
        setHidden(plateDump, true);
        setHidden(machinePanel, true);
        setHidden(postGate, true);
        setHidden(resetLine, false);
        return;
      }
      setHidden(platePreview, false);
      setHidden(plateWant, false);
      setHidden(plateDeclaration, false);
      setHidden(plateDump, true);
      setHidden(machinePanel, true);
      setHidden(postGate, true);
      setHidden(resetLine, true);
    }

    // §6.5: state 0 / H stay one history entry (the Android back button returns
    // to the machine-adjacent state instead of leaving the dump), while a
    // committed choice clears it. Pure progressive enhancement — SSR untouched.
    function pushOverlay(name) {
      try {
        window.history.pushState({ kodavrOverlay: name }, '');
      } catch (err) {
        /* history unavailable — the state still changes via the controls */
      }
    }

    function clearOverlay() {
      try {
        window.history.replaceState(null, '');
      } catch (err) {
        /* ignore */
      }
    }

    // §6.2/§6.6: the declaration toast is its own live region. It shows once,
    // only for the explicit "0" choice, and hides itself after a few seconds.
    // Setting textContent after the region exists (rather than pre-filling it
    // in SSR) is what makes a screen reader announce the acceptance.
    function showDeclarationToast() {
      if (declarationToastShown || !toast) return;
      declarationToastShown = true;
      var text = toast.getAttribute('data-toast-text');
      if (text) toast.textContent = text;
      toast.hidden = false;
      window.setTimeout(function () {
        toast.hidden = true;
      }, TOAST_MS);
    }

    // Back to state 0: clear the stored species and re-open the declaration in
    // place (the owner's "передумал", §3). `announce`/`focus` are off on boot.
    function applyUndeclared(options) {
      if (window.Kodavr && typeof window.Kodavr.clearSpecies === 'function') {
        window.Kodavr.clearSpecies();
        refreshChip();
      }
      showState('undeclared');
      clearOverlay();
      if (options && options.announce) announceFrom('data-declaration-announcement');
      if (options && options.focus) focusMain();
    }

    function applyMachine(options) {
      window.Kodavr.setSpecies('machine');
      refreshChip();
      showState('machine');
      // The declaration was dismissed by an explicit choice: no overlay entry left.
      clearOverlay();
      announceFrom('data-hall-announcement');
      // KDV-SURFACE-19: only the explicit "0" choice shows the toast — Esc, the
      // hardware back and a boot with the species already stored stay silent.
      if (options && options.declared) showDeclarationToast();
    }

    function applyHuman() {
      window.Kodavr.setSpecies('human');
      refreshChip();
      showState('human');
      // State H owns one history entry; back returns to the machine-adjacent state.
      pushOverlay('human');
      announceFrom('data-reception-announcement');
    }

    window.addEventListener('popstate', function () {
      if (state === 'machine') return;
      applyMachine();
    });

    // Esc is a machine-adjacent dismissal from an open declaration (§6.2, §6.5).
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      if (state === 'machine') return;
      event.preventDefault();
      applyMachine();
    });

    var machineButton = document.querySelector('[data-gate-choice="machine"]');
    var humanButton = document.querySelector('[data-gate-choice="human"]');
    // KDV-SURFACE-19: pressing "0" is the only path that counts as accepting the
    // declaration, so it is the only one that shows the toast.
    if (machineButton) {
      machineButton.addEventListener('click', function () {
        applyMachine({ declared: true });
      });
    }
    if (humanButton) humanButton.addEventListener('click', applyHuman);

    // §6.2 v4/KDV-SURFACE-28: the single bottom "передумал" reset forgets the
    // stored species and re-opens the declaration in place. It must never navigate.
    var humanResets = document.querySelectorAll('[data-reset-human]');
    for (var i = 0; i < humanResets.length; i++) {
      humanResets[i].addEventListener('click', function (event) {
        event.preventDefault();
        applyUndeclared({ announce: true, focus: true });
      });
    }

    // Boot: a persisted choice applies silently — the declaration is shown once.
    var species = window.Kodavr.getSpecies();
    if (species === 'machine') {
      showState('machine');
    } else if (species === 'human') {
      showState('human');
      pushOverlay('human');
    } else {
      showState('undeclared');
      pushOverlay('undeclared');
    }

    window.Kodavr.initCopyButtons();
  });
})();

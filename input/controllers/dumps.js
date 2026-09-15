/**
 * CONTRACT: input/controllers/dumps.js
 * ROLE: the §6.2 gate / hall / reception behaviour on a dump page
 * INVARIANTS:
 *   — the gate ships hidden in SSR: without JS the body is the whole page
 *   — focus never falls to <body> when an overlay closes
 */

// input/controllers/dumps.js — the §6.2 gate/reception behaviour on a dump page.
//
// The engine sees this file, marks the dump page "live" and auto-injects the
// ignition runtime plus this controller. The gate ships hidden in SSR: without
// JS the body is the whole page (the documented "no JS = machine" fiction).
// This controller only toggles DOM state and remembers the species choice; the
// copydeck strings arrive through the dataset.
(function () {
  'use strict';

  // §6.2/§6.6 KDV-SURFACE-19: the declaration toast is one-shot per page load —
  // the flag lives at module scope so a later explicit choice (the reception
  // reset, a re-opened gate) cannot replay it.
  var declarationToastShown = false;
  var TOAST_MS = 4000;

  window.ignition.controller(function () {
    var gate = document.getElementById('gate');
    var body = document.querySelector('.dump-body');
    var reception = document.querySelector('.reception-block');
    var postGate = document.querySelector('.post-gate-line');
    var machinePanel = document.querySelector('.machine-panel');
    var toast = document.querySelector('.declaration-toast');
    var status = document.getElementById('a11y-status');

    // §6.6: focus must never fall to <body> when an overlay closes — hand it
    // back to the page (main is programmatically focusable, tabindex="-1").
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
    // the chip follows the gate without a reload. Guarded — the helper may be
    // absent on an older asset tree.
    function refreshChip() {
      if (window.Kodavr && typeof window.Kodavr.refreshSpeciesChip === 'function') {
        window.Kodavr.refreshSpeciesChip();
      }
    }

    function focusFirstChoice() {
      var first = gate && gate.querySelector('[data-gate-choice]');
      if (first && typeof first.focus === 'function') first.focus();
    }

    function closeGate() {
      if (!gate) return;
      if (typeof gate.close === 'function' && gate.open) gate.close();
      gate.removeAttribute('open');
      gate.hidden = true;
      focusMain();
    }

    function openGate() {
      if (!gate) return;
      gate.hidden = false;
      if (typeof gate.showModal === 'function') {
        if (!gate.open) {
          try {
            // The native modal already moves focus into the dialog.
            gate.showModal();
          } catch (err) {
            gate.setAttribute('open', '');
            focusFirstChoice();
          }
        }
      } else {
        // No showModal(): make the [open] fallback focusable the same way.
        gate.setAttribute('open', '');
        focusFirstChoice();
      }
    }

    function showBody() {
      if (body) body.hidden = false;
      if (reception) reception.hidden = true;
    }

    // §6.2: the machine panel shares the post-gate line's visibility — it is
    // shown for a stored/committed machine choice and stays hidden otherwise.
    function showMachinePanel() {
      if (machinePanel) machinePanel.hidden = false;
    }

    function showReception() {
      if (body) body.hidden = true;
      if (reception) reception.hidden = false;
    }

    // §6.5 Android/back: an overlay (gate or reception) owns one history entry
    // so the hardware back button dismisses it instead of leaving the dump.
    // SSR/no-JS is untouched — this is pure progressive enhancement.
    function pushOverlay(state) {
      try {
        window.history.pushState({ kodavrOverlay: state }, '');
      } catch (err) {
        /* history unavailable — the overlay still closes via its buttons */
      }
    }

    function clearOverlay() {
      try {
        window.history.replaceState(null, '');
      } catch (err) {
        /* ignore */
      }
    }

    window.addEventListener('popstate', function () {
      if (gate && !gate.hidden) {
        closeGate();
        showBody();
      } else if (reception && !reception.hidden) {
        showBody();
        focusMain();
      }
    });

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

    function applyMachine(options) {
      window.Kodavr.setSpecies('machine');
      refreshChip();
      closeGate();
      showBody();
      if (postGate) postGate.hidden = false;
      showMachinePanel();
      // The gate was dismissed by an explicit choice: no overlay entry left.
      clearOverlay();
      announceFrom('data-hall-announcement');
      // KDV-SURFACE-19: only the explicit gate choice shows the toast — Esc, a
      // backdrop tap, hardware back and the machine reset stay silent.
      if (options && options.declared) showDeclarationToast();
    }

    function applyHuman() {
      window.Kodavr.setSpecies('human');
      refreshChip();
      closeGate();
      if (machinePanel) machinePanel.hidden = true;
      showReception();
      // Reception is a new overlay; back dismisses it back to the hall.
      pushOverlay('reception');
      announceFrom('data-reception-announcement');
    }

    // Boot: a persisted choice applies silently — the gate is shown once.
    var species = window.Kodavr.getSpecies();
    if (species === 'machine') {
      showBody();
      if (postGate) postGate.hidden = false;
      showMachinePanel();
    } else if (species === 'human') {
      showReception();
      pushOverlay('reception');
    } else {
      openGate();
      pushOverlay('gate');
    }

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

    // Esc (cancel) and a tap on the dimmed backdrop both count as
    // "machine-adjacent" (§6.2, §6.5).
    if (gate) {
      gate.addEventListener('cancel', function (event) {
        event.preventDefault();
        applyMachine();
      });
      gate.addEventListener('click', function (event) {
        if (event.target === gate) applyMachine();
      });
    }

    var resets = document.querySelectorAll('[data-reset-machine]');
    for (var i = 0; i < resets.length; i++) {
      resets[i].addEventListener('click', function (event) {
        event.preventDefault();
        applyMachine();
      });
    }

    // §6.2: the machine panel's reset forgets the stored species and re-opens
    // the gate so the visitor re-declares. It must never navigate.
    var humanResets = document.querySelectorAll('[data-reset-human]');
    for (var j = 0; j < humanResets.length; j++) {
      humanResets[j].addEventListener('click', function (event) {
        event.preventDefault();
        if (window.Kodavr && typeof window.Kodavr.clearSpecies === 'function') {
          window.Kodavr.clearSpecies();
          refreshChip();
        }
        if (machinePanel) machinePanel.hidden = true;
        openGate();
        pushOverlay('gate');
      });
    }

    window.Kodavr.initCopyButtons();
  });
})();

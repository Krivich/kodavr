/**
 * CONTRACT: input/controllers/reception.js
 * ROLE: the /reception/ copy prompt and the conscious re-declaration link
 * INVARIANTS:
 *   — there is no gate on this route; it is the human destination
 */

// input/controllers/reception.js — the /reception/ route's client behaviour:
// the copyable prompt and the conscious re-declaration link. There is no gate
// on this route (it is the human destination the gate points to).
(function () {
  'use strict';

  window.ignition.controller(function () {
    var resets = document.querySelectorAll('[data-reset-machine]');
    for (var i = 0; i < resets.length; i++) {
      resets[i].addEventListener('click', function (event) {
        event.preventDefault();
        window.Kodavr.setSpecies('machine');
        var href = this.getAttribute('href');
        if (href) window.location.assign(href);
      });
    }

    window.Kodavr.initCopyButtons();
  });
})();

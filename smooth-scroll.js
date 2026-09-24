/* Mishri Sweet House. Smooth scrolling with Lenis (vendor/lenis, MIT).

   Lenis eases wheel and trackpad scrolling on the window; touch scrolling
   stays native. It is left off entirely for prefers-reduced-motion, and it
   pauses while the menu, a drawer or a dialog is open so the page behind
   does not move. Same-page links (#shop, #gifts...) glide to their
   section, clear of the fixed header. */
(function () {
  "use strict";
  if (typeof Lenis === "undefined") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.1,
    // Drawers, dialogs and the menu scroll on their own.
    prevent: (node) => !!node.closest("dialog, .drawer, .menu, [data-lenis-prevent]"),
  });

  /* ---------------- pause behind overlays ---------------- */

  const overlayOpen = () => document.body.classList.contains("no-scroll") || !!document.querySelector("dialog[open]");
  function sync() {
    if (overlayOpen()) lenis.stop(); else lenis.start();
  }
  const watch = new MutationObserver(sync);
  watch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  document.querySelectorAll("dialog").forEach((d) => watch.observe(d, { attributes: true, attributeFilter: ["open"] }));

  /* ---------------- same-page links ---------------- */

  function glideTo(hash) {
    // #top is the fixed header itself, which has no scroll position.
    const target = hash === "#top" ? 0 : document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target === null) return false;
    sync();
    // Lenis honours the scroll-padding-top in styles.css, so sections land clear of the fixed header.
    lenis.scrollTo(target);
    if (target !== 0) {
      // Move keyboard focus with the view, as a native anchor jump would.
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    return true;
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute("href").length < 2 || overlayOpen()) return;
    if (glideTo(link.getAttribute("href"))) {
      e.preventDefault();
      history.pushState(null, "", link.getAttribute("href"));
    }
  });

  // app.js sends people to a section by setting location.hash; ease that too.
  window.mishriScrollTo = (hash) => { if (!glideTo(hash)) location.hash = hash; };
})();

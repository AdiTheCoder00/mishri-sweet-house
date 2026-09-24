/* Mishri Sweet House. Behaviour for generated product and category pages.

   app.js is built around the homepage DOM and would throw here, so these
   pages carry only what they need: the shared theme, the ribbon, the basket
   count, and an Add button that writes to the same localStorage basket. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ALL = [
    ...(typeof PRODUCTS !== "undefined" ? PRODUCTS : []),
    ...(typeof GIFT_BOXES !== "undefined" ? GIFT_BOXES : []),
  ];
  const findItem = (id) => ALL.find((p) => p.id === id);
  const MAX_QTY = 99;

  /* ---------------- theme, shared with the homepage ---------------- */

  const themeBtn = $("#theme-toggle");
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    const dark = theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches);
    if (themeBtn) themeBtn.innerHTML = `<i class="ph-light ${dark ? "ph-sun" : "ph-moon"}" aria-hidden="true"></i>`;
  }
  try { applyTheme(localStorage.getItem("mishri-theme") || ""); } catch { applyTheme(""); }
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const isDark = current ? current === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = isDark ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("mishri-theme", next); } catch {}
    });
  }

  /* ---------------- ribbon ---------------- */

  const ribbonText = $("#ribbon-text");
  if (ribbonText) {
    const NOTICES = [
      { long: "Same-day delivery in Jaipur · Next-day to 40 cities", short: "Same-day delivery in Jaipur" },
      { long: "Free delivery on orders over ₹999", short: "Free delivery over ₹999" },
      { long: "Festival boxes open for pre-order soon · Join the list", short: "Festival boxes: join the list" },
    ];
    const narrow = matchMedia("(max-width: 599px)");
    const text = (i) => (narrow.matches ? NOTICES[i].short : NOTICES[i].long);
    let i = 0, timer;
    const show = (n) => {
      i = (n + NOTICES.length) % NOTICES.length;
      ribbonText.classList.add("is-swapping");
      setTimeout(() => { ribbonText.textContent = text(i); ribbonText.classList.remove("is-swapping"); }, 260);
    };
    const cycle = () => {
      clearInterval(timer);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timer = setInterval(() => show(i + 1), 6000);
    };
    ribbonText.textContent = text(0);
    cycle();
    $("#ribbon-prev")?.addEventListener("click", () => { show(i - 1); cycle(); });
    $("#ribbon-next")?.addEventListener("click", () => { show(i + 1); cycle(); });
  }

  /* ---------------- basket ---------------- */

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("mishri-cart") || "[]"); } catch { cart = []; }
  cart = cart.filter((l) => findItem(l.id) && !findItem(l.id).soldOut);

  const countAll = () => cart.reduce((n, l) => n + l.qty, 0);

  function renderCount() {
    const badge = $("#cart-count");
    if (!badge) return;
    const n = countAll();
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast"), text = $("#toast-text");
    if (!el || !text) return;
    text.textContent = msg;
    $("#toast-action").hidden = true;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2400);
  }

  // Prices here are baked in at build time; availability set in the admin is not.
  $$("[data-add]").forEach((btn) => {
    const item = findItem(btn.dataset.add);
    if (!item || item.soldOut) {
      btn.disabled = true;
      btn.textContent = item ? "Sold out today" : "Not available";
    }
    btn.addEventListener("click", () => {
      const id = btn.dataset.add;
      const p = findItem(id);
      if (!p || p.soldOut) return;
      const min = p.minQty || 1;
      const line = cart.find((l) => l.id === id);
      if (line) line.qty = Math.min(MAX_QTY, line.qty + min);
      else cart.push({ id, qty: min });
      try { localStorage.setItem("mishri-cart", JSON.stringify(cart)); } catch {}
      renderCount();
      const shown = cart.find((l) => l.id === id).qty;
      toast(p.minQty && shown === p.minQty ? `${p.name} × ${shown} added, the minimum order` : `${p.name} added to basket`);
      const badge = $("#cart-count");
      if (badge) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
    });
  });

  // The basket and wishlist drawers live on the homepage; send people there.
  const toStore = (hash) => {
    const base = document.querySelector('link[rel="stylesheet"][href$="styles.css"]').getAttribute("href").replace("styles.css", "");
    location.href = base + "index.html" + hash;
  };
  $("#cart-open")?.addEventListener("click", () => toStore("#shop"));
  $("#wishlist-open")?.addEventListener("click", () => toStore("#shop"));
  $("#account-open")?.addEventListener("click", () => toStore(""));

  /* ---------------- menu ---------------- */

  const menuBtn = $("#menu-toggle"), menu = $("#mobile-menu");
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("no-scroll", open);
    };
    menuBtn.addEventListener("click", () => setMenu(menu.hidden));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });
  }

  renderCount();
})();

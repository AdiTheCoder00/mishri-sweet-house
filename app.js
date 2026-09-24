/* Mishri Sweet House. Storefront logic: catalogue, cart, checkout, theme. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const inr = (n) => "₹" + n.toLocaleString("en-IN");
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ALL_ITEMS = [...PRODUCTS, ...GIFT_BOXES];
  const findItem = (id) => ALL_ITEMS.find((p) => p.id === id);
  const FREE_DELIVERY_OVER = DELIVERY.freeOver;
  const DELIVERY_FEE = DELIVERY.fee;

  /* ---------------- Theme ---------------- */

  const themeBtn = $("#theme-toggle");
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    const dark = theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches);
    themeBtn.innerHTML = `<i class="ph-light ${dark ? "ph-sun" : "ph-moon"}" aria-hidden="true"></i>`;
  }
  try { applyTheme(localStorage.getItem("mishri-theme") || ""); } catch { applyTheme(""); }
  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = current ? current === "dark" : systemDark;
    const next = isDark ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("mishri-theme", next); } catch {}
  });

  /* ---------------- Mobile menu ---------------- */

  const menuBtn = $("#menu-toggle");
  const mobileMenu = $("#mobile-menu");
  function setMenu(open) {
    mobileMenu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    // The burger is two CSS-morphed lines; never replace its contents.
    document.body.classList.toggle("no-scroll", open);
    if (open) mobileMenu.querySelector("a").focus();
  }
  menuBtn.addEventListener("click", () => {
    if (mobileMenu.hidden) {
      closeCart();
      closeWishlist();
    }
    setMenu(mobileMenu.hidden);
  });
  mobileMenu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("click", (e) => {
    if (!mobileMenu.hidden && !e.target.closest(".island") && !e.target.closest(".menu")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !mobileMenu.hidden) setMenu(false); });

  /* ---------------- Seasonal ribbon ---------------- */

  // Every line here restates a promise already made elsewhere on the page.
  const NOTICES = [
    { long: "Same-day delivery in Jaipur · 2 to 5 days anywhere in India", short: "Delivering across India" },
    { long: "Free delivery on orders over ₹999", short: "Free delivery over ₹999" },
    { long: "Festival boxes open for pre-order soon · Join the list", short: "Festival boxes: join the list" },
  ];
  const narrow = matchMedia("(max-width: 599px)");
  const noticeText = (i) => (narrow.matches ? NOTICES[i].short : NOTICES[i].long);
  const ribbonText = $("#ribbon-text");
  let notice = 0;
  let ribbonTimer;

  function showNotice(i) {
    notice = (i + NOTICES.length) % NOTICES.length;
    ribbonText.classList.add("is-swapping");
    setTimeout(() => {
      ribbonText.textContent = noticeText(notice);
      ribbonText.classList.remove("is-swapping");
    }, 260);
  }
  function cycleRibbon() {
    clearInterval(ribbonTimer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ribbonTimer = setInterval(() => showNotice(notice + 1), 6000);
  }
  ribbonText.textContent = noticeText(0);
  narrow.addEventListener("change", () => { ribbonText.textContent = noticeText(notice); });
  cycleRibbon();
  $("#ribbon-prev").addEventListener("click", () => { showNotice(notice - 1); cycleRibbon(); });
  $("#ribbon-next").addEventListener("click", () => { showNotice(notice + 1); cycleRibbon(); });
  // Hold still while someone is reading it.
  $(".ribbon").addEventListener("mouseenter", () => clearInterval(ribbonTimer));
  $(".ribbon").addEventListener("mouseleave", cycleRibbon);

  /* ---------------- Toast ---------------- */

  const toastEl = $("#toast");
  const toastAction = $("#toast-action");
  let toastTimer;
  let toastHandler = null;
  // A toast may carry one action (undo a removal). It stays up longer when it does.
  function toast(msg, action) {
    $("#toast-text").textContent = msg;
    toastHandler = action ? action.onClick : null;
    toastAction.hidden = !action;
    if (action) toastAction.textContent = action.label;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove("is-visible"); toastHandler = null; }, action ? 6000 : 2400);
  }
  toastAction.addEventListener("click", () => {
    if (toastHandler) toastHandler();
    toastEl.classList.remove("is-visible");
    toastHandler = null;
  });

  /* ---------------- Cart state ---------------- */

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("mishri-cart") || "[]"); } catch { cart = []; }
  // Lines for anything since hidden or sold out in the admin drop out of the basket.
  cart = cart.filter((line) => findItem(line.id) && !findItem(line.id).soldOut);

  function saveCart() {
    try { localStorage.setItem("mishri-cart", JSON.stringify(cart)); } catch {}
  }
  const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
  const cartSubtotal = () => cart.reduce((n, l) => n + l.qty * findItem(l.id).price, 0);

  const MAX_QTY = 99;
  const minQty = (id) => findItem(id).minQty || 1;
  const qtyStep = (id) => findItem(id).step || 1;

  // Snap a capped quantity back to a valid step rather than leaving 99 of a
  // box that is only sold in tens.
  function capQty(id, n) {
    const step = qtyStep(id), min = minQty(id);
    if (n <= MAX_QTY) return n;
    return Math.max(min, min + Math.floor((MAX_QTY - min) / step) * step);
  }

  function addToCart(id, qty) {
    const p = findItem(id);
    if (p.soldOut) { toast(`${p.name} is sold out today`); return; }
    const line = cart.find((l) => l.id === id);
    const add = qty || minQty(id);
    const wanted = line ? line.qty + add : Math.max(add, minQty(id));
    const capped = capQty(id, wanted);
    if (line) line.qty = capped; else cart.push({ id, qty: capped });
    saveCart();
    renderCart();
    syncBasketButtons();
    const shown = cart.find((l) => l.id === id).qty;
    toast(
      wanted > MAX_QTY ? `${shown} is the most we take in one order`
      : p.minQty && shown === p.minQty ? `${p.name} × ${shown} added, the minimum order`
      : `${p.name} added to basket`
    );
    const badge = $("#cart-count");
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }

  // keepFocus names the control to re-focus after the list re-renders, so a
  // keyboard user holding +/- is not thrown back to the top of the page.
  function setQty(id, qty, keepFocus) {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    line.qty = Math.min(MAX_QTY, qty);
    if (line.qty <= 0) cart = cart.filter((l) => l.id !== id);
    saveCart();
    renderCart();
    syncBasketButtons();
    if (!keepFocus) return;
    const btn = $(`.cart-item[data-id="${id}"] ${keepFocus}`);
    if (btn && !btn.disabled) btn.focus();
    else $(`.cart-item[data-id="${id}"] .qty button:not([disabled])`)?.focus();
  }

  // Removal is explicit and undoable; the minus button stops at the minimum.
  function removeLine(id) {
    const index = cart.findIndex((l) => l.id === id);
    if (index === -1) return;
    const [removed] = cart.splice(index, 1);
    saveCart();
    renderCart();
    syncBasketButtons();
    toast(`${findItem(id).name} removed`, {
      label: "Undo",
      onClick: () => { cart.splice(index, 0, removed); saveCart(); renderCart(); syncBasketButtons(); },
    });
  }

  // smooth-scroll.js eases the move when it is running.
  const goToShop = () => (window.mishriScrollTo ? window.mishriScrollTo("#shop") : (location.hash = "#shop"));

  /* ---------------- Cart drawer ---------------- */

  const drawer = $("#cart-drawer");
  const overlay = $("#cart-overlay");

  // will-change only spans the slide; a permanent layer costs memory on mobile.
  function flagSlide(el) {
    el.classList.add("is-animating");
    el.addEventListener("transitionend", () => el.classList.remove("is-animating"), { once: true });
  }

  function openCart() {
    closeWishlist();
    flagSlide(drawer);
    drawer.classList.add("is-open");
    drawer.inert = false;
    drawer.removeAttribute("aria-hidden");
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    $("#cart-close").focus();
  }
  function closeCart() {
    flagSlide(drawer);
    drawer.classList.remove("is-open");
    drawer.inert = true;
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }
  $("#cart-open").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);
  $("#cart-empty-cta").addEventListener("click", () => { closeCart(); goToShop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("is-open")) closeCart(); });

  function renderCart() {
    const count = cartCount();
    const badge = $("#cart-count");
    badge.textContent = count;
    badge.hidden = count === 0;
    drawer.classList.toggle("is-empty", cart.length === 0);

    $("#cart-items").innerHTML = cart.map((line) => {
      const p = findItem(line.id);
      const atMin = line.qty <= minQty(p.id);
      return `
        <div class="cart-item" data-id="${p.id}">
          <img src="${p.img}" alt="" width="72" height="72" loading="lazy" decoding="async" />
          <div>
            <div class="cart-item-name">${escapeHtml(p.name)}</div>
            <div class="cart-item-meta">${escapeHtml(p.weight)} · ${inr(p.price)} each</div>
            <div class="cart-item-total">${inr(p.price * line.qty)}</div>
          </div>
          <div class="cart-item-right">
            <div class="qty" aria-label="Quantity for ${escapeHtml(p.name)}">
              <button data-dec aria-label="Decrease quantity" ${atMin ? "disabled" : ""}><i class="ph-light ph-minus"></i></button>
              <span>${line.qty}</span>
              <button data-inc aria-label="Increase quantity" ${line.qty >= MAX_QTY ? "disabled" : ""}><i class="ph-light ph-plus"></i></button>
            </div>
            <button class="cart-remove" data-remove>Remove</button>
          </div>
        </div>`;
    }).join("");

    const sub = cartSubtotal();
    $("#cart-subtotal").textContent = inr(sub);
    $("#cart-delivery").textContent = sub >= FREE_DELIVERY_OVER ? "Free" : `${inr(DELIVERY_FEE)} (free over ${inr(FREE_DELIVERY_OVER)})`;
    const nudge = $("#cart-nudge");
    const gap = FREE_DELIVERY_OVER - sub;
    nudge.hidden = !(cart.length && gap > 0);
    if (!nudge.hidden) nudge.innerHTML = `<i class="ph-light ph-truck" aria-hidden="true"></i>Add ${inr(gap)} more for free delivery.`;
  }

  $("#cart-items").addEventListener("click", (e) => {
    const item = e.target.closest(".cart-item");
    if (!item) return;
    const id = item.dataset.id;
    const line = cart.find((l) => l.id === id);
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (inc) setQty(id, line.qty + qtyStep(id), "[data-inc]");
    else if (dec) setQty(id, Math.max(minQty(id), line.qty - qtyStep(id)), "[data-dec]");
    else if (e.target.closest("[data-remove]")) removeLine(id);
  });

  /* ---------------- Wishlist ---------------- */

  let wishlist = [];
  try { wishlist = JSON.parse(localStorage.getItem("mishri-wishlist") || "[]"); } catch { wishlist = []; }
  wishlist = wishlist.filter((id) => findItem(id));

  const wishDrawer = $("#wishlist-drawer");
  const inWishlist = (id) => wishlist.includes(id);
  const heartIcon = (id) => `<i class="${inWishlist(id) ? "ph-fill" : "ph-light"} ph-heart" aria-hidden="true"></i>`;
  const wishButton = (id, name) =>
    `<button class="wish-btn${inWishlist(id) ? " is-active" : ""}" data-wish aria-pressed="${inWishlist(id)}" aria-label="${inWishlist(id) ? "Remove" : "Save"} ${escapeHtml(name)}">${heartIcon(id)}</button>`;

  function toggleWish(id) {
    const p = findItem(id);
    if (inWishlist(id)) {
      wishlist = wishlist.filter((w) => w !== id);
      toast(`${p.name} removed from wishlist`);
    } else {
      wishlist.push(id);
      toast(`${p.name} saved to wishlist`);
    }
    try { localStorage.setItem("mishri-wishlist", JSON.stringify(wishlist)); } catch {}
    syncWishButtons(id);
    renderWishlist();
  }

  // Update every heart for this item in place, so the grid does not re-render and lose scroll position.
  function syncWishButtons(id) {
    $$(`[data-id="${id}"] [data-wish]`).forEach((btn) => {
      const on = inWishlist(id);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", `${on ? "Remove" : "Save"} ${findItem(id).name}`);
      btn.innerHTML = heartIcon(id);
    });
  }

  function openWishlist() {
    flagSlide(wishDrawer);
    wishDrawer.classList.add("is-open");
    wishDrawer.inert = false;
    wishDrawer.removeAttribute("aria-hidden");
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    $("#wishlist-close").focus();
  }
  function closeWishlist() {
    flagSlide(wishDrawer);
    wishDrawer.classList.remove("is-open");
    wishDrawer.inert = true;
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }
  $("#wishlist-open").addEventListener("click", () => { closeCart(); openWishlist(); });
  $("#wishlist-close").addEventListener("click", closeWishlist);
  overlay.addEventListener("click", closeWishlist);
  $("#wishlist-empty-cta").addEventListener("click", () => { closeWishlist(); goToShop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && wishDrawer.classList.contains("is-open")) closeWishlist(); });

  function renderWishlist() {
    const badge = $("#wishlist-count");
    badge.textContent = wishlist.length;
    badge.hidden = wishlist.length === 0;
    wishDrawer.classList.toggle("is-empty", wishlist.length === 0);
    $("#wishlist-items").innerHTML = wishlist.map((id) => {
      const p = findItem(id);
      return `
        <div class="wish-item" data-id="${p.id}">
          <img src="${p.img}" alt="" width="72" height="72" loading="lazy" />
          <div>
            <div class="wish-item-name">${escapeHtml(p.name)}</div>
            <div class="wish-item-meta">${escapeHtml(p.weight)} · ${inr(p.price)}</div>
          </div>
          <div class="wish-item-right">
            <button class="add-btn" data-add aria-label="Add ${escapeHtml(p.name)} to basket">Add<span class="btn-ico"><i class="ph-light ph-plus" aria-hidden="true"></i></span></button>
            <button class="cart-remove" data-wish>Remove</button>
          </div>
        </div>`;
    }).join("");
  }

  $("#wishlist-items").addEventListener("click", (e) => {
    const item = e.target.closest(".wish-item");
    if (!item) return;
    if (e.target.closest("[data-add]")) addToCart(item.dataset.id);
    else if (e.target.closest("[data-wish]")) toggleWish(item.dataset.id);
  });
  // Moving empties the wishlist, so tapping twice cannot duplicate the basket.
  $("#wishlist-add-all").addEventListener("click", () => {
    const available = wishlist.filter((id) => !findItem(id).soldOut);
    const moved = available.length;
    if (!moved) { if (wishlist.length) toast("Everything saved is sold out today"); return; }
    available.forEach((id) => {
      const line = cart.find((l) => l.id === id);
      if (line) line.qty = Math.min(MAX_QTY, line.qty + minQty(id));
      else cart.push({ id, qty: minQty(id) });
    });
    const previous = available;
    wishlist = wishlist.filter((id) => !available.includes(id));
    try { localStorage.setItem("mishri-wishlist", JSON.stringify(wishlist)); } catch {}
    saveCart();
    renderCart();
    renderWishlist();
    previous.forEach(syncWishButtons);
    syncBasketButtons();
    toast(`${moved} item${moved === 1 ? "" : "s"} moved to your basket`);
    closeWishlist();
    openCart();
  });

  /* ---------------- Catalogue ---------------- */

  const grid = $("#product-grid");
  let activeCat = "All";
  let sortMode = "featured";
  let query = "";

  const searchInput = $("#search");
  const searchClear = $("#search-clear");
  // Lowercase and strip accents so "kesar" matches "Kesar" and typed diacritics do not matter.
  const normalise = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const matchesQuery = (p) => {
    if (!query) return true;
    const hay = normalise([p.name, p.category, p.desc, p.tag].join(" "));
    return query.split(/\s+/).every((word) => hay.includes(word));
  };
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const highlight = (text) => {
    if (!query) return escapeHtml(text);
    const words = query.split(/\s+/).filter(Boolean).map(escapeRegex);
    return escapeHtml(text).replace(new RegExp("(" + words.join("|") + ")", "ig"), "<mark>$1</mark>");
  };

  const basketQty = (id) => (cart.find((l) => l.id === id) || {}).qty || 0;
  const addLabel = (name, n) => n ? `${name}, ${n} in basket. Add another` : `Add ${name} to basket`;
  const soldOutBtn = `<button class="add-btn is-sold-out" disabled>Sold out</button>`;
  const addBtnInner = (n) => `${n ? "Added" : "Add"}<span class="btn-ico">${n ? n : '<i class="ph-light ph-plus" aria-hidden="true"></i>'}</span>`;

  function productCard(p) {
    const n = basketQty(p.id);
    const serves = typeof SERVES !== "undefined" ? SERVES[p.weight] : "";
    return `
      <article class="product" data-id="${p.id}" style="--i:${p.i || 0}">
        <div class="bezel">
          <div class="bezel-core">
            <div class="product-media">
              <img src="${p.img}" alt="${escapeHtml(p.name)}" width="800" height="800" loading="lazy" decoding="async" />
              ${p.tag ? `<span class="product-tag">${escapeHtml(p.tag)}</span>` : ""}
              ${wishButton(p.id, p.name)}
            </div>
            <div class="product-body">
              <button class="product-name" data-view>${highlight(p.name)}</button>
              <div class="product-meta">${escapeHtml(p.category)} · ${escapeHtml(p.weight)}${serves ? " · " + serves : ""}</div>
              <div class="product-foot">
                <span class="product-price">${inr(p.price)}</span>
                ${p.soldOut ? soldOutBtn : `<button class="add-btn${n ? " in-basket" : ""}" data-add aria-label="${escapeHtml(addLabel(p.name, n))}">${addBtnInner(n)}</button>`}
              </div>
            </div>
          </div>
        </div>
      </article>`;
  }

  // Keep the Add buttons in step with the basket without re-rendering the grid.
  function syncBasketButtons() {
    $$("#product-grid .product, #bento .bento-cell").forEach((el) => {
      const btn = $("[data-add]", el);
      if (!btn) return;
      const n = basketQty(el.dataset.id);
      btn.classList.toggle("in-basket", n > 0);
      btn.setAttribute("aria-label", addLabel(findItem(el.dataset.id).name, n));
      btn.innerHTML = addBtnInner(n);
    });
  }

  function renderProducts() {
    let list = PRODUCTS.filter((p) => (activeCat === "All" || p.category === activeCat) && matchesQuery(p));
    if (sortMode === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sortMode === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sortMode === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    grid.innerHTML = list.map((p, i) => productCard(Object.assign({}, p, { i: Math.min(i, 8) }))).join("");
    const empty = $("#shop-empty");
    empty.hidden = list.length > 0;
    if (list.length === 0) {
      // Suggest only names that exist in the categories still on the table.
      const pool = PRODUCTS.filter((p) => activeCat === "All" || p.category === activeCat);
      const names = pool.slice(0, 2).map((p) => p.name).join(" or ");
      $("#shop-empty-text").textContent = query
        ? `No sweets match "${searchInput.value.trim()}"${activeCat !== "All" ? " in " + activeCat : ""}.${names ? " Try " + names + "." : ""}`
        : "Nothing in this category yet.";
      $("#empty-clear-search").hidden = !query;
      $("#empty-clear-filter").hidden = activeCat === "All";
    }
    $$(".product", grid).forEach((el, i) => { el.style.animationDelay = `${Math.min(i, 8) * 40}ms`; });
    attachImageFallbacks(grid);
  }

  $("#filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    setCategory(chip.dataset.cat);
  });
  $("#sort").addEventListener("change", (e) => { sortMode = e.target.value; renderProducts(); });

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchClear.hidden = searchInput.value === "";
    searchTimer = setTimeout(() => { query = normalise(searchInput.value.trim()); renderProducts(); }, 120);
  });
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") { searchInput.value = ""; searchInput.dispatchEvent(new Event("input")); } });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
  });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".product");
    if (!card) return;
    if (e.target.closest("[data-add]")) addToCart(card.dataset.id);
    else if (e.target.closest("[data-wish]")) toggleWish(card.dataset.id);
    else if (e.target.closest("[data-view]")) openProduct(card.dataset.id);
  });

  $("#empty-clear-search").addEventListener("click", () => { searchInput.value = ""; searchInput.dispatchEvent(new Event("input")); });
  $("#empty-clear-filter").addEventListener("click", () => setCategory("All"));

  /* ---------------- Category filter ---------------- */

  // "Ghee" and "Syrup" are counter words; this line translates them.
  const CAT_HINT = {
    All: "",
    Barfi: "Pressed and cut into diamonds, finished with nuts or vark.",
    Ladoo: "Rolled by hand, one at a time.",
    Bengali: "Chenna sweets in milk or syrup. Keep them cold.",
    Syrup: "Fried, then soaked warm. Best eaten the same day.",
    Ghee: "Slow-cooked in desi ghee. Rich, and they keep well.",
  };

  function updateFilterFade() {
    const wrap = $("#filters-wrap"), row = $("#filters");
    if (!wrap || !row) return;
    wrap.classList.toggle("has-more", row.scrollWidth - row.clientWidth - row.scrollLeft > 4);
  }
  $("#filters").addEventListener("scroll", updateFilterFade, { passive: true });
  addEventListener("resize", updateFilterFade, { passive: true });

  function setCategory(cat) {
    activeCat = cat;
    $$(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.cat === cat));
    $("#cat-hint").textContent = CAT_HINT[cat] || "";
    // A chip chosen off-screen should not stay off-screen.
    const chip = $('.chip[data-cat="' + cat + '"]');
    if (chip) chip.scrollIntoView({
      inline: "center", block: "nearest",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    updateFilterFade();
    renderProducts();
  }

  /* ---------------- Gift boxes ---------------- */

  function renderBento() {
    $("#bento").innerHTML = GIFT_BOXES.map((b) => {
      const n = basketQty(b.id);
      return `
      <div class="bento-cell" data-id="${b.id}">
        <div class="bezel">
          <div class="bezel-core">
            <img src="${b.img}" alt="${escapeHtml(b.name)}" width="800" height="800" loading="lazy" decoding="async" />
          </div>
        </div>
        ${wishButton(b.id, b.name)}
        <span class="bento-note">Contents shown</span>
        <div class="bento-body">
          <h3>${escapeHtml(b.name)}</h3>
          <p>${escapeHtml(b.desc)}</p>
          <div class="bento-foot">
            <span class="price">${inr(b.price)} <small>/ ${escapeHtml(b.weight)}</small></span>
            ${b.soldOut ? soldOutBtn : `<button class="add-btn${n ? " in-basket" : ""}" data-add aria-label="${escapeHtml(addLabel(b.name, n))}">${addBtnInner(n)}</button>`}
          </div>
        </div>
      </div>`;
    }).join("");
  }

  $("#bento").addEventListener("click", (e) => {
    const cell = e.target.closest(".bento-cell");
    if (!cell) return;
    if (e.target.closest("[data-add]")) addToCart(cell.dataset.id);
    else if (e.target.closest("[data-wish]")) toggleWish(cell.dataset.id);
  });

  /* ---------------- Image fallback ---------------- */

  function attachImageFallbacks(root) {
    $$("img", root).forEach((img) => {
      img.addEventListener("error", () => {
        const wrap = img.closest(".product-media");
        if (!wrap || wrap.querySelector(".fallback")) return;
        const name = wrap.closest(".product")?.querySelector(".product-name")?.textContent || "";
        const fb = document.createElement("div");
        fb.className = "fallback";
        fb.textContent = name.charAt(0);
        wrap.appendChild(fb);
      }, { once: true });
    });
  }

  /* ---------------- Product quick view ---------------- */

  const productModal = $("#product-modal");
  function openProduct(id) {
    const p = findItem(id);
    $("#product-modal-body").dataset.id = p.id;
    const serves = typeof SERVES !== "undefined" ? SERVES[p.weight] : "";
    $("#product-modal-body").innerHTML = `
      <img src="${p.img}" alt="${escapeHtml(p.name)}" width="800" height="800" decoding="async" />
      <div class="modal-copy">
        <h2>${escapeHtml(p.name)}</h2>
        <p class="desc">${escapeHtml(p.desc)}</p>
        <p class="product-meta">${escapeHtml(p.weight)}${serves ? " · " + serves : ""}</p>
        <div class="price">${inr(p.price)}</div>
        <div class="modal-actions">
          <div class="qty" aria-label="Quantity">
            <button type="button" data-dec aria-label="Decrease quantity"><i class="ph-light ph-minus"></i></button>
            <span id="pm-qty">${minQty(p.id)}</span>
            <button type="button" data-inc aria-label="Increase quantity"><i class="ph-light ph-plus"></i></button>
          </div>
          <button class="btn btn-primary" id="pm-add"${p.soldOut ? " disabled" : ""}>${p.soldOut ? "Sold out today" : "Add to basket"} <span class="btn-ico"><i class="ph-light ph-plus" aria-hidden="true"></i></span></button>
          ${wishButton(p.id, p.name)}
        </div>
      </div>`;
    let qty = minQty(p.id);
    const qtyEl = $("#pm-qty");
    $("[data-inc]", productModal).addEventListener("click", () => { qty = Math.min(MAX_QTY, qty + qtyStep(p.id)); qtyEl.textContent = qty; });
    $("[data-dec]", productModal).addEventListener("click", () => { qty = Math.max(minQty(p.id), qty - qtyStep(p.id)); qtyEl.textContent = qty; });
    $("#pm-add").addEventListener("click", () => { addToCart(p.id, qty); productModal.close(); });
    $("[data-wish]", productModal).addEventListener("click", () => toggleWish(p.id));
    productModal.showModal();
  }

  /* ---------------- Checkout ---------------- */

  const checkoutModal = $("#checkout-modal");
  const checkoutForm = $("#checkout-form");

  // We deliver anywhere in India: any 6 digit PIN that doesn't start with 0.
  // Jaipur (302, 303) is same-day; everywhere else takes 2 to 5 days.
  const validPin = (pin) => /^[1-9]\d{5}$/.test(pin);
  const isSameDay = (pin) => pin.startsWith("302") || pin.startsWith("303");
  const etaText = (pin) => (isSameDay(pin) ? "today by evening" : "in 2 to 5 days");
  const hasChilled = () => cart.some((l) => findItem(l.id).tag === "Chilled");
  const orderTotal = () => { const sub = cartSubtotal(); return sub + (sub >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE); };
  const payMethod = () => checkoutForm.elements.pay.value;

  function renderSummary() {
    const sub = cartSubtotal();
    const delivery = sub >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
    $("#checkout-summary").innerHTML = `
      ${cart.map((l) => { const p = findItem(l.id); return `<div class="row muted"><span>${escapeHtml(p.name)} × ${l.qty}</span><span>${inr(p.price * l.qty)}</span></div>`; }).join("")}
      <div class="row"><span>Subtotal</span><span>${inr(sub)}</span></div>
      <div class="row"><span>Delivery</span><span>${delivery === 0 ? "Free" : inr(delivery)}</span></div>
      <div class="row total"><span>Total</span><span>${inr(sub + delivery)}</span></div>`;
  }

  // The CTA names what happens on press, so "Place order" never implies a silent charge.
  function renderPayState() {
    const method = payMethod();
    const total = inr(orderTotal());
    $$(".pay-detail", checkoutForm).forEach((d) => { d.hidden = d.dataset.pay !== method; });
    $("#cod-note").innerHTML = `<i class="ph-light ph-hand-coins" aria-hidden="true"></i>Keep ${total} ready for the rider. UPI at the door works too.`;
    const label = LIVE
      ? { upi: `Pay ${total} with UPI`, card: `Pay ${total} by card`, cod: `Place order, pay ${total} on delivery` }[method]
      : { upi: `Pay ${total} by UPI`, card: "Continue to card payment", cod: `Place order, pay ${total} on delivery` }[method];
    $("#place-order").textContent = label;
  }

  function renderDeliveryNote() {
    const pin = $("#co-pin").value.trim();
    const note = $("#delivery-note");
    note.hidden = !validPin(pin);
    if (validPin(pin)) {
      const city = $("#co-city").value.trim();
      const where = isSameDay(pin) ? "Jaipur" : city || `PIN ${pin}`;
      note.innerHTML = `<i class="ph-light ph-truck" aria-hidden="true"></i><span>We deliver to ${escapeHtml(where)}. Order now and it reaches you <strong>${etaText(pin)}</strong>.</span>`;
    }
  }

  function renderAssurance() {
    const pin = $("#co-pin").value.trim();
    const eta = validPin(pin) ? `Delivered ${etaText(pin)}` : "Same-day in Jaipur, 2 to 5 days anywhere in India";
    const items = [
      ["ph-sun-horizon", "Made fresh on the morning of dispatch, not from stock."],
      ["ph-truck", `${eta}, with a call from the rider on the way.`],
    ];
    if (hasChilled()) items.push(["ph-snowflake", "Rasmalai travels in an insulated box with ice packs. Refrigerate on arrival."]);
    items.push(["ph-arrows-counter-clockwise", "Arrived broken or late? We replace it free, no questions."]);
    items.push(["ph-chat-circle-text", `Questions? <a href="https://wa.me/918744667777" target="_blank" rel="noreferrer">WhatsApp us on +91 87446 67777</a>.`]);
    $("#assure").innerHTML = items.map(([icon, text]) => `<li><i class="ph ${icon}" aria-hidden="true"></i><span>${text}</span></li>`).join("");
  }

  $("#checkout-open").addEventListener("click", () => {
    if (cart.length === 0) return;
    closeCart();
    checkoutForm.hidden = false;
    $("#order-success").hidden = true;
    renderSummary();
    prefillCheckout();
    renderPayState();
    renderDeliveryNote();
    renderAssurance();
    checkoutModal.showModal();
    $("#co-name").focus();
  });

  checkoutForm.addEventListener("change", (e) => { if (e.target.name === "pay") renderPayState(); });
  $("#co-city").addEventListener("input", renderDeliveryNote);
  $("#co-pin").addEventListener("input", () => {
    const input = $("#co-pin");
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
    if (input.value.length === 6) clearError(input);
    renderDeliveryNote();
    renderAssurance();
  });

  function setError(input, message) {
    const field = input.closest(".field");
    const err = field.querySelector(".field-error");
    field.classList.add("has-error");
    if (message) err.textContent = message;
    err.hidden = false;
    err.id = err.id || input.id + "-error";
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", err.id);
    return false;
  }
  function clearError(input) {
    const field = input.closest(".field");
    field.classList.remove("has-error");
    const err = field.querySelector(".field-error");
    if (err) err.hidden = true;
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    return true;
  }
  function validateField(input, test, message) {
    return test(input.value.trim()) ? clearError(input) : setError(input, message);
  }

  // Indian mobile: 10 digits starting 6-9, optionally prefixed by 0 or +91, any spacing or hyphens.
  const normalisePhone = (v) => v.replace(/[\s\-()]/g, "").replace(/^(\+91|0091|0)/, "");

  /* Orders go to the shop's server when it is connected (window.MISHRI_STORE,
     set by /api/store); otherwise this stays a demo that keeps orders in
     this browser. */
  const STORE = window.MISHRI_STORE || { orders: false, razorpayKey: "" };
  const LIVE = Boolean(STORE.orders);
  // /api/store did not load (a network blip, or no server at all). Checkout
  // then asks the server first, so a live shop never takes a demo order.
  const MODE_UNKNOWN = !window.MISHRI_STORE;
  const ONLINE_PAY = LIVE && Boolean(STORE.razorpayKey);

  // Ask for an email only when the shop can actually send one.
  if (!(LIVE && STORE.emails)) $("#co-email-field").remove();
  const customerEmail = () => ($("#co-email") ? $("#co-email").value.trim().toLowerCase() : "");
  const validEmail = (v) => /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(v);

  if (LIVE) {
    // Razorpay collects UPI and cards on its own page; no UPI ID is typed here.
    $('.pay-detail[data-pay="upi"]', checkoutForm).remove();
    $('input[value="upi"]', checkoutForm).closest(".pay-option").querySelector(".pay-desc").textContent = "Pay now from any UPI app on Razorpay's secure page.";
    $('input[value="card"]', checkoutForm).closest(".pay-option").querySelector(".pay-desc").textContent = "Pay now on Razorpay's secure page.";
    $('.pay-detail[data-pay="card"] .pay-note', checkoutForm).innerHTML = '<i class="ph-light ph-lock-key" aria-hidden="true"></i>Card details go to Razorpay, never to this site.';
    if (!ONLINE_PAY) {
      // No payment gateway yet: cash on delivery only.
      $$('input[value="upi"], input[value="card"]', checkoutForm).forEach((i) => i.closest(".pay-option").remove());
      $('input[value="cod"]', checkoutForm).checked = true;
    }
    $("#checkout-fine").textContent = ONLINE_PAY ? "Online payments are processed securely by Razorpay." : "You pay the rider when the box arrives.";
  }

  const checkoutError = $("#checkout-error");
  const showCheckoutError = (message) => { checkoutError.textContent = message; checkoutError.hidden = !message; };

  function setPlacing(btn, method) {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    const busy = LIVE
      ? { upi: "Opening secure payment", card: "Opening secure payment", cod: "Placing order" }
      : { upi: "Sending UPI request", card: "Opening secure page", cod: "Placing order" };
    btn.innerHTML = `<i class="ph-light ph-circle-notch" aria-hidden="true"></i>${busy[method]}`;
  }
  function resetPlaceButton() {
    const btn = $("#place-order");
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    renderPayState();
  }

  // Shows the receipt and empties the basket. lines: [{ name, qty, amount }].
  function showOrderPlaced({ no, method, total, lines, note, city, pin, title, payLine, fine }) {
    const name = $("#co-name").value.trim().split(" ")[0];
    $("#order-success-title").textContent = title;
    $("#order-success-text").textContent = `Thanks, ${name}. Order ${no} reaches ${city} ${etaText(pin)}. ${payLine}`;
    $("#order-receipt").innerHTML = `
      ${lines.map((l) => `<div class="row muted"><span>${escapeHtml(l.name)} × ${l.qty}</span><span>${inr(l.amount)}</span></div>`).join("")}
      <div class="row total"><span>${method === "cod" ? "Due on delivery" : "Total"}</span><span>${inr(total)}</span></div>
      ${hasChilled() ? `<div class="row muted"><span>Packed cold with ice packs</span><i class="ph-light ph-snowflake" aria-hidden="true"></i></div>` : ""}
      ${note ? `<div class="note">Card reads: “${escapeHtml(note)}”</div>` : ""}
      ${fine ? `<div class="muted">${escapeHtml(fine)}</div>` : ""}`;

    if (account) { account.orders = (account.orders || 0) + 1; saveAccount(); }
    checkoutForm.hidden = true;
    $("#order-success").hidden = false;
    $("#order-success .btn").focus();
    cart = [];
    pendingPayment = null;
    saveCart();
    renderCart();
    checkoutForm.reset();
    resetPlaceButton();
    showCheckoutError("");
    $$(".field input, .field textarea", checkoutForm).forEach((i) => clearError(i));
    $("#delivery-note").hidden = true;
  }

  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showCheckoutError("");
    const pinInput = $("#co-pin");
    const pin = pinInput.value.trim();
    const checks = [
      validateField($("#co-name"), (v) => v.length >= 2),
      validateField($("#co-phone"), (v) => /^[6-9]\d{9}$/.test(normalisePhone(v))),
      $("#co-email") ? validateField($("#co-email"), (v) => !v || validEmail(v)) : true,
      validateField($("#co-address"), (v) => v.length >= 6),
      validateField($("#co-city"), (v) => v.length >= 2),
      validPin(pin) ? clearError(pinInput) : setError(pinInput, "Enter a valid 6 digit PIN code."),
      !LIVE && payMethod() === "upi"
        ? validateField($("#co-upi"), (v) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v))
        : true,
    ];
    if (checks.includes(false)) {
      checkoutForm.querySelector(".field.has-error input, .field.has-error textarea")?.focus();
      return;
    }

    const method = payMethod();
    setPlacing($("#place-order"), method);
    if (LIVE || MODE_UNKNOWN) { placeLiveOrder(method, pin); return; }
    placeDemoOrder(method, pin);
  });

  // Demo: nothing leaves the browser.
  function placeDemoOrder(method, pin) {
    const total = orderTotal();
    setTimeout(() => {
      const no = "MSH-" + Math.floor(100000 + Math.random() * 900000);
      const city = $("#co-city").value.trim();
      const note = $("#co-note").value.trim();
      const upi = $("#co-upi").value.trim();
      recordOrder({
        no, at: new Date().toISOString(), status: "new", method, total,
        customer: { name: $("#co-name").value.trim(), phone: $("#co-phone").value.trim(), address: $("#co-address").value.trim(), city, pin },
        note, lines: cart.map((l) => { const p = findItem(l.id); return { id: l.id, name: p.name, qty: l.qty, price: p.price }; }),
      });
      showOrderPlaced({
        no, method, total, note, city, pin,
        lines: cart.map((l) => { const p = findItem(l.id); return { name: p.name, qty: l.qty, amount: p.price * l.qty }; }),
        title: method === "card" ? "Order placed, payment pending" : "Order placed",
        payLine: {
          upi: `A UPI request for ${inr(total)} has gone to ${upi}. Approve it in your app and we start packing.`,
          card: `Pay ${inr(total)} on the bank's secure page to confirm. We hold the order for 30 minutes.`,
          cod: `Pay ${inr(total)} in cash or by UPI when the box reaches you.`,
        }[method],
        fine: "Demo store. Nothing was charged and nothing was sent.",
      });
    }, 1100);
  }

  /* ---------------- Live orders ---------------- */

  // An online order awaiting payment; pressing Pay again reopens it rather
  // than creating a second order, as long as the details are unchanged.
  let pendingPayment = null;

  async function postJson(url, body) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      // No database connected, or no server behind these pages at all.
      const noServer = (res.status === 503 && data.error === "storage-not-configured") || res.status === 404 || res.status === 405;
      return res.ok ? data : { error: data.error || "Something went wrong. Please try again.", field: data.field, noServer };
    } catch {
      return { error: "We could not reach the shop. Check your connection and try again." };
    }
  }

  function liveFailed(result) {
    const input = result.field && $(`#co-${result.field}`);
    if (input) { setError(input, result.error); input.focus(); } else showCheckoutError(result.error);
    resetPlaceButton();
  }

  async function placeLiveOrder(method, pin) {
    const payload = {
      method,
      customer: {
        name: $("#co-name").value.trim(), phone: $("#co-phone").value.trim(), address: $("#co-address").value.trim(),
        city: $("#co-city").value.trim(), pin, email: customerEmail(),
      },
      note: $("#co-note").value.trim(),
      lines: cart.map((l) => ({ id: l.id, qty: l.qty })),
    };
    const key = JSON.stringify(payload);
    if (pendingPayment && pendingPayment.key === key) { openRazorpay(pendingPayment); return; }

    const result = await postJson("/api/orders", payload);
    if (result.noServer && MODE_UNKNOWN) { placeDemoOrder(method, pin); return; }
    if (result.error) { liveFailed(result); return; }
    if (result.razorpay) {
      pendingPayment = { key, order: result.order, razorpay: result.razorpay };
      openRazorpay(pendingPayment);
      return;
    }
    liveOrderPlaced(result.order);
  }

  function liveOrderPlaced(order) {
    const paid = order.payment && order.payment.state === "paid";
    showOrderPlaced({
      no: order.no, method: order.method, total: order.total, note: order.note,
      city: order.customer.city, pin: order.customer.pin,
      lines: order.lines.map((l) => ({ name: l.name, qty: l.qty, amount: l.price * l.qty })),
      title: paid ? "Paid, order placed" : "Order placed",
      payLine: (paid ? `We have your payment of ${inr(order.total)} and start packing now.` : `Pay ${inr(order.total)} in cash or by UPI when the box reaches you.`)
        + (order.customer.email && STORE.emails ? ` A confirmation is on its way to ${order.customer.email}.` : ""),
      fine: "",
    });
  }

  let razorpayScript = null;
  const loadRazorpay = () => (razorpayScript = razorpayScript || new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => { razorpayScript = null; reject(new Error("load")); };
    document.head.appendChild(s);
  }));

  async function openRazorpay({ order, razorpay }) {
    let Razorpay;
    try { Razorpay = await loadRazorpay(); } catch {
      liveFailed({ error: "The payment page did not load. Check your connection and press Pay again." });
      return;
    }
    const rzp = new Razorpay({
      key: razorpay.key,
      order_id: razorpay.orderId,
      amount: razorpay.amount,
      currency: razorpay.currency,
      name: "Mishri Sweet House",
      description: `Order ${order.no}`,
      prefill: { name: order.customer.name, contact: normalisePhone(order.customer.phone) },
      notes: { order_no: order.no },
      theme: { color: "#e8961e" },
      handler: async (response) => {
        setPlacing($("#place-order"), "cod");
        $("#place-order").lastChild.textContent = "Confirming payment";
        const result = await postJson("/api/payments/verify", { no: order.no, ...response });
        if (result.error) { liveFailed(result); return; }
        liveOrderPlaced(result.order);
      },
      modal: {
        ondismiss: () => {
          showCheckoutError(`Payment not finished. Your order ${order.no} is saved: press Pay to try again, or choose pay on delivery.`);
          resetPlaceButton();
        },
      },
    });
    rzp.open();
  }

  // Demo mode keeps orders in this browser so admin.html can list them.
  function recordOrder(order) {
    try {
      const orders = JSON.parse(localStorage.getItem("mishri-orders") || "[]");
      orders.unshift(order);
      localStorage.setItem("mishri-orders", JSON.stringify(orders.slice(0, 500)));
    } catch {}
  }

  /* Close buttons and backdrop clicks for both dialogs */
  $$(".modal").forEach((dlg) => {
    $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  });

  /* ---------------- Newsletter ---------------- */

  // Live: the address is saved for festival-box news. Demo: just says thanks.
  $("#newsletter-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#nl-email");
    const btn = $("#newsletter-form .btn");
    const email = input.value.trim();
    const show = (error, success) => {
      $("#nl-error").hidden = !error;
      if (error) $("#nl-error").textContent = error;
      $("#nl-success").hidden = !success;
      if (success) $("#nl-success").textContent = success;
    };
    if (!validEmail(email)) { show("Please enter a valid email address.", ""); input.focus(); return; }
    if (!(LIVE || MODE_UNKNOWN)) { show("", "You are on the list."); input.value = ""; return; }
    btn.disabled = true;
    const result = await postJson("/api/subscribe", { email });
    btn.disabled = false;
    if (result.noServer && MODE_UNKNOWN) { show("", "You are on the list."); input.value = ""; return; }
    if (result.error) { show(result.error, ""); return; }
    show("", result.already ? "You were already on the list. We'll be in touch." : "You are on the list. We'll email you when festival boxes open.");
    input.value = "";
  });

  /* ---------------- Scroll reveal ---------------- */

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      io.unobserve(en.target);
      // Release the compositor layer once the element has finished arriving.
      en.target.addEventListener("transitionend", () => en.target.classList.add("is-settled"), { once: true });
    });
  }, { threshold: 0.2 });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------------- Hero counter strip ---------------- */

  // Batch times are demo values: a plausible morning clock for today's counter.
  const BATCH_TIMES = ["05:10", "05:40", "06:05", "06:20", "06:40", "07:05", "07:30", "07:55"];
  function renderHeroStrip() {
    const picks = PRODUCTS.slice(0, 8);
    $("#hero-strip").innerHTML = picks.map((p, i) => `
      <button class="tile-arch" data-id="${p.id}" aria-label="View ${escapeHtml(p.name)}">
        <div class="arch">
          <img src="${p.img}" alt="" width="400" height="560" decoding="async" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />
        </div>
        <span class="tile-cap"><span class="stamp">${BATCH_TIMES[i]}</span>${escapeHtml(p.name)}</span>
      </button>`).join("");
  }
  $("#hero-strip").addEventListener("click", (e) => {
    const tile = e.target.closest(".tile-arch");
    if (tile) openProduct(tile.dataset.id);
  });

  /* ---------------- Sign in ----------------

     DEMO ONLY. No SMS is sent and no OAuth round trip happens: the code is
     generated in the page and shown on screen, and "Google" returns a fixed
     sample profile. To make this real you need (a) an SMS/OTP provider or
     Firebase Phone Auth, and (b) Google Identity Services with a client ID
     plus a server to verify the ID token. Nothing here should be treated as
     authentication.                                                        */

  const authModal = $("#auth-modal");
  const AUTH_KEY = "mishri-account";
  let account = null;
  try { account = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch { account = null; }

  let pendingPhone = "";
  let pendingCode = "";

  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const prettyPhone = (d) => "+91 " + d.slice(0, 5) + " " + d.slice(5);

  function saveAccount() {
    try {
      if (account) localStorage.setItem(AUTH_KEY, JSON.stringify(account));
      else localStorage.removeItem(AUTH_KEY);
    } catch {}
  }

  function showAuthStep(step) {
    $$(".auth-step", authModal).forEach((el) => { el.hidden = el.id !== "auth-step-" + step; });
  }

  function renderAccount() {
    const btn = $("#account-open");
    const avatar = $("#account-avatar");
    const icon = $("i", btn);
    if (account) {
      avatar.hidden = false;
      avatar.textContent = initials(account.name);
      icon.hidden = true;
      btn.setAttribute("aria-label", account.name + ", account");
      $("#menu-account").textContent = account.name.split(" ")[0] + "'s account";
    } else {
      avatar.hidden = true;
      icon.hidden = false;
      btn.setAttribute("aria-label", "Sign in");
      $("#menu-account").textContent = "Sign in";
    }
  }

  function renderAccountPanel() {
    if (!account) return;
    $("#account-avatar-lg").textContent = initials(account.name);
    $("#account-name").textContent = account.name;
    $("#account-detail").textContent =
      account.via === "google" ? account.email + " · signed in with Google" : prettyPhone(account.phone);
    const orders = account.orders || 0;
    $("#account-stats").innerHTML = [
      ["Saved for later", String(wishlist.length)],
      ["In the basket", String(cartCount())],
      ["Orders this session", String(orders)],
    ].map(([k, v]) => `<li><span>${k}</span><strong>${escapeHtml(v)}</strong></li>`).join("");
  }

  function openAuth() {
    document.querySelector(".island")?.classList.remove("is-tucked");
    closeCart();
    closeWishlist();
    if (account) { renderAccountPanel(); showAuthStep("account"); }
    else { showAuthStep("phone"); }
    authModal.showModal();
    const first = account ? $("#sign-out") : $("#auth-phone");
    first?.focus();
  }

  $("#account-open").addEventListener("click", openAuth);
  $("#menu-account").addEventListener("click", () => { setMenu(false); openAuth(); });

  // --- phone step ---
  $("#auth-phone").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  $("#phone-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#auth-phone");
    const digits = input.value.trim();
    if (!/^[6-9]\d{9}$/.test(digits)) { setError(input, null); return; }
    clearError(input);
    pendingPhone = digits;
    // Demo: the "sent" code is generated here and shown, never transmitted.
    pendingCode = String(Math.floor(100000 + Math.random() * 900000));
    $("#code-target").textContent = prettyPhone(digits);
    $("#demo-code-note").textContent = "Demo code: " + pendingCode;
    $("#auth-code").value = "";
    clearError($("#auth-code"));
    showAuthStep("code");
    $("#auth-code").focus();
  });

  $("#auth-back").addEventListener("click", () => {
    showAuthStep("phone");
    $("#auth-phone").focus();
  });

  // --- code step ---
  $("#auth-code").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    if (e.target.value.length === 6) clearError(e.target);
  });

  $("#code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#auth-code");
    if (input.value.trim() !== pendingCode) { setError(input, null); input.select(); return; }
    clearError(input);
    signIn({ name: "Guest " + pendingPhone.slice(-4), phone: pendingPhone, via: "phone" });
  });

  // --- Google (mock) ---
  $("#google-signin").addEventListener("click", () => {
    const btn = $("#google-signin");
    btn.disabled = true;
    btn.textContent = "Opening Google";
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = GOOGLE_LABEL;
      signIn({ name: "Aarti Sharma", email: "aarti.sharma@gmail.com", via: "google" });
    }, 700);
  });
  const GOOGLE_LABEL = $("#google-signin").innerHTML;

  function signIn(profile) {
    account = Object.assign({ orders: 0 }, account, profile);
    saveAccount();
    renderAccount();
    renderAccountPanel();
    showAuthStep("account");
    toast("Signed in as " + account.name);
    prefillCheckout();
  }

  $("#sign-out").addEventListener("click", () => {
    const who = account ? account.name : "";
    account = null;
    saveAccount();
    renderAccount();
    authModal.close();
    toast(who ? "Signed out of " + who : "Signed out");
  });

  // A signed-in visitor should not retype what we already know.
  function prefillCheckout() {
    if (!account) return;
    const name = $("#co-name"), phone = $("#co-phone");
    if (name && !name.value && account.via === "google") name.value = account.name;
    if (phone && !phone.value && account.phone) phone.value = prettyPhone(account.phone);
  }

  renderAccount();

  /* ---------------- Init ---------------- */

  updateFilterFade();
  renderHeroStrip();
  renderProducts();
  renderBento();
  attachImageFallbacks($("#hero-strip"));
  attachImageFallbacks($("#bento"));
  renderCart();
  renderWishlist();
})();

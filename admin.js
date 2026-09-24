/* Mishri Sweet House. Shop admin: overview, catalogue edits, orders.

   DEMO ONLY. Everything here lives in this browser's localStorage:
   catalogue edits under "mishri-admin" (read by store-settings.js on the
   storefront) and orders under "mishri-orders" (written by app.js at
   checkout). There is no authentication; a real shop needs a server that
   owns the catalogue and the orders, and a sign-in in front of this page. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SETTINGS_KEY = "mishri-admin";
  const ORDERS_KEY = "mishri-orders";
  const FIELDS = ["name", "price", "weight", "tag", "desc"];
  const AVAILABILITY = { live: "On sale", soldout: "Sold out", hidden: "Hidden" };
  const STATUSES = { new: "New", preparing: "Preparing", dispatched: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
  const OPEN = ["new", "preparing", "dispatched"];
  const PAY = { upi: "UPI", card: "Card", cod: "Cash on delivery" };

  // products.js is loaded untouched here, so these are the originals.
  const ITEMS = [
    ...PRODUCTS.map((p) => Object.assign({ kind: "sweet" }, p)),
    ...GIFT_BOXES.map((b) => Object.assign({ kind: "gift", category: "Gift box" }, b)),
  ];
  const original = (id) => ITEMS.find((i) => i.id === id);

  /* ---------------- storage ---------------- */

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };

  let settings = read(SETTINGS_KEY, { items: {} });
  if (!settings.items) settings.items = {};
  let orders = read(ORDERS_KEY, []);

  const edits = (id) => settings.items[id] || {};
  const current = (id) => {
    const base = original(id), e = edits(id);
    const out = Object.assign({}, base, { status: e.status || "live" });
    FIELDS.forEach((k) => { if (e[k] !== undefined) out[k] = e[k]; });
    return out;
  };
  const isEdited = (id) => Object.keys(edits(id)).length > 0;

  // Store only what differs from products.js, so a later catalogue update
  // still reaches every field the shop never touched.
  function setField(id, key, value) {
    const base = original(id);
    const e = Object.assign({}, edits(id));
    const same = key === "status" ? value === "live" : value === base[key];
    if (same) delete e[key]; else e[key] = value;
    if (Object.keys(e).length) settings.items[id] = e; else delete settings.items[id];
    return write(SETTINGS_KEY, settings);
  }

  function saveOrders() { write(ORDERS_KEY, orders); }

  /* ---------------- theme, shared with the store ---------------- */

  const themeBtn = $("#theme-toggle");
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    const dark = theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches);
    themeBtn.innerHTML = `<i class="ph-light ${dark ? "ph-sun" : "ph-moon"}" aria-hidden="true"></i>`;
  }
  try { applyTheme(localStorage.getItem("mishri-theme") || ""); } catch { applyTheme(""); }
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const isDark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("mishri-theme", next); } catch {}
  });

  /* ---------------- toast ---------------- */

  const toastEl = $("#toast"), toastAction = $("#toast-action");
  let toastTimer, toastHandler = null;
  function toast(msg, action) {
    $("#toast-text").textContent = msg;
    toastHandler = action ? action.onClick : null;
    toastAction.hidden = !action;
    if (action) toastAction.textContent = action.label;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove("is-visible"); toastHandler = null; }, action ? 6000 : 2200);
  }
  toastAction.addEventListener("click", () => {
    if (toastHandler) toastHandler();
    toastEl.classList.remove("is-visible");
    toastHandler = null;
  });

  /* ---------------- tabs ---------------- */

  const TABS = ["overview", "catalogue", "orders"];
  function showTab() {
    const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
    TABS.forEach((t) => { $("#panel-" + t).hidden = t !== tab; });
    $$(".admin-tabs a").forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    render();
  }
  window.addEventListener("hashchange", () => { showTab(); window.scrollTo(0, 0); });

  /* ---------------- overview ---------------- */

  const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const fmtDate = (iso) => dateFmt.format(new Date(iso));
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
  const statusPill = (s) => `<span class="admin-pill is-${s}">${STATUSES[s] || s}</span>`;

  function renderOverview() {
    $("#overview-date").textContent = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    const live = orders.filter((o) => o.status !== "cancelled");
    const today = live.filter((o) => isToday(o.at));
    const open = orders.filter((o) => OPEN.includes(o.status));
    const counts = { live: 0, soldout: 0, hidden: 0 };
    ITEMS.forEach((i) => { counts[current(i.id).status]++; });

    const stat = (label, value, sub) => `
      <div class="admin-stat">
        <span class="admin-stat-label">${label}</span>
        <span class="admin-stat-value">${value}</span>
        <span class="admin-stat-sub">${sub}</span>
      </div>`;
    $("#stats").innerHTML =
      stat("Orders today", today.length, today.length ? inr(today.reduce((n, o) => n + o.total, 0)) + " taken" : "None yet") +
      stat("To fulfil", open.length, `${orders.filter((o) => o.status === "new").length} new, ${orders.filter((o) => o.status === "dispatched").length} out for delivery`) +
      stat("Takings", inr(live.reduce((n, o) => n + o.total, 0)), `${live.length} order${live.length === 1 ? "" : "s"}, cancelled excluded`) +
      stat("On sale", `${counts.live}<small> / ${ITEMS.length}</small>`, `${counts.soldout} sold out, ${counts.hidden} hidden`);

    const recent = orders.slice(0, 5);
    $("#recent-orders").innerHTML = recent.length
      ? `<ul class="admin-mini">${recent.map((o) => `
          <li>
            <span><strong>${escapeHtml(o.no)}</strong> ${escapeHtml(o.customer.name)}, ${escapeHtml(o.customer.city)}</span>
            <span>${inr(o.total)} ${statusPill(o.status)}</span>
          </li>`).join("")}</ul>`
      : `<p class="admin-empty">No orders yet. Place one through checkout on the <a href="index.html#shop" class="admin-link">store</a> and it appears here.</p>`;

    const notes = [];
    const fresh = orders.filter((o) => o.status === "new");
    if (fresh.length) notes.push(`<li><i class="ph-light ph-bell-ringing" aria-hidden="true"></i><a href="#orders" data-go-filter="new">${fresh.length} new order${fresh.length === 1 ? "" : "s"} waiting to be prepared</a></li>`);
    ITEMS.filter((i) => current(i.id).status === "soldout").forEach((i) =>
      notes.push(`<li><i class="ph-light ph-prohibit" aria-hidden="true"></i><span>${escapeHtml(current(i.id).name)} is marked sold out</span></li>`));
    const hidden = ITEMS.filter((i) => current(i.id).status === "hidden");
    if (hidden.length) notes.push(`<li><i class="ph-light ph-eye-slash" aria-hidden="true"></i><span>Hidden from the store: ${hidden.map((i) => escapeHtml(current(i.id).name)).join(", ")}</span></li>`);
    $("#attention").innerHTML = notes.length ? notes.join("") : `<li class="admin-empty"><i class="ph-light ph-check-circle" aria-hidden="true"></i>All clear. Everything is on sale and no order is waiting.</li>`;

    const badge = $("#tab-order-count");
    badge.textContent = fresh.length;
    badge.hidden = fresh.length === 0;
  }

  $("#attention").addEventListener("click", (e) => {
    const a = e.target.closest("[data-go-filter]");
    if (a) orderFilter = a.dataset.goFilter;
  });

  /* ---------------- catalogue ---------------- */

  let catFilter = "all";
  let catQuery = "";

  function itemCard(i) {
    const c = current(i.id);
    const page = i.kind === "gift" ? `gifts/${i.name.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}/` : `sweets/${i.id}/`;
    const field = (key, label, input) => `<label class="admin-field${edits(i.id)[key] !== undefined ? " is-edited" : ""}"><span>${label}</span>${input}</label>`;
    return `
      <article class="admin-item is-${c.status}" data-id="${i.id}">
        <div class="admin-item-media">
          <img src="${i.img}" alt="" width="160" height="160" loading="lazy" decoding="async" />
        </div>
        <div class="admin-item-body">
          <div class="admin-item-head">
            <div>
              <span class="admin-item-kicker">${kicker(i)}</span>
              <h3>${escapeHtml(c.name)}</h3>
            </div>
            <div class="admin-seg" role="radiogroup" aria-label="Availability of ${escapeHtml(c.name)}">
              ${Object.entries(AVAILABILITY).map(([k, label]) => `
                <button type="button" role="radio" data-status="${k}" aria-checked="${c.status === k}">${label}</button>`).join("")}
            </div>
          </div>
          <div class="admin-fields">
            ${field("name", "Name", `<input type="text" data-field="name" value="${escapeHtml(c.name)}" required />`)}
            ${field("price", "Price (₹)", `<input type="number" data-field="price" value="${c.price}" min="1" step="1" inputmode="numeric" required />`)}
            ${field("weight", "Pack size", `<input type="text" data-field="weight" value="${escapeHtml(c.weight)}" required />`)}
            ${field("tag", "Tag", `<input type="text" data-field="tag" value="${escapeHtml(c.tag || "")}" placeholder="None" />`)}
          </div>
          ${field("desc", "Card description", `<textarea data-field="desc" rows="3" required>${escapeHtml(c.desc)}</textarea>`)}
          <div class="admin-item-foot">
            <span class="admin-orig">${wasPrice(i)}</span>
            <a href="${page}" class="admin-link" target="_blank" rel="noopener">Product page</a>
            <button type="button" class="admin-link" data-restore ${isEdited(i.id) ? "" : "hidden"}>Restore original</button>
          </div>
        </div>
      </article>`;
  }

  function renderCatalogue() {
    const q = catQuery.toLowerCase();
    const list = ITEMS.filter((i) => {
      const c = current(i.id);
      if (catFilter === "edited" ? !isEdited(i.id) : catFilter !== "all" && c.status !== catFilter) return false;
      return !q || [c.name, c.category, c.desc, c.tag].join(" ").toLowerCase().includes(q);
    });
    $("#items").innerHTML = list.map(itemCard).join("");
    $("#items-empty").hidden = list.length > 0;
    $("#items-empty").textContent = q ? `Nothing matches "${catQuery}".` : "Nothing here.";
  }

  const kicker = (i) => `${escapeHtml(i.category)}${isEdited(i.id) ? ' · <span class="admin-edited">Edited</span>' : ""}`;
  const wasPrice = (i) => (current(i.id).price !== i.price ? `Was ${inr(i.price)} in products.js` : "");

  // Update a card's labels in place: re-rendering it would steal focus from
  // whichever field the person just tabbed into.
  function syncCard(id) {
    const el = $(`.admin-item[data-id="${id}"]`);
    if (!el) return;
    const i = original(id), e = edits(id);
    $("h3", el).textContent = current(id).name;
    $(".admin-item-kicker", el).innerHTML = kicker(i);
    $(".admin-orig", el).textContent = wasPrice(i);
    $("[data-restore]", el).hidden = !isEdited(id);
    $$("[data-field]", el).forEach((f) => f.closest(".admin-field").classList.toggle("is-edited", e[f.dataset.field] !== undefined));
  }

  $("#items").addEventListener("change", (e) => {
    const input = e.target.closest("[data-field]");
    if (!input) return;
    const id = input.closest(".admin-item").dataset.id;
    const key = input.dataset.field;
    let value = input.value.trim();
    if (key === "price") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        toast("Price must be a whole number of rupees, 1 or more");
        input.value = current(id).price;
        return;
      }
      value = n;
    } else if (key !== "tag" && !value) {
      toast("This field cannot be empty");
      input.value = current(id)[key];
      return;
    }
    if (!setField(id, key, value)) { toast("Could not save. Browser storage is full or blocked."); return; }
    input.value = value;
    syncCard(id);
    toast(`${current(id).name} saved`);
  });

  $("#items").addEventListener("click", (e) => {
    const card = e.target.closest(".admin-item");
    if (!card) return;
    const id = card.dataset.id;
    const statusBtn = e.target.closest("[data-status]");
    if (statusBtn) {
      const prev = current(id).status;
      const next = statusBtn.dataset.status;
      if (prev === next) return;
      setField(id, "status", next);
      renderCatalogue();
      $(`.admin-item[data-id="${id}"] [data-status="${next}"]`)?.focus();
      toast(`${current(id).name}: ${AVAILABILITY[next].toLowerCase()}`, {
        label: "Undo",
        onClick: () => { setField(id, "status", prev); renderCatalogue(); },
      });
      return;
    }
    if (e.target.closest("[data-restore]")) {
      const before = Object.assign({}, edits(id));
      delete settings.items[id];
      write(SETTINGS_KEY, settings);
      renderCatalogue();
      toast(`${original(id).name} restored`, {
        label: "Undo",
        onClick: () => { settings.items[id] = before; write(SETTINGS_KEY, settings); renderCatalogue(); },
      });
    }
  });

  // Arrow keys move through the availability control, like native radios.
  $("#items").addEventListener("keydown", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const all = $$("[data-status]", btn.parentElement);
    const next = all[(all.indexOf(btn) + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
    e.preventDefault();
    next.click();
  });

  $("#cat-search").addEventListener("input", (e) => { catQuery = e.target.value.trim(); renderCatalogue(); });
  $("#cat-filters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    catFilter = chip.dataset.filter;
    $$(".chip", e.currentTarget).forEach((c) => c.classList.toggle("is-active", c === chip));
    renderCatalogue();
  });
  $("#cat-reset-all").addEventListener("click", () => {
    const n = Object.keys(settings.items).length;
    if (!n) { toast("Nothing has been edited"); return; }
    if (!confirm(`Restore all ${n} edited item${n === 1 ? "" : "s"} to the prices, copy and availability in products.js?`)) return;
    const before = settings;
    settings = { items: {} };
    write(SETTINGS_KEY, settings);
    renderCatalogue();
    toast("Catalogue restored", { label: "Undo", onClick: () => { settings = before; write(SETTINGS_KEY, settings); renderCatalogue(); } });
  });

  /* ---------------- orders ---------------- */

  let orderFilter = "all";
  let orderQuery = "";

  function renderOrderFilters() {
    const count = (s) => (s === "all" ? orders.length : s === "open" ? orders.filter((o) => OPEN.includes(o.status)).length : orders.filter((o) => o.status === s).length);
    const filters = [["all", "All"], ["open", "To fulfil"], ...Object.entries(STATUSES)];
    $("#order-filters").innerHTML = filters.map(([k, label]) =>
      `<button class="chip${orderFilter === k ? " is-active" : ""}" data-filter="${k}">${label} <span class="admin-chip-n">${count(k)}</span></button>`).join("");
  }

  function orderCard(o) {
    const c = o.customer;
    return `
      <article class="admin-order is-${o.status}" data-no="${escapeHtml(o.no)}">
        <div class="admin-order-head">
          <div>
            <h3>${escapeHtml(o.no)} ${statusPill(o.status)}</h3>
            <span class="admin-order-when">${fmtDate(o.at)} · ${PAY[o.method] || escapeHtml(o.method)}</span>
          </div>
          <label class="sort admin-order-status">
            <span class="sr-only">Status of ${escapeHtml(o.no)}</span>
            <select data-order-status>
              ${Object.entries(STATUSES).map(([k, label]) => `<option value="${k}"${o.status === k ? " selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="admin-order-body">
          <div class="admin-order-cust">
            <strong>${escapeHtml(c.name)}</strong>
            <a href="tel:${escapeHtml(c.phone)}" class="admin-link">${escapeHtml(c.phone)}</a>
            <span>${escapeHtml(c.address)}, ${escapeHtml(c.city)} ${escapeHtml(c.pin)}</span>
            ${o.note ? `<span class="admin-order-note">Card: “${escapeHtml(o.note)}”</span>` : ""}
          </div>
          <div class="admin-order-lines">
            ${o.lines.map((l) => `<div class="row"><span>${escapeHtml(l.name)} × ${l.qty}</span><span>${inr(l.price * l.qty)}</span></div>`).join("")}
            <div class="row total"><span>${o.method === "cod" ? "Due on delivery" : "Total"}</span><span>${inr(o.total)}</span></div>
          </div>
        </div>
      </article>`;
  }

  function renderOrders() {
    renderOrderFilters();
    const q = orderQuery.toLowerCase();
    const list = orders.filter((o) => {
      if (orderFilter === "open" ? !OPEN.includes(o.status) : orderFilter !== "all" && o.status !== orderFilter) return false;
      return !q || [o.no, o.customer.name, o.customer.phone, o.customer.city, o.customer.pin].join(" ").toLowerCase().includes(q);
    });
    $("#orders").innerHTML = list.map(orderCard).join("");
    const empty = $("#orders-empty");
    empty.hidden = list.length > 0;
    empty.innerHTML = !orders.length
      ? `No orders yet. Checkout on the <a href="index.html#shop" class="admin-link">store</a> records each order here.`
      : q ? `No orders match "${escapeHtml(orderQuery)}".` : "No orders with this status.";
  }

  $("#orders").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-order-status]");
    if (!sel) return;
    const order = orders.find((o) => o.no === sel.closest(".admin-order").dataset.no);
    const prev = order.status;
    order.status = sel.value;
    saveOrders();
    renderOrders();
    renderOverview();
    toast(`${order.no}: ${STATUSES[order.status].toLowerCase()}`, {
      label: "Undo",
      onClick: () => { order.status = prev; saveOrders(); renderOrders(); renderOverview(); },
    });
  });
  $("#order-filters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    orderFilter = chip.dataset.filter;
    renderOrders();
  });
  $("#order-search").addEventListener("input", (e) => { orderQuery = e.target.value.trim(); renderOrders(); });

  $("#orders-export").addEventListener("click", () => {
    if (!orders.length) { toast("No orders to export"); return; }
    const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Order", "Placed", "Status", "Name", "Phone", "Address", "City", "PIN", "Payment", "Items", "Total", "Card note"]]
      .concat(orders.map((o) => [
        o.no, o.at, STATUSES[o.status], o.customer.name, o.customer.phone, o.customer.address, o.customer.city, o.customer.pin,
        PAY[o.method] || o.method, o.lines.map((l) => `${l.name} x ${l.qty}`).join("; "), o.total, o.note || "",
      ]));
    const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mishri-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("#orders-clear").addEventListener("click", () => {
    if (!orders.length) { toast("No orders to clear"); return; }
    if (!confirm(`Delete all ${orders.length} orders from this browser?`)) return;
    const before = orders;
    orders = [];
    saveOrders();
    render();
    toast("Orders cleared", { label: "Undo", onClick: () => { orders = before; saveOrders(); render(); } });
  });

  /* ---------------- render and sync ---------------- */

  function render() {
    renderOverview();
    if (!$("#panel-catalogue").hidden) renderCatalogue();
    if (!$("#panel-orders").hidden) renderOrders();
  }

  // An order placed in the store tab shows up here without a reload.
  window.addEventListener("storage", (e) => {
    if (e.key === ORDERS_KEY) orders = read(ORDERS_KEY, []);
    else if (e.key === SETTINGS_KEY) { settings = read(SETTINGS_KEY, { items: {} }); if (!settings.items) settings.items = {}; }
    else return;
    render();
  });

  showTab();
})();

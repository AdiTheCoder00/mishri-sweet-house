/* Mishri Sweet House. Shop admin: overview, catalogue edits, orders.

   The page sits behind the server-side sign-in in middleware.js.

   With the shop's server connected (Upstash Redis, see api/_lib/store.js)
   orders and catalogue edits load from and save to /api/admin/*, so they
   are shared by every visitor and every device. Without it the admin runs
   in demo mode on this browser's localStorage: catalogue edits under
   "mishri-admin" (read by store-settings.js) and orders under
   "mishri-orders" (written by app.js at checkout). */
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
  // Online orders are only real once paid; cash on delivery ones straight away.
  const awaitingPayment = (o) => Boolean(o.payment && o.payment.state === "pending");
  const payLabel = (o) =>
    !o.payment || o.payment.state === "cod" ? PAY[o.method] || o.method
    : o.payment.state === "paid" ? `Paid online, ${PAY[o.method] || o.method}`
    : `${PAY[o.method] || o.method}, awaiting payment`;

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

  // Set at startup: true when /api/admin answers, so data lives on the server.
  let LIVE = false;
  let settings = { items: {} };
  let orders = [];

  async function api(method, path, body) {
    const res = await fetch("/api/admin/" + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    // Session expired: back to sign-in rather than failing quietly.
    if (res.status === 401) { location.href = "/admin-login.html"; throw new Error("signed-out"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // Saves the whole catalogue edit set. Demo: sync to localStorage.
  // Live: optimistic, reloading the server copy if the save fails.
  function persistSettings() {
    if (!LIVE) return write(SETTINGS_KEY, settings);
    api("PUT", "catalogue", settings)
      .then((saved) => { settings = saved; })
      .catch(async (e) => {
        if (e.message === "signed-out") return;
        toast("Could not save to the shop's server. Showing the last saved version.");
        try { settings = await api("GET", "catalogue"); } catch {}
        render();
      });
    return true;
  }

  function persistOrderStatus(order, onSaved) {
    if (!LIVE) { saveOrders(); return; }
    api("PATCH", "orders", { no: order.no, status: order.status }).then((data) => {
      if (data.order && data.order.notified) order.notified = data.order.notified;
      if (onSaved) onSaved(data.emailed);
    }).catch(async (e) => {
      if (e.message === "signed-out") return;
      toast(`Could not update ${order.no}. Showing the saved orders.`);
      await refreshOrders();
    });
  }

  async function refreshOrders() {
    if (!LIVE) return;
    try { orders = (await api("GET", "orders")).orders; render(); } catch {}
  }

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
    return persistSettings();
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

  const TABS = ["overview", "catalogue", "orders", "email"];
  function showTab() {
    const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
    TABS.forEach((t) => { $("#panel-" + t).hidden = t !== tab; });
    $$(".admin-tabs a").forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    render();
  }
  window.addEventListener("hashchange", () => {
    showTab();
    window.scrollTo(0, 0);
    // Customers keep ordering while the admin is open: fetch the latest.
    refreshOrders();
    if (location.hash === "#email") loadEmail();
  });

  /* ---------------- overview ---------------- */

  const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const fmtDate = (iso) => dateFmt.format(new Date(iso));
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
  const statusPill = (s) => `<span class="admin-pill is-${s}">${STATUSES[s] || s}</span>`;

  function renderOverview() {
    $("#overview-date").textContent = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    const live = orders.filter((o) => o.status !== "cancelled" && !awaitingPayment(o));
    const today = live.filter((o) => isToday(o.at));
    const open = live.filter((o) => OPEN.includes(o.status));
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
      stat("To fulfil", open.length, `${live.filter((o) => o.status === "new").length} new, ${live.filter((o) => o.status === "dispatched").length} out for delivery`) +
      stat("Takings", inr(live.reduce((n, o) => n + o.total, 0)), `${live.length} order${live.length === 1 ? "" : "s"}, cancelled and unpaid excluded`) +
      stat("On sale", `${counts.live}<small> / ${ITEMS.length}</small>`, `${counts.soldout} sold out, ${counts.hidden} hidden`);

    const recent = orders.slice(0, 5);
    $("#recent-orders").innerHTML = recent.length
      ? `<ul class="admin-mini">${recent.map((o) => `
          <li>
            <span><strong>${escapeHtml(o.no)}</strong> ${escapeHtml(o.customer.name)}, ${escapeHtml(o.customer.city)}</span>
            <span>${inr(o.total)} ${awaitingPayment(o) ? '<span class="admin-pill is-unpaid">Unpaid</span>' : statusPill(o.status)}</span>
          </li>`).join("")}</ul>`
      : `<p class="admin-empty">No orders yet. Place one through checkout on the <a href="index.html#shop" class="admin-link">store</a> and it appears here.</p>`;

    const notes = [];
    const fresh = orders.filter((o) => o.status === "new" && !awaitingPayment(o));
    if (fresh.length) notes.push(`<li><i class="ph-light ph-bell-ringing" aria-hidden="true"></i><a href="#orders" data-go-filter="new">${fresh.length} new order${fresh.length === 1 ? "" : "s"} waiting to be prepared</a></li>`);
    ITEMS.filter((i) => current(i.id).status === "soldout").forEach((i) =>
      notes.push(`<li><i class="ph-light ph-prohibit" aria-hidden="true"></i><span>${escapeHtml(current(i.id).name)} is marked sold out</span></li>`));
    const hidden = ITEMS.filter((i) => current(i.id).status === "hidden");
    if (emailState && emailState.lastError) {
      notes.push(`<li><i class="ph-light ph-envelope-simple-open" aria-hidden="true"></i><a href="#email">An email failed to send. See why</a></li>`);
    }
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
      persistSettings();
      renderCatalogue();
      toast(`${original(id).name} restored`, {
        label: "Undo",
        onClick: () => { settings.items[id] = before; persistSettings(); renderCatalogue(); },
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
    persistSettings();
    renderCatalogue();
    toast("Catalogue restored", { label: "Undo", onClick: () => { settings = before; persistSettings(); renderCatalogue(); } });
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
            <h3>${escapeHtml(o.no)} ${statusPill(o.status)}${awaitingPayment(o) ? ' <span class="admin-pill is-unpaid">Unpaid</span>' : ""}</h3>
            <span class="admin-order-when">${fmtDate(o.at)} · ${escapeHtml(payLabel(o))}${o.payment && o.payment.paymentId ? ` · <span class="admin-payment-id">${escapeHtml(o.payment.paymentId)}</span>` : ""}</span>
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
            ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="admin-link">${escapeHtml(c.email)}</a>` : ""}
            <span>${escapeHtml(c.address)}, ${escapeHtml(c.city)} ${escapeHtml(c.pin)}</span>
            ${o.note ? `<span class="admin-order-note">Card: “${escapeHtml(o.note)}”</span>` : ""}
          </div>
          <div class="admin-order-lines">
            ${o.lines.map((l) => `<div class="row"><span>${escapeHtml(l.name)} × ${l.qty}</span><span>${inr(l.price * l.qty)}</span></div>`).join("")}
            ${o.delivery !== undefined ? `<div class="row"><span>Delivery</span><span>${o.delivery ? inr(o.delivery) : "Free"}</span></div>` : ""}
            <div class="row total"><span>${o.method === "cod" ? "Due on delivery" : o.payment && o.payment.state === "paid" ? "Paid" : "Total"}</span><span>${inr(o.total)}</span></div>
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
    persistOrderStatus(order, (emailed) => { if (emailed) toast(`${order.no}: out for delivery. ${order.customer.name.split(" ")[0]} has been emailed`); });
    renderOrders();
    renderOverview();
    toast(`${order.no}: ${STATUSES[order.status].toLowerCase()}`, {
      label: "Undo",
      onClick: () => { order.status = prev; persistOrderStatus(order); renderOrders(); renderOverview(); },
    });
  });
  $("#order-filters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    orderFilter = chip.dataset.filter;
    renderOrders();
  });
  $("#order-search").addEventListener("input", (e) => { orderQuery = e.target.value.trim(); renderOrders(); });

  function downloadCsv(rows, name) {
    const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $("#orders-export").addEventListener("click", () => {
    if (!orders.length) { toast("No orders to export"); return; }
    const rows = [["Order", "Placed", "Status", "Name", "Phone", "Email", "Address", "City", "PIN", "Payment", "Payment ID", "Items", "Total", "Card note"]]
      .concat(orders.map((o) => [
        o.no, o.at, STATUSES[o.status], o.customer.name, o.customer.phone, o.customer.email || "", o.customer.address, o.customer.city, o.customer.pin,
        payLabel(o), (o.payment && o.payment.paymentId) || "", o.lines.map((l) => `${l.name} x ${l.qty}`).join("; "), o.total, o.note || "",
      ]));
    downloadCsv(rows, "mishri-orders");
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

  /* ---------------- email ---------------- */

  let emailState = null;

  async function loadEmail() {
    if (!LIVE) return;
    try { emailState = await api("GET", "email"); } catch (e) {
      if (e.message !== "signed-out") toast("Email settings could not be loaded.");
    }
    render();
  }

  function renderEmail() {
    $("#email-demo").hidden = LIVE;
    $("#email-live").hidden = !LIVE || !emailState;
    if (!LIVE || !emailState) return;
    const c = emailState.config;
    const row = (state, title, detail) => {
      const icon = { ok: "ph-check-circle ok", no: "ph-x-circle no", warn: "ph-warning-circle warn" }[state];
      const said = { ok: "Done", no: "Missing", warn: "Not set up" }[state];
      return `<li><i class="ph-light ${icon}" aria-hidden="true"></i><span><span class="sr-only">${said}: </span>${title}<small>${detail}</small></span></li>`;
    };
    $("#email-checks").innerHTML = [
      row("ok", "Database connected", "Orders are saved on the server, so emails can go out."),
      c.apiKey
        ? row("ok", "Resend API key is set", "<code>RESEND_API_KEY</code>")
        : row("no", "Resend API key is missing", "Add <code>RESEND_API_KEY</code> in Vercel → Settings → Environment Variables, then redeploy."),
      c.alertEmail.length
        ? row("ok", `Order alerts go to ${escapeHtml(c.alertEmail.join(", "))}`, "<code>ALERT_EMAIL</code>")
        : row("no", "No address for order alerts", "Add <code>ALERT_EMAIL</code> in Vercel with the address that should get new orders, then redeploy."),
      c.sender
        ? row("ok", `Customer emails are on, from ${escapeHtml(c.sender)}`, "Order confirmations, out-for-delivery updates and the festival-box list.")
        : row("warn", "Customer emails are off", "To email customers and the festival-box list, verify a domain you own in Resend (Domains) and set <code>EMAIL_FROM</code> in Vercel, e.g. <code>Mishri Sweet House &lt;orders@yourdomain.in&gt;</code>. Until then alerts come from Resend's test sender, which only reaches the address your Resend account was opened with."),
    ].join("");

    const err = emailState.lastError;
    const errBox = $("#email-last-error");
    errBox.hidden = !err;
    if (err) errBox.innerHTML = `<strong>Last email failed</strong> (${escapeHtml(fmtDate(err.at))}, ${escapeHtml(err.context)}): ${escapeHtml(err.reason)}`;

    const subs = emailState.subscribers;
    $("#sub-count").textContent = subs.length;
    $("#sub-empty").hidden = subs.length > 0;
    $("#sub-list").innerHTML = subs.map((s) => `
      <li><span>${escapeHtml(s.email)} <small>${escapeHtml(fmtDate(s.at))}</small></span>
        <button class="admin-link" data-remove-sub="${escapeHtml(s.email)}">Remove</button></li>`).join("");

    const canSend = Boolean(c.apiKey && c.sender);
    $("#announce-send").disabled = !canSend || !subs.length;
    $("#announce-send").textContent = subs.length ? `Send to ${subs.length} subscriber${subs.length === 1 ? "" : "s"}` : "Send";
    $("#announce-note").textContent = !canSend
      ? "Sending to the list needs a verified sender (EMAIL_FROM), because Resend's test sender can't reach your subscribers."
      : !subs.length ? "Nobody has signed up yet." : "Each subscriber gets their own copy with an unsubscribe link.";
  }

  $("#email-test").addEventListener("click", async (e) => {
    const btn = e.currentTarget, out = $("#email-test-result");
    btn.disabled = true;
    out.className = "admin-email-result";
    out.textContent = "Sending…";
    try {
      const r = await api("POST", "email", { action: "test" });
      out.classList.add(r.sent ? "is-ok" : "is-bad");
      out.textContent = r.sent ? `Sent to ${r.to.join(", ")}. Check that inbox (and spam).` : r.reason;
    } catch (err) {
      if (err.message !== "signed-out") { out.classList.add("is-bad"); out.textContent = err.message; }
    }
    btn.disabled = false;
    await loadEmail();
  });

  $("#sub-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove-sub]");
    if (!btn || !confirm(`Remove ${btn.dataset.removeSub} from the festival-box list?`)) return;
    try { await api("DELETE", "email", { email: btn.dataset.removeSub }); toast("Removed"); } catch (err) {
      if (err.message !== "signed-out") toast(err.message);
    }
    await loadEmail();
  });

  $("#sub-export").addEventListener("click", () => {
    const subs = (emailState && emailState.subscribers) || [];
    if (!subs.length) { toast("No subscribers to export"); return; }
    downloadCsv([["Email", "Signed up"], ...subs.map((s) => [s.email, s.at])], "mishri-subscribers");
  });

  $("#announce-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = $("#announce-subject").value.trim(), message = $("#announce-message").value.trim();
    const n = emailState ? emailState.subscribers.length : 0;
    if (!subject || !message) { toast("Write a subject and a message"); return; }
    if (!confirm(`Email "${subject}" to ${n} subscriber${n === 1 ? "" : "s"} now? This can't be undone.`)) return;
    const btn = $("#announce-send");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const r = await api("POST", "email", { action: "announce", subject, message });
      const had = r.skipped ? ` (${r.skipped} already had it)` : "";
      if (r.failed) toast(`Sent to ${r.sent} of ${r.total - r.skipped}${had}. ${r.reason} Send again to reach only the rest.`);
      else { toast(`Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}${had}`); e.target.reset(); }
    } catch (err) {
      if (err.message !== "signed-out") toast(err.message);
    }
    await loadEmail();
  });

  /* ---------------- render and sync ---------------- */

  function render() {
    renderOverview();
    if (!$("#panel-catalogue").hidden) renderCatalogue();
    if (!$("#panel-orders").hidden) renderOrders();
    if (!$("#panel-email").hidden) renderEmail();
  }

  // Demo: an order placed in the store tab shows up here without a reload.
  window.addEventListener("storage", (e) => {
    if (LIVE) return;
    if (e.key === ORDERS_KEY) orders = read(ORDERS_KEY, []);
    else if (e.key === SETTINGS_KEY) { settings = read(SETTINGS_KEY, { items: {} }); if (!settings.items) settings.items = {}; }
    else return;
    render();
  });

  /* ---------------- start ---------------- */

  async function start() {
    try {
      const [cat, list] = await Promise.all([api("GET", "catalogue"), api("GET", "orders")]);
      LIVE = true;
      settings = cat && cat.items ? cat : { items: {} };
      orders = list.orders;
    } catch (e) {
      if (e.message === "signed-out") return;
      // No server (demo mode, or running from plain files): use this browser.
      settings = read(SETTINGS_KEY, { items: {} });
      if (!settings.items) settings.items = {};
      orders = read(ORDERS_KEY, []);
    }
    $("#admin-note-text").textContent = LIVE
      ? "Orders and catalogue changes are saved on the shop's server and reach every customer. New orders appear here within 30 seconds."
      : "Demo mode: no database is connected, so catalogue changes and orders are kept in this browser only. Connect Upstash Redis in Vercel to share them with every customer.";
    $("#orders-clear").hidden = LIVE;
    if (LIVE) {
      loadEmail();
      // Orders arrive from customers' browsers; check for new ones regularly.
      setInterval(() => { if (!document.hidden) refreshOrders(); }, 30000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshOrders(); });
    }
    showTab();
  }
  start();
})();

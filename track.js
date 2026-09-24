/* Mishri Sweet House. The Track your order page: looks an order up by its
   number and the mobile number it was placed with (/api/track), and shows
   where it has got to. page.js handles the header, theme and basket. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#track-form");
  if (!form) return;
  const STORE = window.MISHRI_STORE || null;
  const noInput = $("#track-no");
  const phoneInput = $("#track-phone");
  const errorEl = $("#track-error");
  const result = $("#track-result");
  const submit = $("#track-submit");

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const sameDay = (pin) => /^30[23]/.test(pin);

  const STEPS = [
    ["new", "Order received", "ph-receipt"],
    ["preparing", "Being made fresh", "ph-cooking-pot"],
    ["dispatched", "Out for delivery", "ph-truck"],
    ["delivered", "Delivered", "ph-gift"],
  ];

  const params = new URLSearchParams(location.search);
  if (params.get("no")) noInput.value = params.get("no").slice(0, 20);
  (noInput.value ? phoneInput : noInput).focus({ preventScroll: true });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function render(o) {
    const cancelled = o.status === "cancelled";
    const reached = STEPS.findIndex((s) => s[0] === o.status);
    const history = Object.fromEntries((o.history || []).map((h) => [h.status, h.at]));
    history.new = history.new || o.at;
    const eta = sameDay(o.pin) ? "today by evening" : "in 2 to 5 days from dispatch";
    const pay = o.payment === "paid" ? "Paid online" : o.payment === "pending" ? "Payment not yet received" : "Pay on delivery";
    const headline = {
      new: `We have your order. It reaches ${o.city} ${eta}.`,
      preparing: `Your sweets are being made fresh. They reach ${o.city} ${eta}.`,
      dispatched: "Your order is on its way. The rider will call before arriving.",
      delivered: "Delivered. We hope you enjoy every bite.",
      cancelled: "This order was cancelled. If that's unexpected, WhatsApp us.",
    }[o.status] || "";

    result.innerHTML = `
      <div class="track-head">
        <h2>${esc(o.no)}</h2>
        <p>${esc(headline)}</p>
      </div>
      ${cancelled ? "" : `<ol class="track-steps">
        ${STEPS.map(([key, label, icon], i) => {
          const state = i < reached ? "done" : i === reached ? "current" : "todo";
          const at = history[key] && i <= reached ? `<span class="track-when">${esc(when(history[key]))}</span>` : "";
          return `<li class="track-step is-${state}"${state === "current" ? ' aria-current="step"' : ""}>
            <span class="track-dot"><i class="${state === "todo" ? "ph-light" : "ph-fill"} ${icon}" aria-hidden="true"></i></span>
            <span class="track-label">${esc(label)}${at}</span>
          </li>`;
        }).join("")}
      </ol>`}
      <div class="receipt">
        ${o.lines.map((l) => `<div class="row muted"><span>${esc(l.name)} × ${l.qty}</span></div>`).join("")}
        <div class="row total"><span>${esc(pay)}</span><span>${inr(o.total)}</span></div>
        <div class="row muted"><span>Delivering to ${esc(o.city)} ${esc(o.pin)}</span></div>
        <div class="row muted"><span>Last updated ${esc(when(o.updatedAt))}</span></div>
      </div>`;
    result.hidden = false;
  }

  function demoNotice() {
    result.innerHTML = `
      <div class="track-head">
        <h2>Tracking starts when the shop goes live</h2>
        <p>This is the demo store, so orders stay in your browser and can't be tracked here. WhatsApp us for anything about a real order.</p>
      </div>`;
    result.hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    const no = noInput.value.trim();
    const phone = phoneInput.value.replace(/\D/g, "").slice(-10);
    if (!/\d{6,}/.test(no)) { showError("Enter your order number, for example MSH-100001."); noInput.focus(); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { showError("Enter the 10 digit mobile number you ordered with."); phoneInput.focus(); return; }
    // The demo store has no server to ask.
    if (STORE && !STORE.orders) { demoNotice(); return; }

    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    try {
      const res = await fetch("../api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.order) { render(data.order); return; }
      result.hidden = true;
      if (res.status === 503 || res.status === 405 || (res.status === 404 && !data.error)) { demoNotice(); return; }
      showError(data.error || "We couldn't check that just now. Please try again.");
    } catch {
      showError("We couldn't reach the shop. Check your connection and try again.");
    } finally {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
    }
  });
})();

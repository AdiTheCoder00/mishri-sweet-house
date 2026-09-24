/* Mishri Sweet House. New-order email alerts through Resend (resend.com).

   Needs RESEND_API_KEY and ALERT_EMAIL (where alerts go). ALERT_FROM is
   optional: until you verify a domain in Resend, its shared sender
   onboarding@resend.dev can only mail the address you signed up with, so
   make ALERT_EMAIL that address.

   Never throws: an alert that fails must not fail the order. */

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PAY = { cod: "Cash on delivery", upi: "UPI", card: "Card" };

export async function sendOrderAlert(order, siteUrl) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return { sent: false, reason: "not-configured" };

  const c = order.customer;
  const lines = order.lines.map((l) => `${l.name} × ${l.qty} — ${inr(l.price * l.qty)}`);
  const paid = order.payment && order.payment.state === "paid" ? "Paid online" : PAY[order.method] || order.method;
  const text = [
    `New order ${order.no}: ${inr(order.total)} (${paid})`,
    "",
    ...lines,
    `Delivery: ${order.delivery ? inr(order.delivery) : "Free"}`,
    `Total: ${inr(order.total)}`,
    "",
    `${c.name}, ${c.phone}`,
    `${c.address}, ${c.city} ${c.pin}`,
    order.note ? `Card note: ${order.note}` : "",
    "",
    siteUrl ? `Manage it: ${siteUrl}/admin.html#orders` : "",
  ].filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1a22">
    <h2 style="margin:0 0 4px">New order ${esc(order.no)}</h2>
    <p style="margin:0 0 16px;color:#5d5e69">${esc(inr(order.total))} · ${esc(paid)}</p>
    <table style="border-collapse:collapse;margin-bottom:16px">${order.lines.map((l) =>
      `<tr><td style="padding:4px 16px 4px 0">${esc(l.name)} × ${l.qty}</td><td style="padding:4px 0;text-align:right">${esc(inr(l.price * l.qty))}</td></tr>`).join("")}
      <tr><td style="padding:4px 16px 4px 0;color:#5d5e69">Delivery</td><td style="text-align:right;color:#5d5e69">${order.delivery ? esc(inr(order.delivery)) : "Free"}</td></tr>
      <tr><td style="padding:8px 16px 4px 0;font-weight:700;border-top:1px solid #ddd">Total</td><td style="padding-top:8px;text-align:right;font-weight:700;border-top:1px solid #ddd">${esc(inr(order.total))}</td></tr>
    </table>
    <p style="margin:0"><strong>${esc(c.name)}</strong> · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><br>${esc(c.address)}, ${esc(c.city)} ${esc(c.pin)}</p>
    ${order.note ? `<p style="margin:12px 0 0">Card note: “${esc(order.note)}”</p>` : ""}
    ${siteUrl ? `<p style="margin:20px 0 0"><a href="${esc(siteUrl)}/admin.html#orders">Open the orders in the shop admin</a></p>` : ""}
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERT_FROM || "Mishri Orders <onboarding@resend.dev>",
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        subject: `New order ${order.no} · ${inr(order.total)} · ${c.name}, ${c.city}`,
        text,
        html,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return { sent: res.ok, reason: res.ok ? "" : `resend ${res.status}` };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

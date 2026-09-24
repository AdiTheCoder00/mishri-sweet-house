/* Mishri Sweet House. Email through Resend (resend.com).

   RESEND_API_KEY   the API key
   ALERT_EMAIL      where new-order alerts go (comma-separate several)
   EMAIL_FROM       sender for everything, e.g. "Mishri Sweet House <orders@yourdomain.in>".
                    Must be on a domain verified in Resend. (ALERT_FROM is read too.)

   Without EMAIL_FROM, alerts go out from Resend's shared test sender,
   onboarding@resend.dev, which only delivers to the address the Resend
   account was opened with. So without it only the owner's alert can work,
   and emails to customers and subscribers stay off.

   Nothing here throws: a failed email must never fail an order. The last
   failure is kept (see lastEmailError) so the admin can show the reason. */
import { redis, pipeline, storeReady } from "./store.js";

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PAY = { cod: "Cash on delivery", upi: "UPI", card: "Card" };
const SHOP = "Mishri Sweet House";
const TEST_SENDER = `${SHOP} <onboarding@resend.dev>`;
const LAST_ERROR_KEY = "mishri:email:last-error";

// Pasted values often carry stray spaces or quotes; ignore them.
const env = (name) => String(process.env[name] || "").trim().replace(/^["']|["']$/g, "").trim();
export const verifiedSender = () => env("EMAIL_FROM") || env("ALERT_FROM");
export const alertRecipients = () => env("ALERT_EMAIL").split(",").map((s) => s.trim()).filter(Boolean);
export const emailConfig = () => ({
  apiKey: Boolean(env("RESEND_API_KEY")),
  alertEmail: alertRecipients(),
  sender: verifiedSender(),
  customerEmails: Boolean(env("RESEND_API_KEY") && verifiedSender()),
});
// Printable characters only: no control characters, spaces, quotes or angle brackets.
export const validEmail = (s) =>
  typeof s === "string" && s.length <= 254 && !/[\x00-\x1f\x7f]/.test(s) && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(s);

// Resend's replies, turned into what the shop owner should do about them.
function explain(status, message) {
  const m = String(message || "");
  if (status === 401 || /api key is invalid|invalid api key|missing api key/i.test(m)) {
    return "Resend rejected the API key. Create a new key in Resend (API Keys) and paste it into RESEND_API_KEY in Vercel, then redeploy.";
  }
  if (/only send testing emails to your own email/i.test(m)) {
    const own = (m.match(/\(([^)]+@[^)]+)\)/) || [])[1];
    return `Resend's test sender can only email the address you signed up to Resend with${own ? ` (${own})` : ""}. Set ALERT_EMAIL to exactly that address, or verify your own domain in Resend and set EMAIL_FROM.`;
  }
  if (/domain is not verified|not verified/i.test(m)) {
    return "The sender in EMAIL_FROM uses a domain that isn't verified in Resend yet. Finish verification under Resend → Domains, or remove EMAIL_FROM to fall back to the test sender.";
  }
  if (status === 422 || /invalid .*(from|to)|validation/i.test(m)) {
    return `Resend says an address is malformed: ${m}. Check ALERT_EMAIL and EMAIL_FROM in Vercel.`;
  }
  if (status === 429) return "Resend's sending limit was hit. Wait a minute, or check your Resend plan's daily limit.";
  return m ? `Resend: ${m}` : `Resend answered ${status}.`;
}

async function recordFailure(context, reason) {
  if (!storeReady()) return;
  try { await redis("SET", LAST_ERROR_KEY, JSON.stringify({ at: new Date().toISOString(), context, reason })); } catch {}
}
export async function lastEmailError() {
  if (!storeReady()) return null;
  try { const raw = await redis("GET", LAST_ERROR_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
/* A working test email only proves the path to ALERT_EMAIL, so it clears a
   recorded failure only if that failure was an owner alert or a test. A
   failed customer email or announcement stays until something replaces it. */
export async function clearAlertError() {
  const last = await lastEmailError();
  if (!last || !(last.context === "test" || String(last.context).startsWith("alert "))) return;
  try { await redis("DEL", LAST_ERROR_KEY); } catch {}
}

/* One email. Returns { sent, reason }. `from` defaults to the verified
   sender, falling back to the test sender (owner alerts only). */
export async function sendEmail({ to, subject, text, html, from, context }) {
  const key = env("RESEND_API_KEY");
  if (!key) return { sent: false, reason: "RESEND_API_KEY is not set in Vercel." };
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "No recipient address." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from || verifiedSender() || TEST_SENDER, to: recipients, subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { sent: true, reason: "" };
    const data = await res.json().catch(() => ({}));
    const reason = explain(res.status, data.message || data.error);
    console.error("email failed", context, res.status, data);
    await recordFailure(context, reason);
    return { sent: false, reason };
  } catch (e) {
    const reason = `Could not reach Resend (${e.name === "TimeoutError" ? "timed out" : e.message}).`;
    console.error("email failed", context, e);
    await recordFailure(context, reason);
    return { sent: false, reason };
  }
}

/* ---------------- building blocks ---------------- */

const wrap = (inner) => `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#1a1a22;max-width:560px">${inner}</div>`;
const payLabel = (order) => (order.payment && order.payment.state === "paid" ? "Paid online" : PAY[order.method] || order.method);

function linesTable(order) {
  return `<table style="border-collapse:collapse;margin:0 0 16px;width:100%">${order.lines.map((l) =>
    `<tr><td style="padding:4px 16px 4px 0">${esc(l.name)} × ${l.qty}</td><td style="padding:4px 0;text-align:right">${esc(inr(l.price * l.qty))}</td></tr>`).join("")}
    <tr><td style="padding:4px 16px 4px 0;color:#5d5e69">Delivery</td><td style="text-align:right;color:#5d5e69">${order.delivery ? esc(inr(order.delivery)) : "Free"}</td></tr>
    <tr><td style="padding:8px 16px 4px 0;font-weight:700;border-top:1px solid #ddd">Total</td><td style="padding-top:8px;text-align:right;font-weight:700;border-top:1px solid #ddd">${esc(inr(order.total))}</td></tr>
  </table>`;
}
const linesText = (order) => [
  ...order.lines.map((l) => `${l.name} × ${l.qty} — ${inr(l.price * l.qty)}`),
  `Delivery: ${order.delivery ? inr(order.delivery) : "Free"}`,
  `Total: ${inr(order.total)}`,
];
const eta = (pin) => (/^30[23]/.test(pin) ? "today by evening" : "in 2 to 5 days");

/* ---------------- to the shop ---------------- */

export async function sendOrderAlert(order, siteUrl) {
  const to = alertRecipients();
  if (!env("RESEND_API_KEY") || !to.length) return { sent: false, reason: "not-configured" };
  const c = order.customer;
  const text = [
    `New order ${order.no}: ${inr(order.total)} (${payLabel(order)})`, "",
    ...linesText(order), "",
    `${c.name}, ${c.phone}${c.email ? `, ${c.email}` : ""}`,
    `${c.address}, ${c.city} ${c.pin}`,
    order.note ? `Card note: ${order.note}` : "",
    siteUrl ? `\nManage it: ${siteUrl}/admin.html#orders` : "",
  ].filter(Boolean).join("\n");
  const html = wrap(`
    <h2 style="margin:0 0 4px">New order ${esc(order.no)}</h2>
    <p style="margin:0 0 16px;color:#5d5e69">${esc(inr(order.total))} · ${esc(payLabel(order))}</p>
    ${linesTable(order)}
    <p style="margin:0"><strong>${esc(c.name)}</strong> · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>${c.email ? ` · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}<br>${esc(c.address)}, ${esc(c.city)} ${esc(c.pin)}</p>
    ${order.note ? `<p style="margin:12px 0 0">Card note: “${esc(order.note)}”</p>` : ""}
    ${siteUrl ? `<p style="margin:20px 0 0"><a href="${esc(siteUrl)}/admin.html#orders">Open the orders in the shop admin</a></p>` : ""}`);
  return sendEmail({ to, subject: `New order ${order.no} · ${inr(order.total)} · ${c.name}, ${c.city}`, text, html, context: `alert ${order.no}` });
}

export async function sendTestEmail(siteUrl) {
  const to = alertRecipients();
  if (!to.length) return { sent: false, reason: "ALERT_EMAIL is not set in Vercel." };
  return sendEmail({
    to,
    subject: `${SHOP}: test email`,
    text: `This is a test from your shop admin. If you are reading it, new-order alerts will reach ${to.join(", ")}.${siteUrl ? `\n\n${siteUrl}/admin.html` : ""}`,
    html: wrap(`<h2 style="margin:0 0 8px">Email is working</h2><p style="margin:0">This is a test from your shop admin. New-order alerts will reach ${esc(to.join(", "))}.</p>`),
    context: "test",
  });
}

const trackUrl = (siteUrl, no) => `${siteUrl}/track/?no=${encodeURIComponent(no)}`;

/* ---------------- to the customer ----------------
   Only with a verified sender (EMAIL_FROM); the test sender can't reach them. */

export async function sendOrderConfirmation(order, siteUrl) {
  const c = order.customer;
  if (!c.email || !emailConfig().customerEmails) return { sent: false, reason: "not-configured" };
  const first = c.name.split(" ")[0];
  const paid = order.payment && order.payment.state === "paid";
  const payLine = paid ? `We have your payment of ${inr(order.total)}.` : `Please keep ${inr(order.total)} ready: pay in cash or by UPI when the box arrives.`;
  const text = [
    `Thank you, ${first}. We have your order ${order.no}.`, "",
    ...linesText(order), "",
    payLine,
    `It reaches ${c.city} ${eta(c.pin)}. Delivering to: ${c.address}, ${c.city} ${c.pin}.`,
    order.note ? `Your card will read: “${order.note}”` : "",
    "", "Questions? WhatsApp us on +91 87446 67777.",
    siteUrl ? `Track it: ${trackUrl(siteUrl, order.no)}` : "",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const html = wrap(`
    <h2 style="margin:0 0 4px">Thank you, ${esc(first)}</h2>
    <p style="margin:0 0 16px;color:#5d5e69">Order ${esc(order.no)} · ${esc(payLabel(order))}</p>
    ${linesTable(order)}
    <p style="margin:0 0 8px">${esc(payLine)}</p>
    <p style="margin:0 0 8px">It reaches ${esc(c.city)} <strong>${esc(eta(c.pin))}</strong>. Delivering to ${esc(c.address)}, ${esc(c.city)} ${esc(c.pin)}.</p>
    ${order.note ? `<p style="margin:0 0 8px">Your card will read: “${esc(order.note)}”</p>` : ""}
    ${siteUrl ? `<p style="margin:16px 0 0"><a href="${esc(trackUrl(siteUrl, order.no))}">Track your order</a></p>` : ""}
    <p style="margin:16px 0 0;color:#5d5e69">Questions? <a href="https://wa.me/918744667777">WhatsApp us on +91 87446 67777</a>.</p>`);
  return sendEmail({ to: c.email, subject: `Your order ${order.no} from ${SHOP}`, text, html, context: `confirmation ${order.no}` });
}

export async function sendDispatchNotice(order, siteUrl) {
  const c = order.customer;
  if (!c.email || !emailConfig().customerEmails) return { sent: false, reason: "not-configured" };
  const first = c.name.split(" ")[0];
  const due = order.method === "cod" && !(order.payment && order.payment.state === "paid");
  const text = [
    `Good news, ${first}: order ${order.no} is out for delivery to ${c.address}, ${c.city} ${c.pin}.`,
    due ? `Please keep ${inr(order.total)} ready for the rider (cash or UPI).` : "",
    "The rider will call on the way. Questions? WhatsApp us on +91 87446 67777.",
    siteUrl ? `Track it: ${trackUrl(siteUrl, order.no)}` : "",
  ].filter(Boolean).join("\n\n");
  const html = wrap(`
    <h2 style="margin:0 0 8px">Your order is on its way</h2>
    <p style="margin:0 0 8px">Good news, ${esc(first)}: order ${esc(order.no)} is out for delivery to ${esc(c.address)}, ${esc(c.city)} ${esc(c.pin)}.</p>
    ${due ? `<p style="margin:0 0 8px">Please keep <strong>${esc(inr(order.total))}</strong> ready for the rider (cash or UPI).</p>` : ""}
    ${siteUrl ? `<p style="margin:0 0 8px"><a href="${esc(trackUrl(siteUrl, order.no))}">Track your order</a></p>` : ""}
    <p style="margin:0;color:#5d5e69">The rider will call on the way. Questions? <a href="https://wa.me/918744667777">WhatsApp us on +91 87446 67777</a>.</p>`);
  return sendEmail({ to: c.email, subject: `Order ${order.no} is out for delivery`, text, html, context: `dispatch ${order.no}` });
}

/* ---------------- to subscribers ---------------- */

export async function sendWelcome(email, unsubscribeUrl) {
  if (!emailConfig().customerEmails) return { sent: false, reason: "not-configured" };
  return sendEmail({
    to: email,
    subject: `You're on the ${SHOP} list`,
    text: `Thanks for signing up. We'll email you when Diwali, Holi and Rakhi boxes open for pre-order, and not otherwise.\n\nChanged your mind? Unsubscribe: ${unsubscribeUrl}`,
    html: wrap(`<h2 style="margin:0 0 8px">You're on the list</h2><p style="margin:0 0 16px">We'll email you when Diwali, Holi and Rakhi boxes open for pre-order, and not otherwise.</p><p style="margin:0;font-size:13px;color:#5d5e69">Changed your mind? <a href="${esc(unsubscribeUrl)}">Unsubscribe</a>.</p>`),
    context: "welcome",
  });
}

/* Sends one announcement to many subscribers, 100 per Resend batch call,
   each with its own unsubscribe link. subscribers: [{ email, unsubscribeUrl }].

   Who has already received it is remembered per announcement (keyed by its
   subject and message, for 30 days), so sending the same announcement again
   after a partial failure reaches only the people it missed. */
export async function sendAnnouncement(allSubscribers, subject, message) {
  const key = env("RESEND_API_KEY");
  const from = verifiedSender();
  if (!key || !from) return { sent: 0, skipped: 0, failed: allSubscribers.length, reason: "Sending to subscribers needs RESEND_API_KEY and EMAIL_FROM (a sender on a domain verified in Resend)." };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subject + "\n" + message));
  const sentKey = "mishri:announce:" + [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  const already = new Set((await redis("SMEMBERS", sentKey)) || []);
  const subscribers = allSubscribers.filter((s) => !already.has(s.email));
  const skipped = allSubscribers.length - subscribers.length;
  const paragraphs = String(message).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  let sent = 0, failed = 0, reason = "";
  for (let i = 0; i < subscribers.length; i += 100) {
    const batch = subscribers.slice(i, i + 100).map((s) => ({
      from, to: [s.email], subject,
      text: `${message}\n\n—\nYou signed up for festival box news from ${SHOP}. Unsubscribe: ${s.unsubscribeUrl}`,
      html: wrap(`${paragraphs}<p style="margin:24px 0 0;font-size:13px;color:#5d5e69">You signed up for festival box news from ${SHOP}. <a href="${esc(s.unsubscribeUrl)}">Unsubscribe</a>.</p>`),
      headers: { "List-Unsubscribe": `<${s.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        sent += batch.length;
        try { await pipeline([["SADD", sentKey, ...batch.map((m) => m.to[0])], ["EXPIRE", sentKey, String(30 * 24 * 60 * 60)]]); } catch {}
        continue;
      }
      const data = await res.json().catch(() => ({}));
      reason = explain(res.status, data.message || data.error);
      console.error("announcement batch failed", res.status, data);
    } catch (e) {
      reason = `Could not reach Resend (${e.message}).`;
    }
    failed += batch.length;
    await recordFailure("announcement", reason);
  }
  return { sent, skipped, failed, reason };
}

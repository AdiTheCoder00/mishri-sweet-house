/* Mishri Sweet House. Razorpay payments (razorpay.com).

   Switches on when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set: test
   keys (rzp_test_...) take no real money, live keys (rzp_live_...) do.
   RAZORPAY_WEBHOOK_SECRET is optional but recommended: the webhook marks
   an order paid even if the customer closes the page before the browser
   reports back.

   Flow: the server creates a Razorpay order for the amount it priced, the
   browser opens Razorpay Checkout for it, and the payment only counts once
   its signature checks out here. */

const enc = new TextEncoder();

export const paymentsReady = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const publicKeyId = () => (paymentsReady() ? process.env.RAZORPAY_KEY_ID : "");

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison of two hex strings.
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createRazorpayOrder(order) {
  const auth = btoa(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`);
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: order.total * 100, // paise
      currency: "INR",
      receipt: order.no,
      notes: { order_no: order.no },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.id) throw new Error(`razorpay ${res.status}: ${data && data.error ? data.error.description : "no order"}`);
  return data.id;
}

// Signature Razorpay Checkout returns to the browser after a payment.
export async function paymentSignatureValid(razorpayOrderId, paymentId, signature) {
  if (!paymentsReady() || !razorpayOrderId || !paymentId) return false;
  return sameHex(await hmacHex(process.env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${paymentId}`), signature);
}

// Signature on webhook calls, over the raw request body.
export async function webhookSignatureValid(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return sameHex(await hmacHex(secret, rawBody), signature);
}

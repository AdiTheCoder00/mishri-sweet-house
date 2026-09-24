/* POST /api/payments/webhook: Razorpay reports a payment directly, so an
   order is marked paid even if the customer closed the page before the
   browser could. In the Razorpay dashboard, add a webhook for this URL with
   the payment.captured and order.paid events, and set the same secret as
   RAZORPAY_WEBHOOK_SECRET. */
import { storeReady } from "../_lib/store.js";
import { orderForRazorpay, markPaid } from "../_lib/orders.js";
import { webhookSignatureValid } from "../_lib/razorpay.js";
import { sendOrderAlert, sendOrderConfirmation } from "../_lib/email.js";
import { json } from "../_lib/auth.js";

export async function POST(request) {
  const raw = await request.text();
  if (!(await webhookSignatureValid(raw, request.headers.get("x-razorpay-signature")))) {
    return json({ error: "bad signature" }, 400);
  }
  if (!storeReady()) return json({ error: "storage-not-configured" }, 503);

  try {
    const event = JSON.parse(raw);
    if (event.event !== "payment.captured" && event.event !== "order.paid") return json({ ok: true, ignored: event.event });
    const payment = event.payload && event.payload.payment && event.payload.payment.entity;
    if (!payment) return json({ ok: true, ignored: "no payment" });
    // Look the order up by the Razorpay order id we created it with.
    const order = await orderForRazorpay(payment.order_id);
    if (!order) return json({ ok: true, ignored: "unknown order" });
    const updated = await markPaid(order, payment.id);
    if (updated) {
      const site = new URL(request.url).origin;
      await Promise.all([sendOrderAlert(updated, site), sendOrderConfirmation(updated, site)]);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("webhook failed", e);
    // 500 makes Razorpay retry later.
    return json({ error: "webhook failed" }, 500);
  }
}

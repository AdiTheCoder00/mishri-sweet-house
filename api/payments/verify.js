/* POST /api/payments/verify: the browser reports a Razorpay payment.
   It only counts if Razorpay's signature checks out for this order. */
import { storeReady } from "../_lib/store.js";
import { getOrder, markPaid } from "../_lib/orders.js";
import { paymentSignatureValid } from "../_lib/razorpay.js";
import { sendOrderAlert, sendOrderConfirmation } from "../_lib/email.js";
import { json } from "../_lib/auth.js";
import { reportError } from "../_lib/monitor.js";

export async function POST(request) {
  if (!storeReady()) return json({ error: "storage-not-configured" }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }

  try {
    const order = await getOrder(body.no);
    const rzpOrderId = order && order.payment && order.payment.razorpayOrderId;
    if (!order || !rzpOrderId || rzpOrderId !== body.razorpay_order_id) return json({ error: "Order not found." }, 404);
    if (!(await paymentSignatureValid(rzpOrderId, body.razorpay_payment_id, body.razorpay_signature))) {
      return json({ error: "The payment could not be confirmed. If money left your account, message us on WhatsApp with order " + order.no + "." }, 400);
    }
    const updated = await markPaid(order, body.razorpay_payment_id);
    if (updated) {
      const site = new URL(request.url).origin;
      await Promise.all([sendOrderAlert(updated, site), sendOrderConfirmation(updated, site)]);
    }
    return json({ order: updated || (await getOrder(order.no)) });
  } catch (e) {
    await reportError("verify failed", e, request);
    return json({ error: "The payment could not be confirmed just now. Please message us on WhatsApp." }, 500);
  }
}

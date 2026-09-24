/* POST /api/orders: places an order from the checkout.

   The browser sends item ids, quantities, delivery details and the payment
   method. Prices come from the server's catalogue, never from the browser.
   Cash on delivery orders are confirmed (and alerted) straight away; online
   ones get a Razorpay order to pay and are confirmed by /api/payments/verify
   or the Razorpay webhook. */
import { storeReady, overLimit, clientIp } from "./_lib/store.js";
import { buildOrder, nextOrderNo, saveOrder } from "./_lib/orders.js";
import { paymentsReady, publicKeyId, createRazorpayOrder } from "./_lib/razorpay.js";
import { sendOrderAlert } from "./_lib/email.js";
import { json } from "./_lib/auth.js";

export async function POST(request) {
  if (!storeReady()) return json({ error: "storage-not-configured" }, 503);
  if (await overLimit("order", clientIp(request), 20, 60 * 60)) {
    return json({ error: "Too many orders from this connection. Try again in an hour, or message us on WhatsApp." }, 429);
  }

  let input;
  try { input = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }

  try {
    const built = await buildOrder(input);
    if (built.error) return json(built, 400);
    const order = built.order;
    if (order.method !== "cod" && !paymentsReady()) {
      return json({ error: "Online payment is not available right now. Choose cash on delivery." }, 400);
    }

    order.no = await nextOrderNo();
    if (order.method !== "cod") order.payment.razorpayOrderId = await createRazorpayOrder(order);
    await saveOrder(order, true);

    if (order.method === "cod") await sendOrderAlert(order, new URL(request.url).origin);

    return json({
      order,
      razorpay: order.method === "cod" ? null : {
        key: publicKeyId(),
        orderId: order.payment.razorpayOrderId,
        amount: order.total * 100,
        currency: "INR",
      },
    }, 201);
  } catch (e) {
    console.error("order failed", e);
    return json({ error: "We could not place the order just now. Please try again, or message us on WhatsApp." }, 500);
  }
}

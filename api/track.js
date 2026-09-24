/* POST /api/track: the Track your order page. Needs the order number and
   the mobile number it was placed with; either wrong gives the same
   "not found", and lookups are rate-limited, so orders can't be found by
   guessing. Returns progress and contents only, never the address or phone. */
import { storeReady, overLimit, clientIp } from "./_lib/store.js";
import { getOrder } from "./_lib/orders.js";
import { json } from "./_lib/auth.js";

const digits = (s) => String(s || "").replace(/\D/g, "").slice(-10);
const NOT_FOUND = "We couldn't find an order with that number and mobile number. Check both, or WhatsApp us on +91 87446 67777.";

export async function POST(request) {
  if (!storeReady()) return json({ error: "storage-not-configured" }, 503);
  if (await overLimit("track", clientIp(request), 30, 60 * 60)) {
    return json({ error: "Too many lookups from this connection. Try again in an hour, or WhatsApp us." }, 429);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }

  // Accept "MSH-100001", "msh 100001" or just "100001".
  const num = String((body && body.no) || "").replace(/\D/g, "");
  const phone = digits(body && body.phone);
  if (!num || phone.length !== 10) return json({ error: "Enter your order number and the 10 digit mobile number you ordered with." }, 400);

  try {
    const order = await getOrder("MSH-" + num);
    if (!order || digits(order.customer.phone) !== phone) return json({ error: NOT_FOUND }, 404);
    return json({
      order: {
        no: order.no,
        at: order.at,
        updatedAt: order.updatedAt || order.at,
        status: order.status,
        history: (Array.isArray(order.history) ? order.history : []).map((h) => ({ status: h.status, at: h.at })),
        method: order.method,
        payment: order.payment ? order.payment.state : "cod",
        city: order.customer.city,
        pin: order.customer.pin,
        lines: order.lines.map((l) => ({ name: l.name, qty: l.qty })),
        total: order.total,
      },
    });
  } catch (e) {
    console.error("track failed", e);
    return json({ error: "We couldn't check that just now. Please try again." }, 500);
  }
}

/* /api/admin/orders: the shop admin's view of orders. Needs the admin
   session cookie from sign-in.

   GET    every order, newest first
   PATCH  { no, status } moves an order along: new, preparing, dispatched,
          delivered or cancelled. The first move to dispatched emails the
          customer (when they gave an email and a verified sender is set). */
import { storeReady } from "../_lib/store.js";
import { listOrders, getOrder, saveOrder, STATUSES } from "../_lib/orders.js";
import { adminGuard, json } from "../_lib/auth.js";
import { sendDispatchNotice } from "../_lib/email.js";

export async function GET(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  try {
    return json({ orders: await listOrders() });
  } catch (e) {
    console.error("list orders failed", e);
    return json({ error: "Orders could not be loaded." }, 500);
  }
}

export async function PATCH(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }
  if (!STATUSES.includes(body.status)) return json({ error: "Unknown status." }, 400);
  try {
    const order = await getOrder(body.no);
    if (!order) return json({ error: "Order not found." }, 404);
    order.status = body.status;
    order.updatedAt = new Date().toISOString();
    let emailed = false;
    if (order.status === "dispatched" && !(order.notified && order.notified.dispatched)) {
      emailed = (await sendDispatchNotice(order)).sent;
      if (emailed) order.notified = { ...order.notified, dispatched: order.updatedAt };
    }
    await saveOrder(order, false);
    return json({ order, emailed });
  } catch (e) {
    console.error("update order failed", e);
    return json({ error: "The order could not be updated." }, 500);
  }
}

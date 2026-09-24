/* Mishri Sweet House. Orders: validation, pricing and storage. */
import { redis, pipeline, KEYS, readCatalogue } from "./store.js";
import { effectiveItem, DELIVERY } from "./catalogue.js";

export const STATUSES = ["new", "preparing", "dispatched", "delivered", "cancelled"];
export const METHODS = ["cod", "upi", "card"];
const MAX_QTY = 99;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Indian mobile: 10 digits starting 6-9, optionally prefixed by 0 or +91.
const normalisePhone = (v) => v.replace(/[\s\-()]/g, "").replace(/^(\+91|0091|0)/, "");

/* Checks what the browser sent and prices it from the catalogue.
   Returns { order } or { error, field? }. */
export async function buildOrder(input) {
  const body = input && typeof input === "object" ? input : {};
  const c = body.customer && typeof body.customer === "object" ? body.customer : {};
  const customer = {
    name: str(c.name, 80),
    phone: str(c.phone, 20),
    address: str(c.address, 300),
    city: str(c.city, 60),
    pin: str(c.pin, 6),
  };
  if (customer.name.length < 2) return { error: "Enter your full name.", field: "name" };
  if (!/^[6-9]\d{9}$/.test(normalisePhone(customer.phone))) return { error: "Enter a 10 digit mobile number.", field: "phone" };
  if (customer.address.length < 6) return { error: "Enter the full delivery address.", field: "address" };
  if (customer.city.length < 2) return { error: "Enter the city.", field: "city" };
  if (!/^\d{6}$/.test(customer.pin)) return { error: "Enter a 6 digit PIN code.", field: "pin" };

  const method = METHODS.includes(body.method) ? body.method : "";
  if (!method) return { error: "Choose how you want to pay." };

  const wanted = new Map();
  for (const line of Array.isArray(body.lines) ? body.lines.slice(0, 30) : []) {
    const id = line && typeof line.id === "string" ? line.id : "";
    const qty = line && Number.isInteger(line.qty) ? line.qty : 0;
    if (id && qty > 0) wanted.set(id, (wanted.get(id) || 0) + qty);
  }
  if (!wanted.size) return { error: "Your basket is empty." };

  const settings = await readCatalogue();
  const lines = [];
  for (const [id, qty] of wanted) {
    const item = effectiveItem(id, settings);
    if (!item || item.status === "hidden") return { error: "Something in your basket is no longer on sale. Remove it and try again." };
    if (item.status === "soldout") return { error: `${item.name} has sold out today. Remove it and try again.` };
    const min = item.minQty || 1;
    const step = item.step || 1;
    if (qty < min || qty > MAX_QTY || (qty - min) % step !== 0) {
      return { error: `${item.name} is sold ${min > 1 ? `from ${min}, ` : ""}in steps of ${step}, up to ${MAX_QTY}.` };
    }
    lines.push({ id, name: item.name, qty, price: item.price });
  }

  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const delivery = subtotal >= DELIVERY.freeOver ? 0 : DELIVERY.fee;
  return {
    order: {
      at: new Date().toISOString(),
      status: "new",
      method,
      customer,
      note: str(body.note, 200),
      lines,
      subtotal,
      delivery,
      total: subtotal + delivery,
      payment: { state: method === "cod" ? "cod" : "pending" },
    },
  };
}

export async function nextOrderNo() {
  const n = await redis("INCR", KEYS.orderSeq);
  return "MSH-" + (100000 + Number(n));
}

export async function saveOrder(order, isNew) {
  const commands = [["SET", KEYS.order(order.no), JSON.stringify(order)]];
  if (isNew) commands.push(["ZADD", KEYS.orders, String(Date.parse(order.at)), order.no]);
  if (isNew && order.payment.razorpayOrderId) commands.push(["SET", KEYS.razorpay(order.payment.razorpayOrderId), order.no]);
  await pipeline(commands);
}

export async function getOrder(no) {
  if (typeof no !== "string" || !/^MSH-\d{6,}$/.test(no)) return null;
  const raw = await redis("GET", KEYS.order(no));
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function orderForRazorpay(rzpOrderId) {
  if (typeof rzpOrderId !== "string" || !rzpOrderId) return null;
  return getOrder(await redis("GET", KEYS.razorpay(rzpOrderId)));
}

// Newest first.
export async function listOrders(limit = 500) {
  const nos = await redis("ZRANGE", KEYS.orders, "0", String(limit - 1), "REV");
  if (!nos || !nos.length) return [];
  const raws = await redis("MGET", ...nos.map(KEYS.order));
  return raws.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}

/* Marks an online order paid once. Returns the updated order, or null when
   it was already paid (so callers alert only on the first confirmation). */
export async function markPaid(order, paymentId) {
  if (order.payment && order.payment.state === "paid") return null;
  // The browser and the webhook can both confirm at once; only one wins.
  const first = await redis("SET", KEYS.paid(order.no), paymentId, "NX");
  if (!first) return null;
  order.payment = { ...order.payment, state: "paid", paymentId, paidAt: new Date().toISOString() };
  await saveOrder(order, false);
  return order;
}

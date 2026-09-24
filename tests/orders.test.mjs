// Orders, the admin API and catalogue edits, with and without storage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { req, load, json, setEnv, unsetEnv, STORAGE_ENV, adminCookie, placeOrder, emails } from "./helpers/harness.mjs";

setEnv({ ADMIN_PASSWORD: "pw-123", RESEND_API_KEY: "re_test", ALERT_EMAIL: "owner@example.com" });
const store = await load("api/store.js");
const orders = await load("api/orders.js");
const adminOrders = await load("api/admin/orders.js");
const adminCatalogue = await load("api/admin/catalogue.js");

test("demo mode: without storage the site says so and takes no orders", async () => {
  unsetEnv("KV_REST_API_URL", "KV_REST_API_TOKEN");
  const script = await (await store.GET(req("/api/store"))).text();
  assert.match(script, /"orders":false/);
  const res = await orders.POST(req("/api/orders", { method: "POST", body: {} }));
  assert.equal(res.status, 503);
});

test("the server prices orders from the catalogue, ignoring prices sent by the browser", async () => {
  setEnv(STORAGE_ENV);
  const script = await (await store.GET(req("/api/store"))).text();
  assert.match(script, /"orders":true/);
  assert.match(script, /"razorpayKey":""/);

  const r = await placeOrder({ note: "Happy Diwali", lines: [{ id: "kaju-katli", qty: 2, price: 1 }, { id: "box-wedding", qty: 50 }] });
  assert.equal(r.status, 201);
  assert.equal(r.order.total, 649 * 2 + 249 * 50);
  assert.equal(r.order.delivery, 0);
  assert.match(r.order.no, /^MSH-1\d{5}$/);
  assert.equal(emails.length, 1, "the owner gets an alert");
  assert.deepEqual(emails[0].to, ["owner@example.com"]);
  assert.ok(emails[0].subject.includes(r.order.no));
});

test("small baskets pay delivery; free over ₹999", async () => {
  assert.equal((await placeOrder({ lines: [{ id: "jalebi", qty: 1 }] })).order.total, 249 + 79);
});

test("order validation", async () => {
  assert.equal((await placeOrder({ customer: { phone: "12345" } })).field, "phone");
  assert.equal((await placeOrder({ customer: { pin: "012345" } })).field, "pin");
  assert.equal((await placeOrder({ customer: { email: "not-an-email" } })).field, "email");
  assert.ok((await placeOrder({ customer: { pin: "273001", city: "Gorakhpur" } })).order, "anywhere in India");
  assert.ok((await placeOrder({ lines: [{ id: "box-wedding", qty: 55 }] })).error, "sold in steps");
  assert.ok((await placeOrder({ method: "upi" })).error, "no UPI while payments are off");
  assert.ok((await placeOrder({ lines: [] })).error, "empty basket");
});

test("the admin API needs a valid session cookie", async () => {
  assert.equal((await adminOrders.GET(req("/api/admin/orders"))).status, 401);
  assert.equal((await adminOrders.GET(req("/api/admin/orders", { headers: { cookie: "mishri_admin=9999999999.abc" } }))).status, 401);
  const cookie = await adminCookie();
  const { status, body } = await json(adminOrders.GET(req("/api/admin/orders", { headers: { cookie } })));
  assert.equal(status, 200);
  assert.ok(body.orders.length >= 3);
  const times = body.orders.map((o) => Date.parse(o.at));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "newest first");
});

test("the admin moves an order along and it keeps a history", async () => {
  const cookie = await adminCookie();
  const { order } = await placeOrder();
  const patch = (status) => json(adminOrders.PATCH(req("/api/admin/orders", { method: "PATCH", body: { no: order.no, status }, headers: { cookie } })));
  let r = await patch("preparing");
  assert.equal(r.body.order.status, "preparing");
  r = await patch("dispatched");
  assert.deepEqual(r.body.order.history.map((h) => h.status), ["preparing", "dispatched"]);
  assert.equal((await patch("shipped!")).status, 400);
});

test("catalogue edits are cleaned, published and used for pricing", async () => {
  const cookie = await adminCookie();
  const { body } = await json(adminCatalogue.PUT(req("/api/admin/catalogue", {
    method: "PUT",
    headers: { cookie },
    body: { items: { "kaju-katli": { price: 699, evil: "<script>" }, rasmalai: { status: "soldout" }, jalebi: { status: "hidden" }, nope: { price: 1 }, kalakand: { price: -5, tag: "" } } },
  })));
  assert.deepEqual(body, { items: { "kaju-katli": { price: 699 }, rasmalai: { status: "soldout" }, jalebi: { status: "hidden" }, kalakand: { tag: "" } } });
  assert.match(await (await store.GET(req("/api/store"))).text(), /"kaju-katli":\{"price":699\}/);
  assert.equal((await placeOrder()).order.lines[0].price, 699);
  assert.match((await placeOrder({ lines: [{ id: "rasmalai", qty: 1 }] })).error, /sold out/);
  assert.ok((await placeOrder({ lines: [{ id: "jalebi", qty: 1 }] })).error, "hidden items can't be ordered");
  assert.equal((await adminCatalogue.PUT(req("/api/admin/catalogue", { method: "PUT", body: { items: {} } }))).status, 401);
});

test("orders are rate-limited per address", async () => {
  let last;
  for (let i = 0; i < 21; i++) last = await orders.POST(req("/api/orders", { method: "POST", body: {}, ip: "9.9.9.9" }));
  assert.equal(last.status, 429);
  assert.notEqual((await orders.POST(req("/api/orders", { method: "POST", body: {}, ip: "9.9.9.10" }))).status, 429);
});

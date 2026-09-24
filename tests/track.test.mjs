// Track your order: /api/track.
import { test } from "node:test";
import assert from "node:assert/strict";
import { req, load, json, setEnv, unsetEnv, STORAGE_ENV, adminCookie, placeOrder } from "./helpers/harness.mjs";

setEnv({ ADMIN_PASSWORD: "pw" });
const track = await load("api/track.js");
const adminOrders = await load("api/admin/orders.js");
const lookup = (body, ip = "3.3.3.3") => json(track.POST(req("/api/track", { method: "POST", body, ip })));

test("without storage it says so, so the page can explain the demo", async () => {
  unsetEnv("KV_REST_API_URL", "KV_REST_API_TOKEN");
  assert.equal((await lookup({ no: "MSH-100001", phone: "9876543210" })).status, 503);
});

test("finds an order by number and mobile, in any common format", async () => {
  setEnv(STORAGE_ENV);
  const { order } = await placeOrder({ customer: { email: "asha@example.com" } });
  for (const [no, phone] of [[order.no, "9876543210"], [order.no.toLowerCase(), "+91 98765 43210"], [order.no.slice(4), "098765-43210"]]) {
    const r = await lookup({ no, phone });
    assert.equal(r.status, 200, `${no} / ${phone}`);
    assert.equal(r.body.order.no, order.no);
  }
});

test("shows progress and contents, never the address, phone, name or email", async () => {
  const { order } = await placeOrder({ lines: [{ id: "kaju-katli", qty: 2 }] });
  const { body } = await lookup({ no: order.no, phone: "9876543210" });
  assert.equal(body.order.status, "new");
  assert.equal(body.order.payment, "cod");
  assert.equal(body.order.total, order.total);
  assert.deepEqual(body.order.lines, [{ name: "Kaju Katli", qty: 2 }]);
  assert.equal(body.order.city, "Jaipur");
  const text = JSON.stringify(body);
  for (const secret of ["MI Road", "98765", "Asha", "@"]) assert.ok(!text.includes(secret), `leaks ${secret}`);
});

test("status changes from the admin appear with their times", async () => {
  const { order } = await placeOrder();
  const cookie = await adminCookie("pw");
  for (const status of ["preparing", "dispatched"]) {
    await adminOrders.PATCH(req("/api/admin/orders", { method: "PATCH", body: { no: order.no, status }, headers: { cookie } }));
  }
  const { body } = await lookup({ no: order.no, phone: "9876543210" });
  assert.equal(body.order.status, "dispatched");
  assert.deepEqual(body.order.history.map((h) => h.status), ["preparing", "dispatched"]);
  assert.ok(Date.parse(body.order.updatedAt) >= Date.parse(body.order.at));
});

test("a wrong mobile or unknown number gets the same answer", async () => {
  const { order } = await placeOrder();
  const wrongPhone = await lookup({ no: order.no, phone: "9000000000" });
  const unknown = await lookup({ no: "MSH-999999", phone: "9876543210" });
  assert.equal(wrongPhone.status, 404);
  assert.deepEqual(wrongPhone, unknown);
  assert.equal((await lookup({ no: "", phone: "9876543210" })).status, 400);
  assert.equal((await lookup({ no: order.no, phone: "123" })).status, 400);
  assert.equal((await track.POST(req("/api/track", { method: "POST", body: "not json" }))).status, 400);
});

test("lookups are rate-limited per address", async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await lookup({ no: "MSH-100001", phone: "9000000000" }, "4.4.4.4");
  assert.equal(last.status, 429);
});

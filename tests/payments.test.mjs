// Razorpay: order creation, the browser's confirmation and the webhook.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { req, load, json, setEnv, STORAGE_ENV, adminCookie, placeOrder, emails, razorpayOrders } from "./helpers/harness.mjs";

setEnv({ ...STORAGE_ENV, ADMIN_PASSWORD: "pw-123", RESEND_API_KEY: "re_test", ALERT_EMAIL: "owner@example.com" });
setEnv({ RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "rzsecret", RAZORPAY_WEBHOOK_SECRET: "whsecret" });
const verify = await load("api/payments/verify.js");
const webhook = await load("api/payments/webhook.js");
const adminOrders = await load("api/admin/orders.js");
const store = await load("api/store.js");

const sign = (secret, text) => createHmac("sha256", secret).update(text).digest("hex");
const verifyCall = (body) => json(verify.POST(req("/api/payments/verify", { method: "POST", body })));
const hookCall = (body, signature = sign("whsecret", body)) =>
  webhook.POST(req("/api/payments/webhook", { method: "POST", body, headers: { "x-razorpay-signature": signature } }));

test("the store publishes the public key only", async () => {
  const script = await (await store.GET(req("/api/store"))).text();
  assert.match(script, /"razorpayKey":"rzp_test_abc"/);
  assert.ok(!script.includes("rzsecret"));
});

test("UPI order: Razorpay order created, owner alerted only once paid", async () => {
  const r = await placeOrder({ method: "upi" });
  assert.equal(r.razorpay.key, "rzp_test_abc");
  assert.equal(r.razorpay.amount, (649 + 79) * 100);
  assert.equal(r.order.payment.state, "pending");
  assert.equal(emails.length, 0, "no alert before payment");
  assert.equal(razorpayOrders.at(-1).auth, "Basic " + Buffer.from("rzp_test_abc:rzsecret").toString("base64"));

  const good = { no: r.order.no, razorpay_order_id: r.razorpay.orderId, razorpay_payment_id: "pay_1", razorpay_signature: sign("rzsecret", r.razorpay.orderId + "|pay_1") };
  assert.equal((await verifyCall({ ...good, razorpay_signature: "00" })).status, 400);
  assert.notEqual((await verifyCall({ ...good, razorpay_order_id: "order_other" })).status, 200);

  const ok = await verifyCall(good);
  assert.equal(ok.body.order.payment.state, "paid");
  assert.equal(emails.length, 1);

  // Razorpay's webhook for the same payment must not alert again.
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: r.razorpay.orderId, notes: {} } } } });
  assert.equal((await hookCall(body, "bad")).status, 400);
  assert.equal((await hookCall(body)).status, 200);
  assert.equal(emails.length, 1, "no duplicate alert");
});

test("webhook alone marks a payment paid when the customer closed the page", async () => {
  const r = await placeOrder({ method: "card", lines: [{ id: "kaju-katli", qty: 2 }] });
  const body = JSON.stringify({ event: "order.paid", payload: { payment: { entity: { id: "pay_2", order_id: r.razorpay.orderId } }, order: { entity: { id: r.razorpay.orderId } } } });
  assert.equal((await hookCall(body)).status, 200);
  const cookie = await adminCookie();
  const { body: list } = await json(adminOrders.GET(req("/api/admin/orders", { headers: { cookie } })));
  const saved = list.orders.find((o) => o.no === r.order.no);
  assert.equal(saved.payment.state, "paid");
  assert.equal(saved.payment.paymentId, "pay_2");
  assert.equal(emails.length, 2);
});

test("browser and webhook confirming together alert once", async () => {
  const r = await placeOrder({ method: "upi" });
  const before = emails.length;
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_3", order_id: r.razorpay.orderId } } } });
  await Promise.all([
    verifyCall({ no: r.order.no, razorpay_order_id: r.razorpay.orderId, razorpay_payment_id: "pay_3", razorpay_signature: sign("rzsecret", r.razorpay.orderId + "|pay_3") }),
    hookCall(body),
  ]);
  assert.equal(emails.length, before + 1);
});

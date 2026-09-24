// Races and edge cases found in review of the email work (PR #9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { req, load, json, setEnv, STORAGE_ENV, adminCookie, placeOrder, emails, resend, db } from "./helpers/harness.mjs";

setEnv({ ...STORAGE_ENV, ADMIN_PASSWORD: "pw", RESEND_API_KEY: "k", ALERT_EMAIL: "o@x.in", EMAIL_FROM: "Shop <s@shop.in>" });
const subscribe = await load("api/subscribe.js");
const unsubscribe = await load("api/unsubscribe.js");
const adminEmail = await load("api/admin/email.js");
const adminOrders = await load("api/admin/orders.js");
const email = await load("api/_lib/email.js");
const cookie = await adminCookie("pw");
const admin = (path, method = "GET", body) => req(path, { method, body, headers: { cookie } });
const lastError = async () => (await json(adminEmail.GET(admin("/api/admin/email")))).body.lastError;

test("two admins dispatching at once send one email", async () => {
  const { order } = await placeOrder({ customer: { email: "a@b.in" }, lines: [{ id: "jalebi", qty: 1 }] });
  emails.length = 0;
  const patch = () => adminOrders.PATCH(admin("/api/admin/orders", "PATCH", { no: order.no, status: "dispatched" }));
  await Promise.all([patch(), patch()]);
  assert.equal(emails.filter((m) => /out for delivery/.test(m.subject)).length, 1);
});

test("the same address signing up twice at once gets one welcome, and its link works", async () => {
  emails.length = 0;
  const sign = () => subscribe.POST(req("/api/subscribe", { method: "POST", body: { email: "alice@x.in" }, ip: String(Math.random()) }));
  await Promise.all([sign(), sign()]);
  const welcomes = emails.filter((m) => m.to[0] === "alice@x.in");
  assert.equal(welcomes.length, 1);
  await unsubscribe.POST(req("/api/unsubscribe?token=" + welcomes[0].text.match(/token=([0-9a-f]{36})/)[1], { method: "POST" }));
  const subs = (await json(adminEmail.GET(admin("/api/admin/email")))).body.subscribers;
  assert.ok(!subs.some((s) => s.email === "alice@x.in"));
});

test("a working test email keeps an unrelated customer-email failure visible", async () => {
  db.handle("", ["SET", "mishri:email:last-error", JSON.stringify({ at: new Date().toISOString(), context: "confirmation MSH-100001", reason: "Resend: bounced" })]);
  await adminEmail.POST(admin("/api/admin/email", "POST", { action: "test" }));
  assert.match((await lastError()).context, /^confirmation/);
  db.handle("", ["SET", "mishri:email:last-error", JSON.stringify({ at: new Date().toISOString(), context: "alert MSH-100001", reason: "x" })]);
  await adminEmail.POST(admin("/api/admin/email", "POST", { action: "test" }));
  assert.equal(await lastError(), null);
});

test("retrying a half-sent announcement reaches only the people it missed", async () => {
  const list = Array.from({ length: 120 }, (_, i) => ({ email: `s${i}@x.in`, unsubscribeUrl: `https://mishri.test/u?${i}` }));
  emails.length = 0;
  resend.batchCalls = 0;
  resend.failBatchAfter = 1;
  const first = await email.sendAnnouncement(list, "Diwali", "Open now");
  resend.failBatchAfter = Infinity;
  const second = await email.sendAnnouncement(list, "Diwali", "Open now");
  const perPerson = new Map();
  emails.forEach((m) => perPerson.set(m.to[0], (perPerson.get(m.to[0]) || 0) + 1));
  assert.equal(first.sent, 100);
  assert.equal(first.failed, 20);
  assert.equal(second.sent, 20);
  assert.equal(perPerson.size, 120);
  assert.ok([...perPerson.values()].every((n) => n === 1), "nobody emailed twice");
});

test("control characters are refused in email addresses", () => {
  assert.equal(email.validEmail("ab\u0007c@x.in"), false);
  assert.equal(email.validEmail("a.b+c@x.in"), true);
});

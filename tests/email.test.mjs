// Email: owner alerts, customer emails, the Notify me list and announcements.
import { test } from "node:test";
import assert from "node:assert/strict";
import { req, load, json, setEnv, unsetEnv, STORAGE_ENV, adminCookie, placeOrder, emails, resend } from "./helpers/harness.mjs";

// Stray quotes and spaces, as pasted into Vercel, must be ignored.
setEnv({ ...STORAGE_ENV, ADMIN_PASSWORD: "pw", RESEND_API_KEY: ' "re_123" ', ALERT_EMAIL: "shop@example.com" });
const subscribe = await load("api/subscribe.js");
const unsubscribe = await load("api/unsubscribe.js");
const adminEmail = await load("api/admin/email.js");
const adminOrders = await load("api/admin/orders.js");
const cookie = await adminCookie("pw");
const admin = (path, method = "GET", body) => req(path, { method, body, headers: { cookie } });
const status = async () => (await json(adminEmail.GET(admin("/api/admin/email")))).body;
const PUNE = { city: "Pune", pin: "411001" };

test("without a verified sender only the owner alert goes out", async () => {
  emails.length = 0;
  const r = await placeOrder({ customer: { ...PUNE, email: "asha@gmail.com" } });
  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0].to, ["shop@example.com"]);
  assert.match(emails[0].from, /onboarding@resend\.dev/);
  assert.equal(r.order.customer.email, "asha@gmail.com");
  assert.ok(!("email" in (await placeOrder({ customer: PUNE })).order.customer), "email is optional");
  const st = await status();
  assert.ok(st.config.apiKey);
  assert.deepEqual(st.config.alertEmail, ["shop@example.com"]);
  assert.equal(st.config.customerEmails, false);
});

test("Resend failures are explained to the admin", async () => {
  resend.mode = "testsender";
  let r = (await json(adminEmail.POST(admin("/api/admin/email", "POST", { action: "test" })))).body;
  assert.equal(r.sent, false);
  assert.match(r.reason, /owner@gmail\.com/);
  assert.match(r.reason, /ALERT_EMAIL/);
  await placeOrder({ customer: PUNE });
  const st = await status();
  assert.match(st.lastError.context, /^alert MSH-/);

  resend.mode = "badkey";
  r = (await json(adminEmail.POST(admin("/api/admin/email", "POST", { action: "test" })))).body;
  assert.match(r.reason, /API key/);

  resend.mode = "ok";
  r = (await json(adminEmail.POST(admin("/api/admin/email", "POST", { action: "test" })))).body;
  assert.equal(r.sent, true);
  assert.ok(!(await status()).lastError, "a working test clears the owner-alert error");
  assert.equal((await adminEmail.GET(req("/api/admin/email"))).status, 401);
});

test("with a verified sender customers get a confirmation and a dispatch notice", async () => {
  setEnv({ EMAIL_FROM: "Mishri Sweet House <orders@mishrisweets.in>" });
  emails.length = 0;
  const r = await placeOrder({ customer: { ...PUNE, email: "asha@gmail.com" } });
  const confirmation = emails.find((m) => m.to[0] === "asha@gmail.com");
  assert.equal(emails.length, 2);
  assert.ok(confirmation.subject.includes(r.order.no));
  assert.match(confirmation.text, /in 2 to 5 days/);
  assert.ok(confirmation.text.includes(`/track/?no=${r.order.no}`), "links to Track your order");
  assert.match(confirmation.from, /mishrisweets\.in/);

  emails.length = 0;
  const patch = (s) => json(adminOrders.PATCH(admin("/api/admin/orders", "PATCH", { no: r.order.no, status: s })));
  assert.equal((await patch("dispatched")).body.emailed, true);
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /out for delivery/);
  assert.match(emails[0].text, /₹728/);
  assert.ok(emails[0].text.includes(`/track/?no=${r.order.no}`));
  await patch("preparing");
  assert.equal((await patch("dispatched")).body.emailed, false, "only one dispatch email");
  assert.equal(emails.length, 1);
});

test("Notify me: sign up, announce, unsubscribe", async () => {
  emails.length = 0;
  let r = (await json(subscribe.POST(req("/api/subscribe", { method: "POST", body: { email: " Ravi@Example.com " } })))).body;
  assert.ok(r.ok && !r.already);
  assert.equal(emails[0].to[0], "ravi@example.com");
  assert.match(emails[0].text, /\/api\/unsubscribe\?token=[0-9a-f]{36}/);
  r = (await json(subscribe.POST(req("/api/subscribe", { method: "POST", body: { email: "ravi@example.com" } })))).body;
  assert.ok(r.already);
  assert.equal(emails.length, 1, "no second welcome");
  assert.equal((await subscribe.POST(req("/api/subscribe", { method: "POST", body: { email: "nope" } }))).status, 400);
  await subscribe.POST(req("/api/subscribe", { method: "POST", body: { email: "meera@example.com" } }));
  assert.equal((await status()).subscribers[0].email, "meera@example.com", "newest first");

  emails.length = 0;
  r = (await json(adminEmail.POST(admin("/api/admin/email", "POST", { action: "announce", subject: "Diwali boxes are open", message: "Pre-order now.\n\nThey go fast." })))).body;
  assert.equal(r.sent, 2);
  assert.ok(emails.every((m) => m.url.endsWith("/emails/batch") && m.headers["List-Unsubscribe"]));
  const tokenOf = (m) => m.text.match(/token=([0-9a-f]{36})/)[1];
  assert.notEqual(tokenOf(emails[0]), tokenOf(emails[1]));

  const token = tokenOf(emails.find((m) => m.to[0] === "ravi@example.com"));
  const opened = await (await unsubscribe.GET(req("/api/unsubscribe?token=" + token))).text();
  assert.match(opened, /Yes, unsubscribe me/);
  assert.equal((await status()).subscribers.length, 2, "opening the link (a mail scanner) does not unsubscribe");
  assert.match(await (await unsubscribe.POST(req("/api/unsubscribe?token=" + token, { method: "POST" }))).text(), /You're unsubscribed/);
  assert.deepEqual((await status()).subscribers.map((s) => s.email), ["meera@example.com"]);
  assert.match(await (await unsubscribe.POST(req("/api/unsubscribe?token=" + token, { method: "POST" }))).text(), /Already unsubscribed/);

  r = (await json(adminEmail.DELETE(admin("/api/admin/email", "DELETE", { email: "MEERA@example.com" })))).body;
  assert.ok(r.removed);
  assert.equal((await status()).subscribers.length, 0);
});

test("announcing without a verified sender explains why", async () => {
  unsetEnv("EMAIL_FROM");
  await subscribe.POST(req("/api/subscribe", { method: "POST", body: { email: "x@example.com" } }));
  const r = (await json(adminEmail.POST(admin("/api/admin/email", "POST", { action: "announce", subject: "Hi", message: "Hello" })))).body;
  assert.equal(r.sent, 0);
  assert.match(r.reason, /EMAIL_FROM/);
});

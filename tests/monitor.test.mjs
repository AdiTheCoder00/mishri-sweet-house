// Error reports to Sentry: monitor.js (shared) and api/_lib/monitor.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { req, load, json, setEnv, unsetEnv, STORAGE_ENV, placeOrder, sentryEvents, resend, adminCookie, ROOT, SENTRY_DSN } from "./helpers/harness.mjs";

const core = createRequire(import.meta.url)(path.join(ROOT, "monitor.js"));
setEnv({ ...STORAGE_ENV, ADMIN_PASSWORD: "pw", RESEND_API_KEY: "k", ALERT_EMAIL: "o@x.in" });
const store = await load("api/store.js");
const track = await load("api/track.js");
const adminEmail = await load("api/admin/email.js");

test("reads Sentry DSNs and refuses anything else", () => {
  assert.deepEqual(core.parseDsn(SENTRY_DSN), { dsn: SENTRY_DSN, key: "abc123", host: "o1.ingest.sentry.io", project: "42" });
  assert.equal(core.parseDsn("https://abc@evil.example/../x"), null);
  assert.equal(core.parseDsn(""), null);
  assert.equal(core.parseDsn("http://abc123@o1.ingest.sentry.io/42"), null, "https only");
});

test("turns Chrome and Firefox/Safari stacks into Sentry frames, outermost first", () => {
  const chrome = core.framesFrom("Error: boom\n    at inner (https://s.test/app.js:10:5)\n    at https://s.test/app.js:20:1");
  assert.deepEqual(chrome.map((f) => [f.function, f.lineno]), [["?", 20], ["inner", 10]]);
  const gecko = core.framesFrom("inner@https://s.test/app.js:10:5\n@https://s.test/app.js:20:1");
  assert.deepEqual(gecko.map((f) => [f.function, f.lineno]), [["?", 20], ["inner", 10]]);
});

test("builds an envelope Sentry accepts, without the page's query string", () => {
  const event = core.eventFor(new TypeError("x is undefined"), { url: "https://s.test/track/?no=MSH-100001", tags: { a: "b" } });
  const { url, body } = core.envelope(event, SENTRY_DSN);
  assert.equal(url, "https://o1.ingest.sentry.io/api/42/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=mishri%2F1.0");
  const [header, item, sent] = body.split("\n").map((l) => JSON.parse(l));
  assert.equal(header.event_id, event.event_id);
  assert.match(header.event_id, /^[0-9a-f]{32}$/);
  assert.deepEqual(item, { type: "event" });
  assert.equal(sent.exception.values[0].type, "TypeError");
  assert.equal(sent.request.url, "https://s.test/track/");
  assert.equal(core.eventFor("plain", { message: "Checkout" }).message.formatted, "Checkout: plain");
});

test("off without SENTRY_DSN: nothing published, nothing sent", async () => {
  unsetEnv("SENTRY_DSN");
  assert.match(await (await store.GET(req("/api/store"))).text(), /"sentryDsn":""/);
  setEnv({ KV_REST_API_TOKEN: "wrong" }); // storage now fails
  assert.equal((await track.POST(req("/api/track", { method: "POST", body: { no: "MSH-100001", phone: "9876543210" } }))).status, 500);
  assert.equal(sentryEvents.length, 0);
  setEnv(STORAGE_ENV);
});

test("with SENTRY_DSN: the store publishes it and a failing route reports", async () => {
  setEnv({ SENTRY_DSN: ` "${SENTRY_DSN}" `, VERCEL_ENV: "preview" });
  assert.ok((await (await store.GET(req("/api/store"))).text()).includes(`"sentryDsn":"${SENTRY_DSN}"`));
  setEnv({ KV_REST_API_TOKEN: "wrong" });
  const res = await track.POST(req("/api/track", { method: "POST", body: { no: "MSH-100001", phone: "9876543210" } }));
  setEnv(STORAGE_ENV);
  assert.equal(res.status, 500);
  assert.equal(sentryEvents.length, 1);
  const { event } = sentryEvents[0];
  assert.equal(event.platform, "node");
  assert.equal(event.environment, "preview");
  assert.equal(event.tags.route, "/api/track");
  assert.equal(event.extra.where, "track failed");
  assert.match(event.exception.values[0].value, /redis 401/);
  assert.ok(event.exception.values[0].stacktrace.frames.length > 0);
  assert.ok(!JSON.stringify(event).includes("9876543210"), "no phone number in the report");
});

test("a failed order alert is reported as a warning; the admin's test email is not", async () => {
  sentryEvents.length = 0;
  resend.mode = "badkey";
  await placeOrder();
  assert.equal(sentryEvents.length, 1);
  assert.equal(sentryEvents[0].event.level, "warning");
  assert.match(sentryEvents[0].event.message.formatted, /^Email failed \(alert\): .*API key/);
  const cookie = await adminCookie("pw");
  await adminEmail.POST(req("/api/admin/email", { method: "POST", body: { action: "test" }, headers: { cookie } }));
  assert.equal(sentryEvents.length, 1);
  resend.mode = "ok";
});

test("an unreachable Sentry never breaks the request", async () => {
  setEnv({ SENTRY_DSN: "https://abc123@down.ingest.sentry.io/42" }); // the harness refuses this host
  setEnv({ KV_REST_API_TOKEN: "wrong" });
  const res = await track.POST(req("/api/track", { method: "POST", body: { no: "MSH-100001", phone: "9876543210" } }));
  setEnv(STORAGE_ENV);
  assert.equal(res.status, 500);
  assert.equal((await json(track.POST(req("/api/track", { method: "POST", body: { no: "MSH-999999", phone: "9876543210" } })))).status, 404);
});

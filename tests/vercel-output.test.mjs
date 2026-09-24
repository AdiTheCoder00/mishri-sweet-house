/* Runs what `vercel build` produced, the way Vercel will: the Node
   functions as compiled CommonJS, and the middleware inside Vercel's edge
   runtime (no require, no Node APIs). This is what caught the outage where
   middleware.js imported a helper that only existed at build time.

   Skipped unless .vercel/output exists and edge-runtime is installed; CI
   runs `vercel build` first. Locally:
     npm install --no-save vercel edge-runtime && npx vercel build --yes   */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SITE, fakeFetch, setEnv, STORAGE_ENV, emails } from "./helpers/harness.mjs";

const OUT = path.join(ROOT, ".vercel/output/functions");
const require = createRequire(path.join(ROOT, "package.json"));
let EdgeRuntime;
try { ({ EdgeRuntime } = require(process.env.EDGE_RUNTIME_MODULE || "edge-runtime")); } catch {}
const skip = !fs.existsSync(OUT) ? "no .vercel/output: run vercel build" : !EdgeRuntime ? "edge-runtime is not installed" : false;

setEnv({ ...STORAGE_ENV, ADMIN_PASSWORD: "pw-123", RESEND_API_KEY: "k", ALERT_EMAIL: "o@x.in" });

// A built function: .vercel/output/functions/api/orders.func/<handler>.
const fn = (route) => {
  const dir = path.join(OUT, route + ".func");
  return require(path.join(dir, JSON.parse(fs.readFileSync(path.join(dir, ".vc-config.json"), "utf8")).handler));
};

function edgeMiddleware() {
  const dir = path.join(OUT, "middleware.func");
  const config = JSON.parse(fs.readFileSync(path.join(dir, ".vc-config.json"), "utf8"));
  assert.equal(config.runtime, "edge", "middleware must build for the edge runtime");
  const rt = new EdgeRuntime({ extend: (ctx) => { ctx.process = { env: { ...process.env } }; ctx.fetch = fakeFetch; return ctx; } });
  rt.evaluate(`var module = { exports: {} }; var exports = module.exports;\n${fs.readFileSync(path.join(dir, config.entrypoint), "utf8")}\n;globalThis.__mw = module.exports.default;`);
  assert.equal(rt.evaluate("typeof require"), "undefined");
  return (pathname, init = {}) => rt.evaluate(`globalThis.__mw(new Request(${JSON.stringify(SITE + pathname)}, ${JSON.stringify(init)}))`);
}

test("the built middleware loads and signs in inside the edge runtime", { skip }, async () => {
  const mw = edgeMiddleware();
  const signedOut = await mw("/admin.html");
  assert.equal(signedOut.headers.get("location"), "/admin-login.html");
  assert.equal((await mw("/admin-login.html")).headers.get("x-middleware-next"), "1");

  const login = (password) => mw("/admin/login", { method: "POST", headers: { "x-real-ip": "8.8.8.8", "content-type": "application/x-www-form-urlencoded" }, body: "password=" + password });
  const res = await login("pw-123");
  assert.equal(res.status, 303);
  const cookie = res.headers.get("set-cookie").split(";")[0];
  assert.equal((await mw("/admin.html", { headers: { cookie } })).headers.get("x-middleware-next"), "1");

  // The cookie made at the edge works in the Node functions.
  const orders = await fn("api/admin/orders").GET(new Request(SITE + "/api/admin/orders", { headers: { cookie } }));
  assert.equal(orders.status, 200);

  for (let i = 0; i < 10; i++) await login("nope");
  assert.equal((await login("pw-123")).headers.get("location"), "/admin-login.html?error=locked");
});

test("the built functions run", { skip }, async () => {
  const store = await fn("api/store").GET(new Request(SITE + "/api/store"));
  assert.match(await store.text(), /"orders":true/);

  const placed = await fn("api/orders").POST(new Request(SITE + "/api/orders", {
    method: "POST",
    headers: { "x-real-ip": "1.1.1.1" },
    body: JSON.stringify({ method: "cod", customer: { name: "Asha", phone: "9876543210", address: "12 MI Road", city: "Jaipur", pin: "302001" }, lines: [{ id: "kaju-katli", qty: 1 }] }),
  }));
  assert.equal(placed.status, 201);
  const { order } = await placed.json();
  assert.equal(order.total, 649 + 79, "prices come from products.js, bundled into the function");
  assert.equal(emails.length, 1);

  const tracked = await fn("api/track").POST(new Request(SITE + "/api/track", { method: "POST", body: JSON.stringify({ no: order.no, phone: "9876543210" }) }));
  assert.equal((await tracked.json()).order.no, order.no);

  const hook = await fn("api/payments/webhook").POST(new Request(SITE + "/api/payments/webhook", { method: "POST", body: "{}", headers: { "x-razorpay-signature": "x" } }));
  assert.equal(hook.status, 400);
});

test("stays within the Hobby plan's 12 functions", { skip }, () => {
  const funcs = fs.readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith(".func") && !f.startsWith("middleware"));
  assert.ok(funcs.length <= 12, `${funcs.length} functions`);
});

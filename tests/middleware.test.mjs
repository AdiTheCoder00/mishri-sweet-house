// middleware.js: admin sign-in, session cookie and lockout.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { req, setEnv, unsetEnv, STORAGE_ENV, middleware, db, ROOT } from "./helpers/harness.mjs";

const mw = await middleware();
const where = (res) => res.headers.get("location");
const passes = (res) => res.headers.get("x-middleware-next") === "1";
const login = (password, ip = "5.5.5.5") =>
  mw(req("/admin/login", { method: "POST", body: new URLSearchParams({ password }), headers: { "content-type": "application/x-www-form-urlencoded" }, ip }));

test("stands alone: Vercel's edge runtime has no require, so no imports", () => {
  const source = fs.readFileSync(path.join(ROOT, "middleware.js"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\bimport\(/);
  assert.doesNotMatch(source, /\brequire\(/);
});

test("only runs on admin URLs, so the shop never depends on it", async () => {
  const source = fs.readFileSync(path.join(ROOT, "middleware.js"), "utf8");
  const matcher = JSON.parse(source.match(/matcher:\s*(\[[^\]]*\])/)[1]);
  assert.ok(matcher.length && matcher.every((m) => m.startsWith("/admin")));
});

test("with no password set, the admin explains setup", async () => {
  unsetEnv("ADMIN_PASSWORD");
  assert.equal(where(await mw(req("/admin.html"))), "/admin-login.html?error=setup");
  assert.equal(where(await login("anything")), "/admin-login.html?error=setup");
});

test("signed out: admin files redirect to sign-in; the sign-in page loads", async () => {
  setEnv({ ADMIN_PASSWORD: "pw-123" });
  for (const p of ["/admin", "/admin.html", "/admin.js", "/admin.css", "/ADMIN.html", "/%61dmin.html", "//admin.html/"]) {
    assert.equal(where(await mw(req(p))), "/admin-login.html", p);
  }
  assert.ok(passes(await mw(req("/admin-login.html"))));
  assert.ok(passes(await mw(req("/index.html"))));
});

test("signing in sets a session cookie that opens the admin", async () => {
  const res = await login("pw-123");
  assert.equal(res.status, 303);
  assert.equal(where(res), "/admin.html");
  const setCookie = res.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);
  const cookie = setCookie.split(";")[0];
  assert.ok(passes(await mw(req("/admin.html", { headers: { cookie } }))));
  assert.equal(where(await mw(req("/admin-login.html", { headers: { cookie } }))), "/admin.html");
  assert.equal(where(await mw(req("/admin.html", { headers: { cookie: "mishri_admin=9999999999.abc" } }))), "/admin-login.html", "forged cookie");

  setEnv({ ADMIN_PASSWORD: "changed" });
  assert.equal(where(await mw(req("/admin.html", { headers: { cookie } }))), "/admin-login.html", "changing the password signs everyone out");
  setEnv({ ADMIN_PASSWORD: "pw-123" });
});

test("wrong password and sign-out", async () => {
  assert.equal(where(await login("nope", "5.5.5.6")), "/admin-login.html?error=wrong");
  const out = await mw(req("/admin/logout", { method: "POST" }));
  assert.equal(where(out), "/admin-login.html?signed-out=1");
  assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
});

test("ten misses lock that address for 15 minutes, even with the right password", async () => {
  setEnv(STORAGE_ENV);
  for (let i = 0; i < 10; i++) await login("wrong" + i);
  const locked = await login("pw-123");
  assert.equal(where(locked), "/admin-login.html?error=locked");
  assert.equal(locked.headers.get("set-cookie"), null);
  assert.equal(where(await login("pw-123", "6.6.6.6")), "/admin.html", "other addresses unaffected");
  const ttl = db.handle("", ["TTL", "mishri:rl:login:5.5.5.5"]).result;
  assert.ok(ttl > 0 && ttl <= 900, "window " + ttl);

  db.kv.delete("mishri:rl:login:5.5.5.5"); // as if 15 minutes passed
  for (let i = 0; i < 3; i++) await login("wrong");
  assert.equal(where(await login("pw-123")), "/admin.html");
  assert.ok(!db.kv.has("mishri:rl:login:5.5.5.5"), "a good sign-in clears the count");
});

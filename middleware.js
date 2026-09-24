/* Mishri Sweet House. Vercel Routing Middleware: keeps the shop admin
   behind a password, checked on the server.

   Self-contained on purpose: Vercel compiles this file to CommonJS and runs
   it in the edge runtime, where there is no require(), so importing a local
   module fails as the middleware loads (MIDDLEWARE_INVOCATION_FAILED).
   serve.js loads this same file for local preview.

   The password is the ADMIN_PASSWORD environment variable and never
   appears in the repository. Without it the admin stays locked.

   Signing in sets an HttpOnly cookie holding an expiry time and an HMAC
   of it, keyed by the password, so changing ADMIN_PASSWORD signs
   everyone out. Uses only Web APIs: Request, Response and Web Crypto.

   When Upstash Redis is connected (see api/_lib/store.js), 10 wrong
   passwords from one address lock sign-in there for 15 minutes. api/_lib/auth.js
   checks the same cookie on the admin API routes; keep the two in step. */

const COOKIE = "mishri_admin";
const SESSION_SECONDS = 12 * 60 * 60;
const LOGIN_PAGE = "/admin-login.html";
const ADMIN_PAGE = "/admin.html";

// Everything that makes up the admin itself. The login page stays public.
const PROTECTED = ["/admin", "/admin.html", "/admin.js", "/admin.css"];

const enc = new TextEncoder();
const hmacKey = (secret) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const toB64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function makeToken(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode("session:" + exp));
  return exp + "." + toB64url(sig);
}

async function tokenValid(token, secret) {
  const [exp, sig] = String(token || "").split(".");
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000 || !sig) return false;
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc.encode("session:" + exp));
  } catch {
    return false;
  }
}

// HMAC the attempt, then let crypto.subtle.verify compare it with the HMAC
// of the real password: a constant-time comparison.
async function passwordMatches(attempt, secret) {
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(attempt));
  return crypto.subtle.verify("HMAC", key, mac, enc.encode(secret));
}

const readCookie = (request, name) => {
  const header = request.headers.get("cookie") || "";
  const hit = header.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
};

function redirect(to, cookie) {
  const headers = new Headers({ Location: to, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/* ---------------- sign-in lockout ----------------
   Talks to Upstash over plain fetch: this file can't import api/_lib/store.js. */
const LOCK_AFTER = 10;
const LOCK_SECONDS = 15 * 60;

async function upstash(env, commands) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(url.replace(/\/+$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!res.ok) return null;
    return (await res.json()).map((r) => r.result);
  } catch {
    // Storage trouble never locks the owner out; the 600ms pause still applies.
    return null;
  }
}

const lockKey = (request) =>
  "mishri:rl:login:" + (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();

async function lockedOut(request, env) {
  const got = await upstash(env, [["GET", lockKey(request)]]);
  return Boolean(got && Number(got[0]) >= LOCK_AFTER);
}
const countMiss = (request, env) =>
  upstash(env, [["SET", lockKey(request), "0", "EX", String(LOCK_SECONDS), "NX"], ["INCR", lockKey(request)]]);
const clearMisses = (request, env) => upstash(env, [["DEL", lockKey(request)]]);

const cookieFlags = (url) => `Path=/; HttpOnly; SameSite=Strict${url.protocol === "https:" ? "; Secure" : ""}`;

/* Returns a Response to send, or undefined to let the request through to
   the static file. */
async function handle(request, env) {
  const url = new URL(request.url);
  // Compare a decoded, lower-cased path so /%61dmin.html or /ADMIN.html
  // cannot reach the file around the check.
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch {}
  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const secret = (env && env.ADMIN_PASSWORD) || "";

  if (path === "/admin/login") {
    if (request.method !== "POST") return redirect(LOGIN_PAGE);
    if (!secret) return redirect(LOGIN_PAGE + "?error=setup");
    if (await lockedOut(request, env)) return redirect(LOGIN_PAGE + "?error=locked");
    let attempt = "";
    try { attempt = String((await request.formData()).get("password") || ""); } catch {}
    if (attempt && attempt.length <= 256 && (await passwordMatches(attempt, secret))) {
      await clearMisses(request, env);
      return redirect(ADMIN_PAGE, `${COOKIE}=${await makeToken(secret)}; Max-Age=${SESSION_SECONDS}; ${cookieFlags(url)}`);
    }
    // A short pause on every miss slows guessing without bothering a person.
    await Promise.all([countMiss(request, env), new Promise((r) => setTimeout(r, 600))]);
    return redirect(LOGIN_PAGE + "?error=wrong");
  }

  if (path === "/admin/logout") {
    if (request.method !== "POST") return redirect(LOGIN_PAGE);
    return redirect(LOGIN_PAGE + "?signed-out=1", `${COOKIE}=; Max-Age=0; ${cookieFlags(url)}`);
  }

  const signedIn = secret ? await tokenValid(readCookie(request, COOKIE), secret) : false;

  if (path === LOGIN_PAGE) return signedIn ? redirect(ADMIN_PAGE) : undefined;

  if (PROTECTED.includes(path)) {
    if (!secret) return redirect(LOGIN_PAGE + "?error=setup");
    if (!signedIn) return redirect(LOGIN_PAGE);
    if (path === "/admin") return redirect(ADMIN_PAGE);
  }
  return undefined;
}

// Vercel only lets a request through when the middleware returns a Response
// carrying this header (what next() in @vercel/functions returns).
const next = () => new Response(null, { headers: { "x-middleware-next": "1" } });

export default async function middleware(request) {
  try {
    const env = typeof process !== "undefined" && process.env ? process.env : {};
    return (await handle(request, env)) || next();
  } catch {
    // Fail closed: if the check itself breaks, keep the admin shut.
    return new Response("Shop admin is unavailable right now.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

// Only the admin's own URLs, so the storefront never depends on this.
// Must stay a literal: Vercel reads it at build time.
export const config = {
  matcher: ["/admin", "/admin.html", "/admin.js", "/admin.css", "/admin-login.html", "/admin/:path*"],
};

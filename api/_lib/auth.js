/* Mishri Sweet House. Checks the admin session cookie on API routes.

   The cookie is issued by middleware.js at sign-in: "<expiry>.<HMAC>",
   the HMAC keyed by ADMIN_PASSWORD. middleware.js has to stay a single
   file (Vercel's edge runtime cannot load imports), so this verification
   is a copy of its tokenValid(); keep the two in step. */

const COOKIE = "mishri_admin";
const enc = new TextEncoder();

const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function tokenValid(token, secret) {
  const [exp, sig] = String(token || "").split(".");
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000 || !sig) return false;
  try {
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, fromB64url(sig), enc.encode("session:" + exp));
  } catch {
    return false;
  }
}

const readCookie = (request, name) => {
  const header = request.headers.get("cookie") || "";
  const hit = header.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
};

export async function isAdmin(request) {
  const secret = process.env.ADMIN_PASSWORD || "";
  return Boolean(secret) && (await tokenValid(readCookie(request, COOKIE), secret));
}

export const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

// Admin routes answer 401 without a valid session and 503 in demo mode.
export async function adminGuard(request, storeReady) {
  if (!(await isAdmin(request))) return json({ error: "signed-out" }, 401);
  if (!storeReady()) return json({ error: "storage-not-configured" }, 503);
  return null;
}

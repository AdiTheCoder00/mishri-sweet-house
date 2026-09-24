/* Vercel Routing Middleware: keeps the shop admin behind a password.
   The logic lives in lib/admin-auth.mjs, which serve.js also uses locally.
   Set ADMIN_PASSWORD in the Vercel project's environment variables. */
import { handle } from "./lib/admin-auth.mjs";

// Vercel only lets a request through when the middleware returns a Response
// carrying this header (what next() in @vercel/functions returns).
// Returning nothing fails the request with MIDDLEWARE_INVOCATION_FAILED.
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

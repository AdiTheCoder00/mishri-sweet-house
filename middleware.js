/* Vercel Routing Middleware: keeps the shop admin behind a password.
   The logic lives in lib/admin-auth.mjs, which serve.js also uses locally.
   Set ADMIN_PASSWORD in the Vercel project's environment variables. */
import { handle } from "./lib/admin-auth.mjs";

export default function middleware(request) {
  return handle(request, process.env);
}

// Runs on every path but photos and vendored libraries, so no spelling of
// an admin URL slips past the check. Must stay a literal: Vercel reads it at build time.
export const config = {
  matcher: ["/((?!images/|vendor/).*)"],
};

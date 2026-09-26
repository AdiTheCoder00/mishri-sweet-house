/* GET /api/store: a small script the storefront loads before its own code.
   It sets window.MISHRI_STORE to what the pages need from the server:

     orders       true when orders go to the server (storage connected)
     catalogue    the admin's catalogue edits, applied by store-settings.js
     razorpayKey  public Razorpay key id when online payment is on
     emails       true when customers can be emailed (verified sender set)
     sentryDsn    where monitor.js sends error reports (SENTRY_DSN); public by design
     environment  production, preview or development, to tell reports apart

   Cached briefly at Vercel's edge, so an admin edit shows up within about
   15 seconds without every page view reaching the database. */
import { storeReady, readCatalogue } from "./_lib/store.js";
import { publicKeyId } from "./_lib/razorpay.js";
import { emailConfig } from "./_lib/email.js";
import { sentryDsn, environment } from "./_lib/monitor.js";

export async function GET() {
  const payload = { orders: false, catalogue: null, razorpayKey: "", emails: false, sentryDsn: sentryDsn(), environment: environment() };
  let cache = "public, max-age=0, s-maxage=15, stale-while-revalidate=60";
  if (storeReady()) {
    payload.orders = true;
    payload.razorpayKey = publicKeyId();
    payload.emails = emailConfig().customerEmails;
    try {
      payload.catalogue = await readCatalogue();
    } catch {
      // Storage hiccup: pages fall back to products.js prices; orders are
      // still priced on the server. Don't cache the gap.
      cache = "no-store";
    }
  }
  // Escape "<" so the JSON can never close the script it sits in.
  const body = `window.MISHRI_STORE = ${JSON.stringify(payload).replace(/</g, "\\u003c")};\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": cache },
  });
}

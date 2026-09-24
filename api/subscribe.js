/* POST /api/subscribe: the homepage "Notify me" form for festival boxes.
   Saves the address and, when a verified sender is set, emails a welcome
   note with a one-click unsubscribe link. */
import { storeReady, overLimit, clientIp } from "./_lib/store.js";
import { addSubscriber, unsubscribeUrl } from "./_lib/subscribers.js";
import { sendWelcome, validEmail } from "./_lib/email.js";
import { json } from "./_lib/auth.js";

export async function POST(request) {
  if (!storeReady()) return json({ error: "storage-not-configured" }, 503);
  if (await overLimit("subscribe", clientIp(request), 10, 60 * 60)) {
    return json({ error: "Too many sign-ups from this connection. Try again later." }, 429);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }
  const email = String((body && body.email) || "").trim().toLowerCase();
  if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
  try {
    const { created, token } = await addSubscriber(email);
    if (created) await sendWelcome(email, unsubscribeUrl(new URL(request.url).origin, token));
    return json({ ok: true, already: !created });
  } catch (e) {
    console.error("subscribe failed", e);
    return json({ error: "We could not save that just now. Please try again." }, 500);
  }
}

/* /api/admin/email: the admin's Email tab. Needs the admin session cookie.

   GET     what's set up, the last sending error, and the subscriber list
   POST    { action: "test" }                         email ALERT_EMAIL now and report what happened
           { action: "announce", subject, message }   email every subscriber
   DELETE  { email }                                  remove one subscriber */
import { storeReady } from "../_lib/store.js";
import { adminGuard, json } from "../_lib/auth.js";
import { emailConfig, lastEmailError, clearAlertError, sendTestEmail, sendAnnouncement } from "../_lib/email.js";
import { listSubscribers, removeSubscriber, unsubscribeUrl } from "../_lib/subscribers.js";
import { reportError } from "../_lib/monitor.js";

export async function GET(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  try {
    const subscribers = await listSubscribers();
    return json({
      config: emailConfig(),
      lastError: await lastEmailError(),
      subscribers: subscribers.map((s) => ({ email: s.email, at: s.at })),
    });
  } catch (e) {
    await reportError("email status failed", e, request);
    return json({ error: "Email settings could not be loaded." }, 500);
  }
}

export async function POST(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }
  const site = new URL(request.url).origin;

  if (body.action === "test") {
    const result = await sendTestEmail(site);
    if (result.sent) await clearAlertError();
    return json({ ...result, to: emailConfig().alertEmail });
  }

  if (body.action === "announce") {
    const subject = String(body.subject || "").trim().slice(0, 150);
    const message = String(body.message || "").trim().slice(0, 5000);
    if (!subject || !message) return json({ error: "Write a subject and a message." }, 400);
    try {
      const list = await listSubscribers();
      if (!list.length) return json({ error: "There are no subscribers yet." }, 400);
      const result = await sendAnnouncement(list.map((s) => ({ email: s.email, unsubscribeUrl: unsubscribeUrl(site, s.token) })), subject, message);
      return json({ ...result, total: list.length });
    } catch (e) {
      await reportError("announce failed", e, request);
      return json({ error: "The announcement could not be sent." }, 500);
    }
  }

  return json({ error: "Unknown action." }, 400);
}

export async function DELETE(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }
  try {
    return json({ removed: await removeSubscriber(String(body.email || "").toLowerCase()) });
  } catch (e) {
    await reportError("remove subscriber failed", e, request);
    return json({ error: "Could not remove that address." }, 500);
  }
}

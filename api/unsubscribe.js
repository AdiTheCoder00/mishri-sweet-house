/* /api/unsubscribe?token=…: the link at the foot of every festival-box
   email. GET only shows a button, because mail scanners open links on
   their own; the button, and the one-click unsubscribe mail apps send
   (List-Unsubscribe-Post), POST here to do it. */
import { storeReady } from "./_lib/store.js";
import { removeByToken } from "./_lib/subscribers.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (title, body) => new Response(`<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Mishri Sweet House</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif;background:#f5efe6;color:#1a1a22}main{max-width:420px;padding:32px;border-radius:24px;background:#fffdf9;border:1px solid rgba(26,26,34,.09)}h1{margin:0 0 8px;font-size:1.6rem}p{margin:0 0 16px;color:#5d5e69;line-height:1.5}a{color:#1a1a22}button{font:inherit;font-weight:600;padding:12px 22px;border-radius:999px;border:0;background:#e8961e;color:#1a1a22;cursor:pointer;margin-bottom:16px}@media(prefers-color-scheme:dark){body{background:#101014;color:#f2f1ec}main{background:#17171d;border-color:rgba(255,255,255,.09)}p{color:#a5a4ad}a{color:#f2f1ec}}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><a href="/">Back to Mishri Sweet House</a></main></body></html>`, {
  headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  return page("Unsubscribe?", `Stop festival-box emails from Mishri Sweet House?</p>
    <form method="post" action="/api/unsubscribe?token=${esc(encodeURIComponent(token))}"><button type="submit">Yes, unsubscribe me</button></form><p>`);
}

export async function POST(request) {
  if (!storeReady()) return page("Something went wrong", "Please try the link again later.");
  const token = new URL(request.url).searchParams.get("token");
  try {
    const email = await removeByToken(token);
    return email
      ? page("You're unsubscribed", "You won't get any more festival-box emails from us.")
      : page("Already unsubscribed", "This address is no longer on our list.");
  } catch (e) {
    console.error("unsubscribe failed", e);
    return page("Something went wrong", "Please try the link again later, or WhatsApp us on +91 87446 67777.");
  }
}

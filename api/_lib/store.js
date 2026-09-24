/* Mishri Sweet House. Upstash Redis over its REST API, with fetch only.

   Connected by adding Upstash Redis to the Vercel project (Storage or
   Marketplace), which sets KV_REST_API_URL and KV_REST_API_TOKEN. The
   UPSTASH_REDIS_REST_* names work too. Without them the site runs in
   demo mode: orders and catalogue edits stay in each browser.

   Keys:
     mishri:catalogue        JSON  admin catalogue edits, { items: { id: {...} } }
     mishri:order:<no>       JSON  one order
     mishri:orders           ZSET  order numbers, scored by time placed
     mishri:order-seq        INT   last order number handed out
     mishri:rzp:<id>         STR   our order number for a Razorpay order id
     mishri:paid:<no>        STR   set once when an order is first marked paid
     mishri:rl:<name>:<ip>   INT   rate-limit counters, with expiry            */

const creds = () => ({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export const storeReady = () => {
  const { url, token } = creds();
  return Boolean(url && token);
};

async function call(pathname, body) {
  const { url, token } = creds();
  if (!url || !token) throw new Error("storage-not-configured");
  const res = await fetch(url.replace(/\/+$/, "") + pathname, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`redis ${res.status}: ${data && data.error ? data.error : "no response"}`);
  return data;
}

// One command, e.g. redis("SET", "key", "value").
export async function redis(...command) {
  const data = await call("", command);
  if (data.error) throw new Error("redis: " + data.error);
  return data.result;
}

// Several commands in one round trip, run in order.
export async function pipeline(commands) {
  const data = await call("/pipeline", commands);
  return data.map((d) => {
    if (d.error) throw new Error("redis: " + d.error);
    return d.result;
  });
}

export const KEYS = {
  catalogue: "mishri:catalogue",
  order: (no) => `mishri:order:${no}`,
  orders: "mishri:orders",
  orderSeq: "mishri:order-seq",
  razorpay: (rzpOrderId) => `mishri:rzp:${rzpOrderId}`,
  paid: (no) => `mishri:paid:${no}`,
  rate: (name, who) => `mishri:rl:${name}:${who}`,
};

export async function readCatalogue() {
  const raw = await redis("GET", KEYS.catalogue);
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.items ? parsed : { items: {} };
  } catch {
    return { items: {} };
  }
}

/* Counts one hit for `who` in a window and says whether it is over `limit`.
   Fails open when storage errors, so an outage never locks out checkout. */
export async function overLimit(name, who, limit, windowSeconds) {
  try {
    const key = KEYS.rate(name, who);
    // SET NX starts the window on the first hit only; INCR then counts it.
    const [, count] = await pipeline([["SET", key, "0", "EX", String(windowSeconds), "NX"], ["INCR", key]]);
    return Number(count) > limit;
  } catch {
    return false;
  }
}

export const clientIp = (request) =>
  (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();

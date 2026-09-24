/* Runs the api/ routes and middleware.js in-process, the way Vercel calls
   them, with every outside service replaced:
     Upstash   an in-memory store (mock-upstash.mjs)
     Resend    captured in `emails`; `resend.mode` makes it fail like the real one
     Razorpay  order creation captured in `razorpayOrders`

   Each test file runs in its own process, so each gets a fresh store. */
import { createRedis } from "./mock-upstash.mjs";
import { pathToFileURL } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const SITE = "https://mishri.test";

export const db = createRedis();
export const emails = [];
export const razorpayOrders = [];
export const resend = { mode: "ok", failBatchAfter: Infinity, batchCalls: 0 };

const RESEND_ERRORS = {
  badkey: [401, { statusCode: 401, message: "API key is invalid", name: "validation_error" }],
  testsender: [403, { statusCode: 403, message: "You can only send testing emails to your own email address (owner@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains", name: "validation_error" }],
};

const realFetch = globalThis.fetch;
export async function fakeFetch(url, init = {}) {
  const u = String(url);
  if (u.startsWith("https://mock-upstash.test")) {
    if (init.headers && init.headers.Authorization !== "Bearer tok") return new Response("{}", { status: 401 });
    // A little latency so concurrent requests really interleave.
    await new Promise((r) => setTimeout(r, 1));
    return Response.json(db.handle(new URL(u).pathname, JSON.parse(init.body)));
  }
  if (u.startsWith("https://api.resend.com/emails")) {
    if (RESEND_ERRORS[resend.mode]) { const [status, body] = RESEND_ERRORS[resend.mode]; return Response.json(body, { status }); }
    if (u.endsWith("/batch") && ++resend.batchCalls > resend.failBatchAfter) return Response.json({ message: "Internal error" }, { status: 500 });
    const body = JSON.parse(init.body);
    (Array.isArray(body) ? body : [body]).forEach((m) => emails.push({ url: u, ...m }));
    return Response.json(Array.isArray(body) ? { data: body.map((_, i) => ({ id: "b" + i })) } : { id: "em_1" });
  }
  if (u === "https://api.razorpay.com/v1/orders") {
    const b = JSON.parse(init.body);
    razorpayOrders.push({ auth: init.headers.Authorization, ...b });
    return Response.json({ id: "order_T" + razorpayOrders.length, amount: b.amount });
  }
  if (u.startsWith("http://127.0.0.1") || u.startsWith("http://localhost")) return realFetch(url, init);
  throw new Error("test tried to reach the internet: " + u);
}
globalThis.fetch = fakeFetch;

export const STORAGE_ENV = { KV_REST_API_URL: "https://mock-upstash.test", KV_REST_API_TOKEN: "tok" };
export const setEnv = (vars) => Object.assign(process.env, vars);
export const unsetEnv = (...names) => names.forEach((n) => delete process.env[n]);

// Import a route or helper; `api/orders.js` etc.
export const load = (file) => import(pathToFileURL(path.join(ROOT, file)).href);

// A Request as Vercel would hand it to a route.
export function req(pathname, { method = "GET", body, headers = {}, ip = "1.2.3.4" } = {}) {
  return new Request(SITE + pathname, {
    method,
    headers: { "content-type": "application/json", "x-real-ip": ip, ...headers },
    body: body === undefined ? undefined : typeof body === "string" || body instanceof URLSearchParams ? body : JSON.stringify(body),
  });
}

export const middleware = async () => (await load("middleware.js")).default;

// Signs in through middleware.js and returns the session cookie.
export async function adminCookie(password = process.env.ADMIN_PASSWORD) {
  const mw = await middleware();
  const res = await mw(req("/admin/login", { method: "POST", body: new URLSearchParams({ password }), headers: { "content-type": "application/x-www-form-urlencoded" }, ip: "10.0.0.1" }));
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie.startsWith("mishri_admin=")) throw new Error("admin sign-in failed: " + res.headers.get("location"));
  return cookie;
}

export const CUSTOMER = { name: "Asha Verma", phone: "+91 98765 43210", address: "12 MI Road, C-Scheme", city: "Jaipur", pin: "302001" };

// Places an order through api/orders.js; returns the parsed reply and status.
export async function placeOrder({ method = "cod", customer = {}, lines = [{ id: "kaju-katli", qty: 1 }], ip, ...rest } = {}) {
  const orders = await load("api/orders.js");
  const res = await orders.POST(req("/api/orders", { method: "POST", body: { method, customer: { ...CUSTOMER, ...customer }, lines, ...rest }, ip }));
  return { status: res.status, ...(await res.json()) };
}

export const json = async (resPromise) => {
  const res = await resPromise;
  return { status: res.status, body: await res.json() };
};

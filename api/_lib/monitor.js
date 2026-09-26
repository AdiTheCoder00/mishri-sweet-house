/* Server errors to Sentry, in the same format the pages use (monitor.js at
   the root). Off until SENTRY_DSN is set. Never throws: reporting a problem
   must not become a second one. */
import core from "../../monitor.js";

const env = (name) => String(process.env[name] || "").trim().replace(/^["']|["']$/g, "").trim();
export const sentryDsn = () => (core.parseDsn(env("SENTRY_DSN")) ? env("SENTRY_DSN") : "");
export const environment = () => env("VERCEL_ENV") || "development";

/* Sends one event. `problem` is an Error or a message.
   opts: { level, tags, extra, request, message } */
export async function report(problem, opts = {}) {
  const dsn = sentryDsn();
  if (!dsn) return false;
  try {
    const url = opts.request ? opts.request.url : undefined;
    const event = core.eventFor(problem, { ...opts, url, platform: "node", environment: environment() });
    event.tags = { ...event.tags, runtime: "vercel-function", ...(url ? { route: new URL(url).pathname } : {}) };
    const req = core.envelope(event, dsn);
    const res = await fetch(req.url, { method: "POST", body: req.body, signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

// Logs to Vercel's function logs, as before, and reports to Sentry.
export async function reportError(what, error, request, extra) {
  console.error(what, error);
  await report(error instanceof Error ? error : new Error(String(error)), { request, message: what, extra });
}

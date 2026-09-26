/* Mishri Sweet House. Error reports to Sentry (sentry.io), which emails the
   shop when something breaks: a script error in a customer's browser, a
   checkout the server couldn't take, an order alert that didn't send.

   Off until SENTRY_DSN is set in Vercel. Rather than Sentry's 75 KB SDK,
   this sends Sentry's plain envelope format itself: the error, its stack,
   the page, and a few tags. Never form contents, names, phones or addresses;
   email addresses and phone numbers quoted inside error text are blanked.

   One file, two users:
     pages   load it after /api/store; it reads window.MISHRI_STORE.sentryDsn
             and reports uncaught errors. Page code can call
             window.MishriMonitor.report(errorOrMessage, { level, tags, extra }).
     api/    api/_lib/monitor.js requires it (like products.js) and sends
             server errors with the same event format. */
(function (root) {
  "use strict";

  // https://<key>@<host>/<project id>
  function parseDsn(dsn) {
    const m = /^https:\/\/([0-9a-f]+)@([a-z0-9.-]+(?::\d+)?)\/(\d+)$/i.exec(String(dsn || "").trim());
    return m ? { dsn: m[0], key: m[1], host: m[2], project: m[3] } : null;
  }

  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  // Chrome, Node, Edge: "    at fn (file:1:2)" or "    at file:1:2".
  // Firefox, Safari: "fn@file:1:2".
  function framesFrom(stack) {
    const frames = [];
    for (const line of String(stack || "").split("\n")) {
      const v8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
      const gecko = !v8 && /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/.exec(line);
      const m = v8 || gecko;
      if (m) frames.push({ function: m[1] || "?", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: !/node_modules|node:|^internal\//.test(m[2]) });
    }
    return frames.reverse(); // Sentry lists the outermost call first.
  }

  /* Error text can quote whatever a library was handed, so email addresses
     and Indian mobile numbers are blanked before anything leaves. (No
     lookbehind in these patterns: older Safari can't parse it.) */
  const EMAIL = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[a-z]{2,}/gi;
  const PHONE = /(^|[^\d])((?:\+|00)?(?:91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5})(?!\d)/g;
  function scrub(value) {
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.replace(EMAIL, "[email]").replace(PHONE, "$1[phone]");
  }
  const scrubAll = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, scrub(v)]));

  // An Error (or anything thrown) or a plain message becomes one Sentry event.
  function eventFor(problem, opts) {
    const o = opts || {};
    const event = {
      event_id: hex(32),
      timestamp: Date.now() / 1000,
      platform: o.platform || "javascript",
      level: o.level || "error",
      environment: o.environment || "production",
      tags: scrubAll(o.tags),
      extra: scrubAll(o.extra),
    };
    if (o.url) event.request = { url: String(o.url).split("?")[0] };
    if (problem instanceof Error || (problem && typeof problem === "object" && "stack" in problem)) {
      const frames = framesFrom(problem.stack);
      event.exception = { values: [{ type: problem.name || "Error", value: scrub(String(problem.message || "")).slice(0, 500), stacktrace: frames.length ? { frames } : undefined }] };
      if (o.message) event.extra.where = scrub(o.message);
    } else {
      event.message = { formatted: scrub(String(o.message ? `${o.message}: ${problem}` : problem)).slice(0, 500) };
    }
    return event;
  }

  // What to POST, and where.
  function envelope(event, dsnString) {
    const d = parseDsn(dsnString);
    if (!d) return null;
    return {
      url: `https://${d.host}/api/${d.project}/envelope/?sentry_key=${d.key}&sentry_version=7&sentry_client=mishri%2F1.0`,
      body: [JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: d.dsn }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n"),
    };
  }

  const core = { parseDsn, framesFrom, scrub, eventFor, envelope };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }

  /* ---------------- in the browser ---------------- */

  const store = root.MISHRI_STORE || {};
  const dsn = parseDsn(store.sentryDsn) ? store.sentryDsn : "";
  const seen = new Set();
  let sent = 0;

  function report(problem, opts) {
    try {
      if (!dsn || sent >= 10) return false;
      const o = Object.assign({ url: location.href, environment: store.environment }, opts);
      const event = eventFor(problem, o);
      const stack = (problem && problem.stack) || "";
      if (/(chrome|moz|safari(-web)?)-extension:\/\//.test(stack)) return false; // someone's browser extension, not the shop
      const key = JSON.stringify(event.exception ? event.exception.values[0].value + stack.slice(0, 200) : event.message);
      if (seen.has(key)) return false;
      seen.add(key);
      sent += 1;
      event.tags.page = location.pathname;
      event.contexts = { browser: { name: navigator.userAgent } };
      const req = envelope(event, dsn);
      fetch(req.url, { method: "POST", body: req.body, keepalive: true }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  root.MishriMonitor = Object.assign({ report, enabled: Boolean(dsn) }, core);
  if (!dsn) return;
  root.addEventListener("error", (e) => {
    // "Script error." with no details comes from other sites' scripts: nothing to act on.
    if (!e.error && (!e.filename || e.message === "Script error.")) return;
    report(e.error || e.message, { extra: { source: e.filename, line: e.lineno } });
  });
  root.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    report(r instanceof Error ? r : String(r), { message: r instanceof Error ? "" : "Unhandled promise rejection" });
  });
})(typeof window !== "undefined" ? window : globalThis);

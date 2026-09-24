// In-memory stand-in for Upstash's REST API: only the commands api/ and
// middleware.js use. handle(path, body) answers like the real REST endpoint.
export function createRedis() {
  const kv = new Map(), exp = new Map(), zsets = new Map(), sets = new Map();
  const alive = (k) => { if (exp.has(k) && exp.get(k) < Date.now()) { kv.delete(k); exp.delete(k); } return kv.has(k); };
  const run = (cmd) => {
    const [op, ...a] = cmd.map(String); const O = op.toUpperCase();
    switch (O) {
      case "GET": return alive(a[0]) ? kv.get(a[0]) : null;
      case "MGET": return a.map((k) => (alive(k) ? kv.get(k) : null));
      case "SET": {
        const [k, v, ...opts] = a; const up = opts.map((o) => o.toUpperCase());
        if (up.includes("NX") && alive(k)) return null;
        kv.set(k, v); exp.delete(k);
        const ex = up.indexOf("EX"); if (ex >= 0) exp.set(k, Date.now() + Number(opts[ex + 1]) * 1000);
        return "OK";
      }
      case "INCR": { const n = Number(alive(a[0]) ? kv.get(a[0]) : 0) + 1; kv.set(a[0], String(n)); return n; }
      case "DEL": return a.reduce((n, k) => n + (kv.delete(k) ? 1 : 0), 0);
      case "TTL": return alive(a[0]) ? (exp.has(a[0]) ? Math.ceil((exp.get(a[0]) - Date.now()) / 1000) : -1) : -2;
      case "ZADD": { const z = zsets.get(a[0]) || new Map(); z.set(a[2], Number(a[1])); zsets.set(a[0], z); return 1; }
      case "SADD": { const st = sets.get(a[0]) || new Set(); let n = 0; for (const m of a.slice(1)) if (!st.has(m)) { st.add(m); n++; } sets.set(a[0], st); return n; }
      case "SMEMBERS": return [...(sets.get(a[0]) || [])];
      case "EXPIRE": return (kv.has(a[0]) || sets.has(a[0])) ? 1 : 0;
      case "ZREM": { const z = zsets.get(a[0]); let n = 0; if (z) for (const m of a.slice(1)) n += z.delete(m) ? 1 : 0; return n; }
      case "ZRANGE": {
        const z = [...(zsets.get(a[0]) || new Map())].sort((x, y) => x[1] - y[1]).map((e) => e[0]);
        if (a.map((s) => s.toUpperCase()).includes("REV")) z.reverse();
        return z.slice(Number(a[1]), Number(a[2]) === -1 ? undefined : Number(a[2]) + 1);
      }
      default: throw new Error("mock: unsupported " + O);
    }
  };
  const handle = (path, body) => {
    try {
      if (path.endsWith("/pipeline")) return body.map((c) => { try { return { result: run(c) }; } catch (e) { return { error: e.message }; } });
      return { result: run(body) };
    } catch (e) { return { error: e.message }; }
  };
  return { handle, kv, zsets };
}

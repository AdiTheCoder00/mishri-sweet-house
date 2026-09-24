// Tiny static server for the demo. Run: node serve.js  (then open http://localhost:5173)
// The shop admin needs a password: ADMIN_PASSWORD='your password' node serve.js
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 5173;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});

// Runs middleware.js, the same admin check Vercel runs, on every request.
async function adminGate(middleware, req, res) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const body = req.method === "POST" ? await readBody(req) : undefined;
  const reply = await middleware(new Request(`http://${req.headers.host || "localhost"}${req.url}`, { method: req.method, headers, body }));
  if (reply.headers.get("x-middleware-next")) return false;
  const out = {};
  reply.headers.forEach((v, k) => { if (k !== "set-cookie") out[k] = v; });
  const cookies = reply.headers.getSetCookie();
  if (cookies.length) out["set-cookie"] = cookies;
  res.writeHead(reply.status, out);
  res.end(Buffer.from(await reply.arrayBuffer()));
  return true;
}

// middleware.js is written as an ES module for Vercel; load it the same way here.
const source = fs.readFileSync(path.join(ROOT, "middleware.js"));
import("data:text/javascript;base64," + source.toString("base64")).then(({ default: middleware }) => {
  http.createServer(async (req, res) => {
    try {
      if (await adminGate(middleware, req, res)) return;
    } catch {
      res.writeHead(500); return res.end();
    }
    let file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (file.endsWith(path.sep)) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  }).listen(PORT, () => {
    console.log(`Mishri demo running at http://localhost:${PORT}`);
    if (!process.env.ADMIN_PASSWORD) console.log("Shop admin is locked: start with ADMIN_PASSWORD='…' node serve.js to sign in.");
  });
});

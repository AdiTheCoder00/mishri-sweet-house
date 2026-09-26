/* Downloads the site's typefaces from Fontshare into vendor/fonts/, so pages
   load them from the site itself instead of api.fontshare.com.

     node tools/fetch-fonts.mjs

   Fontshare no longer serves Satoshi: asking for it returns Switzer, a close
   relative, which is what the site uses for body text. Both Clash Display
   and Switzer are by the Indian Type Foundry, free for commercial use under
   the ITF Free Font License, which allows self-hosting. Re-run only to
   change weights (edit FAMILIES) or pick up a new release. Fontshare can't
   be reached from every machine; the "Vendor fonts" GitHub workflow runs
   this on GitHub's runner and commits the result. */
import fs from "node:fs";
import path from "node:path";

const FAMILIES = { "clash-display": [500, 600, 700], switzer: [400, 500, 700] };
const OUT = path.join(import.meta.dirname, "..", "vendor", "fonts");
const query = Object.entries(FAMILIES).map(([f, w]) => `f[]=${f}@${w.join(",")}`).join("&");
// Fontshare serves woff2 only to browsers it recognises.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const get = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res;
};

const css = await (await get(`https://api.fontshare.com/v2/css?${query}&display=swap`)).text();
const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
  family: body.match(/font-family:\s*['"]([^'"]+)['"]/)[1],
  weight: body.match(/font-weight:\s*(\d+)/)[1],
  style: (body.match(/font-style:\s*(\w+)/) || [, "normal"])[1],
  url: body.match(/url\(['"]?([^'")]+\.woff2)['"]?\)/)[1],
}));
if (!faces.length) throw new Error("no @font-face rules in Fontshare's reply:\n" + css.slice(0, 500));

fs.mkdirSync(OUT, { recursive: true });
const rules = [];
for (const face of faces) {
  const file = `${face.family.toLowerCase().replace(/\s+/g, "-")}-${face.weight}${face.style === "italic" ? "-italic" : ""}.woff2`;
  const url = face.url.startsWith("//") ? "https:" + face.url : face.url;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(await (await get(url)).arrayBuffer()));
  rules.push(`@font-face {
  font-family: "${face.family}";
  src: url("${file}") format("woff2");
  font-weight: ${face.weight};
  font-style: ${face.style};
  font-display: swap;
}`);
  console.log(file, fs.statSync(path.join(OUT, file)).size, "bytes");
}

fs.writeFileSync(
  path.join(OUT, "fonts.css"),
  `/* ${[...new Set(faces.map((f) => f.family))].join(" and ")} by the Indian Type Foundry (fontshare.com), under the
   ITF Free Font License. Downloaded by tools/fetch-fonts.mjs: do not edit by hand. */\n${rules.join("\n")}\n`
);

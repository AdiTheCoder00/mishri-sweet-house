/* ------------------------------------------------------------------
   Mishri Sweet House. Static page generator.

   Run:  node build.js

   Emits one indexable page per sweet, per gift box and per category,
   each with its own title, description, canonical, Open Graph tags and
   Product / BreadcrumbList structured data, then rewrites sitemap.xml.

   It reads products.js and the shared chrome out of index.html, so the
   generated pages cannot drift from the catalogue or the site header.

   Generated output lives in sweets/, gifts/ and mithai/. Those folders
   are disposable: delete them and re-run.
------------------------------------------------------------------ */

"use strict";

const fs = require("fs");
const path = require("path");

/* The site's public address, used for canonical links, Open Graph tags,
   structured data and the sitemap. Also in index.html and robots.txt. */
const SITE = "https://mishri-sweet-house.vercel.app";
const BRAND = "Mishri Sweet House";

/* ---------------- read the catalogue ---------------- */

const sandbox = {};
new Function(
  "exports",
  fs.readFileSync("products.js", "utf8") +
    "\nexports.PRODUCTS = PRODUCTS; exports.GIFT_BOXES = GIFT_BOXES;" +
    "\nexports.SERVES = typeof SERVES === 'undefined' ? {} : SERVES;"
)(sandbox);
const { PRODUCTS, GIFT_BOXES, SERVES } = sandbox;

/* ---------------- shared chrome, lifted from index.html ---------------- */

const home = fs.readFileSync("index.html", "utf8");
const between = (startMark, endMark) => {
  const a = home.indexOf(startMark);
  const b = home.indexOf(endMark, a);
  if (a === -1 || b === -1) throw new Error("chrome marker missing: " + startMark);
  return home.slice(a, b);
};
const CHROME_TOP = between("<!-- Seasonal ribbon -->", "<main>");
const CHROME_FOOT = between('<footer class="footer">', "<!-- Basket drawer -->");

// The chrome is written for a page at the root; nested pages need to climb out.
const reRoot = (html, base) =>
  html
    .replace(/(href|src)="(?!https?:|#|mailto:|tel:|\/\/)([^"]+)"/g, (_, a, v) => `${a}="${base}${v}"`)
    .replace(/href="#([a-z-]+)"/g, (_, id) => `href="${base}index.html#${id}"`);

/* ---------------- helpers ---------------- */

const slug = (s) => s.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
// Photos come in 200, 400 and 600px copies next to the 800px original
// (tools/resize-images.mjs); the browser picks the smallest that is sharp.
const sized = (img, w) => img.replace(/\.webp$/, `-${w}.webp`);
const imgSrc = (base, img, sizes) =>
  /\.webp$/.test(img)
    ? `src="${base}${img}" srcset="${[200, 400, 600].map((w) => `${base}${sized(img, w)} ${w}w`).join(", ")}, ${base}${img} 800w" sizes="${sizes}"`
    : `src="${base}${img}"`;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inr = (n) => "₹" + n.toLocaleString("en-IN");

// Storage advice by category. These match the wording already used in the
// FAQ and on the product cards; they are not new claims.
const STORAGE = {
  Bengali: "Keep it refrigerated and eat within two days. It travels in an insulated box with ice packs.",
  Syrup: "Best on the day it is made. Keep it covered at room temperature.",
  Barfi: "Keeps for several days in a cool, dry place. Do not refrigerate, it dries the edges.",
  Ladoo: "Keeps for several days in a cool, dry place in an airtight box.",
  Ghee: "Keeps well for several days in a cool, dry place in an airtight box.",
};

const CATEGORY_NOTE = {
  Barfi: "Pressed and cut into diamonds, finished with nuts or vark.",
  Ladoo: "Rolled by hand, one at a time.",
  Bengali: "Chenna sweets in milk or syrup. Keep them cold.",
  Syrup: "Fried, then soaked warm. Best eaten the same day.",
  Ghee: "Slow-cooked in desi ghee. Rich, and they keep well.",
};

const ldScript = (obj) =>
  `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n  </script>`;

/* ---------------- page shell ---------------- */

function page({ base, url, title, description, image, imageAlt, jsonLd, body, bodyClass = "", scripts = [], robots = "index, follow, max-image-preview:large" }) {
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="${robots}" />
  <meta name="theme-color" content="#b4455b" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#101014" media="(prefers-color-scheme: dark)" />
  <link rel="icon" href="${base}favicon.svg" type="image/svg+xml" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${BRAND}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:alt" content="${esc(imageAlt)}" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${image}" />

  <link rel="preload" href="${base}vendor/fonts/switzer-400.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="${base}vendor/fonts/clash-display-600.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="${base}vendor/fonts/fonts.css" />
  <link rel="stylesheet" href="${base}vendor/phosphor/icons.css" />
  <!-- Vercel Web Analytics: page views only, no cookies. Enable it under the project's Analytics tab. -->
  <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
  <script defer src="/_vercel/insights/script.js"></script>
  <!-- Vercel Speed Insights: real visitors' load times. Enable it under the project's Speed Insights tab. -->
  <script>window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };</script>
  <script defer src="/_vercel/speed-insights/script.js"></script>
  <link rel="stylesheet" href="${base}vendor/lenis/lenis.css" />
  <link rel="stylesheet" href="${base}styles.css" />
${jsonLd.map(ldScript).join("\n")}
</head>
<body class="${bodyClass}">
${reRoot(CHROME_TOP, base)}
  <main>
${body}
  </main>

${reRoot(CHROME_FOOT, base)}

  <div class="toast" id="toast" role="status" aria-live="polite">
    <span id="toast-text"></span>
    <button class="toast-action" id="toast-action" hidden></button>
  </div>

  <script src="${base}products.js"></script>
  <script src="${base}api/store"></script>
  <script src="${base}monitor.js"></script>
  <script src="${base}store-settings.js"></script>
  <script src="${base}vendor/lenis/lenis.min.js"></script>
  <script src="${base}smooth-scroll.js"></script>
  <script src="${base}page.js"></script>
${scripts.map((src) => `  <script src="${base}${src}"></script>\n`).join("")}</body>
</html>
`;
}

const crumbs = (items, base) => `
      <nav class="crumbs" aria-label="Breadcrumb">
        <ol>
${items
  .map((c, i) =>
    c.href
      ? `          <li><a href="${base}${c.href}">${esc(c.name)}</a></li>`
      : `          <li aria-current="page">${esc(c.name)}</li>`
  )
  .join("\n")}
        </ol>
      </nav>`;

const breadcrumbLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: c.href === undefined ? undefined : SITE + "/" + c.href,
  })),
});

/* ---------------- product page ---------------- */

function productPage(p, kind) {
  const base = "../../";
  const dir = kind === "box" ? "gifts" : "sweets";
  const url = `${SITE}/${dir}/${slug(p.name)}/`;
  const image = `${SITE}/${p.img}`;
  const serves = SERVES[p.weight];
  const storage = kind === "box" ? null : STORAGE[p.category];

  const related = (kind === "box" ? GIFT_BOXES : PRODUCTS)
    .filter((o) => o.id !== p.id && (kind === "box" || o.category === p.category))
    .slice(0, 3);

  const title = `${p.name} · ${p.weight} · ${BRAND}`;
  const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.]$/, "") + "…");
  const description = clip(
    `${p.desc} ${inr(p.price)} for ${p.weight}${serves ? ", " + serves : ""}. Fresh from our Jaipur kitchen.`,
    158
  );

  const trail = [
    { name: "Home", href: "index.html" },
    kind === "box"
      ? { name: "Gift boxes", href: "index.html#gifts" }
      : { name: p.category, href: `mithai/${slug(p.category)}/` },
    { name: p.name },
  ];

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.desc,
    image,
    sku: p.id,
    category: kind === "box" ? "Gift box" : p.category,
    brand: { "@type": "Brand", name: BRAND },
    offers: {
      "@type": "Offer",
      url,
      price: String(p.price),
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: BRAND },
    },
  };

  const body = `
    <section class="pdp">
      <div class="wrap">
${crumbs(trail, base)}
        <div class="pdp-grid">
          <figure class="pdp-media">
            <img ${imgSrc(base, p.img, "(min-width: 1200px) 560px, (min-width: 900px) 45vw, 100vw")} alt="${esc(p.name)}" width="800" height="800" fetchpriority="high" />
          </figure>

          <div class="pdp-copy">
            ${p.tag ? `<span class="stamp">${esc(p.tag)}</span>` : ""}
            <h1>${esc(p.name)}</h1>
            <p class="pdp-meta">${esc(kind === "box" ? "Gift box" : p.category)} · ${esc(p.weight)}${serves ? " · " + esc(serves) : ""}</p>
            <p class="pdp-desc">${esc(p.desc)}</p>
            <p class="pdp-price">${inr(p.price)}</p>
            ${p.minQty ? `<p class="pdp-note">Minimum order ${p.minQty} boxes, in multiples of ${p.step || 1}.</p>` : ""}

            <div class="pdp-actions">
              <button class="btn btn-primary" data-add="${esc(p.id)}">
                Add to basket <span class="btn-ico"><i class="ph-light ph-plus" aria-hidden="true"></i></span>
              </button>
              <a class="btn btn-ghost" href="${base}index.html#shop">Back to the counter</a>
            </div>

            <dl class="pdp-facts">
              ${storage ? `<div><dt>Keeping it</dt><dd>${esc(storage)}</dd></div>` : ""}
              <div><dt>Delivery</dt><dd>Same-day in Jaipur, 2 to 5 days anywhere in India. Free over ₹999.</dd></div>
              <div><dt>Made with</dt><dd>Pure desi ghee and whole milk, no artificial colour. Cooked in five kilo batches each morning.</dd></div>
            </dl>
          </div>
        </div>

        ${
          p.story
            ? `<section class="pdp-story" aria-labelledby="story-h">
          <h2 id="story-h">${kind === "box" ? "What is in it, and why" : "How we make it"}</h2>
          <p>${esc(p.story)}</p>
        </section>`
            : ""
        }

        ${
          related.length
            ? `<aside class="pdp-related">
          <h2>${kind === "box" ? "Other gift boxes" : "More " + esc(p.category)}</h2>
          <ul>
${related
  .map(
    (r) => `            <li><a href="${base}${r.id && GIFT_BOXES.includes(r) ? "gifts" : "sweets"}/${slug(r.name)}/">
              <img ${imgSrc(base, r.img, "200px")} alt="" width="200" height="200" loading="lazy" />
              <span>${esc(r.name)}</span><span class="rel-price">${inr(r.price)}</span>
            </a></li>`
  )
  .join("\n")}
          </ul>
        </aside>`
            : ""
        }
      </div>
    </section>`;

  return {
    file: path.join(dir, slug(p.name), "index.html"),
    url,
    html: page({
      base,
      url,
      title,
      description,
      image,
      imageAlt: p.name,
      jsonLd: [productLd, breadcrumbLd(trail)],
      body,
      bodyClass: "page-pdp",
    }),
  };
}

/* ---------------- category page ---------------- */

function categoryPage(cat) {
  const base = "../../";
  const url = `${SITE}/mithai/${slug(cat)}/`;
  const items = PRODUCTS.filter((p) => p.category === cat);
  const note = CATEGORY_NOTE[cat] || "";
  const title = `${cat} · Fresh ${cat} Sweets from Jaipur · ${BRAND}`;
  const clipC = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.]$/, "") + "…");
  const description = clipC(
    `${note} ${items.length} ${cat.toLowerCase()} sweets made fresh each morning in Jaipur: ${items.map((i) => i.name).join(", ")}.`,
    158
  );

  const trail = [{ name: "Home", href: "index.html" }, { name: cat }];

  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: cat,
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/sweets/${slug(p.name)}/`,
      name: p.name,
    })),
  };

  const body = `
    <section class="plp">
      <div class="wrap">
${crumbs(trail, base)}
        <header class="plp-head">
          <h1>${esc(cat)}</h1>
          <p class="lede">${esc(note)}</p>
        </header>
        <div class="product-grid">
${items
  .map(
    (p) => `          <article class="product">
            <div class="bezel"><div class="bezel-core">
              <a class="plp-link" href="${base}sweets/${slug(p.name)}/">
                <div class="product-media">
                  <img ${imgSrc(base, p.img, "(min-width: 1100px) 300px, (min-width: 768px) 33vw, 50vw")} alt="${esc(p.name)}" width="800" height="800" loading="lazy" />
                  ${p.tag ? `<span class="product-tag">${esc(p.tag)}</span>` : ""}
                </div>
                <div class="product-body">
                  <span class="product-name">${esc(p.name)}</span>
                  <span class="product-meta">${esc(p.weight)}${SERVES[p.weight] ? " · " + esc(SERVES[p.weight]) : ""}</span>
                  <span class="product-price">${inr(p.price)}</span>
                </div>
              </a>
            </div></div>
          </article>`
  )
  .join("\n")}
        </div>
      </div>
    </section>`;

  return {
    file: path.join("mithai", slug(cat), "index.html"),
    url,
    html: page({
      base,
      url,
      title,
      description,
      image: `${SITE}/${items[0].img}`,
      imageAlt: items[0].name,
      jsonLd: [listLd, breadcrumbLd(trail)],
      body,
      bodyClass: "page-plp",
    }),
  };
}

/* ---------------- policy pages ---------------- */

const { POLICIES, UPDATED, WHATSAPP } = require("./policies.js");

// Plain text in, HTML out: the WhatsApp number and "Track your order" become links.
function policyText(text, base) {
  return esc(text)
    .split(esc(WHATSAPP)).join(`<a href="https://wa.me/${WHATSAPP.replace(/\D/g, "")}">${esc(WHATSAPP)}</a>`)
    .replace(/Track your order page/g, `<a href="${base}track/">Track your order</a> page`)
    .replace(/our (Shipping and delivery|Refunds and cancellations) policy/g, (m, name) =>
      `our <a href="${base}policies/${name.startsWith("Ship") ? "shipping" : "refunds"}/">${name} policy</a>`);
}

function policyPage(pol) {
  const base = "../../";
  const url = `${SITE}/policies/${pol.slug}/`;
  const trail = [{ name: "Home", href: "index.html" }, { name: pol.title }];
  const others = POLICIES.filter((p) => p.slug !== pol.slug);
  const body = `
    <article class="doc">
      <div class="wrap doc-wrap">
${crumbs(trail, base)}
        <header class="doc-head">
          <h1>${esc(pol.title)}</h1>
          <p class="lede">${esc(pol.lede)}</p>
          <p class="doc-updated">Last updated ${esc(UPDATED)}</p>
        </header>
${pol.sections
  .map(([heading, paras]) => `        <section class="doc-section">
          <h2>${esc(heading)}</h2>
${paras
  .map((p) =>
    Array.isArray(p)
      ? `          <ul>\n${p.map((li) => `            <li>${policyText(li, base)}</li>`).join("\n")}\n          </ul>`
      : `          <p>${policyText(p, base)}</p>`)
  .join("\n")}
        </section>`)
  .join("\n")}
        <nav class="doc-more" aria-label="Other policies">
          <h2>More</h2>
          <ul>
${others.map((o) => `            <li><a href="${base}policies/${o.slug}/">${esc(o.title)}</a></li>`).join("\n")}
          </ul>
        </nav>
      </div>
    </article>`;
  return {
    file: path.join("policies", pol.slug, "index.html"),
    url,
    html: page({
      base,
      url,
      title: `${pol.title} · ${BRAND}`,
      description: `${pol.lede} ${BRAND}, Jaipur.`,
      image: `${SITE}/images/hero.jpg`,
      imageAlt: BRAND,
      jsonLd: [breadcrumbLd(trail)],
      body,
      bodyClass: "page-doc",
    }),
  };
}

/* ---------------- track your order ---------------- */

function trackPage() {
  const base = "../";
  const url = `${SITE}/track/`;
  const trail = [{ name: "Home", href: "index.html" }, { name: "Track your order" }];
  const body = `
    <article class="doc track">
      <div class="wrap doc-wrap">
${crumbs(trail, base)}
        <header class="doc-head">
          <h1>Track your order</h1>
          <p class="lede">Enter your order number and the mobile number you ordered with.</p>
        </header>
        <form class="track-form" id="track-form" novalidate>
          <div class="field-row">
            <div class="field">
              <label for="track-no">Order number</label>
              <input id="track-no" name="no" type="text" inputmode="text" autocomplete="off" placeholder="MSH-100001" required />
            </div>
            <div class="field">
              <label for="track-phone">Mobile number</label>
              <input id="track-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" required />
            </div>
          </div>
          <p class="field-error" id="track-error" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary" id="track-submit">Track order <span class="btn-ico"><i class="ph-light ph-arrow-right" aria-hidden="true"></i></span></button>
        </form>
        <section class="track-result" id="track-result" aria-live="polite" hidden></section>
        <p class="track-help">Your order number starts with MSH and is on your receipt and confirmation email. Can't find it? <a href="https://wa.me/${WHATSAPP.replace(/\D/g, "")}">WhatsApp us on ${esc(WHATSAPP)}</a>.</p>
      </div>
    </article>`;
  return {
    file: path.join("track", "index.html"),
    url,
    noindex: true,
    html: page({
      base,
      url,
      title: `Track your order · ${BRAND}`,
      description: `Check where your ${BRAND} order is with your order number and mobile number.`,
      image: `${SITE}/images/hero.jpg`,
      imageAlt: BRAND,
      jsonLd: [breadcrumbLd(trail)],
      body,
      bodyClass: "page-doc",
      scripts: ["track.js"],
      robots: "noindex, follow",
    }),
  };
}

/* ---------------- write ---------------- */

const pages = [
  ...PRODUCTS.map((p) => productPage(p)),
  ...GIFT_BOXES.map((b) => productPage(b, "box")),
  ...[...new Set(PRODUCTS.map((p) => p.category))].map(categoryPage),
  ...POLICIES.map(policyPage),
  trackPage(),
];

for (const pg of pages) {
  fs.mkdirSync(path.dirname(pg.file), { recursive: true });
  fs.writeFileSync(pg.file, pg.html);
}

/* sitemap: home first, then every generated page */
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`, ...pages.filter((p) => !p.noindex).map((p) => p.url)];
fs.writeFileSync(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u === SITE + "/" ? "1.0" : u.includes("/mithai/") ? "0.8" : "0.7"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`
);

console.log(`built ${pages.length} pages`);
console.log(`  ${PRODUCTS.length} sweets, ${GIFT_BOXES.length} gift boxes, ${new Set(PRODUCTS.map((p) => p.category)).size} categories, ${POLICIES.length} policy pages, track your order`);
console.log(`sitemap.xml: ${urls.length} urls`);

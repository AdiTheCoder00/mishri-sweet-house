# Mishri Sweet House (demo store)

A single-page ecommerce demo for a Jaipur mithai shop. Plain HTML, CSS and JavaScript, no build step, no dependencies.

## Run it

```bash
node serve.js
```

Then open http://localhost:5173. Opening `index.html` straight from disk works in most browsers too, though the fonts and icons need internet either way.

The shop admin needs a password: `ADMIN_PASSWORD='your password' node serve.js` (see [Signing in](#signing-in)).

## The design

Built on Jaipur's own screen grammar rather than the usual premium-DTC template: a cool white ground with Jaipur pink and pista green as page-scale fields, each carrying a jaali (pierced screen) lattice; sweets shown through cusped-arch windows; saffron reserved for the action. Clash Display over Satoshi, one spring easing curve throughout. [DESIGN.md](DESIGN.md) records the full system; [PRODUCT.md](PRODUCT.md) records the product truth behind it.

The signature interaction: a jaali screen sits over each sweet and opens when you hover or focus it.

## What it does

- Catalogue with category filters, sort and live search (matches names, categories and descriptions, highlights the hit)
- Quick-view modal with a quantity stepper
- Basket drawer: per-line totals, a free-delivery nudge, quantity controls that stop at each item's minimum, and Remove with an Undo toast
- Wishlist drawer with "Move all to basket"
- Checkout: validated form, PIN serviceability against ~40 city prefixes, three real payment methods whose CTA names the consequence ("Pay ₹1,078 by UPI"), a cold-chain note when the basket holds a chilled item, and a receipt-style confirmation
- Light and dark themes (follows the system, toggle in the nav, remembered), full keyboard support, `prefers-reduced-motion` respected
- Smooth wheel scrolling with Lenis. Touch scrolling stays native, and it switches off under `prefers-reduced-motion`

Cart, wishlist and theme persist in `localStorage`. Nothing is charged and no order is sent.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup, drawers, modals; the direction contract sits in a comment at the top of `<body>` |
| `styles.css` | Tokens, materials (jaali, arch, double bezel), components |
| `app.js` | Catalogue, basket, wishlist, search, checkout, theme |
| `products.js` | Product and gift-box data: edit names, prices, weights and copy here |
| `images/` | Product and section photography |
| `serve.js` | Dependency-free static server for local preview |
| `admin.html`, `admin.js`, `admin.css` | Shop admin: overview, catalogue edits, orders |
| `admin-login.html` | Sign-in page for the shop admin |
| `middleware.js`, `lib/admin-auth.mjs` | Server-side password check in front of the admin (Vercel Routing Middleware; `serve.js` runs the same check locally) |
| `store-settings.js` | Applies the admin's catalogue edits on top of `products.js` in the storefront |
| `smooth-scroll.js` | Lenis smooth scrolling: eased wheel scrolling, section links that glide clear of the header, paused behind drawers and dialogs |
| `vendor/lenis/` | [Lenis](https://github.com/darkroomengineering/lenis) 1.3.26 (MIT), vendored so the site still needs no build step or extra CDN |
| `DESIGN.md` / `PRODUCT.md` | Visual system and product truth |

## Shop admin

Open `admin.html`, or follow **Shop admin** in the footer of any page. You are asked to sign in first. It has three sections:

- **Overview**: today's orders and takings, orders still to fulfil, how much of the catalogue is on sale, and anything that needs attention
- **Catalogue**: edit each sweet's and gift box's name, price, pack size, tag and card description, and set it to *On sale*, *Sold out* (shown, but cannot be added) or *Hidden* (off the storefront). Edits save when you leave the field and can be undone or restored to the `products.js` original
- **Orders**: every order placed through checkout, with search, status filters, a status per order (New, Preparing, Out for delivery, Delivered, Cancelled) and CSV export

### Signing in

The admin is behind a password that is checked on the server, before `admin.html`, `admin.js` or `admin.css` is sent. The password is the `ADMIN_PASSWORD` environment variable. It is never stored in the repository, and **without it the admin stays locked.**

- **On Vercel:** add `ADMIN_PASSWORD` under the project's Settings → Environment Variables (Production and Preview), then redeploy. `middleware.js` does the check.
- **Locally:** `ADMIN_PASSWORD='your password' node serve.js`. Plain `node serve.js` still serves the store, but the admin stays locked.

Signing in sets an HttpOnly, SameSite=Strict cookie (Secure on https) that lasts 12 hours. It carries an expiry time signed with HMAC-SHA-256, keyed by the password. **Sign out** in the admin bar clears it, and changing `ADMIN_PASSWORD` signs everyone out. A wrong password gets a short delay before the page answers. There is no lockout, so use a long random password.

### What is still a demo

Catalogue edits are stored in `localStorage` under `mishri-admin` and orders under `mishri-orders`, so they only exist in the browser that made them. The sign-in protects the admin page, not that data: a live shop needs a server that owns the catalogue and orders. `admin.html` and `admin-login.html` are also `noindex` and disallowed in `robots.txt`, to keep them out of search results.

The generated product pages carry prices and copy baked in at build time. Availability from the admin applies there immediately; to publish a new price or description on those pages, copy it into `products.js` and run `node build.js`.

## Building the product pages

```bash
node build.js
```

Generates one indexable page per sweet, per gift box and per category, then rewrites `sitemap.xml`:

| Output | Count | Example |
| --- | --- | --- |
| `sweets/<slug>/` | 12 | `sweets/kaju-katli/` |
| `gifts/<slug>/` | 3 | `gifts/the-diwali-box/` |
| `mithai/<category>/` | 5 | `mithai/barfi/` |

Each page carries its own title, meta description (clipped to 158 chars), canonical, Open Graph and Twitter tags, plus `Product` and `BreadcrumbList` structured data. Category pages carry `ItemList`.

The generator reads `products.js` for the catalogue and lifts the ribbon, nav and footer straight out of `index.html`, so the generated pages cannot drift from the real header or the real prices. **Re-run it after editing `products.js` or the site chrome.**

`sweets/`, `gifts/` and `mithai/` are disposable build output. Delete and regenerate freely.

### The per-product copy

Each product carries a `story` field in `products.js` (131–172 words, ~2,250 in total) that renders below the buy column as a **How we make it** section. With it each page runs to roughly 310–350 words of body text rather than a one-line description, which is the difference between a thin page and an indexable one.

```js
{ id: "kaju-katli", name: "Kaju Katli", /* … */
  story: "Kaju Katli is the sweet people judge a shop by, because there is nowhere to hide…" }
```

**This copy is written demo content and should be replaced with the shop's own words.** It was written to stay inside what the rest of the site already commits to — desi ghee, whole milk, no artificial colour, the Sanganer dairy, five kilo batches, the delivery promise — and the preparation described for each sweet is how that sweet is generally made, not a claim about a specific kitchen. It invents no awards, certifications, suppliers, health claims or nutrition figures. Anything a real shop would want to say beyond that (who supplies the cashews, which family recipe, what changed in 1998) has to come from the shop.

## SEO

The page ships a full head (title, description, canonical, Open Graph, Twitter card, theme-color, SVG favicon), `robots.txt`, `sitemap.xml`, and JSON-LD structured data describing the shop (`Store`), the site (`WebSite`) and all 15 products with prices in INR.

**The domain is a placeholder.** Every absolute URL uses `https://mishrisweethouse.example` (`.example` is IETF-reserved, so it can never collide with a real site). Before publishing, replace it in:

- `index.html` — canonical, `og:url`, `og:image`, `twitter:image`, and the JSON-LD block
- `robots.txt` — the `Sitemap:` line
- `sitemap.xml` — the `<loc>`

**No review markup, deliberately.** The testimonials on the page are written sample content. Marking invented reviews up as `Review`/`AggregateRating` is structured-data spam and can earn a Google manual action, so the JSON-LD carries none. Add it only when you have real, verifiable reviews.

**Product schema goes live when the shop does.** It advertises prices and `InStock` availability; keep it out of a published page until the store can actually take orders.

If you change `products.js`, the JSON-LD needs regenerating to match — it is a static copy of the catalogue.

## Before using this for real

- **Replace the photography.** The images were pulled from Flickr by keyword for the demo. Shoot the actual products.
- **The product stories are written demo copy.** See [The per-product copy](#the-per-product-copy). Replace them with the shop's own words.
- **The reviews are invented.** They are labelled as sample content on the page; swap in real ones or remove the section.
- **The batch times on the hero tiles are demo values**, as is the delivery PIN list.
- There is no backend: no stock, no accounts, no payment integration.

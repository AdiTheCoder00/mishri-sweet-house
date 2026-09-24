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
- Checkout: validated form, delivery estimate by PIN (same-day in Jaipur, 2 to 5 days anywhere else in India), three real payment methods whose CTA names the consequence ("Pay ₹1,078 by UPI"), a cold-chain note when the basket holds a chilled item, and a receipt-style confirmation
- Light and dark themes (follows the system, toggle in the nav, remembered), full keyboard support, `prefers-reduced-motion` respected
- **Track your order** (`track/`): customers enter their order number and mobile number and see where the order has got to, with the time of each step. Linked from the receipt, the confirmation and dispatch emails, and the footer
- Policy pages: shipping, refunds and cancellations, privacy, terms, and contact, linked from the footer
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
| `middleware.js` | Server-side password check in front of the admin (Vercel Routing Middleware; `serve.js` runs the same file locally). Kept in one file: Vercel runs it where local imports fail |
| `store-settings.js` | Applies the admin's catalogue edits on top of `products.js` in the storefront |
| `smooth-scroll.js` | Lenis smooth scrolling: eased wheel scrolling, section links that glide clear of the header, paused behind drawers and dialogs |
| `vendor/lenis/` | [Lenis](https://github.com/darkroomengineering/lenis) 1.3.26 (MIT), vendored so the site still needs no build step or extra CDN |
| `policies.js` | Text of the policy pages; `build.js` renders it into `policies/<slug>/` |
| `track.js` | The Track your order page |
| `tests/` | Automated tests; see [Tests](#tests) |
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

Signing in sets an HttpOnly, SameSite=Strict cookie (Secure on https) that lasts 12 hours. It carries an expiry time signed with HMAC-SHA-256, keyed by the password. **Sign out** in the admin bar clears it, and changing `ADMIN_PASSWORD` signs everyone out. A wrong password gets a short delay before the page answers. With Upstash connected, **10 wrong passwords from one address lock sign-in there for 15 minutes**.

`admin.html` and `admin-login.html` are also `noindex` and disallowed in `robots.txt`, to keep them out of search results.

## Going live: orders, alerts and payments

The site runs in two modes and switches by itself:

- **Demo mode** (no database connected): checkout is a demo, and orders and catalogue edits stay in each browser's `localStorage`.
- **Live mode** (Upstash Redis connected): orders go to the server, catalogue edits reach every customer within about 15 seconds, and the admin shows every order from every customer.

Everything below is set in Vercel under the project's **Settings → Environment Variables**, for Production and Preview. **Redeploy after any change**, because new values only reach new deployments.

| Variable | What it does | Where it comes from |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Admin sign-in | You choose it; make it long and random |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Turns on live mode | Set automatically when you add Upstash Redis (below) |
| `RESEND_API_KEY` | Sends email | resend.com → API Keys |
| `ALERT_EMAIL` | Where new-order alerts go (comma-separate several) | Your email address |
| `EMAIL_FROM` | Sender for everything, e.g. `Mishri Sweet House <orders@yourdomain.in>`. Turns on emails to customers and the festival-box list | A domain you have verified in Resend (`ALERT_FROM` still works too) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Turns on UPI and card payments | Razorpay Dashboard → Account & Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Confirms payments even if the customer closes the page | The secret you type when adding the webhook (below) |

### 1. Database: Upstash Redis

1. In the Vercel project, open **Storage** (or **Marketplace**), choose **Upstash → Redis**, and create a database on the free plan in the region nearest your customers (Mumbai for India).
2. Connect it to this project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Redeploy. The admin's notice now reads "saved on the shop's server".

Orders and catalogue edits made earlier in demo mode stay in the browser that made them; they are not moved to the database.

### 2. Email: Resend

There are three kinds of email:

| Email | Goes to | Needs |
| --- | --- | --- |
| New-order alert | You (`ALERT_EMAIL`) | `RESEND_API_KEY`, `ALERT_EMAIL` |
| Order confirmation, and "out for delivery" when you mark it so in the admin | The customer, if they gave an email at checkout | Plus `EMAIL_FROM` |
| Welcome note, and anything you send the festival-box list | People who pressed "Notify me" | Plus `EMAIL_FROM` |

**Order alerts only:**
1. Sign up at resend.com with the email address that should receive order alerts, and create an API key.
2. Set `RESEND_API_KEY` to the key and `ALERT_EMAIL` to that same address, then redeploy.

Without your own domain, email goes out from Resend's shared test sender, which **only delivers to the address the Resend account was opened with**. That is why `ALERT_EMAIL` must be that exact address. It is also the most common reason alerts don't arrive.

**Emails to customers and the festival-box list** need a domain you own, such as `mishrisweets.in`. The `vercel.app` address can't be verified.
1. In Resend, go to **Domains → Add Domain** and add the DNS records it shows at your domain provider. Wait until it says **Verified**.
2. Set `EMAIL_FROM`, e.g. `Mishri Sweet House <orders@mishrisweets.in>`, then redeploy.

The checkout's optional email field only appears once customer emails are on, so it never promises an email that can't be sent.

**Checking it:** the admin's **Email** tab shows what's set up. It has a **Send test email** button that reports exactly what Resend said, and it shows the last failed email with the fix, for example "ALERT_EMAIL must be the address you signed up to Resend with". The Overview's "Needs attention" list also flags failed emails.

**The festival-box list:** the homepage "Notify me" form saves addresses to the database. Signing up twice doesn't create a duplicate. The Email tab lists subscribers, exports them as CSV, removes addresses, and emails the whole list, 100 at a time, through Resend's batch sending. Every email carries its own unsubscribe link, plus the headers mail apps use for one-click unsubscribe. The link opens a confirm button rather than unsubscribing straight away, because mail scanners open links on their own.

Cash-on-delivery orders are emailed as soon as they are placed. Online orders are emailed once the payment is confirmed. A failed email never blocks an order.

### 3. Payments: Razorpay

1. Create a Razorpay account. **Test mode** keys (`rzp_test_…`) work straight away and take no real money. Live keys (`rzp_live_…`) need Razorpay to approve your business.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, then redeploy. Checkout now offers UPI and cards on Razorpay's secure page.
3. Recommended: in Razorpay go to **Settings → Webhooks → Add**, enter `https://<your site>/api/payments/webhook`, choose a secret, and tick `payment.captured` and `order.paid`. Set the same secret as `RAZORPAY_WEBHOOK_SECRET` and redeploy.

Without Razorpay keys, live mode offers **cash on delivery only**, so no order ever claims a payment that did not happen. The server prices every order from `products.js` plus the admin's edits and ignores prices sent by the browser. An online payment only counts once Razorpay's signature checks out. Orders whose payment was started but not finished show as **Unpaid** in the admin and are left out of takings.

### How it fits together

| Piece | Job |
| --- | --- |
| `api/store.js` | `GET /api/store`: a small script telling the pages whether live mode is on, the catalogue edits, and the public Razorpay key |
| `api/orders.js` | `POST /api/orders`: validates and prices an order, saves it, emails cash-on-delivery orders, and opens a Razorpay order for online ones. Limited to 20 orders an hour per address |
| `api/payments/verify.js`, `api/payments/webhook.js` | Confirm Razorpay payments (browser report and Razorpay webhook), each checked by signature |
| `api/admin/orders.js`, `api/admin/catalogue.js`, `api/admin/email.js` | The admin's data, email status, test email and list sending. They need the sign-in cookie |
| `api/track.js` | `POST /api/track`: an order's progress for the Track your order page. Needs the order number and the mobile number it was placed with; shows items, total and status, never the name, address or phone. Limited to 30 lookups an hour per address |
| `api/subscribe.js`, `api/unsubscribe.js` | The "Notify me" list: sign-up (with a welcome email) and unsubscribe |
| `api/_lib/` | Shared helpers: Upstash REST client, pricing, order storage, subscribers, Resend email (with plain-English error explanations), Razorpay |
| `middleware.js` | Admin sign-in and lockout (edge runtime, one self-contained file) |

`node serve.js` runs the `api/` routes locally too, reading the same environment variables.

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
| `policies/<slug>/` | 5 | `policies/refunds/` |
| `track/` | 1 | Track your order (kept out of search results and the sitemap) |

Each page carries its own title, meta description (the longest version that fits in 160 characters whole, so a snippet never ends on an ellipsis), canonical, Open Graph and Twitter tags (JPEG share image with its size; `og:type` product with price on product pages), plus `Product` (with delivery cost and time as `shippingDetails`) and `BreadcrumbList` structured data. Category pages carry `ItemList`. The build also rewrites the `ItemList` in `index.html` so it points at these pages, and lists each page's photograph in `sitemap.xml` for image search.

Every item's page path is worked out in `products.js` (`item.page`) from its original name, so the homepage cards, the generator and the related links all agree, and an admin rename does not break a link.

The generator reads `products.js` for the catalogue and lifts the ribbon, nav and footer straight out of `index.html`, so the generated pages cannot drift from the real header or the real prices. **Re-run it after editing `products.js` or the site chrome.**

Policy text lives in `policies.js`; re-run the build after editing it too. The tests fail if a generated page is out of date.

`sweets/`, `gifts/`, `mithai/`, `policies/` and `track/` are disposable build output. Delete and regenerate freely.

### The per-product copy

Each product carries a `story` field in `products.js` (131–172 words, ~2,250 in total) that renders below the buy column as a **How we make it** section. With it each page runs to roughly 310–350 words of body text rather than a one-line description, which is the difference between a thin page and an indexable one.

```js
{ id: "kaju-katli", name: "Kaju Katli", /* … */
  story: "Kaju Katli is the sweet people judge a shop by, because there is nowhere to hide…" }
```

**This copy is written demo content and should be replaced with the shop's own words.** It was written to stay inside what the rest of the site already commits to — desi ghee, whole milk, no artificial colour, the Sanganer dairy, five kilo batches, the delivery promise — and the preparation described for each sweet is how that sweet is generally made, not a claim about a specific kitchen. It invents no awards, certifications, suppliers, health claims or nutrition figures. Anything a real shop would want to say beyond that (who supplies the cashews, which family recipe, what changed in 1998) has to come from the shop.

## Policies

The shipping, refunds, privacy, terms and contact pages are written from what the site already promises (delivery times and fees, payment methods, free replacement, the services it runs on). A few terms the site never stated before had to be chosen. **Confirm these match how the shop really works** before taking real orders, and edit `policies.js` if not:

- Damaged, spoilt or late orders must be reported on WhatsApp **within 24 hours** of delivery
- Orders can be cancelled free **until preparation starts**; bulk and wedding orders are agreed case by case
- Online refunds go back to the same account or card **within 5 to 7 working days** of approval; cash-on-delivery refunds are paid **by UPI or bank transfer**
- Perishable orders that arrived in good condition **can't be returned**
- The kitchen handles **milk, nuts (cashew, pistachio, almond), gram flour, wheat and sugar**
- Disputes go to the **courts in Jaipur**
- Order records are kept for **accounts and tax purposes**
- Consider adding a **contact email** and, if the shop has one, its **GSTIN** to the contact page. Razorpay asks for these policy pages when you activate the account

Change `UPDATED` in `policies.js` whenever the wording changes.

## Tests

```bash
node --test tests/*.test.mjs
```

Needs nothing installed. The tests run the real `api/` routes and `middleware.js` with Upstash, Resend and Razorpay replaced by in-memory stand-ins (`tests/helpers/`), so no keys or network are needed and nothing is sent.

| File | Covers |
| --- | --- |
| `orders.test.mjs` | Demo vs live mode, server-side pricing, validation, admin sign-in, status changes, catalogue edits, rate limits |
| `payments.test.mjs` | Razorpay orders, signature checks, the webhook, and alerting exactly once |
| `email.test.mjs` | Owner alerts, customer confirmation and dispatch emails, Resend errors explained, the Notify me list, announcements, unsubscribe |
| `regressions.test.mjs` | Races and edge cases found in code review: double dispatch emails, double sign-ups, retrying a half-sent announcement |
| `track.test.mjs` | Track your order: matching by number and mobile, what it reveals, rate limit |
| `middleware.test.mjs` | Admin sign-in, cookies, lockout, and that the file stays self-contained for the edge runtime |
| `build.test.mjs` | Generated pages are up to date, and no internal link is broken |
| `e2e.test.mjs` | In Chromium: the demo shop, policy pages, phone widths, and a live order followed through Track your order |
| `vercel-output.test.mjs` | The output of `vercel build`: functions as Vercel compiles them, the middleware inside Vercel's edge runtime |

The last two are skipped unless their tools are present. To run them too:

```bash
npm install --no-save playwright edge-runtime vercel
npx playwright install chromium
npx vercel build --yes   # first time: asks to link a project; any will do, nothing is deployed
node --test tests/*.test.mjs
```

GitHub Actions (`.github/workflows/test.yml`) runs everything, including `vercel build`, on every pull request and on pushes to `main`.

## SEO

The page ships a full head (title, description, canonical, Open Graph, Twitter card, theme-color, SVG favicon), `robots.txt`, `sitemap.xml`, and JSON-LD structured data describing the shop (`Store`), the site (`WebSite`) and a list of all 15 product pages.

**Crawlable catalogue.** The homepage grid is drawn by JavaScript, so each card's name is a real link to that sweet's page (a plain click still opens the quick view; middle-click or Ctrl-click opens the page). Gift box names link to their pages, and the quick view links through too. Without these the product pages were reachable only from the sitemap. Links to the home page use `/`, never `/index.html`, so it has one URL.

`robots.txt` keeps `/api/` closed but allows `/api/store`, the script every page loads for today's prices and availability, so search engines render the pages the way customers see them.

**The domain** is `https://mishri-sweet-house.vercel.app`, the project's Vercel address. To move to a custom domain, change it in:

- `build.js`: the `SITE` constant, then run `node build.js` to regenerate the product pages and `sitemap.xml`
- `index.html`: the canonical link, `og:url`, `og:image`, `twitter:image` and the JSON-LD block
- `robots.txt`: the `Sitemap:` line

**Analytics and Speed Insights.** The storefront pages load Vercel Web Analytics (`/_vercel/insights/script.js`), which counts page views without cookies, and Speed Insights (`/_vercel/speed-insights/script.js`), which measures real visitors' load times (Core Web Vitals). The admin pages load neither. Each starts collecting once it is enabled on its tab in the Vercel project, followed by a redeploy. Until then its script returns 404, which is harmless.

**No review markup, deliberately.** The testimonials on the page are written sample content. Marking invented reviews up as `Review`/`AggregateRating` is structured-data spam and can earn a Google manual action, so the JSON-LD carries none. Add it only when you have real, verifiable reviews.

**Product schema goes live when the shop does.** It advertises prices and `InStock` availability; keep it out of a published page until the store can actually take orders.

If you change `products.js`, the JSON-LD needs regenerating to match — it is a static copy of the catalogue.

## Before using this for real

- **Replace the photography.** The images were pulled from Flickr by keyword for the demo. Shoot the actual products.
- **The product stories are written demo copy.** See [The per-product copy](#the-per-product-copy). Replace them with the shop's own words.
- **The reviews are invented.** They are labelled as sample content on the page; swap in real ones or remove the section.
- **The batch times on the hero tiles are demo values.**
- **Customer sign-in is a demo.** The OTP code is shown on screen and "Google" returns a sample profile. Making it real needs an SMS provider (or Firebase Phone Auth) and Google Identity Services.
- **There is no stock count.** Mark items *Sold out* in the admin when they run out.

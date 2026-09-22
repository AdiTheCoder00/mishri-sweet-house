# Mishri Sweet House (demo store)

A single-page ecommerce demo for a Jaipur mithai shop. Plain HTML, CSS and JavaScript, no build step, no dependencies.

## Run it

```bash
node serve.js
```

Then open http://localhost:5173. Opening `index.html` straight from disk works in most browsers too, though the fonts and icons need internet either way.

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
| `DESIGN.md` / `PRODUCT.md` | Visual system and product truth |

## Before using this for real

- **Replace the photography.** The images were pulled from Flickr by keyword for the demo. Shoot the actual products.
- **The reviews are invented.** They are labelled as sample content on the page; swap in real ones or remove the section.
- **The batch times on the hero tiles are demo values**, as is the delivery PIN list.
- There is no backend: no stock, no accounts, no payment integration.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and vanilla JavaScript, no build step. `node serve.js` serves the folder on port 5173. (Chosen at project start for a zero-setup demo; the user did not request a framework.)

## Users

Primary: gift-givers across India. Someone in Bengaluru, Pune or Ahmedabad sending a Diwali, Rakhi or "just because" box to family, usually on a phone in the evening. Their job: pick a box they can trust to arrive fresh, write a card message, pay, and know when it lands.

Secondary (confirmed as present, not the lead): locals in Jaipur ordering same-day; corporate and wedding bulk buyers (Office Box, Wedding Favour, minimum orders).

## Product Purpose

Mishri Sweet House is an online storefront for a Jaipur mithai shop. It sells twelve classic sweets and three curated gift boxes, delivered same-day in Jaipur and in 2 to 5 days (cold-packed where needed) anywhere else in India. Success: a gift-giver completes an order within a couple of minutes, believing the box will arrive fresh and the card will be handwritten.

This is a demo store. No payment is processed and no order is transmitted; the UI states this on the success screen and in the footer.

## Positioning

Lead claim: "Mithai made this morning, at your door by evening." Daily 5 am production, nothing sold older than a day, same-day in Jaipur, cold-packed in 2 to 5 days anywhere in India. (User expressed no preference among the three candidate claims; this one was already the hero and is kept as lead.)

Supporting proof: three generations and one kadhai (two-table shop near Johari Bazaar since 1962, unchanged recipes, same dairy, khoya reduced by hand); pure desi ghee, whole milk, no artificial colour, five-kilo batches.

## Operating Context

- Ordering happens mostly on phones; festival peaks (Diwali, Holi, Rakhi) with pre-order boxes.
- Delivery: anywhere in India. Same-day for Jaipur PINs (302xxx, 303xxx); 2 to 5 days everywhere else; chilled items (Rasmalai) ship in insulated boxes with ice packs.
- Payment methods offered in the demo: UPI (payment request to a UPI ID), card (redirect to a secure page, not on-site), pay on delivery.
- Gift boxes carry a handwritten card message written at checkout.

## Capabilities and Constraints

- Catalogue with category filter, sort and text search; quick-view modal; basket drawer with quantities; wishlist drawer; checkout dialog with validation, PIN serviceability, payment-method-aware CTA and a receipt-style success screen; newsletter signup; light/dark theme with system preference and a remembered toggle; reduced-motion respected.
- Terminology in use: "The counter" (shop section), "basket", "Saved for later" (wishlist), "Handwritten card message", "mithai", "kadhai", "khoya", "vark".
- Categories: Barfi, Ladoo, Bengali, Syrup, Ghee.
- No backend, no stock, no accounts. Prices in INR, formatted en-IN.
- npm registry is unreachable on the development machine (certificate issue); no build tooling or npm dependencies can be added. Fonts and icons load from CDNs.
- Open decisions: weight/size variants per sweet (currently one fixed size each); a real "build your own box" flow (the hero CTA currently links to fixed boxes); enforcement of the Wedding Favour 50-unit minimum.

## Brand Commitments

- Name: Mishri Sweet House ("Mishri"), Jaipur, since 1962, 14 Johari Bazaar Road.
- Voice: plain, concrete, unhurried; specific nouns over adjectives ("made in five kilo lots so nothing sits"). No hype words. All existing copy and product data are to be preserved by default in the visual overhaul; changes only where the direction clearly earns them, and flagged.
- Binding visual constraint volunteered by the user: the overhaul follows the "high-end-visual-design" skill (Apple/Linear-tier craft: floating island nav, nested double-bezel containers, pill CTAs with nested trailing icon, spring-curve motion, heavy macro-whitespace, no Inter/Roboto/Arial, no generic borders or harsh shadows, no linear/ease-in-out transitions). Light and dark renditions both required.

## Evidence on Hand

- Product photos in `images/` (17 files, sourced from Flickr via keyword search for the demo; suitable for demo only, to be replaced with real product photography). The current hero image (`images/hero.jpg`) shows chakli, not a sweet, and must not be used as a hero.
- Reviews on the page are invented demo content (names and cities). No real testimonials, press or metrics exist; none may be fabricated as real.
- No logo asset exists beyond a lettermark "M".

## Product Principles

1. Freshness is the promise: every surface should make "made this morning" concrete (times, batches, delivery windows), never abstract.
2. Trust at the moment of commitment: checkout says what happens next, what it costs, and how the box travels.
3. The gift is the unit: card message, box presentation and arrival experience matter as much as the sweet.
4. Plain words, real nouns: copy names Jaipur places, ingredients and processes; no marketing filler.
5. Honest demo: anything not real is labelled as such.

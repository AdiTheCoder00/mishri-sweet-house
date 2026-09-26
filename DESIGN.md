# Design

<!-- impeccable:design-source built -->

Recorded from the built storefront (`index.html`, `styles.css`, `app.js`) after the jaali overhaul. Ground truth, not intention: every value below is in the shipped CSS.

## World

Jaipur's own screen grammar. A cool white ground holds two page-scale colour fields, Jaipur pink and pista green, both carrying a jaali (pierced screen) lattice. Photography sits in cusped-arch windows. Surfaces are double-bezel tiles: a hairline shell around a paper core, radii concentric. The sweets are the only imagery; the pattern is texture, never wallpaper.

The thesis this refuses: the premium-DTC storefront (one big photo, three feature cards, an even product grid on white).

## Color

Fields, not accents. Pink or pista owns a whole region; saffron appears only on primary actions.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--ground` | `#f4f5f2` | `#101014` | Page |
| `--paper` | `#ffffff` | `#17171d` | Tile core, drawers, dialogs |
| `--shell` | `rgba(26,26,34,.045)` | `rgba(255,255,255,.05)` | Bezel shell, quiet fills |
| `--ink` / `--ink-2` | `#1a1a22` / `#5d5e69` | `#f2f1ec` / `#a5a4ad` | Text, secondary text |
| `--hair` / `--hair-strong` | `rgba(26,26,34,.09)` / `.16` | `rgba(255,255,255,.09)` / `.18` | Rules, borders |
| `--pink` / `--pink-deep` / `--pink-soft` | `#b4455b` / `#8f3247` / `#f7e2e6` | `#8a3247` / `#6a2436` / `#2c1a20` | Hero field, newsletter, gift tiles |
| `--pista` / `--pista-soft` | `#2e5b3f` / `#e2ede3` | `#1f3d2b` / `#1a2a20` | Kitchen story, delivery and assurance cues |
| `--saffron` | `#e8961e` | `#f0a63a` | Primary CTA, basket badge, focus ring, selection |

One accent rule: saffron marks the action the visitor should take. Pink is place, pista is process. Never a fourth hue.

## Type

- Display: **Clash Display** 500/600/700 (Fontshare). `h1` `clamp(2.6rem, 6.2vw, 5.5rem)` at `-0.035em`, line-height `0.98`; `h2` `clamp(2rem, 4vw, 3.4rem)` at `-0.03em`. Product names, drawer and dialog headings use it at 1.05–2.2rem.
- Body: **Switzer** 400/500/700 (Satoshi was the original choice; Fontshare now serves Switzer in its place). 16px base, line-height 1.55. Copy measures cap at 40–58ch.
- Stamps: `.stamp`, 10.5px, weight 700, `letter-spacing: .16em`, uppercase, in a hairline pill. They carry batch times (`05:10`), lot sizes (`5 KG LOTS`) and place (`JAIPUR · SINCE 1962`). This is the only uppercase in the system, and it always carries data, never a section label.

## Shape and depth

One radius scale, concentric: `--r-xl 2rem` (bezel shell, drawers, dialogs, colour fields), `--r-lg calc(2rem - 6px)` (bezel core), `--r-md 1rem` (inputs, notes), `999px` (every button, chip, stamp, badge).

The **double bezel** is the repeating container: `.bezel` (shell, `--shell` fill, 1px `--hair`, 6px padding) wrapping `.bezel-core` (paper, inner top highlight). Used for product cards and gift tiles. Shadows always carry offset and blur (`--shadow-soft`, `--shadow-float`); no zero-offset halos, no hard block shadows.

## Materials

- **Jaali lattice**: an octagon-and-square SVG tile at a fixed 44×44px. Cells never stretch; the field re-counts them per viewport. It is a **field material only**: it dresses the pink and pista grounds and never sits over a photograph. Food is shown unobstructed.
- **Cusped arch**: a five-lobe mask (`.arch`) on the hero counter tiles. Path springs at 36% height so the straight sides read as a window.
- **Island glass**: the nav and the full-screen menu use `--glass` + `backdrop-filter: blur(22px) saturate(160%)` with a `--glass-edge` hairline and an inner top highlight. Blur is applied only to fixed elements.

## Motion

One easing: `--spring cubic-bezier(0.32, 0.72, 0, 1)`. No `linear`, no `ease-in-out`.

- Entrance: `rise` (24px up, 8px blur, opacity) staggered across hero copy, then the counter strip; the island drops in separately.
- Scroll reveal: `.reveal` blur-fade-up via IntersectionObserver, once per element, staggered by `--i`.
- Signature: the arch-window counter strip. Tiles snap, alternate tiles sit 40px lower, and each carries its batch time. On a product card the photo scales 1.05 beneath a lifting bezel; that lift is the card's whole hover language.
- Buttons: the nested `.btn-ico` circle translates `(2px, -1px)` and scales 1.06 on hover; the button scales 0.98 on press.
- Burger: two lines rotate ±45° into a cross; menu links rise in with a 60ms stagger.
- Only `transform`, `opacity`, `filter` and colour animate. Everything collapses under `prefers-reduced-motion`.

## Components

- **Island nav**: fixed, centred, `width: max-content`, 60px tall, fully rounded, glass. Links inline above 900px; below that a morphing burger opens a full-screen blurred menu.
- **Buttons**: pill, 52px. Primary is saffron with an inner highlight and a tinted drop shadow. Every primary CTA ends in a nested 36px icon circle (button-in-button). Ghost is a hairline outline.
- **Product card**: bezel → square photo, unveiled, with a hairline inner edge and a soft top scrim, tag pill top-left, 44px heart top-right, then name (a button, it opens quick view), meta with serving guidance, price and Add. The Add button carries its own state: `Added` plus the count in the icon circle.
- **Counter strip**: horizontally scrolling, snap-aligned arch tiles with batch-time stamps; alternate tiles offset 40px down.
- **Bento**: 8fr/4fr, the lead tile spanning both rows. Photo, a bottom-up scrim, and copy inside the bezel core.
- **Drawers**: inset 12px from the viewport edge, fully rounded, sliding on the spring. Basket shows per-line totals, a free-delivery nudge, minus disabled at the item's minimum, and Remove with an Undo toast.
- **Checkout dialog**: single column, payment as three described options, a payment-specific detail panel, a summary, a pista assurance list, and a sticky footer holding the CTA that names the consequence ("Pay ₹1,078 by UPI").
- **Toast**: below the island, never over a drawer CTA. Carries an optional action (Undo).

## Browser surfaces

Themed, not defaults: `::selection` is saffron on ink; the scrollbar thumb is `--hair-strong` on a 3px ground-coloured border; `:focus-visible` is a 2px saffron ring at 3px offset; the sort chevron is a masked element that follows `--ink-2` in both themes.

## Rules

1. Colour arrives as a field that owns a region, never as a scattered accent.
2. Lattice cells stay square at 44px; the count changes, the cell never stretches.
3. Every card and tile is a double bezel; no bare rectangles, no nested cards.
4. Every primary CTA gets the nested trailing icon circle.
5. Stamps carry data. A stamp that only labels a section does not ship.
6. One motion grammar, one spring; the arch-window counter strip is the authored moment.
7. Both themes are first-class; nothing ships tested in only one.
8. Minimum 44×44 for anything tappable.

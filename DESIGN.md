---
name: Paradisio
description: Ticketing site for a maximalist house/disco/techno night in Barranco, Lima
colors:
  orange: "#FD5400"
  yellow: "#FFC700"
  red: "#E8291C"
  pure-black: "#000000"
  card-black: "#0a0a0a"
  hairline: "#232323"
  paper-white: "#ffffff"
typography:
  display:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "clamp(20vw, 11.5vw, 11.5vw)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "normal"
  headline:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "1.5px"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "7px"
  md: "8px"
  lg: "14px"
  xl: "16px"
  full: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.paper-white}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  button-accent:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#cccccc"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "28px 24px"
  ticket-card:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.xl}"
    padding: "30px"
---

# Design System: Paradisio

## Overview

**Creative North Star: "The Barranco Blackout Flyer"**

Paradisio's landing page is a black wall papered over in oversized, stroked-outline type and screen-printed stickers — the visual grammar of a photocopied rave flyer stapled to a Barranco lamppost, not a polished nightlife brand deck. Three inks do all the work on that wall: fire orange, acid yellow, and alarm red, laid down flat and hard-edged against pure black, the way spray paint and marker sit on a poster rather than the way a gradient sits on a screen. Nothing here is soft, pastel, or "elegant nightlife" — it commits fully to maximalist, high-contrast collage, and it explicitly avoids the white-sand, sun-bleached Ibiza-flyer cliché in favor of something louder, blacker, and more concrete.

Once a visitor commits — buying a ticket, checking in at the door, running the admin panel — the system deliberately quiets down. Checkout, the ticket picker, staff check-in, and the admin dashboard all drop to a single accent (orange) on flat dark cards with hairline borders: legible, calm, and fast to scan under bad lighting at 1am. The loud collage world and the quiet operational world share one type system and one accent color, so the app never feels like two products, but they never bleed into each other stylistically either.

**Key Characteristics:**
- Pure black canvas, everywhere, with color used as ink, not as tint or gradient.
- Oversized stroked-outline Orbitron type as the dominant landing-page motif.
- Exactly one accent color (orange) survives past the hero; yellow and red are hero-only.
- Hard, offset "sticker" shadows on the collage; no shadows at all on operational screens except one ambient accent glow.
- Skewed geometry (ticker, countdown chips, stripe band) on the hero; upright, calm geometry everywhere else.

## Colors

The palette is three saturated inks over black-and-white, used like a photocopied flyer rather than a soft brand system — no tints, no gradients, no muted variants.

### Primary
- **Fire Orange** (`#FD5400`): the one color that survives everywhere — the paid-ticket button, the ticket-picker ticker background, the checkout accent, the staff scan button, focus rings, and the sole accent on every card past the landing hero. It is the thread that ties the loud world to the quiet one.

### Secondary
- **Acid Yellow** (`#FFC700`): hero-only. Landing-page ticker background, one of the three tiled-text fill colors, the spinning ring sticker. Never appears past the hero.

### Tertiary
- **Alarm Red** (`#E8291C`): hero-only. Diagonal overlay phrases, the ribbon sticker, one of the three tiled-text fill colors, the striped section-break band. Reads as warning/urgency ink, reserved for the collage.

### Neutral
- **Pure Black** (`#000000`): the page background everywhere, hero and operate alike.
- **Card Black** (`#0a0a0a`): one step off true black — every card, table, stat tile, and panel surface.
- **Hairline** (`#232323`): every border and divider; the only border color in the system.
- **Paper White** (`#ffffff`): the primary button fill and the QR backing tile — the only place pure white appears as a surface, not just as text.

### Named Rules
**The One Accent Rule.** Every screen past the landing hero (checkout, ticket picker, staff, admin) uses exactly one accent color — orange. Yellow and red are reserved for the collage and never appear in the operational UI.

## Typography

**Display Font:** Orbitron (weight 400–900), self-hosted at `/fonts/Orbitron.ttf`
**Body Font:** Inter (weight 100–900), self-hosted at `/fonts/Inter.ttf`

**Character:** Orbitron is the shout — a square, geometric, sci-fi-rave face used at extreme scale on the hero wall and at small structural scale for card titles, stats, tickers, and countdowns. Inter is the whisper underneath it — the quiet workhorse for every label, price, and paragraph. The two never blend mid-word; a given piece of text is either fully Orbitron or fully Inter.

### Hierarchy
- **Display** (900, `11.5vw` desktop / `20vw` mobile, line-height 0.86): the tiled "PARADISIO" wall rows on the landing hero, always uppercase, always with a 2px black stroke outline so the type reads over any fill color behind it.
- **Headline** (700, 17–20px): card titles, ticket-type name, section titles.
- **Label** (700–800, 9–14px, letter-spacing 0.5–3px, uppercase): ticker text, countdown labels, stat labels — always Orbitron, always uppercase.
- **Body** (400–600, 12–15px, line-height ~1.5): form labels, descriptions, ticket notes, everything read as a sentence rather than a shout.

### Named Rules
**The All-Caps Shout Rule.** Orbitron only ever appears uppercase — it is never used in sentence case, and it is never used for body copy.

## Layout

Two distinct spatial grammars, matched to the two modes:

- **Persuade (`index.html`):** full-bleed, no max-width container, `overflow-x: hidden` so oversized tiled text and rotated overlay phrases can bleed off both edges. The hero is `min-height: 92vh`; a skewed diagonal stripe band (`skewY(-2deg)`) marks the section break instead of a horizontal rule.
- **Operate (`tickets.html`, `checkout.html`, `staff.html`, `admin.html`):** centered, constrained columns — 420–460px for single-flow ticketing/check-in screens, 920px for the ticket-picker's two-card grid, 1100px for the admin table. Consistent 16–24px page padding, a 2-column card grid collapsing to 1 column under 640px, and single-column stacked forms throughout.

## Elevation & Depth

Flat by default outside the hero: cards are a one-step-lighter fill (`#0a0a0a`) on pure black with a 1px hairline border, no drop shadows. The single exception is the "accent" ticket-type card, which gets an ambient `rgba(253,84,0,0.10–0.35)` glow instead of a directional shadow — depth reads as a light bleed, not a lift. The hero collage uses the opposite idiom: hard, zero-blur offset "sticker" shadows (`4px 4px 0 #000`) on ribbon and phrase elements, like screen-printed paper stacked on paper.

### Shadow Vocabulary
- **Ambient accent glow** (`box-shadow: 0 0 30px rgba(253,84,0,0.10)`, ticket/card border tinted `#FD540055`): marks the one featured card per operational screen.
- **Sticker offset** (`box-shadow: 4px 4px 0 #000`): hero-only collage elements (ribbon sticker).

### Named Rules
**The Sticker Shadow Rule.** Any shadow on the hero collage is a hard, zero-blur offset — never a soft blur. It reads as paper on paper, not glass floating.

## Shapes

Two form languages coexist by design. Operate surfaces use soft, calm geometry: 7–8px radius on inputs and buttons, 14–16px radius on cards, upright rectangles throughout. The hero uses aggressive, skewed geometry: `skewX(-6deg)` countdown chips, a `skewY(-2deg)` stripe band, a sharp-cornered "hero-frame" with exposed corner-bracket accents (2px border ticks at two opposing corners), full circles reserved for stickers (a spinning ring and a spinning badge), and one hard triangle sticker. Oversized hero type always carries a 2px black stroke outline so it holds its shape over any fill color.

## Components

### Buttons
- **Shape:** 8px radius, full-width block, 14px/20px padding, Inter 14px/600 label.
- **Primary:** white fill, black text — the default/safe action (free registration, generic confirm).
- **Accent:** orange fill, white text — the paid/upsell action (buy ticket, pay, scan QR).
- **Ghost:** transparent fill, 1px hairline border, light-gray text, smaller 6px/12px padding — secondary or in-row actions (export, refresh, void/reactivate).

### Cards / Containers
- **Corner Style:** 14px radius (16px on the ticket-confirmation card).
- **Background:** card black (`#0a0a0a`) on the pure-black page.
- **Border:** 1px hairline (`#232323`); the accent variant swaps to a dim orange border plus the ambient glow shadow.
- **Internal Padding:** 24–30px.

### Tickets (signature component)
The generated ticket is the emotional payoff of the whole flow: a centered card with an orange uppercase eyebrow (ticket type), an Orbitron ticket name, a QR code on its own white padded tile — QR always gets a white background regardless of the surrounding theme, since scanner legibility overrides visual consistency — a monospace ticket ID, a green confirmation note, and a hairline-divided footnote with validity rules.

### Inputs / Fields
- **Style:** black fill, 1px hairline border, 7px radius, a 12px gray label sits above the field rather than inside it.
- **Focus:** border shifts to accent orange; no glow ring.
- **Error:** a dedicated dark-red banner (`#2a0a0a` background, `#5a1a1a` border, `#ff8a8a` text) rather than just a red input border.

### Navigation / Ticker
A horizontally auto-scrolling marquee (yellow background on the landing hero, orange background on the ticket picker) carrying uppercase Orbitron brand/genre words. It doubles as both a header and a section divider — there is no separate nav bar.

### Status Badges
Pill-shaped (12px radius), color-coded by ticket state — free (blue-tinted), paid (purple-tinted), checked-in (green-tinted), pending (gray), voided (red-tinted). Each pairs a dark tinted background with a lighter same-hue text. This is a deliberately separate semantic palette from the three brand accents, so ticket status never competes visually with brand color.

## Do's and Don'ts

### Do:
- **Do** keep exactly one accent color (orange `#FD5400`) on every Operate screen; reserve yellow and red for the landing hero only.
- **Do** give the QR code a white background tile even on fully dark screens — scanner legibility overrides theme consistency.
- **Do** use Orbitron only in uppercase, and only for shouted, structural, or numeric content (headlines, stats, tickers, countdowns) — never for body copy.
- **Do** keep cards flat (hairline border only) outside the hero; reserve the ambient glow shadow for the single featured/accent card on a screen.

### Don't:
- **Don't** introduce a fourth brand hue; the palette is fixed to orange / yellow / red / black / white.
- **Don't** apply the hero's hard sticker shadows or skewed geometry to Operate screens — those stay upright, calm, and shadow-free.
- **Don't** confuse the ticket-status badge colors (blue/purple/green/gray/red-tinted) with the three brand accents — they are a separate semantic palette.
- **Don't** give a collage/sticker element a soft blurred shadow — it's a hard offset or nothing.

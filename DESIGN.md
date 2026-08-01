---
name: Paradisio
description: Real event landing for a house/disco night in Barranco, Lima — editorial dark-club aesthetic
colors:
  primary: "#FF2800"
  primary-hover: "#FF9A00"
  bg: "#090909"
  ink: "#F2EDE4"
  muted: "#888880"
  card: "#141414"
  field: "#1A1A1A"
  line: "rgba(255,40,0,0.18)"
typography:
  display:
    fontFamily: "Unbounded, sans-serif"
    fontWeight: 900
    fontSize: "clamp(2.4rem, 6vw, 4.6rem)"
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontWeight: 400
    fontSize: "15px"
    lineHeight: 1.7
  label:
    fontFamily: "DM Sans, sans-serif"
    fontWeight: 500
    fontSize: "10px"
    letterSpacing: "0.35em"
rounded:
  none: "0px"
spacing:
  sm: "14px"
  md: "24px"
  lg: "48px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#0A0A0A"
    rounded: "{rounded.none}"
    padding: "17px 32px"
  button-dark:
    backgroundColor: "#000000"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "17px 32px"
  tier-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "38px 48px"
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "15px 16px"
---

# Design System: Paradisio

## Overview

**Creative North Star: "The Late-Night Broadsheet"**

Paradisio's site now reads like a broadsheet insert for a nightlife section — dense grid rules, oversized uppercase display type, and real photography, printed in one aggressive red-orange ink on near-black stock. Where the previous system celebrated a collage of stickers and repeated flyer text, this one strips that away for editorial restraint: hairline dividers, generous negative space, and a strict grid carry the energy instead. Nothing is rounded, and nothing is decorative for its own sake — a photograph, a number, a rule of type. The one loud gesture left is color itself: a single saturated red-orange against near-black and warm off-white, used with total conviction.

**Key Characteristics:**
- Sharp corners everywhere; no radius token in the system.
- Two-family type system: Unbounded (display, always uppercase, always heavy weight) for anything shouted, DM Sans (body) for anything read.
- Real event photography (hero + venue) replaces the illustrated collage, always dimmed rather than shown at full brightness.
- Thin red-tinted hairlines (`rgba(255,40,0,0.18)`) are the only borders in the system — no card shadows, no glows.
- Scroll-driven micro-motion (parallax photography, header state change, staggered reveal) replaces the constant spring/spin motion of the old collage system.

## Colors

One saturated ink on near-black-and-clay neutrals — no secondary or tertiary hue.

### Primary
- **Signal Red** (`#FF2800`): the hero background, the Entradas section background, every CTA, every hairline rule (at 18% opacity), every eyebrow label. The only accent color in the system.

### Secondary (hover-only accent)
- **Amber Flare** (`#FF9A00`): exists only as the hover/active state for red elements (links, buttons, the seconds digit of the countdown). Never a resting-state fill.

### Neutral
- **Near Black** (`#090909`): the page background.
- **Warm Off-White** (`#F2EDE4`): all body text and the page's "paper" tone — never pure white.
- **Muted Clay** (`#888880`): secondary text, captions, timestamps.
- **Panel Black** (`#141414`): the checkout panel and footer surface, one step off the page background.
- **Field Black** (`#1A1A1A`): input backgrounds, one step lighter than the panel so fields read as wells.

### Named Rules
**The One-Ink Rule.** Signal Red is the only hue in the system besides black, white, and clay. Amber Flare is not a second color — it's what Signal Red becomes on hover.

## Typography

**Display Font:** Unbounded (weight 200–900), self-hosted at `/fonts/Unbounded.ttf`
**Body Font:** DM Sans (weight 100–900), self-hosted at `/fonts/DMSans.ttf`

**Character:** Unbounded is the shout — always uppercase, always weight 900, used at extreme scale on the hero wordmark and at structural scale for section headlines, countdown digits, and prices. DM Sans is the whisper underneath it — long-form copy, captions, form fields, footer text.

### Hierarchy
- **Display** (900, `clamp(2.4rem,6vw,4.6rem)` up to `clamp(3.6rem,17.5vw,15rem)` on the hero wordmark): section headlines, countdown digits, ticket prices.
- **Label** (500, 10px, letter-spacing 0.28–0.4em, uppercase): every eyebrow, nav link, button label, footer heading.
- **Body** (400, 14–15px, line-height 1.6–1.7): paragraphs, form inputs, legal copy.

### Named Rules
**The All-Caps Shout Rule.** Unbounded only ever appears uppercase, and only for structural or numeric content — never for body copy.

## Layout

Full-bleed sections with no rounded container anywhere. Content uses a single `40px` gutter (`22px` under 860px) applied uniformly, not a centered max-width column — sections run edge to edge and are split by hairline rules instead of card boundaries. "La Noche" and the ticket list use a strict `1fr 1fr` grid above 860px that collapses to one column below. Density is deliberately uneven: tight row padding in the Entradas list and the checkout form grid, generous 96px+ vertical padding everywhere else (140px at the top of the hero).

## Elevation & Depth

Flat, full stop. No shadows, no glows, anywhere in this system — depth comes only from contrast between the three near-black surfaces (`#090909` page / `#141414` panel / `#1A1A1A` field) and from the hairline rule that separates them.

### Named Rules
**The No-Shadow Rule.** If a boundary is needed, it's a 1px `rgba(255,40,0,0.18)` hairline — never a shadow, glow, or elevation trick.

## Shapes

Everything is a sharp rectangle. There is no radius token in this system — buttons, inputs, tier rows, photo frames, the countdown grid: all hard 90° corners. The only non-rectangular marks are the hairline dividers and the marquee's endless horizontal scroll.

### Named Rules
**The Zero-Radius Rule.** No `border-radius` appears anywhere in this system. A rounded corner is a tell that a component regressed to the retired collage system.

## Components

### Buttons
- **Shape:** sharp rectangle, no radius, uppercase label, letter-spacing 0.3em.
- **Dark:** black fill, warm-white text — the default hero/header CTA.
- **Primary (red):** red fill, near-black text — the paid action (pay button, scrolled-state nav CTA).
- **Hover:** red buttons brighten to Amber Flare; dark buttons darken slightly and their text turns Amber Flare.

### Tier Rows (signature component)
Each ticket tier is a full-width, borderless row (not a card) with a hairline rule below it: an index number, a price in Unbounded, the tier name and access-hours note, and a "Seleccionar" tag on the right that becomes "Seleccionado ✓" and turns red when active. Clicking a row expands the one shared checkout panel directly beneath the list — never a modal.

### Checkout Panel
One shared panel below the tier list, `#141414` on `#090909`, opened by whichever tier is selected. Inputs are sharp-cornered `#1A1A1A` wells with a hairline border that turns red on focus. The four original fields (Nombre/Apellido/Email/DNI) carry no visible label, relying on placeholder text plus an `aria-label` for assistive tech; the phone and date-of-birth fields added for backend compliance follow the same well styling, and the date field alone carries a small visible micro-label since browsers don't render placeholder text inside native date inputs.

### Countdown
No boxes, no borders — four flat Unbounded numerals in a 4-column grid divided by hairlines, each with a small red uppercase label beneath it. The seconds digit alone is Amber Flare, the one warm accent in an otherwise red-and-white block.

### Photography
Two real photographs (hero, dancefloor), always dimmed: the hero photo sits at `multiply` blend and 50% opacity under the red hero background; the dancefloor photo carries a bottom-up black gradient so its caption stays legible. Both move on a slow parallax offset tied to scroll position.

### Marquee
A single continuous horizontal ticker survives from the old system, now inside the hero itself rather than a separate top bar: uppercase Unbounded/DM Sans mix at 11px, on a semi-transparent black strip over the red hero.

## Do's and Don'ts

### Do:
- **Do** keep every corner sharp — no `border-radius` anywhere in this system.
- **Do** treat Amber Flare (`#FF9A00`) as a hover/active state only, never a resting fill.
- **Do** dim real photography (multiply blend, gradient shade) rather than showing it at full brightness — it's atmosphere, not the subject.
- **Do** use hairline rules (`rgba(255,40,0,0.18)`, 1px) as the only boundary/depth device; never a shadow or glow.

### Don't:
- **Don't** reintroduce yellow (`#FFC700`) or the old orange (`#FD5400`) as a system color — Signal Red (`#FF2800`) is the only primary ink now.
- **Don't** round a corner. A rounded button or card is a regression to the retired collage system.
- **Don't** stack more than one accent hue on a screen — Signal Red plus its own hover state is the entire palette besides neutrals.
- **Don't** add scroll-triggered motion beyond parallax position and one-time reveal fades; both must fall back to a static, non-moving state under `prefers-reduced-motion`.

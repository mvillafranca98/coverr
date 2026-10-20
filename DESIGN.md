---
name: "Coverr"
description: "Warm, plain and unfussy — a paper ticket in a dark room, with one amber accent"
colors:
  primary: "#F0A03C"      # main actions and links
  on-primary: "#100C06"   # text and icons on primary (9.10:1)
  secondary: "#FFFFFF"    # secondary buttons, tags, quieter UI (light theme)
  accent: "#A8540E"       # accent as *text* on light, where #F0A03C cannot reach AA
  background: "#FBF8F2"   # page background
  surface: "#FFFFFF"      # cards, sheets, inputs
  text: "#1A1714"         # body text (16.84:1 on background, 17.85:1 on surface)
  text-muted: "#5C554C"   # secondary text (6.93:1)
  border: "#D9D1C4"       # input and control borders
  divider: "#EAE3D7"      # subtle separators (decorative)
  error: "#A3301F"
  success: "#1F6B42"
typography:
  display:
    fontFamily: "system-ui"
    fontSize: 2.6rem
    fontWeight: 750
    lineHeight: 1.1
  h1:
    fontFamily: "system-ui"
    fontSize: 1.75rem
    fontWeight: 750
    lineHeight: 1.2
  h2:
    fontFamily: "system-ui"
    fontSize: 1.05rem
    fontWeight: 650
    lineHeight: 1.3
  body-md:
    fontFamily: "system-ui"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "system-ui"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace"
    fontSize: 0.69rem
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px 20px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px 20px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
---

## Overview
- **Style:** Flat, typographic, no ornament. Content sits on plain surfaces separated by hairlines rather than shadows. One amber accent carries every action; nothing else competes for attention.
- **Feel:** warm, plain, unfussy
- **Themes:** light and dark — but not as a user preference. **The surface is chosen by audience, not by toggle.**
- **Motion:** none, with exactly one exception — the landing page. See *Motion and the landing page* below. `prefers-reduced-motion` is honoured in every stylesheet.
- **Accessibility:** WCAG AA in both themes — 4.5:1 for body text, 3:1 for large text and controls. Every pair in this file was computed, not estimated; the table under **Colors** carries the numbers.
- **Reference:** none. Tokens derived from the product's own existing stylesheets.

## Two surfaces, one palette

Coverr is used in two very different rooms, and that — not personal preference — decides the theme.

**Light is for buyers.** The buy page and the ticket page get opened outdoors, in a queue, on a cracked phone at midday, and the ticket page is the one thing that must be readable when someone is holding it up at a door. Light also prints, and a QR on white scans more reliably than a QR inverted on near-black.

**Dark is for the band.** The dashboard and the door scanner are used at night, on stage-side, in a dark venue, often for hours. A dark surface is kinder there and doesn't blow out anyone's night vision at the door.

Same token names in both. A component written against `--text` and `--surface` works on either surface without knowing which it is on.

## Colors

| Token | Light (buyer) | Dark (band) | Contrast on its background |
|---|---|---|---|
| `--bg` | `#FBF8F2` | `#0F0E0B` | — |
| `--surface` | `#FFFFFF` | `#181510` | — |
| `--text` | `#1A1714` | `#F4F0E8` | 16.84 / 16.98 |
| `--muted` | `#5C554C` | `#A69D8F` | 6.93 / 7.21 |
| `--dim` | `#675F52` | `#8E8679` | 5.94 / 5.36 |
| `--accent` | `#F0A03C` | `#F0A03C` | fills only — see below |
| `--accent-text` | `#A8540E` | `#F0A03C` | 5.03 / 9.01 |
| `--accent-ink` | `#100C06` | `#100C06` | 9.10 on `--accent` |

**The accent splits in two, and this is the rule most easily got wrong.** `#F0A03C` on a light background is **2.02:1** — nowhere near readable. It is a *fill* colour on light: use it behind `--accent-ink`, never as text. For links and accented text on light, use `--accent-text` (`#A8540E`, 5.03:1). On dark the amber reaches 9.01:1 on its own, so both tokens collapse to the same value there.

**`--dim` was failing and has been corrected.** The shipped values (`#7A7367` light-equivalent, `#756E63` dark) measure 4.43 and 3.83 against their backgrounds — below AA. `--dim` is used for the small uppercase mono labels on stat cards and table headers, which is body-size text, so 4.5:1 applies. The values above are the corrected ones.

## Typography
System stack only — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial` for prose and `ui-monospace, SFMono-Regular, Menlo, Consolas` for data. Two families, both already on the device.

No webfont is loaded and none should be. Buyers open these pages on venue wifi moments before paying; a font request that blocks text is a worse cost than any gain in character. Monospace is reserved for things you read as *data* rather than prose — order codes, account numbers, money in tables, timestamps, and the small uppercase labels.

Money is always tabular (`font-variant-numeric: tabular-nums`) so columns line up and a changing total doesn't jitter.

## Layout
Single column throughout. Buyer pages cap at 480px — they are phone-first and nothing in them benefits from width. Admin pages cap at 980px because tables need it. Gutters are 18–20px.

The buyer flow is numbered steps (`01`–`05`) stacked vertically, never a wizard with hidden state: someone who leaves for their banking app mid-purchase comes back to the same scroll position with everything still filled in.

Breakpoints are incidental. The only one that matters is the table scroll container on admin; everything else is fluid.

## Elevation & Depth
Hairline borders, not shadows. `--line` separates, `--line-2` outlines anything interactive. There is no blur, no glass and no layered shadow anywhere, so there is nothing to provide a fallback for.

Depth is communicated by surface change — `--surface` sits on `--bg`, `--surface-2` sits on `--surface` — not by elevation.

## Shapes
`sm: 4px` for chips and tags, `md: 8px` for buttons and inputs, `lg: 12px` for cards and panels, `full` for nothing currently. No icon set is installed; the few glyphs in the product are text characters (`−`, `+`, `✓`, `!`). Keep it that way unless a real need appears — an icon font or SVG sprite is a dependency and a download.

## Components
Buttons, inputs and cards are defined in the front matter. Three states carry every message in the product and they are the same in both themes:

- **ok** — green, a clean scan or a confirmed order
- **warn** — amber, a flag that needs a human but does not block anyone
- **crit** — red, a duplicate scan or a voided order

**Amber must always name its reason on screen.** A door flag that says only "revisar" has failed: staff resolving it in five seconds is the point, staff phoning the admin is the failure.

Loading, empty and error states: most screens are server-rendered and arrive complete, so there is no loading state to design. Empty states are written out ("Nada que mostrar con ese filtro"), and errors render in the page as a `note crit` block rather than as an alert or a bare status code.

## The landing page

The landing page (`/`) is the single surface allowed decoration, motion and webfonts.
Everything else — the buy page, the ticket page, recovery, refunds, the admin and the
scanner — stays still, ships no animation library and loads no font file.

The split is not taste, it is who is reading. The restrictions exist because a buyer
opens `/e/:slug` on venue wifi with a transfer half-made, and a blocked render there
costs a sale. A band deciding whether to trust Coverr with their gig is on a sofa.

### Type

Taken from the Comport/Comseid house style, because the first version of this page had
no typographic voice and read like every other gradient-and-glass landing page. The
system, not the assets: no logo, image or line of copy came from those sites.

| Role | Face | Use |
|---|---|---|
| Display | **Space Grotesk**, weight 500–700, tracking −.02 to −.035em | `h1`, `h2`, `h3`, prices, button labels |
| Accent | **Instrument Serif**, *italic*, 400, 1.1em | One phrase inside a heading — `<em>` |
| Body | system sans | Paragraphs |
| Micro | system mono, uppercase, .14–.2em tracking | Eyebrows, `/ 01` indices, table heads, the utility strip |

The italic serif inside the sans heading is the device the page hangs on. It is set a
touch larger because the face runs small, and given back its own tracking because the
sans is tightened hard and the serif should not be. One phrase per heading — two is a
mannerism.

Both faces are OFL, self-hosted in `public/vendor/fonts/` as Latin woff2 subsets
(~43 KB together) with `font-display:swap`. Self-hosted, not from a CDN, so the CSP
stays `'self'` and no third party learns who reads this page.

### Structure

The house style's devices, kept: the hairline utility strip, the bordered marquee, the
hairline-gap grid (cells on a line-coloured bed with 1px gaps, so no border doubles at
a join), `/ 01` mono indices, the outlined wordmark in the footer.

Two deliberately not taken:

- **The stats band.** Comport can say "85+ obras" because it is true. Coverr has had
  one real order, and a fabricated count is barred by the repo's own rules.
- **A pulsing "live" dot.** Nothing on this page is live. A status light that reports
  nothing is decoration dressed as information.

### Product shots

Three screens on `/`, captured by `npm run shots` (`scripts/shoot.mjs`). Never by hand:
hand-captures cannot be repeated, and the browser pane caps resolution at its own width.

The rig drives the Chrome already on the machine through `playwright-core`, so nothing
downloads a second browser. It re-applies `seed/demo.sql` first, so every run starts from
the same 151 checked in rather than one more each time, and captures at
`deviceScaleFactor: 2` — a 1x capture of a 1360px viewport is soft the moment it is
displayed at any size. WebP encoding happens in that same browser via canvas, rather than
in another dependency.

Each surface is shot at the device it is used on, which is why the shapes differ: the
dashboard is a laptop (a band doing the accounts after the gig) and leads full width, the
scanner and the ticket are phones and sit beneath it. Shooting the scanner at 1360px wide
would be a picture of something nobody sees.

Two rules:

- **The data is fabricated and the page says so.** `seed/make-demo.mjs` invents the band,
  the venue, 89 orders and every figure. Publishing a real band's takings, with real
  buyers' names in the orders list, is not a thing to do for a marketing image.
- **Crop heights are measured, not guessed.** Cutting through a table header reads as a
  broken screenshot rather than a cropped one.

### Motion

- **GSAP + ScrollTrigger**, vendored in `public/vendor/` like `jsQR.js` already is.
  45 KB gzipped, `defer`. Staggered rise on load, batched reveal on scroll.
- The marquee is **CSS**, not GSAP, so it runs with no JavaScript at all.

Three rules hold, each because getting it wrong broke something real:

1. **Decoration never hides content.** Every reveal is a `gsap.from`, so the page
   renders complete without JavaScript and stays complete if a script fails. Nothing in
   the stylesheet sets `opacity:0`. The Comseid mockup shows the alternative: `.js
   .reveal{opacity:0}` with 18 of 20 elements never revealed, and a blank page.
2. **Background decoration must not sit under body text.** An earlier version put a
   fixed amber aurora behind the page; fixed keeps the glow in the viewport, so every
   paragraph eventually scrolls under its brightest point and `--muted` measured
   **3.96** against a 4.5 floor. The aurora is gone. If one ever returns, anchor it to
   the document so it scrolls away, and cap its alpha at what the dimmest ink on it
   survives.
3. **`prefers-reduced-motion` disables all of it**, not a gentler version.

## Do's and Don'ts
- **Do** pick the surface by audience: light for anything a buyer sees, dark for anything the band sees.
- **Do** use `--accent-text` for accented text on light. `--accent` is a fill.
- **Do** keep money tabular and monospaced.
- **Do** compute contrast when adding a colour. Every number in this file is measured.
- **Don't** add a webfont, an icon set or an animation library to anything but `/`.
- **Don't** add a second animation library, ship lorem ipsum, or invent testimonials, logos or stats.
- **Don't** load a third webfont. `/` has four type roles but only two loaded faces; the other
  two are the system sans and system mono, which cost nothing. Everywhere else is system-only.

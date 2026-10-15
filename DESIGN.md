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
- **Motion:** none. There is no animation library in this project and there should not be one. The only motion rule that applies is `prefers-reduced-motion`, already honoured in both stylesheets.
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

## Do's and Don'ts
- **Do** pick the surface by audience: light for anything a buyer sees, dark for anything the band sees.
- **Do** use `--accent-text` for accented text on light. `--accent` is a fill.
- **Do** keep money tabular and monospaced.
- **Do** compute contrast when adding a colour. Every number in this file is measured.
- **Don't** add a webfont, an icon set or an animation library.
- **Don't** add a second animation library, use more than two font families, ship lorem ipsum, or invent testimonials, logos or stats.

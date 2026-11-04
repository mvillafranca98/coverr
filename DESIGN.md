---
name: "Coverr"
description: "Neo-brutalist stickers: flat colour, black outlines, hard shadows, one heavy face"
colors:
  primary: "#FF6EC7"      # the main call to action on light surfaces
  on-primary: "#111111"   # text on primary (7.47:1)
  secondary: "#FFFFFF"    # secondary buttons, cards, inputs
  accent: "#FFD43B"       # highlighter, selected states, the mark (ink on it: 13.25:1)
  background: "#FFF4DE"   # page background, light surfaces
  surface: "#FFFFFF"      # cards, sheets, inputs
  text: "#111111"         # body text and every outline (17.31:1 on background)
  text-muted: "#3B372F"   # secondary text (10.85:1 on background)
  border: "#111111"       # 3px on cards and controls; the outline is the style
  error: "#B0102A"        # 6.52:1 on background
  success: "#145C33"
typography:
  display:
    fontFamily: "Archivo Black"
    fontSize: 4.25rem
    fontWeight: 400
    lineHeight: 1.16
  h1:
    fontFamily: "Archivo Black"
    fontSize: 2.2rem
    fontWeight: 400
    lineHeight: 1.05
  h2:
    fontFamily: "Archivo Black"
    fontSize: 1.35rem
    fontWeight: 400
    lineHeight: 1.15
  body-md:
    fontFamily: "system-ui"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "system-ui"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace"
    fontSize: 0.69rem
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: 8px
  md: 12px
  lg: 18px
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
    typography: "{typography.h2}"
    rounded: "{rounded.md}"
    padding: 16px 24px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.text}"
    typography: "{typography.h2}"
    rounded: "{rounded.md}"
    padding: 16px 24px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 13px 14px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
---

## Overview
- **Style:** neo-brutalist. Flat sticker colour, heavy outlines, hard shadows with no blur, one chunky display face. Everything on screen is drawn like a sticker you could peel off: the ticket, the buttons, the chips, the cards.
- **Feel:** loud, DIY, friendly — a zine or a gig flyer, not a bank.
- **Signature:** the ticket. The lime stub with a black head band and a dashed perforation is the hero of the landing page, the header of the buy page, what the buyer receives, the image they share, and the brand mark itself.
- **Themes:** light and dark — but not as a user preference. **The surface is chosen by audience, not by toggle.**
- **Motion:** none, with exactly one exception — the landing page. See *The landing page* below. `prefers-reduced-motion` is honoured in every stylesheet.
- **Accessibility:** WCAG AA on both surfaces — 4.5:1 for body text, 3:1 for large text and controls. Every pair in this file was computed, not estimated.
- **Reference:** the neo-brutalist web style (Gumroad is the best-known example), chosen from a board of six directions. The style, not the assets: no logo, image or line of copy came from any site.

## Two surfaces, one palette

Coverr is used in two very different rooms, and that — not personal preference — decides the theme.

**Light is for buyers.** The buy page and the ticket page get opened outdoors, in a queue, on a cracked phone at midday, and the ticket page is the one thing that must be readable when someone is holding it up at a door. Light also prints, and a QR on white scans more reliably than a QR inverted on near-black.

**Dark is for the band.** The dashboard and the door scanner are used at night, stage-side, in a dark venue, often for hours. A dark surface is kinder there and doesn't blow out anyone's night vision at the door.

Coverr's own back office, `/operador`, is staff-facing like the band panel, so it wears the same dark surface and stylesheet — under a bar that reads "Coverr · operación" rather than a band's name, so someone signed in as both never mistakes one for the other.

Same token names on both. The style flips with the surface: on light, outlines and shadows are black; on dark, outlines are cream and the hard shadows take the sticker colours, because a black shadow vanishes on a black page.

## Colors

The four sticker colours are shared by both surfaces and live in `src/styles/tokens.css`. **Each one carries black ink, never light text.** That single rule is what keeps a loud palette readable.

| Sticker | Hex | Black ink on it |
|---|---|---|
| `--pink` | `#FF6EC7` | 7.47 |
| `--yellow` | `#FFD43B` | 13.25 |
| `--lime` | `#B8F35A` | 14.39 |
| `--blue` | `#4D7CFE` | 5.06 — the tightest; never put grey text on it |

| Token | Light (buyer) | Dark (band) | Contrast on its background |
|---|---|---|---|
| `--bg` | `#FFF4DE` | `#141414` | — |
| `--surface` | `#FFFFFF` | `#1D1D1D` | — |
| `--text` | `#111111` | `#FFF4DE` | 17.31 / 16.88 |
| `--muted` | `#3B372F` | `#CFC6B3` | 10.85 / 9.94 (on surface) |
| `--dim` | `#57524A` | `#A8A091` | 7.10 / 6.50 (on surface) |
| `--line-control` | `#111111` | `#FFF4DE` | the outline itself — 17.31 / 15.45 |
| `--ok` (text) | `#145C33` | `#B8F35A` | 6.14 on lime / 14.04 |
| `--crit` (text) | `#B0102A` | `#FF8FA3` | 6.52 / 8.52 |

More pairs, measured the same way:

| Pair | Ratio |
|---|---|
| Buy page account card: `#FFF4DE` / `#CFC6B3` on `#111111` | 17.31 / 11.13 |
| Lime head band text on black (ticket, flyer) | 14.39 |
| Placeholder `#6A6458` on white | 5.87 |
| Blue focus ring on cream (3:1 floor, it is an outline) | 3.42 |
| Band `--muted` on a hovered table row `#272727` | 8.81 |
| Scanner ink `#04120A` on scanner green `#2BA35F` (landing drawing) | 5.94 |
| Door scanner: ink on the valid, amber and refused panels (lime, yellow, `#FF8FA3`) | 14.39 / 13.25 / 8.73 |
| Door scanner: ink on the white box that holds an amber result's reason | 18.88 |
| Door scanner: `--dim` on a disabled row button `#272727` / as placeholder on the input well `#0E0E0E` | 5.76 / 7.45 |
| Door scanner: lime and yellow hint text on `--bg` | 14.04 / 12.92 |
| Email: fine print `#57524A` on cream | 7.10 |
| Email: flag code `#B0102A` on `#FFD6DF` | 5.40 |
| Email: cream stack trace on black | 17.31 |

The door scanner (`public/scanner.css`) and the emails (`src/views/email.ts`) use this same palette, restated in their own files: the scanner because its service worker precaches it as a standalone file, the emails because a mail client keeps nothing but inline styles. The scanner is the band's dark surface. Every mail is the light one, including those sent to the band, since a mail client's dark mode cannot be relied on to leave a dark design alone.

Lime and yellow measure **1.09** against each other — the same lightness — so a red-green colour-blind eye can take a valid scan for an amber one. The scanner never leans on the fill alone: each verdict stamps a glyph on the panel (✓, !, ✕), and the amber panel is the only one carrying a boxed reason and two buttons.

## Typography
Three roles, one of them a webfont:

| Role | Face | Use |
|---|---|---|
| Display | **Archivo Black**, 400 (its only weight), tracking −.02 to −.04em | Headings, stat numbers, buttons, the ticket, prices |
| Body | system sans — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial` | Paragraphs, form fields |
| Data | system mono — `ui-monospace, SFMono-Regular, Menlo, Consolas` | Order codes, account numbers, money in tables, the small uppercase labels and chips |

**Archivo Black is the one webfont, on every page but the door scanner.** OFL, from `@fontsource/archivo-black` 5.3.0, Latin subset, 18.6 KB, self-hosted in `public/vendor/fonts/` so the CSP stays `'self'`. It is preloaded by each layout and set `font-display: swap`, so text paints at once in the system sans and swaps when the font lands. **Nothing ever waits on it** — that is the reason the product once loaded no fonts at all, and it still binds. One heavy weight is the whole display system; there is no second face.

**The door scanner stays system-only**: it must open at a venue with no signal, and its service worker precaches an explicit file list the font is not on. Its headings take the system sans at weight 900 instead. The emails load no font either, and do the same.

Headings that box a phrase in a sticker (`<em>`) need line-height around **1.16–1.24**: the box is as tall as the font's whole line, and anything tighter lets it cover the descenders of the line above. The boxed phrase is `white-space: nowrap` — it is always two or three words and should never split across lines.

One fluid type scale (`--step--1` … `--step-5`, in `src/styles/tokens.css`) is shared by every surface. Money is always tabular (`font-variant-numeric: tabular-nums`) so columns line up and a changing total doesn't jitter.

## Layout
Single column throughout. Buyer pages cap at 520px — they are phone-first and nothing in them benefits from width. Admin pages cap at 980px because tables need it. The landing page caps at 1200px. Gutters are 18–32px.

The buyer flow is numbered steps (`01`–`05`) stacked vertically on a dashed rail, never a wizard with hidden state: someone who leaves for their banking app mid-purchase comes back to the same scroll position with everything still filled in.

Breakpoints are incidental. The only one that matters is the table scroll container on admin; everything else is fluid.

## Elevation & Depth
Depth is a **hard shadow**: offset down and right (`--lift` 5px, `--lift-lg` 9px), no blur, in black on light and in a sticker colour on dark. No soft shadows, no blur, no glass, no gradients, no texture anywhere — the style is flat on purpose, and flat is also cheap to paint on an old phone.

Things that can be pressed show it: a button lifts a couple of pixels on hover and, on click, moves into its own shadow until the shadow is gone. A plain text link gets the highlighter on hover instead: sticker yellow behind the word, black ink on it. Hover effects sit behind `@media (hover: hover)` on the buyer and band surfaces, because on a phone `:hover` sticks after a tap and leaves a button floating.

## Shapes
`sm: 8px` for chips and tags, `md: 12px` for buttons and inputs, `lg: 18px` for cards and panels, `full` for pills and stickers. Outlines are 3px on light and 2px on dark (a 3px cream line on black reads heavier than a 3px black one on cream). No icon set is installed; the few glyphs are text characters (`−`, `+`, `✓`, `✕`, `↑`, `✳`, `→`). Keep it that way unless a real need appears.

**The ticket shape** — a black head band, a dashed perforation with a notch cut into each edge, a white stub below for the QR — is the product's one recurring object. On the landing page the notches are real holes (a CSS mask), so whatever is behind shows through; on the buyer pages and in the downloadable image they are circles of the page colour ringed in ink.

## The mark
A ticket stub, notched on both sides, whose right-hand notch opens a C: yellow `#FFD43B`, a heavy black outline, a black C — a sticker. Its colours are fixed rather than themed, so it looks the same on both surfaces. It lives as inline SVG in `src/views/brand.tsx` (`Monogram`, `Wordmark`), so it costs no request; the wordmark pairs it with "coverr" set in Archivo Black as real text.

Every brand image is generated from it by `npm run brand` (`scripts/brand.mjs`): the SVG and 32px favicons, the 180px Apple touch icon, the 192 and 512 PWA icons plus a maskable 512 for the scanner's manifest, and two 1200×630 share cards: `og.png` for the landing page, pitched to bands, and `og-event.png` for event links, written for the buyer who opens them. The event card is composed around its middle 630px square, because WhatsApp on a computer shows a small square cut from the centre: the mark and "Comprá tu boleto" sit there, and the sides only decorate. When it is redrawn, bump the `?v=` on its address in `src/views/layout.tsx`, since apps cache preview images by address. Never draw them by hand; change the mark in both files and regenerate.

## Components
Buttons, inputs and cards are defined in the front matter. Three states carry every message in the product, as solid stickers with black ink:

- **ok** — lime, a clean scan or a confirmed order
- **warn** — yellow, a flag that needs a human but does not block anyone (the door scanner's "amber" result)
- **crit** — pink-red, a duplicate scan or a voided order

**A warning must always name its reason on screen.** A door flag that says only "revisar" has failed: staff resolving it in five seconds is the point, staff phoning the admin is the failure.

On the band surface a flag is the brightest thing on a dark screen on purpose: notes and chips are filled, not tinted.

Loading, empty and error states: most screens are server-rendered and arrive complete, so there is no loading state to design. Empty states are written out ("Nada que mostrar con ese filtro"), and errors render in the page as a `note crit` block rather than as an alert or a bare status code.

The ticket a buyer downloads or shares is drawn in their browser by `src/views/confirm/ticket-script.ts`, in the same style as the page: lime stub, Archivo Black name, chips, perforation, the QR integer-scaled on white with crop marks, the code on a yellow chip. It waits for the display face before drawing, or the saved image would keep the fallback font.

## The landing page

The landing page (`/`) is the single surface allowed motion and an animation library.
Everything else — the buy page, the ticket page, recovery, refunds, the admin and the
scanner — stays still.

The split is not taste, it is who is reading. A buyer opens `/e/:slug` on venue wifi
with a transfer half-made, and a blocked render there costs a sale. A band deciding
whether to trust Coverr with their gig is on a sofa.

### Structure

Top to bottom: a sticky nav (the mark in a yellow sticker, pill links, a pink call to
action); the hero — headline with *nadie más* on a yellow sticker, two rotated chips
above it, the lime ticket on a pink disc with a blue "¡QR al instante!" sticker on its
corner; two strips of tape crossed over the page, scrolling opposite ways; *Lo que
estás haciendo hoy*, four habits on white cards, each struck out in pink as it scrolls in
(pink, not ink: a black bar through black heavy type made the line unreadable on a phone);
*Directo a tu cuenta*, the transfer going from buyer to the band's account with
Coverr beside the path, never on it; the four steps as yellow, pink, lime and blue
cards, each with a small HTML drawing of its screen; the product shots in white device
frames; the price brackets as ticket stubs, led by a pink "Tu primer evento" stub that names the
offer's last day, wears a blue "¡Oferta limitada!" sticker on its corner and disappears once
the offer has passed, with a lime note while billing is
switched off (the route reads the switch, as the terms do); a closing yellow card; a black footer with
a giant yellow wordmark running off the bottom.

The headline is capped at 68px so it sets in four lines and the buttons under it stay on
screen down to a 1366×768 laptop. The lede names all three jobs — presale, the door and
the split at the end of the night — because a reader who only skims the hero should still
know what Coverr does.

The hero ticket shows one of six invented shows (`src/views/demo-shows.ts`), picked again
on every visit so the joke changes on refresh, and says it is an example in its caption.
The product shots further down show the same show. Every name is short enough that the
ticket keeps the height it had with the old demo band at 375, 1024, 1366 and 1920 px, so a
different show never moves the hero; "Prueba de Sonido", "Azotea del Primo", "Garaje
Prestado" and "Techo de Lámina" each grew it by a line and were replaced. Its QR is real
and encodes the site's own address.

Two things deliberately absent:

- **A stats band.** Coverr has had one real order, and a fabricated count is barred by
  the repo's own rules.
- **A pulsing "live" dot.** Nothing on this page is live. A status light that reports
  nothing is decoration dressed as information.

### Product shots

Three screens on `/`, captured by `npm run shots` (`scripts/shoot.mjs`). Never by hand:
hand-captures cannot be repeated, and the browser pane caps resolution at its own width.

There is a set per invented show, saved as `<shot>-<show key>.webp`: eighteen files, of
which a visit loads three. Before each set the rig reseeds the demo and renames it to that
show, and it refuses a show whose names wrap or are cut off, because every crop below
assumes they sit on one line. `tests/demo-shows.test.ts` fails while any show is missing a
file.

The rig drives the Chrome already on the machine through `playwright-core`, so nothing
downloads a second browser. It re-applies `seed/demo.sql` first, so every run starts from
the same 151 checked in rather than one more each time, and captures at
`deviceScaleFactor: 2` — a 1x capture of a 1360px viewport is soft the moment it is
displayed at any size. WebP encoding happens in that same browser via canvas, rather than
in another dependency.

Each surface is shot at the device it is used on, which is why the shapes differ: the
dashboard is a laptop (a band doing the accounts after the gig) and leads full width, the
scanner and the ticket are phones and sit beneath it. On a phone the laptop screen would
shrink past reading, so below 600px its frame shows only the dashboard's own column, from
the header to the live numbers, about 1.4 times larger.

The scanner is shot first. It checks one person in, and the dashboard taken after it has
to count that person, or the two pictures disagree by one.

Two rules:

- **The data is fabricated and the page says so.** `seed/make-demo.mjs` invents the band,
  the venue, 89 orders and every figure. Publishing a real band's takings, with real
  buyers' names in the orders list, is not a thing to do for a marketing image. The names
  on screen follow the same rule: every band, event and venue is made up, and none may be
  one a San Pedro Sula or Tegucigalpa audience could tie to a real one. The person on the
  ticket and the one at the door are famous musicians — an obvious joke, not a claim.
- **Crop heights are measured, not guessed.** Cutting through a table header reads as a
  broken screenshot rather than a cropped one. The dashboard crops at 914 (its income
  table ends at 895, the next heading starts at 933, on a 1360×960 viewport); the ticket
  frames one whole stub, its hard shadow included, from 390 to 1144.

### Motion

- **GSAP + ScrollTrigger**, vendored in `public/vendor/` like `jsQR.js` already is.
  45 KB gzipped, `defer`. On load the headline pops up word by word and the ticket is
  slapped onto the stage, unwinding its tilt as it lands (`back.out`: stickers bounce).
  After that the ticket bobs, its sticker wobbles, and on a real pointer it tilts toward
  the cursor. On scroll: batched reveals, the habits struck out, the accounts drawing's
  bars filled, and the device frames drifting at their own speed — wide screens only,
  since on a phone parallax reads as jitter. The free tier's "¡Oferta limitada!" sticker
  is slapped on once, just after its card arrives, and then stays still: a looping
  blink was considered and turned down, because it reads as an ad and WCAG 2.2.2 would
  need a way to stop it. The sticker reaches no further into the card than its 20px of
  top padding, checked clear of the label, price, caption and next card from 375 to
  1920 px. Anything a keyboard user tabs to is shown at
  once, without the animation: focus on something still hidden is focus nobody can see.
- The tape strips, the money diagram's moving coin and the buttons' press are **CSS**,
  so they work with no JavaScript at all.

Three rules hold, each because getting it wrong broke something real:

1. **Decoration never hides content for good.** Reveal start states are scoped to a
   `.js-reveal` class that a guard script in `<head>` adds, along with a deadman timer
   that strips it again two seconds later unless the motion script reports in. Scripts
   blocked, a 404 on the vendor bundle, a parse error — every one ends with a complete
   page, not a blank one. See `src/views/landing/motion.ts`.
2. **Nothing decorative sits under body text.** An earlier version put a fixed glow
   behind the page and `--muted` measured 3.96 against a 4.5 floor. The current style
   has no glow at all; keep it that way.
3. **`prefers-reduced-motion` disables all of it**, not a gentler version.

## Do's and Don'ts
- **Do** pick the surface by audience: light for anything a buyer sees, dark for anything the band sees.
- **Do** put black ink on every sticker colour. Never light text on pink, yellow, lime or blue.
- **Do** give anything you can press a hard shadow and a press state.
- **Do** keep money tabular and monospaced.
- **Do** compute contrast when adding a colour. Every number in this file is measured.
- **Don't** add soft shadows, blur, gradients, glass or texture. Depth here is a hard offset.
- **Don't** add an icon set or a second animation library, or any animation outside `/`.
- **Don't** load a second webfont. Archivo Black plus the system sans and mono is the whole type system; the scanner loads none.
- **Don't** ship lorem ipsum or invent testimonials, logos or stats.

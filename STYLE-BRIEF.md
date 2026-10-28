# Style brief — Coverr visual overhaul

This is a **presentation-only** change. Nothing about how the product works changes: no
route, no query, no job, no verification rule, no money arithmetic. If you find yourself
opening a file outside the allowed list below, stop and say so instead.

Work in two passes. Pass 1, the plumbing, is done — see below. Pass 2 is the redesign.

---

## Pass 1 — done

The CSS lives in real files and still reaches the browser inlined in the HTML, never as a
second request.

| File | Inlined by | Styles |
|---|---|---|
| `src/styles/buyer.css` | `src/views/layout.tsx` | buyer surface (light) |
| `src/styles/admin.css` | `src/views/admin/layout.tsx` | band surface (dark) |
| `src/styles/legal.css` | `src/views/legal/doc.tsx` | legal prose — emitted *after* buyer.css, and that order is load-bearing |
| `src/styles/landing.css` | `src/views/landing/page.tsx` | the marketing page |
| `public/scanner.css` | linked by the scanner | unchanged — a static asset because the service worker precaches it |

The mechanism is a Text module rule in `wrangler.jsonc`: `import css from "…/x.css"` yields
the file's text, bundled into the Worker. `src/css.d.ts` types it. Rendered HTML was
diffed against a pre-change baseline on six pages and is identical, apart from each
`<style>` no longer opening on a blank line and the landing sheet carrying its design note
as a leading comment.

Deliberately left for pass 2:

- **No `tokens.css` yet.** The buyer and band palettes share token names but not values,
  so they cannot live in one file without a surface selector in the markup. Create
  `tokens.css` in pass 2 for what is genuinely shared — the type scale, the display face,
  spacing, radii, `--sans`, `--mono` — and compose it ahead of each surface sheet
  (`tokens + buyer`, `tokens + admin`). The palettes stay in their surface files.
- **Biome does not cover the CSS yet.** Turning it on reformats every line of all four
  files and flags 9 deliberate `!important`s (`[hidden]`, reduced motion, `.invalid` — each
  has a reason) plus 5 `noDescendingSpecificity` hits on intentional cascade order. In
  pass 2, add `"src/**/*.css"` to `biome.json`, turn `lint/complexity/noImportantStyles`
  off, and format once while rewriting.

---

## Pass 2 — the visual direction

### What is wrong today, concretely

1. **No brand.** There is no wordmark, no favicon, no OG image, and
   `public/manifest.webmanifest` declares **no icons at all** — door staff who install the
   scanner to their home screen get a blank square. "Coverr" exists only as a word in mono
   caps.
2. **System-ui everywhere but `/`.** The landing page has a real typographic voice
   (Space Grotesk + Instrument Serif italic). The moment anyone clicks through, it
   evaporates. That discontinuity is the single loudest "unfinished" signal in the product.
3. **The ticket is a form receipt.** It is the one screen a buyer screenshots, keeps, and
   sends to four friends — the product's only organic distribution surface — and it is
   styled like a settings panel.
4. **The buy page has no rhythm.** Five numbered steps, every one weighted identically, so
   nothing tells the eye where it is in the flow.
5. **The dashboard is a spreadsheet.** Good numbers, zero hierarchy. "151 adentro" is the
   fact a band cares about at 11pm and it is the same size as everything around it.
6. **The hero wastes its fold.** On a 1280px screen the headline sits in the top third and
   the rest is empty until the marquee.

### The direction: "flyer and stub"

Not a new look — the landing page's voice, extended to the whole product, plus one real
piece of craft on the surfaces that matter. Gig flyers and paper tickets are the native
visual language of the thing Coverr replaces, and they are cheap to build honestly: type,
rules, overprint and texture, no photography and no illustration budget.

Keep the warm paper and the single amber. They are already distinctive and the contrast
work behind them is done. The "wow" comes from craft, not from a new palette.

#### Type

Promote **Space Grotesk** to the display face on every surface **except the door
scanner**. It is already self-hosted in `public/vendor/fonts/` and already subset, so this
costs one 22KB request that is then cached for the whole site.

The scanner stays system-only. It has to open at a venue with no signal, its service
worker precaches an explicit file list (`SHELL` in `public/sw.js`), and the verdict is
carried by colour, not type. Restyle its colours and spacing in `public/scanner.css` if
you like, but give it no new file to depend on.

- Display face: headings, stat numbers, button labels, the ticket, prices.
- Body: system sans, unchanged.
- Mono micro-labels: unchanged — they already work.
- **Instrument Serif italic stays on `/` only.** Bringing it to the ticket would double
  the font cost of a buyer page for a single phrase.
- Load it with `font-display: swap` and `<link rel="preload">` on the buy and ticket pages
  only. Text must paint immediately in system sans and swap — never block.
- Build a shared fluid type scale (`--step--1` … `--step-4`) in `tokens.css`, same shape as
  the landing page's, so the three surfaces finally agree on sizes.

**This relaxes a stated rule in `CLAUDE.md` and `DESIGN.md`** ("no webfonts except on the
landing page"). It is a deliberate, approved relaxation — but the reason behind the rule
still binds: nothing may block first paint. If you cannot hit that with a swap-and-preload
setup, keep the surface on system-ui and say so rather than shipping a blocking font.

#### Texture and depth

- One tileable SVG grain as an inline `data:` URI (under 2KB, no request), at 2–4% alpha
  over the buyer paper. This is the cheapest possible upgrade from "default white page" to
  "printed stock".
- Adopt the landing page's hairline-gap grid on admin cards: cells on a line-coloured bed
  with 1px gaps, so no border doubles at a join.
- Still no shadows, no blur, no glass. Depth stays surface-change plus hairline.

#### The ticket — the one piece of real craft

`src/views/confirm/page.tsx`, styled from `buyer.css`. Make it read as a printed stub:

- A real perforation: two half-circle notches cut into the card edges with
  `radial-gradient`, with the existing dashed rule between them. `.tk-perf` is already
  there as a flat dash — finish it.
- Band and event name in the display face, large.
- The date set big in mono, with the venue under it.
- The QR in a framed well on **true white** — not the paper tone. Scanning reliability
  beats styling here, and this is non-negotiable.
- The short code set as a stub number: mono, letterspaced, with a hairline box.
- An amber overprint bar across the head of the card carrying the event name.
- The whole thing should survive being screenshotted at phone width and still read at
  thumbnail size in a WhatsApp thread.

#### The buy page

- Step indices become real typographic markers (`/ 01`) matching the landing page.
- Step headings in the display face, so the five steps have a hierarchy.
- The bank grid becomes a proper segmented control; bank names in the display face.
- The account number card is the hero of the page: oversized mono number, the copy button
  as a full-width amber overprint bar beneath it.

#### The band surface

- Stat cards: display-face numbers at a size that reads across a dark room, mono labels
  above, on the hairline-gap bed.
- Thin progress bars under the cards, **built only from numbers already in `DashProps`**
  (`src/views/admin/dashboard.tsx`): adentro out of vendidos, and brazaletes used out of
  `wristbands.start`. The event's `capacityCap` is *not* passed to the dashboard today, so a
  capacity bar would mean changing the route — which is out of scope. Do not add it; list it
  as a follow-up instead.
- Tables: hairline, no zebra, sticky header inside the existing `.scroll` container.
- The dashboard genuinely is live, so an honest "actualizado 23:14" is fine. A pulsing dot
  that reports nothing is not — `DESIGN.md` already rejected one.

#### The landing page

Mostly working. Three fixes:

- Fill the fold: tighten the gap between headline and marquee so the first screen carries
  the hero, the sub and the first proof.
- Put the new wordmark in the utility strip and the footer, replacing the mono text.
- Ship the OG image.

### Assets to create

All of these are new files, all generated or hand-authored in-repo — nothing downloaded,
nothing traced from another product.

| Asset | Format | Notes |
|---|---|---|
| Wordmark | SVG | Full lockup plus a `C` monogram. Set in the display face, outlined to paths. |
| Favicon | SVG + 32px ICO fallback | Monogram on amber. |
| PWA icons | PNG 192, 512, plus a maskable 512 | `manifest.webmanifest` has none today — add them and wire them up. |
| OG image for `/` | 1200×630 PNG | Authored as SVG, rendered by a small script in `scripts/` next to `shoot.mjs`. Static, one file. |
| Paper grain | inline SVG data URI | In `tokens.css`, under 2KB. |
| Ticket furniture | CSS only | Perforation notches, stub box, overprint bar. |

**Do not** add an icon set, do not copy the six banks' logos (trademark, and the repo's own
rules bar lifting logos), and do not add stock photography — invented atmosphere shots of a
Honduran venue are both a licensing problem and a lie about the product. Type and texture
carry this.

### Hard constraints — these outrank anything above

- **Touch only:** `src/styles/**`, `src/views/**`, `public/scanner.css`,
  `public/manifest.webmanifest`, new asset files under `public/`, `scripts/` for the OG
  generator, `DESIGN.md`, `wrangler.jsonc` (the rules line only), `biome.json`.
  **Never:** `src/routes`, `src/lib`, `src/db`, `src/jobs`, `migrations`, `tests`.
- In the view files, change markup and class names only. No logic, no data flow, no new
  props that carry anything but presentation.
- **Recompute every colour pair you touch.** AA: 4.5:1 for body, 3:1 for large text and
  for any border that is the only thing identifying a control. `DESIGN.md`'s contrast table
  carries measured numbers, not estimates — keep it that way and update it.
- `--accent` (`#F0A03C`) is a **fill** on light, 2.02:1 as text. Accented text on light is
  `--accent-text` (`#A8540E`). This is the rule most easily got wrong here.
- No background decoration under body text. A fixed amber aurora was tried, pushed
  `--muted` to 3.96 against a 4.5 floor, and was removed. If one returns, anchor it to the
  document and cap its alpha at what the dimmest ink on it survives.
- `prefers-reduced-motion` disables motion entirely, not a gentler version.
- Any reveal animation is a `gsap.from`, never a stylesheet `opacity:0`. The page must
  render complete with JavaScript disabled or failed.
- Motion stays on `/` only. The buy page, ticket, admin and scanner stay still.
- The QR stays dark-on-white and the ticket keeps working in print.
- Amber always names its reason on screen.
- Money stays tabular mono and keeps going through `src/lib/core.ts`.
- The scanner must keep working offline. Its service worker fetches network-first and
  falls back to a precached `SHELL` list, so edits to `public/scanner.css` reach phones the
  next time they are online — but any *new* file the scanner depends on would be missing
  offline. Add none.
- No new runtime dependency. No second animation library, no icon font, no CSS framework.
- Copy stays Honduran Spanish, informal *vos*. If a layout change needs different words,
  propose them — do not translate or neutralise what is there.

### Done when

- Every surface has been looked at in a browser at 375px and at 1280px, in both the buyer
  and band themes.
- `npm run check` passes.
- `DESIGN.md` is updated: the new type roles, the webfont relaxation and its reasoning, the
  recomputed contrast table, and the ticket's construction.
- `docs/STANDARDS.md` gets its frontend item updated if anything there is affected.
- The product shots on `/` are regenerated with `npm run shots`, since every one of them is
  now out of date.
- No `TODO`, no commented-out CSS, no unused class left behind.

### Work in this order

1. ~~Pass 1~~ — done.
2. Tokens and type scale — the shared foundation.
3. The ticket. It is the highest-leverage surface; get it right before anything else.
4. The buy page.
5. The band surface.
6. The landing page and the brand assets.
7. Regenerate shots, update the docs.

Show me each surface before moving to the next one.

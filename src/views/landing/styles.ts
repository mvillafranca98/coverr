/**
 * The landing page's stylesheet.
 *
 * Lives apart from the markup because it is the larger half of the page and
 * the two change for different reasons — copy moves often, the visual system
 * rarely.
 *
 * The type system is lifted from the Comport/Comseid house style: a geometric
 * sans for display with an italic serif set inside the headline as the accent,
 * and monospace reserved for micro-labels, indices and data. That pairing is
 * the whole character. The first version of this page had none of it and read
 * like every other gradient-and-glass landing page.
 *
 * Dark rather than that house style's warm paper, because DESIGN.md assigns
 * dark to everything a band sees, and this page is marketing to bands.
 *
 * Two webfonts, ~43KB, loaded here and on no other route. Same carve-out as
 * GSAP and the same reason: a buyer on venue wifi mid-transfer waits for
 * nothing. See DESIGN.md, "Motion and the landing page".
 */
export const LANDING_CSS = `
/* Self-hosted so the CSP stays 'self' and no third party sees who reads this
   page. swap, so text is never invisible while a font is in flight. */
@font-face{
  font-family:"Space Grotesk";
  src:url("/vendor/fonts/space-grotesk-latin-wght-normal.woff2") format("woff2-variations");
  font-weight:300 700;font-style:normal;font-display:swap;
}
@font-face{
  font-family:"Instrument Serif";
  src:url("/vendor/fonts/instrument-serif-latin-400-italic.woff2") format("woff2");
  font-weight:400;font-style:italic;font-display:swap;
}

:root{
  --bg:#0C0B08;
  --ink:#F5F1E8;
  --ink-70:rgba(245,241,232,.74);
  --ink-50:rgba(245,241,232,.58);
  --ink-30:rgba(245,241,232,.42);
  --line:rgba(245,241,232,.14);
  --line-soft:rgba(245,241,232,.07);
  --accent:#F0A03C;
  --accent-hi:#FFC87A;
  --accent-ink:#100C06;

  --f-display:"Space Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  --f-serif:"Instrument Serif",Georgia,"Times New Roman",serif;
  --f-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --f-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;

  /* Fluid scale, same shape as the house style's. */
  --step--1:clamp(.78rem,.74rem + .2vw,.86rem);
  --step-0:clamp(.95rem,.9rem + .25vw,1.05rem);
  --step-1:clamp(1.08rem,1rem + .45vw,1.3rem);
  --step-2:clamp(1.35rem,1.15rem + .95vw,1.9rem);
  --step-3:clamp(1.8rem,1.45rem + 1.8vw,2.8rem);
  --step-4:clamp(2.4rem,1.8rem + 3vw,4.2rem);

  --section:clamp(3.6rem,2.6rem + 5.5vw,6.5rem);
  --container:960px;
  --ease-out:cubic-bezier(.16,1,.3,1);
}

/* Reveal start state. Scoped to .js-reveal, which only exists once the guard
   script in <head> has armed it and started its deadman timer — so a page with
   no JavaScript, or one whose vendor scripts fail, renders complete. Never put
   these rules outside this class. */
.js-reveal [data-reveal],
.js-reveal [data-hero] > *{opacity:0;transform:translateY(18px)}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font-family:var(--f-body);font-size:var(--step-0);line-height:1.6;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
}
a{color:var(--accent)}

.skip{
  position:absolute;left:-9999px;top:0;
  background:var(--accent);color:var(--accent-ink);
  padding:12px 18px;border-radius:0 0 8px 0;font-weight:700;text-decoration:none;
}
.skip:focus{left:0;z-index:20}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:3px}

.wrap{max-width:var(--container);margin:0 auto;padding:0 clamp(18px,4vw,28px)}

/* ---------- utility strip ----------
   The house style's hairline band. No pulsing "live" dot here: nothing on
   this page is live, and a status light that reports nothing is decoration
   dressed as information. */
.strip{
  border-bottom:1px solid var(--line-soft);
  font-family:var(--f-mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--ink-50);
}
.strip .wrap{display:flex;justify-content:space-between;gap:16px;padding-block:12px}
.strip b{color:var(--accent);font-weight:400}
@media (max-width:560px){.strip .r{display:none}}

/* ---------- masthead ---------- */
header{padding:clamp(54px,11vw,104px) 0 clamp(40px,8vw,72px)}
.eyebrow{
  font-family:var(--f-mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--accent);margin:0 0 20px;
}
h1{
  font-family:var(--f-display);font-weight:500;
  font-size:var(--step-4);line-height:.98;letter-spacing:-.035em;
  margin:0;max-width:15ch;text-wrap:balance;
}
/* The accent. Italic serif inside the sans headline is the single device the
   whole page hangs on — set larger than its neighbours because this serif
   runs small, and given back its own tracking because the sans is tightened
   hard and the serif should not be. */
h1 em,h2 em{
  font-family:var(--f-serif);font-style:italic;font-weight:400;
  letter-spacing:-.005em;font-size:1.1em;
}
.lede{
  margin:26px 0 0;max-width:44ch;
  font-size:var(--step-1);color:var(--ink-70);text-wrap:pretty;
}

.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.cta{
  display:inline-flex;align-items:center;justify-content:center;gap:.6em;
  min-height:50px;padding:14px 26px;border-radius:100px;
  font-family:var(--f-display);font-weight:600;font-size:15px;letter-spacing:-.01em;
  background:var(--accent);color:var(--accent-ink);border:1px solid var(--accent);
  text-decoration:none;transition:background .3s var(--ease-out),transform .3s var(--ease-out);
}
.cta:hover{background:var(--accent-hi);border-color:var(--accent-hi);transform:translateY(-1px)}
.cta:active{transform:translateY(1px)}
.cta.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.cta.ghost:hover{background:transparent;border-color:var(--accent);color:var(--accent-hi)}

/* ---------- marquee ----------
   Carries the four things the product does, so it is content rather than
   ornament. CSS-driven: it has to run with no JavaScript, and stop dead
   under prefers-reduced-motion. */
.marquee{border-block:1px solid var(--line-soft);overflow:hidden;padding-block:18px}
.marquee__track{
  display:flex;width:max-content;white-space:nowrap;
  animation:slide 38s linear infinite;
}
.marquee__track span{
  display:inline-flex;align-items:center;gap:40px;padding-right:40px;
  font-family:var(--f-display);font-weight:500;
  font-size:clamp(1rem,2.4vw,1.45rem);letter-spacing:-.015em;color:var(--ink-50);
}
.marquee__track span::after{content:"✳";color:var(--accent);font-size:.75em}
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* ---------- sections ---------- */
section{padding:var(--section) 0;border-bottom:1px solid var(--line-soft)}
section:last-of-type{border-bottom:0}
h2{
  font-family:var(--f-display);font-weight:500;
  font-size:var(--step-3);line-height:1.05;letter-spacing:-.03em;
  margin:0 0 20px;max-width:18ch;text-wrap:balance;
}
p{color:var(--ink-70);margin:0 0 15px;max-width:60ch;text-wrap:pretty}
p:last-child{margin-bottom:0}
b{color:var(--ink);font-weight:600}

/* ---------- hairline grid ----------
   Cells sit on a line-coloured bed with 1px gaps, so every divider is exactly
   one pixel and no border doubles where two cells meet. */
.grid{
  display:grid;gap:1px;background:var(--line-soft);
  border:1px solid var(--line-soft);margin-top:34px;
  /* It is an <ol> for the semantics; the step number is rendered as the
     mono index inside each cell, so the list marker would be a second one. */
  list-style:none;margin-block-end:0;padding:0;
}
@media (min-width:640px){.grid{grid-template-columns:1fr 1fr}}
.cell{background:var(--bg);padding:clamp(22px,3.4vw,34px)}
.cell__ix{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.16em;color:var(--accent)}
.cell h3{
  font-family:var(--f-display);font-weight:500;
  font-size:var(--step-1);letter-spacing:-.02em;line-height:1.15;
  margin:18px 0 8px;color:var(--ink);
}
.cell p{font-size:var(--step--1);color:var(--ink-50);margin:0;max-width:34ch}

/* ---------- product shots ----------
   Same hairline bed as .grid. Each surface is shot at the device it is used
   on, so the shapes differ on purpose: the dashboard is a laptop screen and
   leads full width, the scanner and the ticket are phones and sit beneath it.
   Every image carries its intrinsic size, so nothing shifts while they load. */
.shots{
  display:grid;gap:1px;background:var(--line-soft);
  border:1px solid var(--line-soft);margin-top:30px;
  list-style:none;padding:0;
}
@media (min-width:720px){
  .shots{grid-template-columns:1fr 1fr}
  .shot--lead{grid-column:1 / -1}
}
.shot{background:var(--bg);padding:clamp(20px,3vw,26px)}
/* The phones are shot at 390px wide; left to fill a half-column they tower
   over the laptop shot above them. */
.shot--phone img{max-width:300px;margin-inline:auto}
.shot img{
  display:block;width:100%;height:auto;
  border:1px solid var(--line);border-radius:10px;
}
.shot .cap{
  font-family:var(--f-mono);font-size:10.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--accent);margin:18px 0 0;
}
.shot p{font-size:var(--step--1);color:var(--ink-50);margin:8px 0 0;max-width:36ch}

/* ---------- pricing ---------- */
.tiers{width:100%;border-collapse:collapse;margin-top:30px;font-size:var(--step-0)}
.tiers caption{
  font-family:var(--f-mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink-50);text-align:left;padding-bottom:12px;
}
.tiers th{
  font-family:var(--f-mono);font-weight:400;font-size:10.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-50);text-align:left;
  padding:0 0 12px;border-bottom:1px solid var(--line);
}
.tiers th:last-child,.tiers td:last-child{text-align:right}
.tiers td{padding:16px 0;border-bottom:1px solid var(--line-soft);color:var(--ink-70)}
.tiers tr:last-child td{border-bottom:0}
.tiers td:last-child{
  font-family:var(--f-display);font-weight:600;color:var(--ink);
  font-variant-numeric:tabular-nums;white-space:nowrap;
}
.tiers tr.free td,.tiers tr.free td:last-child{color:var(--accent-hi)}
.note{margin-top:20px;font-size:var(--step--1);color:var(--ink-50)}

/* ---------- footer ---------- */
footer{padding-top:var(--section)}
.footer__meta{
  display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between;
  font-family:var(--f-mono);font-size:11px;letter-spacing:.08em;color:var(--ink-50);
  padding-bottom:22px;
}
.footer__meta a{color:var(--ink-50)}
.footer__meta a:hover{color:var(--accent-hi)}
/* Outlined wordmark. The faint fill is the fallback: where text-stroke is
   missing, transparent text would simply vanish. */
.footer__giant{
  font-family:var(--f-display);font-weight:700;letter-spacing:-.05em;line-height:.76;
  font-size:clamp(3.6rem,20vw,13rem);text-align:center;
  color:var(--line-soft);user-select:none;overflow:hidden;margin:0;
}
@supports (-webkit-text-stroke:1px currentColor){
  .footer__giant{color:transparent;-webkit-text-stroke:1px var(--line)}
}

@media (prefers-reduced-motion:reduce){
  *{transition:none!important;animation:none!important}
  .cta:hover{transform:none}
  .marquee__track{animation:none}
}
`;

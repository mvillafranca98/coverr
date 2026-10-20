/**
 * The landing page's stylesheet.
 *
 * Lives apart from the markup because it is the larger half of the page and
 * the two change for different reasons — copy moves often, the visual system
 * rarely.
 *
 * This is the one surface in the product with decorative depth. DESIGN.md
 * allows it here and nowhere else: a band deciding whether to trust Coverr
 * with their gig is on a sofa, while a buyer on the pages this links to is on
 * venue wifi with a transfer half-made. The aurora, the grain and the glass
 * all stop at this page's edge.
 *
 * Contrast is not relaxed to buy the effect. Every text colour is measured
 * against what is actually behind it, including the tint the glass adds.
 */
export const LANDING_CSS = `
:root{
  --bg:#0F0E0B; --surface:#181510; --line:#2F2921; --line-control:#6E6454;
  --text:#F4F0E8; --muted:#A69D8F; --dim:#8E8679;
  --accent:#F0A03C; --accent-hi:#FFC87A; --accent-deep:#C2691A; --accent-ink:#100C06;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}

/* ---------- atmosphere ----------
   Two soft amber fields behind the masthead. No blur filter: the gradients
   fade to transparent on their own, and blurring something this large is the
   one cheap-looking effect that is actually expensive to paint.

   Deliberately "absolute", not "fixed". Fixed was the first attempt and it is
   a contrast trap: the glow stays in the viewport, so every paragraph on the
   page eventually scrolls under its brightest point, and --muted over peak
   amber measures 3.96 where AA needs 4.5. Anchored to the document instead,
   the glow belongs to the masthead and scrolls away, which leaves the pricing
   table and the footer — the two places that use the dimmest ink — on flat
   --bg where they measure 12.68 and 5.36.

   The peak alphas are then capped at what --muted survives even at dead
   centre. Growing the fields is free; making them denser is not. */
.aurora{position:absolute;top:0;left:0;right:0;height:165vh;z-index:0;pointer-events:none;will-change:transform}
.aurora span{position:absolute;display:block;border-radius:50%}
.aurora .a1{
  width:min(92vw,1040px);aspect-ratio:1;left:-18vw;top:-20vw;
  background:radial-gradient(circle,rgba(240,160,60,.20),rgba(240,160,60,0) 64%);
}
.aurora .a2{
  width:min(66vw,760px);aspect-ratio:1;right:-16vw;top:22vh;
  background:radial-gradient(circle,rgba(194,105,26,.17),rgba(194,105,26,0) 68%);
}

/* Film grain. Stops the large flat gradients banding on cheap panels. */
.grain{
  position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.04;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.wrap{position:relative;z-index:2;max-width:680px;margin:0 auto;padding:0 20px 80px}

/* Keyboard users land here first and can jump the masthead. */
.skip{
  position:absolute;left:-9999px;top:0;
  background:var(--accent);color:var(--accent-ink);
  padding:12px 18px;border-radius:0 0 8px 0;font-weight:700;text-decoration:none;
}
.skip:focus{left:0;z-index:10}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}

/* ---------- masthead ---------- */
header{padding:clamp(52px,13vw,96px) 0 clamp(32px,7vw,48px)}
.brand{
  display:inline-flex;align-items:center;gap:8px;
  font-family:var(--mono);font-size:11px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--accent);
}
.brand::before{
  content:"";width:7px;height:7px;border-radius:50%;
  background:var(--accent);box-shadow:0 0 12px 2px rgba(240,160,60,.65);
}
h1{
  font-size:clamp(2.2rem,8.2vw,3.55rem);line-height:1.03;letter-spacing:-.035em;
  margin:18px 0 18px;font-weight:780;text-wrap:balance;
}
/* The gradient word. Amber at both ends, so it clears AA either way, and the
   plain colour stays as the fallback where background-clip:text is missing —
   getting that wrong renders the headline invisible. */
.grad{color:var(--accent-hi)}
@supports (-webkit-background-clip:text) or (background-clip:text){
  .grad{
    background:linear-gradient(118deg,var(--accent-hi) 10%,var(--accent) 60%,var(--accent-deep) 105%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
}
.lede{font-size:clamp(1.02rem,3.6vw,1.18rem);color:var(--muted);margin:0;max-width:36ch;text-wrap:pretty}

/* ---------- calls to action ---------- */
.actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:30px}
.cta{
  display:inline-flex;align-items:center;justify-content:center;
  min-height:50px;padding:14px 24px;border-radius:11px;
  background:linear-gradient(180deg,var(--accent-hi),var(--accent));
  color:var(--accent-ink);border:1px solid var(--accent-hi);
  font-weight:700;font-size:15px;text-decoration:none;
  box-shadow:0 10px 30px -10px rgba(240,160,60,.55);
  transition:transform .15s ease,box-shadow .15s ease;
}
.cta:hover{box-shadow:0 14px 38px -10px rgba(240,160,60,.7);transform:translateY(-1px)}
.cta:active{transform:translateY(1px)}
.cta.ghost{
  background:rgba(255,255,255,.03);color:var(--text);
  border-color:var(--line-control);box-shadow:none;
}
.cta.ghost:hover{border-color:var(--accent);background:rgba(240,160,60,.07);transform:translateY(-1px)}

/* ---------- sections ---------- */
main{border-top:1px solid var(--line)}
section{padding:clamp(38px,8vw,60px) 0;border-bottom:1px solid var(--line)}
section:last-of-type{border-bottom:0}
.eyebrow{
  font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--accent);margin:0 0 10px;
}
h2{font-size:clamp(1.3rem,4.6vw,1.6rem);font-weight:720;letter-spacing:-.022em;margin:0 0 16px;text-wrap:balance}
p{color:var(--muted);margin:0 0 14px;max-width:62ch;text-wrap:pretty}
p:last-child{margin-bottom:0}
b{color:var(--text);font-weight:650}

/* ---------- how it works ---------- */
.steps{display:grid;gap:14px;margin:0;padding:0;list-style:none;counter-reset:step}
@media (min-width:600px){.steps{grid-template-columns:1fr 1fr;gap:16px}}
.step{
  position:relative;border-radius:16px;padding:20px 20px 22px;counter-increment:step;
  background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018));
  border:1px solid rgba(255,255,255,.085);
  transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease;
}
.step:hover{
  border-color:rgba(240,160,60,.42);transform:translateY(-2px);
  box-shadow:0 18px 44px -20px rgba(240,160,60,.5);
}
.step::before{
  content:"0" counter(step);
  display:block;font-family:var(--mono);font-size:11px;letter-spacing:.16em;
  color:var(--accent);margin-bottom:10px;
}
.step h3{font-size:1.02rem;font-weight:660;margin:0 0 7px;color:var(--text)}
.step p{font-size:.93rem;margin:0}

/* ---------- pricing ---------- */
.tiers{width:100%;border-collapse:collapse;font-size:.95rem;margin-top:6px}
.tiers th{
  text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--dim);font-weight:600;
  padding:0 10px 10px;border-bottom:1px solid var(--line);
}
.tiers th:first-child,.tiers td:first-child{padding-left:14px}
.tiers th:last-child,.tiers td:last-child{text-align:right;padding-right:14px}
.tiers td{padding:13px 10px;border-bottom:1px solid var(--line);color:var(--muted)}
.tiers tr:last-child td{border-bottom:0}
.tiers td:last-child{color:var(--text);font-variant-numeric:tabular-nums;font-weight:650;white-space:nowrap}
/* The free row is lit rather than merely coloured — it is the offer. */
.tiers tr.free td{
  color:var(--accent-hi);font-weight:650;
  background:linear-gradient(90deg,rgba(240,160,60,.14),rgba(240,160,60,.02));
}
.tiers tr.free td:first-child{border-left:2px solid var(--accent)}

footer{
  margin-top:48px;padding-top:20px;border-top:1px solid var(--line);
  font-family:var(--mono);font-size:11px;color:var(--dim);
  display:flex;flex-wrap:wrap;gap:6px 16px;
}
a{color:var(--accent)}
footer a{color:var(--dim)}

@media (prefers-reduced-motion:reduce){
  *{transition:none!important;animation:none!important}
  .cta:hover,.step:hover{transform:none}
}
`;

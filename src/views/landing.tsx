import type { FC } from "hono/jsx";

/**
 * The public front page. Carries its own document and stylesheet rather than
 * the admin chrome: it is the only view a logged-out stranger sees, and it
 * shares no navigation, no session and no layout with the rest of the app.
 *
 * Dark, because it is marketing to bands and DESIGN.md gives the band every
 * dark surface. Buyers never land here — they arrive at /e/:slug from a flyer.
 *
 * Everything on this page is a fact taken from the product or the spec. There
 * are no testimonials, no band logos and no counts, because Coverr has had one
 * real order and inventing social proof would be a lie that outlives the page.
 */

/**
 * The real unlock brackets, from `lib/settlement.ts`. Kept as data so the page
 * cannot drift from what the product actually charges — if the brackets move,
 * this list is the thing that fails code review.
 */
const PRICE_TIERS: { tickets: string; price: string }[] = [
  { tickets: "Tu primer evento", price: "Gratis" },
  { tickets: "1 – 60 boletos", price: "L400" },
  { tickets: "61 – 150", price: "L800" },
  { tickets: "151 – 300", price: "L1,200" },
  { tickets: "301 o más", price: "L1,800" },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Compartís un enlace",
    body: "En el flyer o la bio. Ahí está tu número de cuenta listo para copiar, con el banco correcto para que nadie pague comisión.",
  },
  {
    title: "El comprador transfiere",
    body: "Sube su comprobante y recibe sus códigos QR al instante, en pantalla y por correo. Nunca queda esperando.",
  },
  {
    title: "En la puerta escanean",
    body: "Desde el navegador, sin instalar nada. Funciona sin señal: la lista queda guardada en el teléfono.",
  },
  {
    title: "Al final ves las cuentas",
    body: "Preventa, taquilla, efectivo, cortesías, costos y el reparto de cada integrante. Todo sale de los registros, no de una celda escrita a mano.",
  },
];

const CSS = `
:root{
  --bg:#0F0E0B; --surface:#181510; --line:#2F2921; --line-control:#6E6454;
  --text:#F4F0E8; --muted:#A69D8F; --dim:#8E8679;
  --accent:#F0A03C; --accent-ink:#100C06;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
}

/* Keyboard users land here first and can jump the masthead. */
.skip{
  position:absolute;left:-9999px;top:0;
  background:var(--accent);color:var(--accent-ink);
  padding:12px 18px;border-radius:0 0 8px 0;font-weight:700;text-decoration:none;
}
.skip:focus{left:0;z-index:10}

:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}

.wrap{max-width:660px;margin:0 auto;padding:0 20px 72px}

/* ---------- masthead ---------- */
header{padding:clamp(40px,10vw,72px) 0 clamp(28px,6vw,40px)}
.brand{
  font-family:var(--mono);font-size:11px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--accent);
}
h1{
  font-size:clamp(1.9rem,6.5vw,2.7rem);line-height:1.08;letter-spacing:-.028em;
  margin:14px 0 14px;font-weight:750;text-wrap:balance;
}
.lede{font-size:clamp(1rem,3.4vw,1.14rem);color:var(--muted);margin:0;max-width:34ch;text-wrap:pretty}

/* ---------- calls to action ---------- */
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.cta{
  display:inline-flex;align-items:center;justify-content:center;
  min-height:48px;padding:13px 22px;border-radius:10px;
  background:var(--accent);color:var(--accent-ink);
  font-weight:700;font-size:15px;text-decoration:none;border:1px solid var(--accent);
}
.cta.ghost{background:transparent;color:var(--text);border-color:var(--line-control)}
.cta:active{transform:translateY(1px)}
@media (prefers-reduced-motion:reduce){.cta:active{transform:none}}

/* ---------- sections ---------- */
main{border-top:1px solid var(--line)}
section{padding:clamp(30px,7vw,46px) 0;border-bottom:1px solid var(--line)}
section:last-of-type{border-bottom:0}
h2{font-size:clamp(1.15rem,4vw,1.4rem);font-weight:700;letter-spacing:-.015em;margin:0 0 14px;text-wrap:balance}
p{color:var(--muted);margin:0 0 14px;max-width:62ch;text-wrap:pretty}
p:last-child{margin-bottom:0}
b{color:var(--text);font-weight:650}

/* ---------- how it works ---------- */
.steps{display:grid;gap:14px;margin:0;padding:0;list-style:none;counter-reset:step}
@media (min-width:560px){.steps{grid-template-columns:1fr 1fr;gap:16px}}
.step{
  background:var(--surface);border:1px solid var(--line);border-radius:12px;
  padding:18px 18px 20px;counter-increment:step;
}
.step::before{
  content:"0" counter(step);
  display:block;font-family:var(--mono);font-size:11px;letter-spacing:.14em;
  color:var(--accent);margin-bottom:8px;
}
.step h3{font-size:1rem;font-weight:650;margin:0 0 6px;color:var(--text)}
.step p{font-size:.92rem;margin:0}

/* ---------- pricing ---------- */
.tiers{width:100%;border-collapse:collapse;font-size:.95rem;margin-top:4px}
.tiers th{
  text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--dim);font-weight:600;
  padding:0 0 8px;border-bottom:1px solid var(--line);
}
.tiers th:last-child,.tiers td:last-child{text-align:right}
.tiers td{padding:11px 0;border-bottom:1px solid var(--line);color:var(--muted)}
.tiers tr:last-child td{border-bottom:0}
.tiers td:last-child{color:var(--text);font-variant-numeric:tabular-nums;font-weight:650;white-space:nowrap}
.tiers tr.free td{color:var(--accent)}

footer{
  margin-top:40px;padding-top:18px;border-top:1px solid var(--line);
  font-family:var(--mono);font-size:11px;color:var(--dim);
  display:flex;flex-wrap:wrap;gap:4px 14px;
}
a{color:var(--accent)}
footer a{color:var(--dim)}
`;

export const LandingPage: FC<{ origin: string }> = ({ origin }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="theme-color" content="#0F0E0B" />
      <title>Coverr — Preventa y entrada para bandas en Honduras</title>
      <meta
        name="description"
        content="Vendé boletos por transferencia a tu propia cuenta, entregá códigos QR al instante y cerrá las cuentas de tu toque. Para bandas independientes en Honduras."
      />
      {/* The only page in the product meant to be found in a search result.
          Everything else is noindex — see views/layout.tsx. */}
      <link rel="canonical" href={origin} />
      <meta property="og:url" content={origin} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="Coverr — Preventa y entrada para bandas" />
      <meta
        property="og:description"
        content="El dinero llega directo a la cuenta de tu banda. Preventa, códigos QR, entrada sin señal y el reparto al final."
      />
      <meta name="twitter:card" content="summary" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </head>
    <body>
      <a class="skip" href="#main">
        Saltar al contenido
      </a>

      <div class="wrap">
        <header>
          <div class="brand">Coverr</div>
          <h1>Vendé tus boletos sin que el dinero pase por nadie más.</h1>
          <p class="lede">
            Tus compradores transfieren directo a la cuenta de tu banda. Nosotros nunca tocamos
            el dinero.
          </p>
          {/* The primary action sits above the fold on purpose: a band that
              already knows what this is should not have to scroll to start. */}
          <div class="actions">
            <a class="cta" href="/registro">
              Crear mi banda
            </a>
            <a class="cta ghost" href="/admin/acceso">
              Ya tengo banda
            </a>
          </div>
        </header>

        <main id="main">
          <section aria-labelledby="problema">
            <h2 id="problema">Lo que estás haciendo hoy</h2>
            <p>
              Un hilo de WhatsApp lleno de capturas. Una hoja de cálculo escrita a mano, nombre
              por nombre. Un conteo en la puerta que nunca cuadra con los brazaletes, y al final
              alguien promedia para que cierre.
            </p>
            <p>
              Coverr hace esa parte. Vos tocás.
            </p>
          </section>

          <section aria-labelledby="como">
            <h2 id="como">Cómo funciona</h2>
            <ol class="steps">
              {STEPS.map((step) => (
                <li class="step" key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="precio">
            <h2 id="precio">Precio</h2>
            <p>
              La preventa, los códigos QR, la entrada, las ventas en efectivo y el resumen en
              vivo son <b>gratis, siempre</b>. Sólo se paga el reporte de reparto al final de
              cada evento — cuando el toque ya pasó y la plata ya está en la cuenta.
            </p>
            <table class="tiers">
              <caption class="brand" style="text-align:left;padding-bottom:10px">
                Por evento
              </caption>
              <thead>
                <tr>
                  <th scope="col">Boletos vendidos</th>
                  <th scope="col">Reporte de reparto</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_TIERS.map((tier, i) => (
                  <tr class={i === 0 ? "free" : ""} key={tier.tickets}>
                    <td>{tier.tickets}</td>
                    <td>{tier.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style="margin-top:14px;font-size:.9rem">
              Las cortesías no cuentan para el tramo. No hay suscripción ni plan mensual: una
              banda que toca dos veces al año paga dos veces al año y conserva su historial.
            </p>
          </section>

          <section aria-labelledby="empezar">
            <h2 id="empezar">Empezá con tu próximo toque</h2>
            <p>
              Crear la banda toma dos campos. Podés correr un evento completo antes de decidir si
              pagás el reporte.
            </p>
            <div class="actions">
              <a class="cta" href="/registro">
                Crear mi banda
              </a>
            </div>
          </section>
        </main>

        <footer>
          <span>Coverr · Honduras</span>
          <span>
            Un producto de <a href="https://macawly.dev">macawly.dev</a>
          </span>
        </footer>
      </div>
    </body>
  </html>
);

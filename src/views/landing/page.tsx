import type { FC } from "hono/jsx";
import { LegalLinks } from "../legal/links";
import { LANDING_CSS } from "./styles";
import { landingMotionScript } from "./motion";

/**
 * The public front page. Carries its own document and stylesheet rather than
 * the admin chrome: it is the only view a logged-out stranger sees, and it
 * shares no navigation, no session and no layout with the rest of the app.
 *
 * Dark, because it is marketing to bands and DESIGN.md gives the band every
 * dark surface. Buyers never land here — they arrive at /e/:slug from a flyer,
 * on a light page with no decoration and no JavaScript beyond the form.
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
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      {/* Vendored, not from a CDN — see motion.ts. `defer` so neither blocks
          the first paint, and both have run by DOMContentLoaded, which is what
          the init below waits for. */}
      <script src="/vendor/gsap.min.js" defer />
      <script src="/vendor/ScrollTrigger.min.js" defer />
      <script dangerouslySetInnerHTML={{ __html: landingMotionScript() }} />
    </head>
    <body>
      <a class="skip" href="#main">
        Saltar al contenido
      </a>

      {/* Decoration only: no text, no structure, hidden from assistive tech. */}
      <div class="aurora" aria-hidden="true">
        <span class="a1" />
        <span class="a2" />
      </div>
      <div class="grain" aria-hidden="true" />

      <div class="wrap">
        <header data-hero>
          <div class="brand">Coverr</div>
          <h1>
            Vendé tus boletos sin que el dinero <span class="grad">pase por nadie más</span>.
          </h1>
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
            <p class="eyebrow" data-reveal>
              El problema
            </p>
            <h2 id="problema" data-reveal>
              Lo que estás haciendo hoy
            </h2>
            <p data-reveal>
              Un hilo de WhatsApp lleno de capturas. Una hoja de cálculo escrita a mano, nombre
              por nombre. Un conteo en la puerta que nunca cuadra con los brazaletes, y al final
              alguien promedia para que cierre.
            </p>
            <p data-reveal>Coverr hace esa parte. Vos tocás.</p>
          </section>

          <section aria-labelledby="como">
            <p class="eyebrow" data-reveal>
              Cómo funciona
            </p>
            <h2 id="como" data-reveal>
              Cuatro pasos, de principio a fin
            </h2>
            <ol class="steps">
              {STEPS.map((step) => (
                <li class="step" key={step.title} data-reveal>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="precio">
            <p class="eyebrow" data-reveal>
              Precio
            </p>
            <h2 id="precio" data-reveal>
              Sólo pagás cuando ya cobraste
            </h2>
            <p data-reveal>
              La preventa, los códigos QR, la entrada, las ventas en efectivo y el resumen en
              vivo son <b>gratis, siempre</b>. Sólo se paga el reporte de reparto al final de
              cada evento — cuando el toque ya pasó y la plata ya está en la cuenta.
            </p>
            <div data-reveal>
              <table class="tiers">
                <caption class="eyebrow" style="text-align:left;padding-bottom:10px">
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
            </div>
            <p style="margin-top:16px;font-size:.9rem" data-reveal>
              Las cortesías no cuentan para el tramo. No hay suscripción ni plan mensual: una
              banda que toca dos veces al año paga dos veces al año y conserva su historial.
            </p>
          </section>

          <section aria-labelledby="empezar">
            <p class="eyebrow" data-reveal>
              Empezar
            </p>
            <h2 id="empezar" data-reveal>
              Empezá con tu próximo toque
            </h2>
            <p data-reveal>
              Crear la banda toma dos campos. Podés correr un evento completo antes de decidir si
              pagás el reporte.
            </p>
            <div class="actions" data-reveal>
              <a class="cta" href="/registro">
                Crear mi banda
              </a>
            </div>
          </section>
        </main>

        <footer>
          <span>Coverr · Honduras</span>
          <LegalLinks />
          <span>
            Un producto de <a href="https://macawly.dev">macawly.dev</a>
          </span>
        </footer>
      </div>
    </body>
  </html>
);

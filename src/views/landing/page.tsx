import type { FC } from "hono/jsx";
import { LegalLinks } from "../legal/links";
import { LANDING_CSS } from "./styles";
import { landingMotionScript, revealGuardScript } from "./motion";

/**
 * The public front page. Carries its own document and stylesheet rather than
 * the admin chrome: it is the only view a logged-out stranger sees, and it
 * shares no navigation, no session and no layout with the rest of the app.
 *
 * Dark, because it is marketing to bands and DESIGN.md gives the band every
 * dark surface. Buyers never land here — they arrive at /e/:slug from a flyer,
 * on a light page with no decoration and no JavaScript beyond the form.
 *
 * Everything here is a fact taken from the product or the spec. No
 * testimonials, no band logos, no counts and no "trusted by" row: Coverr has
 * had one real order, and the house style's stats band is the one device from
 * it that cannot be borrowed honestly.
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
    body: "Preventa, taquilla, efectivo, cortesías, costos y el reparto de cada integrante. Todo sale de los registros.",
  },
];

/**
 * Screen captures of the real product, taken against the fabricated band in
 * `seed/demo.sql` so no band's takings and no buyer's name is published. The
 * page says so under the heading — these are real screens, invented numbers.
 */
const SHOTS: { src: string; cap: string; alt: string; body: string }[] = [
  {
    src: "/img/shot-dashboard.webp",
    cap: "El resumen en vivo",
    alt: "Resumen del evento: 151 personas adentro, 157 vendidos, 49 brazaletes y L33,950 de bruto, con los ingresos desglosados por canal.",
    body: "Adentro, vendidos, brazaletes y bruto. Los ingresos por canal se actualizan mientras entra la gente.",
  },
  {
    src: "/img/shot-scanner.webp",
    cap: "La puerta",
    alt: "El escáner de entrada en verde, mostrando «Adelante» con el nombre del asistente y su código.",
    body: "Verde y el nombre de quien entra. Funciona sin señal: la lista queda guardada en el teléfono.",
  },
  {
    src: "/img/shot-ticket.webp",
    cap: "El boleto",
    alt: "La pantalla de boletos del comprador, con el código QR y el código corto debajo.",
    body: "El código QR aparece al instante, antes de que verifiquemos nada. Se descarga como imagen.",
  },
];

/** Rendered twice in the track so the -50% translate loops seamlessly. */
const MARQUEE = ["Preventa", "Códigos QR", "Entrada sin señal", "Efectivo y cortesías", "Reparto"];

export const LandingPage: FC<{ origin: string }> = ({ origin }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="theme-color" content="#0C0B08" />
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
      {/* The headline paints first and is set in the display face, so that one
          file is worth requesting before the parser reaches the stylesheet. */}
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/vendor/fonts/space-grotesk-latin-wght-normal.woff2"
        crossorigin="anonymous"
      />
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      {/* Synchronous and before the body: it hides what is about to be
          revealed, and arms the timer that un-hides it if the motion script
          never reports in. See motion.ts. */}
      <script dangerouslySetInnerHTML={{ __html: revealGuardScript() }} />
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

      <div class="strip">
        <div class="wrap">
          <span>
            Coverr <b>·</b> Honduras
          </span>
          <span class="r">Preventa · Puerta · Reparto</span>
        </div>
      </div>

      <div class="wrap">
        <header data-hero>
          <p class="eyebrow">Para bandas independientes</p>
          <h1>
            Vendé tus boletos sin que el dinero pase por <em>nadie más</em>.
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
      </div>

      <div class="marquee" aria-hidden="true">
        <div class="marquee__track">
          {[0, 1].map((copy) =>
            MARQUEE.map((item) => <span key={`${copy}-${item}`}>{item}</span>),
          )}
        </div>
      </div>

      <div class="wrap">
        <main id="main">
          <section aria-labelledby="problema">
            <p class="eyebrow" data-reveal>
              El problema
            </p>
            <h2 id="problema" data-reveal>
              Lo que estás haciendo <em>hoy</em>
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
              Cuatro pasos, de <em>principio a fin</em>
            </h2>
            <ol class="grid">
              {STEPS.map((step, i) => (
                <li class="cell" key={step.title} data-reveal>
                  <div class="cell__ix">/ {String(i + 1).padStart(2, "0")}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="producto">
            <p class="eyebrow" data-reveal>
              El producto
            </p>
            <h2 id="producto" data-reveal>
              Así se ve <em>tu toque</em>
            </h2>
            <p data-reveal>
              Capturas del producto tal como está hoy.{" "}
              <b>Los datos son de una banda de ejemplo</b> — Coverr no publica las cuentas ni los
              compradores de nadie.
            </p>
            <ul class="shots">
              {SHOTS.map((shot) => (
                <li class="shot" key={shot.src} data-reveal>
                  {/* Intrinsic size on every image: the row must not jump while
                      they load, and these sit well below the fold. */}
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    width="469"
                    height="600"
                    loading="lazy"
                    decoding="async"
                  />
                  <p class="cap">{shot.cap}</p>
                  <p>{shot.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="precio">
            <p class="eyebrow" data-reveal>
              Precio
            </p>
            <h2 id="precio" data-reveal>
              Sólo pagás cuando <em>ya cobraste</em>
            </h2>
            <p data-reveal>
              La preventa, los códigos QR, la entrada, las ventas en efectivo y el resumen en
              vivo son <b>gratis, siempre</b>. Sólo se paga el reporte de reparto al final de
              cada evento — cuando el toque ya pasó y la plata ya está en la cuenta.
            </p>
            <div data-reveal>
              <table class="tiers">
                <caption>Por evento</caption>
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
            <p class="note" data-reveal>
              Las cortesías no cuentan para el tramo. No hay suscripción ni plan mensual: una
              banda que toca dos veces al año paga dos veces al año y conserva su historial.
            </p>
          </section>

          <section aria-labelledby="empezar">
            <p class="eyebrow" data-reveal>
              Empezar
            </p>
            <h2 id="empezar" data-reveal>
              Empezá con tu <em>próximo toque</em>
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
          <div class="footer__meta">
            <span>Coverr · Honduras</span>
            <LegalLinks />
            <span>
              Un producto de <a href="https://macawly.dev">macawly.dev</a>
            </span>
          </div>
          {/* Decorative repeat of the wordmark already in the strip above. */}
          <p class="footer__giant" aria-hidden="true">
            COVERR
          </p>
        </footer>
      </div>
    </body>
  </html>
);

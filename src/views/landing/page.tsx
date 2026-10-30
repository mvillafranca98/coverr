import type { FC } from "hono/jsx";
import LANDING_CSS from "../../styles/landing.css";
import TOKENS_CSS from "../../styles/tokens.css";
import { BrandIcons, Monogram, Wordmark } from "../brand";
import { ErrorReporter } from "../error-reporter";
import { LegalLinks } from "../legal/links";
import { HeroTicket } from "./hero-ticket";
import { MoneyFlow } from "./money-flow";
import { landingMotionScript, revealGuardScript } from "./motion";
import { AccountsVisual, DoorVisual, ShareLinkVisual, TransferVisual } from "./step-visuals";

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
 * it that cannot be borrowed honestly. The demo band that appears on the hero
 * ticket and in the drawings is fabricated, and the page says so.
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

const STEPS: { title: string; body: string; visual: FC }[] = [
  {
    title: "Compartís un enlace",
    body: "En el flyer o la bio. Ahí está tu número de cuenta listo para copiar, con el banco correcto para que nadie pague comisión.",
    visual: ShareLinkVisual,
  },
  {
    title: "El comprador transfiere",
    body: "Sube su comprobante y recibe sus códigos QR al instante, en pantalla y por correo. Nunca queda esperando.",
    visual: TransferVisual,
  },
  {
    title: "En la puerta escanean",
    body: "Desde el navegador, sin instalar nada. Funciona sin señal: la lista queda guardada en el teléfono.",
    visual: DoorVisual,
  },
  {
    title: "Al final ves las cuentas",
    body: "Preventa, taquilla, efectivo, cortesías, costos y el reparto de cada integrante. Todo sale de los registros.",
    visual: AccountsVisual,
  },
];

/** The paragraph of "El problema", one habit per line so each can be struck out. */
const TODAY = [
  "Un hilo de WhatsApp lleno de capturas.",
  "Una hoja de cálculo escrita a mano, nombre por nombre.",
  "Un conteo en la puerta que nunca cuadra con los brazaletes.",
  "Y al final, alguien promedia para que cierre.",
];

/**
 * Screen captures of the real product, taken against the fabricated band in
 * `seed/demo.sql` so no band's takings and no buyer's name is published. The
 * page says so under the heading — these are real screens, invented numbers.
 */
const SHOTS: {
  src: string;
  cap: string;
  alt: string;
  body: string;
  w: number;
  h: number;
  lead?: boolean;
}[] = [
  {
    lead: true,
    w: 2720,
    h: 1828,
    src: "/img/shot-dashboard.webp",
    cap: "El resumen en vivo",
    alt: "Resumen del evento: 152 personas adentro, 157 vendidos, 48 brazaletes y L33,950 de bruto, con los ingresos desglosados por canal.",
    body: "Adentro, vendidos, brazaletes y bruto. Los ingresos por canal se actualizan mientras entra la gente.",
  },
  {
    w: 780,
    h: 1200,
    src: "/img/shot-scanner.webp",
    cap: "La puerta",
    alt: "El escáner de entrada en verde, mostrando «Adelante» con el nombre del asistente y su código.",
    body: "Verde y el nombre de quien entra. Si algo no cuadra, amarillo y el motivo en pantalla.",
  },
  {
    w: 780,
    h: 1508,
    src: "/img/shot-ticket.webp",
    cap: "El boleto",
    alt: "La pantalla de boletos del comprador, con el código QR y el código corto debajo.",
    body: "El código QR aparece al instante, antes de que verifiquemos nada. Se descarga como imagen.",
  },
];

/** Rendered twice in the track so the -50% translate loops seamlessly. */
const MARQUEE = ["Preventa", "Códigos QR", "Entrada sin señal", "Efectivo y cortesías", "Reparto"];

/**
 * Splits a phrase into word spans so the headline can rise word by word. The
 * spaces stay real text between the spans, so the heading still reads, wraps
 * and copies as one sentence.
 */
const Words: FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(" ").map((word, i, all) => (
      <>
        <span class="w" key={`${i}-${word}`}>
          {word}
        </span>
        {i < all.length - 1 ? " " : ""}
      </>
    ))}
  </>
);

export const LandingPage: FC<{ origin: string; billingEnabled: boolean }> = ({
  origin,
  billingEnabled,
}) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <ErrorReporter />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="theme-color" content="#FFF4DE" />
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
      <meta property="og:image" content={`${origin}/og.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <BrandIcons />
      {/* The headline paints first and is set in the display face, so that one
          file is worth requesting before the parser reaches the stylesheet. */}
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/vendor/fonts/archivo-black-latin-400-normal.woff2"
        crossorigin="anonymous"
      />
      <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS + LANDING_CSS }} />
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

      <nav class="nav" aria-label="Principal">
        <div class="wrap nav__in">
          <a class="nav__brand" href="/" aria-label="Coverr, inicio">
            <Wordmark size={26} />
          </a>
          <div class="nav__links">
            <a href="#como">Cómo funciona</a>
            <a href="#precio">Precio</a>
            <a href="/admin/acceso">Entrar</a>
            <a class="cta cta--sm" href="/registro">
              Crear mi banda
            </a>
          </div>
        </div>
      </nav>

      <header class="hero">
        <div class="wrap hero__grid">
          <div class="hero__copy">
            <p class="chips" data-rise>
              <span class="chip chip--lime">Para bandas independientes</span>
              <span class="chip chip--blue">Honduras</span>
            </p>
            <h1 class="hero__title">
              <Words text="Vendé tus boletos sin que el dinero pase por" />{" "}
              <em>
                <Words text="nadie más" />
              </em>
              <span class="w">.</span>
            </h1>
            <p class="lede" data-rise>
              La preventa, la puerta y el reparto al final de la noche. Tus compradores transfieren
              directo a la cuenta de tu banda; nosotros nunca tocamos el dinero.
            </p>
            {/* The primary action sits above the fold on purpose: a band that
                already knows what this is should not have to scroll to start. */}
            <div class="actions" data-rise>
              <a class="cta cta--lg" href="/registro">
                Crear mi banda <span aria-hidden="true">→</span>
              </a>
              <a class="cta ghost cta--lg" href="/admin/acceso">
                Ya tengo banda
              </a>
            </div>
            <ul class="facts" data-rise>
              <li>El dinero va directo a tu cuenta</li>
              <li>QR al instante</li>
              <li>Entrada sin señal</li>
            </ul>
          </div>
          <HeroTicket origin={origin} />
        </div>
      </header>

      {/* Two strips of tape crossed over each other, running opposite ways. */}
      <div class="tapes" aria-hidden="true">
        {["tape--yellow", "tape--pink"].map((tape) => (
          <div class={`tape ${tape}`} key={tape}>
            <div class="tape__track">
              {[0, 1].map((copy) =>
                MARQUEE.map((item) => <span key={`${copy}-${item}`}>{item}</span>),
              )}
            </div>
          </div>
        ))}
      </div>

      <div class="wrap">
        <main id="main">
          <section class="today" aria-labelledby="problema">
            <p class="eyebrow" data-reveal>
              El problema
            </p>
            <h2 id="problema" data-reveal>
              Lo que estás haciendo <em>hoy</em>
            </h2>
            <ul class="today__list">
              {TODAY.map((line) => (
                <li key={line} data-reveal>
                  <span class="today__text">{line}</span>
                </li>
              ))}
            </ul>
            <p class="today__punch" data-reveal>
              Coverr hace esa parte. <em>Vos tocás.</em>
            </p>
          </section>

          <section class="money" aria-labelledby="dinero">
            <div class="money__copy">
              <p class="eyebrow" data-reveal>
                El dinero
              </p>
              <h2 id="dinero" data-reveal>
                Directo a tu cuenta, <em>sin escalas</em>
              </h2>
              <p data-reveal>
                Tus compradores transfieren a la cuenta de tu banda desde la app de su propio banco.
                Coverr no recibe, no retiene y no mueve ese dinero: entrega los códigos QR, revisa
                los comprobantes y lleva las cuentas.
              </p>
            </div>
            <MoneyFlow />
          </section>

          <section aria-labelledby="como-h" id="como">
            <p class="eyebrow" data-reveal>
              Cómo funciona
            </p>
            <h2 id="como-h" data-reveal>
              Cuatro pasos, de <em>principio a fin</em>
            </h2>
            <ol class="grid steps">
              {STEPS.map((step, i) => (
                <li class="cell" key={step.title} data-reveal>
                  <span class="cell__big" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div class="cell__ix">/ {String(i + 1).padStart(2, "0")}</div>
                  <step.visual />
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
              Capturas del producto tal como está hoy. <b>Los datos son de una banda de ejemplo</b>{" "}
              — Coverr no publica las cuentas ni los compradores de nadie.
            </p>
            <ul class="shots">
              {SHOTS.map((shot) => (
                <li
                  class={`shot ${shot.lead ? "shot--lead" : "shot--phone"}`}
                  key={shot.src}
                  data-reveal
                >
                  <div
                    class={`device ${shot.lead ? "device--laptop" : "device--phone"}`}
                    data-drift={shot.lead ? "18" : "44"}
                  >
                    {/* The screen clips its image, so a phone can show part
                        of the laptop screen larger. Intrinsic size on every
                        image: the row must not jump while they load. */}
                    <div class="device__screen">
                      <img
                        src={shot.src}
                        alt={shot.alt}
                        width={shot.w}
                        height={shot.h}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                  <p class="cap">{shot.cap}</p>
                  <p>{shot.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="precio-h" id="precio">
            <p class="eyebrow" data-reveal>
              Precio
            </p>
            <h2 id="precio-h" data-reveal>
              Sólo pagás cuando <em>ya cobraste</em>
            </h2>
            <p data-reveal>
              La preventa, los códigos QR, la entrada, las ventas en efectivo y el resumen en vivo
              son <b>gratis, siempre</b>. Sólo se paga el reporte de reparto al final de cada evento
              — cuando el toque ya pasó y la plata ya está en la cuenta.
            </p>
            <p class="tiers__cap" data-reveal>
              Reporte de reparto, por evento
            </p>
            <ol class="tiers">
              {PRICE_TIERS.map((tier, i) => (
                <li class={i === 0 ? "tier tier--free" : "tier"} key={tier.tickets} data-reveal>
                  <span class="tier__range">{tier.tickets}</span>
                  <span class="tier__price">{tier.price}</span>
                </li>
              ))}
            </ol>
            {billingEnabled ? null : (
              <p class="billing-off" data-reveal>
                <b>Hoy el cobro está desactivado:</b> todas las bandas ven el reporte completo sin
                pagar. Antes de activarlo se avisa con tiempo.
              </p>
            )}
            <p class="note" data-reveal>
              Las cortesías no cuentan para el tramo. No hay suscripción ni plan mensual: una banda
              que toca dos veces al año paga dos veces al año y conserva su historial.
            </p>
          </section>

          <section class="finale" aria-labelledby="empezar">
            <Monogram size={64} />
            <h2 id="empezar" data-reveal>
              Empezá con tu <em>próximo toque</em>
            </h2>
            <p data-reveal>
              Crear la banda toma dos campos. Podés correr un evento completo antes de decidir si
              pagás el reporte.
            </p>
            <div class="actions" data-reveal>
              <a class="cta cta--lg" href="/registro">
                Crear mi banda <span aria-hidden="true">→</span>
              </a>
            </div>
          </section>
        </main>
      </div>

      <footer>
        <div class="wrap footer__meta">
          <Wordmark size={24} />
          <LegalLinks />
          <span>
            Un producto de <a href="https://macawly.dev">macawly.dev</a>
          </span>
        </div>
        {/* Decorative repeat of the wordmark already in the nav above. */}
        <p class="footer__giant" aria-hidden="true">
          coverr
        </p>
      </footer>
    </body>
  </html>
);

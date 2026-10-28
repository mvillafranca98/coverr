import type { FC, PropsWithChildren } from "hono/jsx";
import ADMIN_CSS from "../../styles/admin.css";
import TOKENS_CSS from "../../styles/tokens.css";
import { BrandIcons, Monogram } from "../brand";
import { ErrorReporter } from "../error-reporter";
import { LegalLinks } from "../legal/links";

/**
 * Copies a link, after asking first when the link carries authority.
 *
 * `navigator.clipboard` needs a secure context, which production is and
 * localhost counts as. Where it is missing the text is selected instead, so
 * the band can still copy it by hand rather than being left with a dead
 * button.
 */
const COPY_SCRIPT = `
document.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
  if (!btn) return;

  var warn = btn.getAttribute('data-warn');
  if (warn && !window.confirm(warn)) return;

  var text = btn.getAttribute('data-copy');
  var done = function () {
    var was = btn.textContent;
    btn.textContent = 'Copiado';
    setTimeout(function () { btn.textContent = was; }, 1600);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, select);
  } else {
    select();
  }

  function select() {
    var code = btn.parentNode && btn.parentNode.querySelector('code');
    if (!code) return;
    var range = document.createRange();
    range.selectNodeContents(code);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = 'Copialo a mano';
  }
});`;

export const AdminLayout: FC<
  PropsWithChildren<{
    title: string;
    bandName?: string;
    active?: string;
    eventSlug?: string;
    /** Named in the event bar so the scope of those tabs is never in doubt. */
    eventName?: string;
  }>
> = ({ title, bandName, active, eventSlug, eventName, children }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <ErrorReporter />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="theme-color" content="#0F0E0B" />
      <title>{title}</title>
      {/* The admin app's whole design system, inlined into every page rather
          than linked: the door and the dashboard both get used on venue wifi,
          where a second round trip is the difference between a page that
          paints and one that hangs. A page that needs a rule adds it to
          styles/admin.css, so there is one place to look. */}
      <BrandIcons />
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/vendor/fonts/archivo-black-latin-400-normal.woff2"
        crossorigin="anonymous"
      />
      <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS + ADMIN_CSS }} />
    </head>
    <body>
      {/* Two bars of links sit before every page's content; a keyboard user
          should not have to tab through all of them on each page. */}
      {bandName ? (
        <a class="skip" href="#main">
          Saltar al contenido
        </a>
      ) : null}
      <div class="wrap">
        {/* Two levels, because they are two scopes. Everything in the band bar
            leaves whatever event you are in; everything in the event bar acts
            on it. Flat, they read as one menu and it is not obvious which is
            which — which is exactly what happened during QA. */}
        {bandName ? (
          <header class="chrome">
            <nav class="band" aria-label="Banda">
              <span class="brand">
                <Monogram size={22} />
                {bandName}
              </span>
              <span class="band-links">
                <a href="/admin" class={active === "events" ? "on" : ""}>
                  Eventos
                </a>
                <a href="/admin/nuevo">+ Evento</a>
                <a href="/admin/banda" class={active === "band" ? "on" : ""}>
                  Banda
                </a>
                <a href="/admin/salir">Salir</a>
              </span>
            </nav>

            {eventSlug ? (
              <nav class="event" aria-label={eventName ? `Evento: ${eventName}` : "Evento"}>
                {eventName ? <span class="ev-name">{eventName}</span> : null}
                {/* Scrolls rather than wraps: five tabs on a phone used to
                    stack into three lines, which is where this read worst. */}
                <span class="ev-tabs">
                  <a href={`/admin/e/${eventSlug}`} class={active === "dash" ? "on" : ""}>
                    Resumen
                  </a>
                  <a href={`/admin/e/${eventSlug}/ordenes`} class={active === "orders" ? "on" : ""}>
                    Órdenes
                  </a>
                  <a href={`/admin/e/${eventSlug}/venta`} class={active === "manual" ? "on" : ""}>
                    Venta
                  </a>
                  <a href={`/admin/e/${eventSlug}/dinero`} class={active === "money" ? "on" : ""}>
                    Dinero
                  </a>
                  <a
                    href={`/admin/e/${eventSlug}/ajustes`}
                    class={active === "settings" ? "on" : ""}
                  >
                    Ajustes
                  </a>
                </span>
              </nav>
            ) : null}
          </header>
        ) : null}
        <main id="main">{children}</main>
        <footer>
          <div>Coverr</div>
          <LegalLinks />
        </footer>
      </div>
      {/* One delegated handler for every CopyLink on the page. Inline because
          this surface ships no script files and a copy button is not worth
          starting. */}
      <script dangerouslySetInnerHTML={{ __html: COPY_SCRIPT }} />
    </body>
  </html>
);

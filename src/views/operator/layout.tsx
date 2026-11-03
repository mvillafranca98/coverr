import type { FC, PropsWithChildren } from "hono/jsx";
import ADMIN_CSS from "../../styles/admin.css";
import TOKENS_CSS from "../../styles/tokens.css";
import { BrandIcons, Monogram } from "../brand";
import { ErrorReporter } from "../error-reporter";

/**
 * Coverr's own back office. It wears the band side's dark surface and
 * stylesheet, because it is staff-facing like the band panel, but under a bar
 * of its own, so nobody signed in as both ever mistakes one for the other.
 * Nothing a band or a buyer sees links here.
 */
export const OperatorLayout: FC<PropsWithChildren<{ title: string; signedIn?: boolean }>> = ({
  title,
  signedIn,
  children,
}) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <ErrorReporter />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="theme-color" content="#141414" />
      <title>{title}</title>
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
      <div class="wrap">
        {signedIn ? (
          <header class="chrome">
            <nav class="band" aria-label="Operación">
              <span class="brand">
                <Monogram size={22} />
                Coverr · operación
              </span>
              <span class="band-links">
                <a href="/operador" class="on">
                  Bandas
                </a>
                <a href="/operador/salir">Salir</a>
              </span>
            </nav>
          </header>
        ) : null}
        <main id="main">{children}</main>
      </div>
    </body>
  </html>
);

import type { FC } from "hono/jsx";

/**
 * The public front page. Carries its own document and stylesheet rather than
 * the admin chrome: it is the only view a logged-out stranger sees, and it
 * shares no navigation, no session and no layout with the rest of the app.
 */
/** Deliberately plain — the visual pass comes later. */
export const LandingPage: FC = () => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="theme-color" content="#0F0E0B" />
      <title>Coverr — Preventa y entrada para bandas</title>
      <meta
        name="description"
        content="Preventa por transferencia, códigos QR, entrada y cuentas claras para bandas independientes en Honduras."
      />
      <meta property="og:title" content="Coverr" />
      <meta
        property="og:description"
        content="Preventa por transferencia, códigos QR, entrada y cuentas claras para bandas."
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
:root{--bg:#0F0E0B;--surface:#181510;--line:#2F2921;--text:#F4F0E8;--muted:#A69D8F;--dim:#756E63;--accent:#E9963A;--accent-ink:#120D06;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:640px;margin:0 auto;padding:0 20px 80px}
header{padding:56px 0 30px;border-bottom:1px solid var(--line)}
.brand{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
h1{font-size:2.1rem;line-height:1.1;letter-spacing:-.025em;margin:12px 0 12px;font-weight:750}
.lede{font-size:1.05rem;color:var(--muted);margin:0}
h2{font-size:1.02rem;font-weight:650;margin:32px 0 8px}
p{color:var(--muted);margin:0 0 12px}
ol,ul{color:var(--muted);padding-left:20px;margin:0 0 12px}
li{margin-bottom:6px}
li b{color:var(--text);font-weight:600}
.cta{display:inline-block;margin-top:20px;padding:14px 22px;border-radius:10px;background:var(--accent);color:var(--accent-ink);font-weight:700;text-decoration:none}
.cta.ghost{background:transparent;color:var(--text);border:1px solid var(--line);margin-left:8px}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--dim)}
a{color:var(--accent)}
`,
        }}
      />
    </head>
    <body>
      <div class="wrap">
        <header>
          <div class="brand">Coverr</div>
          <h1>Preventa, entrada y cuentas claras para tu banda.</h1>
          <p class="lede">
            Tus compradores transfieren a tu propia cuenta. El dinero nunca pasa por nosotros.
          </p>
        </header>

        <h2>Cómo funciona</h2>
        <ol>
          <li>
            <b>Compartís un enlace</b> en el flyer o la bio. Ahí está tu número de cuenta listo para
            copiar, con el banco correcto para que nadie pague comisión.
          </li>
          <li>
            <b>El comprador transfiere</b> y sube su comprobante. Recibe sus códigos QR al instante
            y por correo.
          </li>
          <li>
            <b>En la puerta escanean</b> desde el navegador, sin instalar nada. Funciona sin señal.
          </li>
          <li>
            <b>Al final ves las cuentas</b>: preventa, taquilla, efectivo, cortesías, costos y el
            reparto de cada integrante.
          </li>
        </ol>

        <h2>Por qué</h2>
        <p>
          Porque la alternativa es un hilo de WhatsApp lleno de capturas, una hoja de cálculo
          escrita a mano, y un conteo en la puerta que nunca cuadra.
        </p>

        <h2>Precio</h2>
        <p>
          La preventa, los códigos QR, la entrada, las ventas en efectivo y el resumen en vivo son
          gratis, siempre. Sólo se paga el reporte de reparto al final de cada evento, y tu primer
          evento es gratis completo.
        </p>

        <a class="cta" href="/registro">
          Crear mi banda
        </a>
        <a class="cta ghost" href="/admin/acceso">
          Ya tengo banda
        </a>

        <footer>Coverr · Honduras</footer>
      </div>
    </body>
  </html>
);

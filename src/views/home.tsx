import type { FC } from "hono/jsx";
import { AdminLayout } from "./admin/layout";
import { formatLpsShort, formatEventDate } from "../lib/core";
import type { EventMetrics, CategoryRow, FanStats } from "../db/queries/stats";
import { OnboardingChecklist } from "./signup";

const pct = (v: number | null, digits = 0): string =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

const CATEGORY_LABEL: Record<string, string> = {
  sound: "Sonido",
  stage: "Tarima",
  promo: "Promoción",
  food: "Comida",
  art: "Arte",
  staff: "Personal",
  photo: "Fotos",
  decor: "Decoración",
  rental: "Alquiler",
  other: "Otro",
};

export const BandHomePage: FC<{
  bandName: string;
  events: EventMetrics[];
  categories: CategoryRow[];
  fans: FanStats;
  setup: { hasAccount: boolean; hasMembers: boolean };
}> = ({ bandName, events, categories, fans, setup }) => {
  const played = events.filter((e) => e.attendance > 0);
  const totals = played.reduce(
    (t, e) => ({
      attendance: t.attendance + e.attendance,
      gross: t.gross + e.gross,
      costs: t.costs + e.costs,
      net: t.net + e.net,
    }),
    { attendance: 0, gross: 0, costs: 0, net: 0 },
  );

  // Newest first, so "previous" is the next one along.
  const latest = played[0];
  const previous = played[1];
  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null || b === 0 ? null : (a - b) / b;

  return (
    <AdminLayout title={`${bandName} — Coverr`} bandName={bandName}>
      <h1>{bandName}</h1>
      <p class="sub">
        {played.length} {played.length === 1 ? "evento" : "eventos"} · {totals.attendance} personas
        en total
      </p>

      <OnboardingChecklist
        hasAccount={setup.hasAccount}
        hasMembers={setup.hasMembers}
        hasEvent={events.length > 0}
      />

      <h2>Acumulado</h2>
      <div class="cards">
        <div class="card">
          <span>Personas</span>
          <b>{totals.attendance}</b>
          <small>en {played.length} {played.length === 1 ? "evento" : "eventos"}</small>
        </div>
        <div class="card">
          <span>Bruto</span>
          <b>{formatLpsShort(totals.gross)}</b>
        </div>
        <div class="card">
          <span>Costos</span>
          <b>{formatLpsShort(totals.costs)}</b>
          <small>{pct(totals.gross > 0 ? totals.costs / totals.gross : null)} del bruto</small>
        </div>
        <div class="card">
          <span>Neto</span>
          <b>{formatLpsShort(totals.net)}</b>
          <small>
            {totals.attendance > 0
              ? `${formatLpsShort(Math.round(totals.net / totals.attendance))} por persona`
              : "—"}
          </small>
        </div>
      </div>

      {latest && previous ? (
        <>
          <h2>Último evento vs. el anterior</h2>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th class="n">{formatEventDate(previous.startsAt)}</th>
                  <th class="n">{formatEventDate(latest.startsAt)}</th>
                  <th class="n">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Personas", previous.attendance, latest.attendance, (v: number) => String(v)],
                    ["Bruto", previous.gross, latest.gross, formatLpsShort],
                    ["Costos", previous.costs, latest.costs, formatLpsShort],
                    ["Neto", previous.net, latest.net, formatLpsShort],
                    [
                      "Neto por persona",
                      previous.netPerHead ?? 0,
                      latest.netPerHead ?? 0,
                      formatLpsShort,
                    ],
                  ] as const
                ).map(([label, a, b, fmt]) => {
                  const d = delta(b, a);
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td class="n">{fmt(a)}</td>
                      <td class="n">{fmt(b)}</td>
                      <td class="n">
                        {d == null ? (
                          "—"
                        ) : (
                          <span class={`chip ${d >= 0 ? "ok" : "crit"}`}>
                            {d >= 0 ? "+" : ""}
                            {(d * 100).toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2>Cada evento</h2>
      <p class="sub" style="margin-bottom:10px">
        Todo sale de los registros, nada se escribe a mano.
      </p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th class="n">Personas</th>
              <th class="n">Preventa</th>
              <th class="n">Bruto</th>
              <th class="n">Costos</th>
              <th class="n">Neto</th>
              <th class="n">Neto/persona</th>
              <th class="n">Boleto prom.</th>
              <th class="n">Efectivo</th>
              <th class="n">No-show</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <a href={`/admin/e/${e.slug}`}>{e.name}</a>
                  <div class="muted" style="font-size:12px">
                    {formatEventDate(e.startsAt)}
                  </div>
                </td>
                <td class="n">{e.attendance}</td>
                <td class="n">{pct(e.presaleShare)}</td>
                <td class="n">{formatLpsShort(e.gross)}</td>
                <td class="n">{formatLpsShort(e.costs)}</td>
                <td class="n">{formatLpsShort(e.net)}</td>
                <td class="n">{e.netPerHead == null ? "—" : formatLpsShort(e.netPerHead)}</td>
                <td class="n">{e.avgTicket == null ? "—" : formatLpsShort(e.avgTicket)}</td>
                <td class="n">{pct(e.cashShareOfDoor)}</td>
                <td class="n">{pct(e.noShowRate, 1)}</td>
              </tr>
            ))}
            {played.length > 1 ? (
              <tr class="tot">
                <td>Total</td>
                <td class="n">{totals.attendance}</td>
                <td class="n" />
                <td class="n">{formatLpsShort(totals.gross)}</td>
                <td class="n">{formatLpsShort(totals.costs)}</td>
                <td class="n">{formatLpsShort(totals.net)}</td>
                <td class="n" />
                <td class="n" />
                <td class="n" />
                <td class="n" />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p class="sub" style="margin-top:8px">
        <b>No-show</b> es cuánta gente pagó preventa y no llegó. Es un número que antes no se podía
        medir — la lista impresa se marcaba y se botaba.
      </p>

      {categories.length > 0 ? (
        <>
          <h2>Costos por categoría</h2>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  {played.map((e) => (
                    <th class="n" key={e.id}>
                      {formatEventDate(e.startsAt).replace(/^\w+ /, "")}
                    </th>
                  ))}
                  <th class="n">Total</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.category}>
                    <td>{CATEGORY_LABEL[cat.category] ?? cat.category}</td>
                    {played.map((e) => (
                      <td class="n" key={e.id}>
                        {cat.perEvent[e.id] ? formatLpsShort(cat.perEvent[e.id]!) : "—"}
                      </td>
                    ))}
                    <td class="n">{formatLpsShort(cat.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2>Tu gente</h2>
      <div class="cards">
        <div class="card">
          <span>Personas únicas</span>
          <b>{fans.uniquePeople}</b>
          <small>en todos los eventos</small>
        </div>
        <div class="card">
          <span>Repitieron</span>
          <b>{fans.repeatPeople}</b>
          <small>vinieron a más de uno</small>
        </div>
        <div class="card">
          <span>Del último</span>
          <b>{pct(fans.returningShareLatest)}</b>
          <small>ya habían venido</small>
        </div>
        <div class="card">
          <span>Fieles</span>
          <b>{fans.regulars.length}</b>
          <small>3 eventos o más</small>
        </div>
      </div>
      <p class="sub" style="margin-top:10px">
        Se agrupa por el correo de quien pagó. No incluye ventas en efectivo ni cortesías — ahí
        nadie deja su correo.
      </p>

      {fans.regulars.length > 0 ? (
        <div class="scroll" style="margin-top:12px">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th class="n">Eventos</th>
                <th class="n">Boletos</th>
              </tr>
            </thead>
            <tbody>
              {fans.regulars.map((r) => (
                <tr key={r.email}>
                  <td>{r.name}</td>
                  <td>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </td>
                  <td class="n">{r.events}</td>
                  <td class="n">{r.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="sub">
          Todavía nadie ha venido a tres eventos. Esta lista se llena sola con el tiempo.
        </p>
      )}
    </AdminLayout>
  );
};

// ----------------------------------------------------------------- landing

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

import type { FC, PropsWithChildren } from "hono/jsx";
import {
  formatLps, formatLpsShort, formatEventDate, bankLabel, isRenderableImage,
} from "../lib/core";
import type { Settlement } from "../lib/settlement";

export const ADMIN_CSS = `
:root{
  --bg:#0F0E0B;--surface:#181510;--surface-2:#221E17;--line:#2F2921;--line-2:#443C31;
  --text:#F4F0E8;--muted:#A69D8F;--dim:#756E63;
  --accent:#E9963A;--accent-ink:#120D06;
  --ok:#5FBB88;--ok-bg:#12251A;--warn:#E0AC42;--warn-bg:#2A2110;--crit:#E2705F;--crit-bg:#2A1512;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
.wrap{max-width:980px;margin:0 auto;padding:0 18px 80px}

nav.top{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 0;border-bottom:1px solid var(--line);margin-bottom:22px}
nav.top .brand{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
nav.top a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:550}
nav.top a.on{color:var(--text)}
nav.top .sp{margin-left:auto}

h1{font-size:1.75rem;font-weight:750;letter-spacing:-.022em;margin:0 0 4px;text-wrap:balance}
.sub{color:var(--muted);font-size:14px;margin:0 0 22px}
h2{font-size:1.05rem;font-weight:650;margin:30px 0 10px;letter-spacing:-.01em}
h2:first-of-type{margin-top:0}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:8px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:13px 15px}
.card b{display:block;font-size:1.65rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1;letter-spacing:-.02em}
.card span{font-size:10.5px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.card small{display:block;font-size:12px;color:var(--muted);margin-top:3px}
.card.warn{border-color:#4A3A16;background:var(--warn-bg)}
.card.warn b{color:var(--warn)}

.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:11px;background:var(--surface);margin-bottom:8px}
table{border-collapse:collapse;width:100%;font-size:14px}
th{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);text-align:left;padding:9px 13px;border-bottom:1px solid var(--line-2);white-space:nowrap}
td{padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--muted)}
td:first-child{color:var(--text)}
tr:last-child td{border-bottom:none}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono)}
tr.tot td{border-top:1px solid var(--line-2);font-weight:650;color:var(--text)}

.chip{display:inline-block;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:3px;white-space:nowrap}
.chip.ok{background:var(--ok-bg);color:var(--ok)}
.chip.warn{background:var(--warn-bg);color:var(--warn)}
.chip.crit{background:var(--crit-bg);color:var(--crit)}
.chip.info{background:var(--surface-2);color:var(--dim)}

form.inline{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}
label.fl{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px}
input[type=text],input[type=email],input[type=number],select{padding:10px 11px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface);color:var(--text);font-size:15px;font-family:var(--sans);width:100%}
input:focus,select:focus{outline:2px solid var(--accent);outline-offset:-1px}
.btn{padding:10px 16px;border:none;border-radius:8px;background:var(--accent);color:var(--accent-ink);font:650 14px/1.2 var(--sans);cursor:pointer;white-space:nowrap}
.btn.ghost{background:var(--surface-2);color:var(--text);border:1px solid var(--line-2)}
.btn.danger{background:var(--crit-bg);color:var(--crit);border:1px solid #4A211B}
.btn:active{filter:brightness(.9)}
.btn.sm{padding:6px 11px;font-size:12.5px}

.note{background:var(--surface);border:1px solid var(--line);border-left:2px solid var(--line-2);border-radius:8px;padding:12px 15px;margin:0 0 16px;font-size:14px;color:var(--muted)}
.note.warn{border-left-color:var(--warn);background:var(--warn-bg);color:#F0D89C}
.note.ok{border-left-color:var(--ok);background:var(--ok-bg);color:#A8DDBF}
.note.crit{border-left-color:var(--crit);background:var(--crit-bg);color:#F0B5AC}

.proof{max-width:100%;border-radius:9px;border:1px solid var(--line-2);display:block}
.kv{display:grid;grid-template-columns:auto 1fr;gap:5px 16px;font-size:13.5px;margin:0}
.kv dt{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);padding-top:3px}
.kv dd{margin:0;color:var(--text)}
.muted{color:var(--muted)}
.right{text-align:right}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--dim)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export const AdminLayout: FC<
  PropsWithChildren<{ title: string; bandName?: string; active?: string; eventSlug?: string }>
> = ({ title, bandName, active, eventSlug, children }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="theme-color" content="#0F0E0B" />
      <title>{title}</title>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
    </head>
    <body>
      <div class="wrap">
        {bandName ? (
          <nav class="top">
            <span class="brand">{bandName}</span>
            {eventSlug ? (
              <>
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
                <a href={`/admin/e/${eventSlug}/ajustes`} class={active === "settings" ? "on" : ""}>
                  Ajustes
                </a>
              </>
            ) : null}
            <span class="sp" />
            <a href="/admin">Eventos</a>
            <a href="/admin/nuevo">+ Evento</a>
            <a href="/admin/banda">Banda</a>
            <a href="/admin/salir">Salir</a>
          </nav>
        ) : null}
        {children}
        <footer>Coverr</footer>
      </div>
    </body>
  </html>
);

// ------------------------------------------------------------------- login

export const LoginPage: FC<{ sent?: boolean; error?: string }> = ({ sent, error }) => (
  <AdminLayout title="Coverr — Admin">
    <div style="max-width:400px;margin:60px auto 0">
      <div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)">
        Coverr
      </div>
      <h1 style="margin-top:8px">Panel de la banda</h1>
      {sent ? (
        <div class="note ok">
          Si ese correo pertenece a una banda, te enviamos un enlace para entrar. Revisá tu bandeja
          — el enlace vence en 15 minutos.
        </div>
      ) : (
        <form method="post" action="/admin/login">
          <p class="sub">Te mandamos un enlace para entrar. No hay contraseña.</p>
          {error ? <div class="note crit">{error}</div> : null}
          <label class="fl" for="email">
            Correo de la banda
          </label>
          <input type="email" name="email" id="email" required autocomplete="email" />
          <button class="btn" style="margin-top:12px;width:100%" type="submit">
            Enviar enlace
          </button>
          <p class="sub" style="margin-top:18px">
            ¿Todavía no tenés banda? <a href="/registro">Creala acá</a>
          </p>
        </form>
      )}
    </div>
  </AdminLayout>
);

// ------------------------------------------------------------- event list

export const EventsPage: FC<{
  bandName: string;
  events: {
    slug: string;
    name: string;
    venue: string;
    startsAt: string;
    status: string;
    sold: number;
    gross: number;
  }[];
}> = ({ bandName, events }) => (
  <AdminLayout title={`Eventos — ${bandName}`} bandName={bandName}>
    <h1>Eventos</h1>
    <p class="sub">{bandName}</p>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Evento</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th class="n">Boletos</th>
            <th class="n">Bruto</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.slug}>
              <td>
                <a href={`/admin/e/${e.slug}`}>{e.name}</a>
                <div class="muted" style="font-size:12.5px">
                  {e.venue}
                </div>
              </td>
              <td>{formatEventDate(e.startsAt)}</td>
              <td>
                <span class={`chip ${e.status === "live" ? "ok" : "info"}`}>{e.status}</span>
              </td>
              <td class="n">{e.sold}</td>
              <td class="n">{formatLpsShort(e.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </AdminLayout>
);

// -------------------------------------------------------------- dashboard

export type DashProps = {
  bandName: string;
  event: { slug: string; name: string; venue: string; startsAt: string; status: string };
  counts: {
    sold: number;
    inside: number;
    presale: number;
    doorCash: number;
    doorOnline: number;
    manual: number;
    comp: number;
  };
  channels: {
    presale: number; doorTransfer: number; doorCash: number; manual: number; comp: number;
  };
  byAccount: { bank: string; count: number; amount: number }[];
  wristbands: { start: number | null; left: number | null };
  openFlags: number;
  openRefunds: number;
  settlement: Settlement;
  scanUrl: string | null;
};

export const DashboardPage: FC<DashProps> = (p) => {
  const outside = p.counts.sold - p.counts.inside;
  return (
    <AdminLayout
      title={`${p.event.name} — Coverr`}
      bandName={p.bandName}
      active="dash"
      eventSlug={p.event.slug}
    >
      <h1>{p.event.name}</h1>
      <p class="sub">
        {formatEventDate(p.event.startsAt)} · {p.event.venue} ·{" "}
        <span class={`chip ${p.event.status === "live" ? "ok" : "info"}`}>{p.event.status}</span>
      </p>

      {p.openRefunds > 0 ? (
        <div class="note warn">
          <b>
            {p.openRefunds} {p.openRefunds === 1 ? "solicitud" : "solicitudes"} de reembolso
          </b>{" "}
          — <a href={`/admin/e/${p.event.slug}/ordenes?filtro=refunds`}>revisarlas</a>.
        </div>
      ) : null}

      {p.openFlags > 0 ? (
        <div class="note warn">
          <b>
            {p.openFlags} {p.openFlags === 1 ? "comprobante" : "comprobantes"} por revisar
          </b>{" "}
          — <a href={`/admin/e/${p.event.slug}/ordenes?filtro=flagged`}>verlos</a>. Los compradores
          ya tienen su QR; esto es control interno.
        </div>
      ) : null}

      <h2>En vivo</h2>
      <div class="cards">
        <div class="card">
          <span>Adentro</span>
          <b>{p.counts.inside}</b>
          <small>{outside} todavía afuera</small>
        </div>
        <div class="card">
          <span>Vendidos</span>
          <b>{p.counts.sold}</b>
          <small>{p.counts.comp} cortesías</small>
        </div>
        <div class="card">
          <span>Brazaletes</span>
          <b>{p.wristbands.left ?? "—"}</b>
          <small>
            {p.wristbands.start != null ? `de ${p.wristbands.start}` : "sin conteo inicial"}
          </small>
        </div>
        <div class="card">
          <span>Bruto</span>
          <b>{formatLpsShort(p.settlement.gross)}</b>
          <small>antes de costos</small>
        </div>
      </div>

      <h2>Ingresos por canal</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Canal</th>
              <th class="n">Personas</th>
              <th class="n">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Preventa</td>
              <td class="n">{p.counts.presale}</td>
              <td class="n">{formatLps(p.channels.presale)}</td>
            </tr>
            <tr>
              <td>Taquilla — transferencia</td>
              <td class="n">{p.counts.doorOnline}</td>
              <td class="n">{formatLps(p.channels.doorTransfer)}</td>
            </tr>
            <tr>
              <td>Taquilla — efectivo</td>
              <td class="n">{p.counts.doorCash}</td>
              <td class="n">{formatLps(p.channels.doorCash)}</td>
            </tr>
            <tr>
              <td>Venta manual</td>
              <td class="n">{p.counts.manual}</td>
              <td class="n">{formatLps(p.channels.manual)}</td>
            </tr>
            <tr>
              <td>Cortesías</td>
              <td class="n">{p.counts.comp}</td>
              <td class="n">L0.00</td>
            </tr>
            <tr class="tot">
              <td>Total</td>
              <td class="n">{p.counts.sold}</td>
              <td class="n">{formatLps(p.settlement.gross)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {p.byAccount.length > 0 ? (
        <>
          <h2>Por cuenta</h2>
          <p class="sub" style="margin-bottom:10px">
            Lo que dijo cada comprador al pagar. Sirve para cuadrar contra lo que llegó a cada
            banco.
          </p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Banco del comprador</th>
                  <th class="n">Órdenes</th>
                  <th class="n">Monto</th>
                </tr>
              </thead>
              <tbody>
                {p.byAccount.map((a) => (
                  <tr key={a.bank}>
                    <td>{bankLabel(a.bank)}</td>
                    <td class="n">{a.count}</td>
                    <td class="n">{formatLps(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {p.scanUrl ? (
        <>
          <h2>Entrada</h2>
          <div class="note">
            Enlace para el personal de la puerta. Quien lo tenga puede registrar entradas — compartilo
            sólo con tu staff.
            <div style="margin-top:8px;font-family:var(--mono);font-size:12.5px;word-break:break-all;color:var(--text)">
              {p.scanUrl}
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
};

// ----------------------------------------------------------------- orders

export type OrderRow = {
  id: string;
  shortCode: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string | null;
  quantity: number;
  expectedAmount: number;
  channel: string;
  status: string;
  verificationStatus: string;
  bankSelected: string | null;
  createdAt: string;
  note: string | null;
  attendees: string;
  checkedIn: number;
  flag: string | null;
};

const CHANNEL_LABEL: Record<string, string> = {
  online: "Preventa",
  door_online: "Taquilla",
  door_cash: "Efectivo",
  manual: "Manual",
  comp: "Cortesía",
};

export const OrdersPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  orders: OrderRow[];
  q: string;
  filter: string;
  total: number;
}> = ({ bandName, event, orders, q, filter, total }) => (
  <AdminLayout
    title={`Órdenes — ${event.name}`}
    bandName={bandName}
    active="orders"
    eventSlug={event.slug}
  >
    <h1>Órdenes</h1>
    <p class="sub">
      {total} {total === 1 ? "orden" : "órdenes"} · {event.name}
    </p>

    <form class="inline" method="get">
      <div style="flex:1;min-width:200px">
        <label class="fl" for="q">
          Buscar
        </label>
        <input type="text" name="q" id="q" value={q} placeholder="Nombre, correo o código" />
      </div>
      <div style="min-width:150px">
        <label class="fl" for="filtro">
          Filtro
        </label>
        <select name="filtro" id="filtro">
          <option value="" selected={filter === ""}>
            Todas
          </option>
          <option value="flagged" selected={filter === "flagged"}>
            Por revisar
          </option>
          <option value="online" selected={filter === "online"}>
            Preventa
          </option>
          <option value="door_cash" selected={filter === "door_cash"}>
            Efectivo en puerta
          </option>
          <option value="manual" selected={filter === "manual"}>
            Venta manual
          </option>
          <option value="comp" selected={filter === "comp"}>
            Cortesías
          </option>
          <option value="inside" selected={filter === "inside"}>
            Ya entraron
          </option>
          <option value="refunds" selected={filter === "refunds"}>
            Reembolsos pedidos
          </option>
        </select>
      </div>
      <button class="btn" type="submit">
        Aplicar
      </button>
      <a class="btn ghost" href={`/admin/e/${event.slug}/ordenes.csv`}>
        CSV
      </a>
    </form>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Comprador</th>
            <th>Asistentes</th>
            <th>Canal</th>
            <th class="n">Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colspan={6} class="muted">
                Nada que mostrar con ese filtro.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <a href={`/admin/e/${event.slug}/orden/${o.id}`}>{o.shortCode}</a>
                </td>
                <td>
                  {o.payerName}
                  <div class="muted" style="font-size:12px">
                    {o.payerEmail}
                  </div>
                </td>
                <td style="max-width:220px">
                  {o.attendees}
                  <div class="muted" style="font-size:12px">
                    {o.checkedIn}/{o.quantity} adentro
                  </div>
                </td>
                <td>{CHANNEL_LABEL[o.channel] ?? o.channel}</td>
                <td class="n">{formatLpsShort(o.expectedAmount)}</td>
                <td>
                  {o.status !== "confirmed" ? (
                    <span class="chip crit">{o.status}</span>
                  ) : o.flag ? (
                    <span class="chip warn">revisar</span>
                  ) : (
                    <span class="chip ok">ok</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </AdminLayout>
);

// ----------------------------------------------------------- order detail

export const OrderPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  order: OrderRow;
  attendees: { id: string; name: string; note: string | null; checkedInAt: string | null }[];
  proof: {
    id: string;
    contentType: string;
    fileSize: number;
    uploadedAt: string;
    docType: string;
    xAmount: number | null;
    xReference: string | null;
    xSenderName: string | null;
    xSenderAccount: string | null;
    xDestAccount: string | null;
    xDestName: string | null;
    xCurrency: string | null;
    xDatetime: string | null;
    xDetail: string | null;
    xBank: string | null;
    ocrConfidence: number | null;
  } | null;
  flags: { id: string; code: string; severity: string; detail: string; resolvedAt: string | null }[];
  refund: { id: string; requestedAt: string; reason: string | null; status: string } | null;
}> = ({ bandName, event, order, attendees, proof, flags, refund }) => (
  <AdminLayout
    title={`${order.shortCode} — ${event.name}`}
    bandName={bandName}
    active="orders"
    eventSlug={event.slug}
  >
    <h1>{order.shortCode}</h1>
    <p class="sub">
      {CHANNEL_LABEL[order.channel] ?? order.channel} ·{" "}
      {new Date(order.createdAt).toLocaleString("es-HN")}
    </p>

    {flags
      .filter((f) => !f.resolvedAt)
      .map((f) => (
        <div class={`note ${f.severity === "critical" ? "crit" : "warn"}`} key={f.id}>
          <b>{f.code}</b> — {f.detail}
          <form method="post" action={`/admin/e/${event.slug}/orden/${order.id}/resolver`} style="margin-top:10px">
            <input type="hidden" name="flag_id" value={f.id} />
            <button class="btn sm" type="submit">
              Revisado y resuelto
            </button>
          </form>
        </div>
      ))}

    {refund ? (
      <>
        <h2>Solicitud de reembolso</h2>
        <div class={`note ${refund.status === "open" ? "warn" : ""}`}>
          <div style="font-size:12px;color:var(--dim);font-family:var(--mono)">
            {new Date(refund.requestedAt).toLocaleString("es-HN")} ·{" "}
            {refund.status === "open"
              ? "pendiente"
              : refund.status === "approved"
                ? "aprobada"
                : "rechazada"}
          </div>
          <p style="margin:8px 0 0;color:var(--text)">{refund.reason ?? "Sin motivo."}</p>
          {refund.status === "open" ? (
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
              <form method="post" action={`/admin/e/${event.slug}/orden/${order.id}/reembolso`}>
                <input type="hidden" name="decision" value="approved" />
                <button class="btn sm" type="submit">
                  Aprobar y anular los boletos
                </button>
              </form>
              <form method="post" action={`/admin/e/${event.slug}/orden/${order.id}/reembolso`}>
                <input type="hidden" name="decision" value="denied" />
                <button class="btn sm ghost" type="submit">
                  Rechazar
                </button>
              </form>
            </div>
          ) : null}
          <p class="sub" style="margin:10px 0 0">
            Aprobar invalida los códigos QR y saca la orden de los totales. El dinero lo devolvés
            vos desde tu banco — Coverr nunca lo tuvo.
          </p>
        </div>
      </>
    ) : null}

    {order.note ? (
      <div class="note">
        <div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)">
          Motivo
        </div>
        <div style="color:var(--text);margin-top:4px">{order.note}</div>
      </div>
    ) : null}

    <h2>Comprador</h2>
    <dl class="kv">
      <dt>Nombre</dt>
      <dd>{order.payerName}</dd>
      <dt>Correo</dt>
      <dd>
        <a href={`mailto:${order.payerEmail}`}>{order.payerEmail}</a>
      </dd>
      <dt>Teléfono</dt>
      <dd>
        {order.payerPhone ? (
          <a href={`https://wa.me/504${order.payerPhone}`}>{order.payerPhone}</a>
        ) : (
          <span class="muted">—</span>
        )}
      </dd>
      <dt>Banco</dt>
      <dd>{order.bankSelected ? bankLabel(order.bankSelected) : <span class="muted">—</span>}</dd>
      <dt>Monto</dt>
      <dd>{formatLps(order.expectedAmount)}</dd>
    </dl>

    <h2>Asistentes</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Nota</th>
            <th>Entrada</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {attendees.map((a) => (
            <tr key={a.id}>
              <td>
                <form
                  method="post"
                  action={`/admin/e/${event.slug}/orden/${order.id}/asistente`}
                  style="display:flex;gap:6px"
                >
                  <input type="hidden" name="attendee_id" value={a.id} />
                  <input type="text" name="name" value={a.name} style="min-width:150px" />
                  <button class="btn sm ghost" type="submit">
                    Guardar
                  </button>
                </form>
              </td>
              <td>{a.note ?? <span class="muted">—</span>}</td>
              <td>
                {a.checkedInAt ? (
                  <span class="chip ok">
                    {new Date(a.checkedInAt).toLocaleTimeString("es-HN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ) : (
                  <span class="chip info">afuera</span>
                )}
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p class="sub" style="margin-top:8px">
      Cambiar el nombre aquí es todo lo que hace falta para transferir un boleto a otra persona.
    </p>

    <h2>Comprobante</h2>
    {proof ? (
      <>
        <dl class="kv" style="margin-bottom:14px">
          <dt>Subido</dt>
          <dd>{new Date(proof.uploadedAt).toLocaleString("es-HN")}</dd>
          <dt>Archivo</dt>
          <dd>
            {proof.contentType} · {Math.round(proof.fileSize / 1024)} KB
          </dd>
        </dl>

        <h4
          style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0 0 8px;font-weight:600"
        >
          Lo que dice el comprobante
        </h4>
        {proof.xReference || proof.xAmount != null || proof.xSenderName ? (
          <dl class="kv" style="margin-bottom:14px">
            <dt>Formato</dt>
            <dd>
              {proof.docType}
              {proof.xBank ? ` · ${proof.xBank}` : ""}
            </dd>
            <dt>Envió</dt>
            <dd>
              {proof.xSenderName ?? <span class="muted">—</span>}
              {proof.xSenderAccount ? (
                <span class="muted"> · cta {proof.xSenderAccount}</span>
              ) : null}
            </dd>
            <dt>Recibió</dt>
            <dd>
              {proof.xDestAccount ?? <span class="muted">—</span>}
              {proof.xDestName ? <span class="muted"> · {proof.xDestName}</span> : null}
            </dd>
            <dt>Monto</dt>
            <dd>
              {proof.xAmount == null ? (
                <span class="muted">—</span>
              ) : (
                <>
                  {formatLps(proof.xAmount)}
                  {proof.xAmount !== order.expectedAmount ? (
                    <span class="muted"> · se esperaba {formatLps(order.expectedAmount)}</span>
                  ) : null}
                </>
              )}
            </dd>
            <dt>Fecha</dt>
            <dd>{proof.xDatetime ?? <span class="muted">—</span>}</dd>
            <dt>Referencia</dt>
            <dd>{proof.xReference ?? <span class="muted">—</span>}</dd>
            <dt>Detalle</dt>
            <dd>{proof.xDetail ?? <span class="muted">sin detalle</span>}</dd>
          </dl>
        ) : (
          <p class="muted" style="margin-bottom:14px">
            Todavía no se ha leído este comprobante.
          </p>
        )}
        <form
          method="post"
          action={`/admin/e/${event.slug}/orden/${order.id}/revisar`}
          style="margin-bottom:14px"
        >
          <button class="btn sm ghost" type="submit">
            Volver a leer el comprobante
          </button>
        </form>
        {isRenderableImage(proof.contentType) ? (
          <img
            class="proof"
            src={`/admin/e/${event.slug}/orden/${order.id}/comprobante`}
            alt="Comprobante de pago"
          />
        ) : (
          <div class="note warn">
            El navegador no puede mostrar <span class="mono">{proof.contentType}</span> — descargalo
            para verlo.
            <div style="margin-top:10px">
              <a class="btn sm ghost" href={`/admin/e/${event.slug}/orden/${order.id}/comprobante`}>
                Descargar comprobante
              </a>
            </div>
          </div>
        )}
      </>
    ) : (
      <p class="muted">Sin comprobante (venta en efectivo o cortesía).</p>
    )}

    {order.status === "confirmed" ? (
      <>
        <h2>Anular</h2>
        <div class="note">
          Anular invalida los códigos QR y descuenta la orden de los totales. El historial se
          conserva.
          <form method="post" action={`/admin/e/${event.slug}/orden/${order.id}/anular`} style="margin-top:10px">
            <button class="btn danger sm" type="submit">
              Anular esta orden
            </button>
          </form>
        </div>
      </>
    ) : null}
  </AdminLayout>
);

// ------------------------------------------------------------------ money

export const MoneyPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  expenses: { id: string; label: string; category: string; amount: number; paid: number }[];
  settlement: Settlement;
  advancesByMember: Record<string, number>;
  unlocked: boolean;
  bracket: { bracket: string; amount: number };
  isFirstEvent: boolean;
}> = ({ bandName, event, expenses, settlement, unlocked, bracket, isFirstEvent }) => (
  <AdminLayout
    title={`Dinero — ${event.name}`}
    bandName={bandName}
    active="money"
    eventSlug={event.slug}
  >
    <h1>Dinero</h1>
    <p class="sub">{event.name}</p>

    <h2>Costos</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Categoría</th>
            <th class="n">Monto</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colspan={4} class="muted">
                Sin costos registrados.
              </td>
            </tr>
          ) : (
            expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.label}</td>
                <td class="muted">{e.category}</td>
                <td class="n">{formatLps(e.amount)}</td>
                <td class="right">
                  <form method="post" action={`/admin/e/${event.slug}/dinero/costo/borrar`}>
                    <input type="hidden" name="id" value={e.id} />
                    <button class="btn sm ghost" type="submit">
                      Quitar
                    </button>
                  </form>
                </td>
              </tr>
            ))
          )}
          <tr class="tot">
            <td>Total</td>
            <td />
            <td class="n">{formatLps(settlement.costs)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>

    <form class="inline" method="post" action={`/admin/e/${event.slug}/dinero/costo`}>
      <div style="flex:1;min-width:170px">
        <label class="fl" for="label">
          Concepto
        </label>
        <input type="text" name="label" id="label" required placeholder="Sonido" />
      </div>
      <div style="min-width:130px">
        <label class="fl" for="category">
          Categoría
        </label>
        <select name="category" id="category">
          <option value="sound">Sonido</option>
          <option value="stage">Tarima</option>
          <option value="promo">Promoción</option>
          <option value="food">Comida</option>
          <option value="art">Arte</option>
          <option value="staff">Personal</option>
          <option value="photo">Fotos</option>
          <option value="decor">Decoración</option>
          <option value="rental">Alquiler</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <div style="min-width:120px">
        <label class="fl" for="amount">
          Monto (L)
        </label>
        <input type="number" name="amount" id="amount" step="0.01" min="0" required />
      </div>
      <button class="btn" type="submit">
        Agregar
      </button>
    </form>

    <h2>Reparto</h2>
    {settlement.pctTotal !== 100 ? (
      <div class="note warn">
        Los porcentajes suman <b>{settlement.pctTotal}%</b>, no 100%. Puede ser intencional (algo
        queda en el fondo de la banda), pero revisalo.
      </div>
    ) : null}

    {unlocked ? (
      <>
        <div class="cards">
          <div class="card">
            <span>Bruto</span>
            <b>{formatLpsShort(settlement.gross)}</b>
          </div>
          <div class="card">
            <span>Costos</span>
            <b>−{formatLpsShort(settlement.costs)}</b>
          </div>
          <div class="card">
            <span>Neto</span>
            <b>{formatLpsShort(settlement.net)}</b>
          </div>
        </div>
        <div class="scroll" style="margin-top:12px">
          <table>
            <thead>
              <tr>
                <th>Integrante</th>
                <th class="n">%</th>
                <th class="n">Parte</th>
                <th class="n">Adelantos</th>
                <th class="n">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {settlement.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td class="n">{m.splitPct}%</td>
                  <td class="n">{formatLps(m.share)}</td>
                  <td class="n">{m.advances ? `−${formatLps(m.advances)}` : "—"}</td>
                  <td class="n">
                    <b>{formatLps(m.payout)}</b>
                  </td>
                </tr>
              ))}
              {settlement.unallocated !== 0 ? (
                <tr class="tot">
                  <td colspan={4}>Sin asignar</td>
                  <td class="n">{formatLps(settlement.unallocated)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </>
    ) : (
      <div class="note warn">
        <b>El reporte de reparto está bloqueado.</b>
        <p style="margin:8px 0 0">
          Todo lo demás — preventa, códigos QR, entrada, ventas en efectivo, el resumen en vivo — es
          gratis y siempre lo va a ser. El reparto final de este evento cuesta{" "}
          <b>{formatLpsShort(bracket.amount)}</b>
          {isFirstEvent ? " (pero tu primer evento es gratis)" : ""}.
        </p>
        <form method="post" action={`/admin/e/${event.slug}/dinero/desbloquear`} style="margin-top:12px">
          <button class="btn" type="submit">
            {isFirstEvent ? "Desbloquear gratis" : `Desbloquear por ${formatLpsShort(bracket.amount)}`}
          </button>
        </form>
      </div>
    )}
  </AdminLayout>
);

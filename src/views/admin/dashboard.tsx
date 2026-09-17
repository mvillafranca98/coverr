import type { FC } from "hono/jsx";
import { formatLps, formatLpsShort, formatEventDate, bankLabel } from "../../lib/core";
import type { Settlement } from "../../lib/settlement";
import { AdminLayout } from "./layout";

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

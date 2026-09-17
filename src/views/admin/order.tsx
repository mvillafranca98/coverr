import type { FC } from "hono/jsx";
import { formatLps, bankLabel, isRenderableImage } from "../../lib/core";
import { AdminLayout } from "./layout";
import { CHANNEL_LABEL, type OrderRow } from "./order-row";

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

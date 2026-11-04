import type { FC } from "hono/jsx";
import {
  bankLabel,
  formatDayMonth,
  formatEventTime,
  formatLps,
  formatMoment,
  isRenderableImage,
} from "../../lib/core";
import { flagLabel, NOTE_ONLY_FLAG } from "../../lib/verify";
import { AdminLayout } from "./layout";
import { CHANNEL_LABEL, type OrderRow } from "./order-row";

export const OrderPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  order: OrderRow;
  attendees: {
    id: string;
    name: string;
    note: string | null;
    checkedInAt: string | null;
    voidedAt: string | null;
  }[];
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
    /** Set once the retention window has run; the file is gone from R2. */
    purgedAt: string | null;
  } | null;
  flags: {
    id: string;
    code: string;
    severity: string;
    detail: string;
    resolvedAt: string | null;
  }[];
  refund: { id: string; requestedAt: string; reason: string | null; status: string } | null;
  error?: string;
}> = ({ bandName, event, order, attendees, proof, flags, refund, error }) => {
  // A partially refunded order keeps the tickets that were not returned, so
  // almost everything below asks about the live ones rather than the whole set.
  const live = attendees.filter((a) => a.voidedAt === null);
  const refunded = attendees.filter((a) => a.voidedAt !== null);

  return (
    <AdminLayout
      title={`${order.shortCode} — ${event.name}`}
      bandName={bandName}
      active="orders"
      eventSlug={event.slug}
      eventName={event.name}
    >
      <h1>{order.shortCode}</h1>
      <p class="sub">
        {CHANNEL_LABEL[order.channel] ?? order.channel} · {formatMoment(order.createdAt)}
      </p>

      {error ? <div class="note crit">{error}</div> : null}

      {flags
        .filter((f) => !f.resolvedAt)
        .map((f) =>
          // A note, not a to-do: nothing to resolve, so no button and no colour.
          f.code === NOTE_ONLY_FLAG ? (
            <div class="note" key={f.id}>
              <b>{flagLabel(f.code)}</b> — {f.detail}
            </div>
          ) : (
            <div class={`note ${f.severity === "critical" ? "crit" : "warn"}`} key={f.id}>
              <b>{flagLabel(f.code)}</b> — {f.detail}
              <form
                method="post"
                action={`/admin/e/${event.slug}/orden/${order.id}/resolver`}
                style="margin-top:10px"
              >
                <input type="hidden" name="flag_id" value={f.id} />
                <button class="btn sm" type="submit">
                  Revisado y resuelto
                </button>
              </form>
            </div>
          ),
        )}

      {refund ? (
        <>
          <h2>Solicitud de reembolso</h2>
          <div class={`note ${refund.status === "open" ? "warn" : ""}`}>
            {/* No colours of its own: the note sets them, dark ink while it is
                yellow and the page greys once the request is decided. */}
            <div style="font-size:12px;font-family:var(--mono)">
              {formatMoment(refund.requestedAt)} ·{" "}
              {refund.status === "open"
                ? "pendiente"
                : refund.status === "approved"
                  ? "aprobada"
                  : "rechazada"}
            </div>
            <p style="margin:8px 0 0;font-weight:700">{refund.reason ?? "Sin motivo."}</p>
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
        <dd>
          {formatLps(live.length * order.unitAmount)}
          {attendees.length > 1 ? (
            <span class="muted">
              {" "}
              · {live.length} × {formatLps(order.unitAmount)}
            </span>
          ) : null}
          {refunded.length > 0 ? (
            <div class="muted">
              {refunded.length} reembolsado{refunded.length > 1 ? "s" : ""} ·{" "}
              {formatLps(refunded.length * order.unitAmount)} devueltos de{" "}
              {formatLps(order.expectedAmount)}
            </div>
          ) : null}
        </dd>
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
                    <input
                      type="text"
                      name="name"
                      value={a.name}
                      aria-label={`Nombre de ${a.name}`}
                      style="min-width:150px"
                    />
                    <button class="btn sm ghost" type="submit" aria-label={`Guardar ${a.name}`}>
                      Guardar
                    </button>
                  </form>
                </td>
                <td>{a.note ?? <span class="muted">—</span>}</td>
                <td>
                  {a.voidedAt ? (
                    <span class="chip crit">reembolsado</span>
                  ) : a.checkedInAt ? (
                    <span class="chip ok">{formatEventTime(a.checkedInAt)}</span>
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
            <dd>{formatMoment(proof.uploadedAt)}</dd>
            <dt>Archivo</dt>
            <dd>
              {proof.contentType} · {Math.round(proof.fileSize / 1024)} KB
            </dd>
          </dl>

          <h4 style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0 0 8px;font-weight:600">
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
          {proof.purgedAt ? (
            <div class="note">
              El comprobante se borró el {formatDayMonth(proof.purgedAt, { year: true })}, 30 días
              después del evento. Los datos de la cuenta de quien pagó se borraron con él — eran de
              un tercero. Lo que queda arriba es lo que no identifica a nadie.
            </div>
          ) : isRenderableImage(proof.contentType) ? (
            <img
              class="proof"
              src={`/admin/e/${event.slug}/orden/${order.id}/comprobante`}
              alt="Comprobante de pago"
            />
          ) : (
            <div class="note warn">
              El navegador no puede mostrar <span class="mono">{proof.contentType}</span> —
              descargalo para verlo.
              <div style="margin-top:10px">
                <a
                  class="btn sm ghost"
                  href={`/admin/e/${event.slug}/orden/${order.id}/comprobante`}
                >
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
          <h2>Anular o reembolsar</h2>
          {/* Two different things, kept apart on purpose. Anular is for an order
            that should not exist — a test, a duplicate, a mistake. Reembolsar
            is for money going back, and records why. Both stop the QR codes
            and drop the order from the totals; only one implies a transfer. */}
          <div class="note">
            <b>Anular</b> invalida los códigos QR y descuenta la orden de los totales, sin registrar
            ninguna devolución. Para una orden que no debió existir.
            <form
              method="post"
              action={`/admin/e/${event.slug}/orden/${order.id}/anular`}
              style="margin-top:10px"
            >
              <button class="btn danger sm" type="submit">
                Anular esta orden
              </button>
            </form>
          </div>

          {order.channel === "comp" || live.length === 0 ? null : (
            <div class="note" style="margin-top:12px">
              <b>Reembolsar</b> deja constancia de la devolución, con el motivo y la fecha. Usalo si
              le vas a devolver la plata. El dinero lo transferís vos desde tu banco; Coverr nunca
              lo tuvo.
              <form
                method="post"
                action={`/admin/e/${event.slug}/orden/${order.id}/reembolsar`}
                style="margin-top:10px"
              >
                {live.length > 1 ? (
                  <>
                    <span class="fl">Qué boletos devolvés</span>
                    {/* Every box starts ticked, so the ordinary case — giving
                        the whole order back — is still one click. Unticking
                        leaves the rest of the tickets scanning. */}
                    {live.map((a) => (
                      <label
                        key={a.id}
                        class="pick"
                        style="display:flex;gap:8px;align-items:center;margin:6px 0"
                      >
                        <input type="checkbox" name="boleto" value={a.id} checked />
                        <span>
                          {a.name}
                          {a.checkedInAt ? <span class="muted"> · ya entró</span> : null}
                        </span>
                      </label>
                    ))}
                  </>
                ) : (
                  <input type="hidden" name="boleto" value={live[0]?.id} />
                )}
                <label class="fl" for="motivo" style="margin-top:10px">
                  Motivo <span>(queda en el historial)</span>
                </label>
                <input
                  type="text"
                  name="motivo"
                  id="motivo"
                  maxlength={300}
                  placeholder="Ej: se canceló el evento"
                />
                <button class="btn danger sm" type="submit" style="margin-top:10px">
                  Reembolsar los boletos marcados
                </button>
              </form>
            </div>
          )}
        </>
      ) : null}
    </AdminLayout>
  );
};

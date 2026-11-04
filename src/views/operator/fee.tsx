import type { FC } from "hono/jsx";
import { formatDayMonth, formatLpsShort } from "../../lib/core";
import type { FeeStatus } from "../../lib/fees";
import { TEXT_LIMITS } from "../../lib/text-limits";
import { type Flag, flagLabel } from "../../lib/verify";
import { FeeStatusChip } from "./fee-status";
import { OperatorLayout } from "./layout";

type Payment = {
  id: string;
  amount: number;
  status: FeeStatus;
  fileKey: string | null;
  contentType: string;
  uploadedAt: string;
  purgedAt: string | null;
  xAmount: number | null;
  xDestAccount: string | null;
  xReference: string | null;
  xDatetime: string | null;
  xSenderName: string | null;
  xBank: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  invoiceNumber: string | null;
};

const DONE: Record<string, string> = {
  revisado: "Marcado como revisado: el pago está bien.",
  "no-pagado":
    "Marcado como no pagado. La banda no puede crear ni publicar eventos, ni abrir otro reporte pagado, hasta que se resuelva.",
  factura: "Factura guardada.",
};

/** What was read off the screenshot, or a dash for what was not. */
const Read: FC<{ label: string; value: string | null }> = ({ label, value }) => (
  <>
    <dt>{label}</dt>
    <dd>{value ?? "—"}</dd>
  </>
);

/**
 * One fee payment for an operator to settle: what the checks said, what was
 * read, the screenshot itself while it is kept, and the verdict.
 */
export const FeePaymentPage: FC<{
  payment: Payment;
  flags: Flag[];
  band: { id: string; name: string; contactEmail: string };
  event: { name: string };
  done?: string;
  error?: string;
}> = ({ payment, flags, band, event, done, error }) => (
  <OperatorLayout title={`Pago de ${band.name} — Coverr operación`} signedIn active="fees">
    <p class="sub">
      <a href="/operador/cobros">← Cobros</a> ·{" "}
      <a href={`/operador/bandas/${band.id}`}>{band.name}</a>
    </p>
    <h1>Pago de {band.name}</h1>
    <p class="sub">
      {event.name} · {formatLpsShort(payment.amount)} · subido el{" "}
      {formatDayMonth(payment.uploadedAt, { year: true })}{" "}
      <FeeStatusChip status={payment.status} bracket="" />
    </p>
    {done && DONE[done] ? <div class="note ok">{DONE[done]}</div> : null}
    {error ? <div class="note crit">{error}</div> : null}

    {flags.length > 0 ? (
      <>
        <h2>Lo que no cuadró</h2>
        {flags.map((flag) => (
          <div class={`note ${flag.severity === "critical" ? "crit" : "warn"}`} key={flag.code}>
            <b>{flagLabel(flag.code)}</b>
            <p style="margin:6px 0 0">{flag.detail}</p>
          </div>
        ))}
      </>
    ) : null}

    <h2>Lo que se leyó</h2>
    <dl class="kv">
      <Read
        label="Monto"
        value={payment.xAmount === null ? null : formatLpsShort(payment.xAmount)}
      />
      <Read label="Cuenta destino" value={payment.xDestAccount} />
      <Read label="Referencia" value={payment.xReference} />
      <Read label="Fecha" value={payment.xDatetime} />
      <Read label="Transfirió" value={payment.xSenderName} />
      <Read label="Banco" value={payment.xBank} />
    </dl>

    <h2>Captura</h2>
    {payment.fileKey ? (
      payment.contentType === "application/pdf" ? (
        <p>
          <a class="btn sm ghost" href={`/operador/pagos/${payment.id}/comprobante`}>
            Descargar el PDF
          </a>
        </p>
      ) : (
        <img
          class="proof"
          src={`/operador/pagos/${payment.id}/comprobante`}
          alt={`Captura de la transferencia de ${band.name}`}
        />
      )
    ) : (
      <p class="muted">
        La captura se borró
        {payment.purgedAt ? ` el ${formatDayMonth(payment.purgedAt, { year: true })}` : ""}, a los
        90 días. Lo que se leyó de ella queda arriba.
      </p>
    )}

    <h2>Revisión</h2>
    {payment.reviewedAt ? (
      <p class="sub" style="margin-top:0">
        Última revisión: {formatDayMonth(payment.reviewedAt, { year: true })} por{" "}
        {payment.reviewedBy}
        {payment.reviewNote ? ` — ${payment.reviewNote}` : ""}
      </p>
    ) : null}
    <div class="field-pair">
      <form method="post" action={`/operador/pagos/${payment.id}/revisar`}>
        <input type="hidden" name="estado" value="resolved" />
        <label class="fl" for="ok-note">
          {payment.status === "unpaid" ? "Ya pagó: nota (opcional)" : "Está bien: nota (opcional)"}
        </label>
        <input type="text" name="note" id="ok-note" maxlength={TEXT_LIMITS.operatorNote} />
        <button class="btn" type="submit" style="margin-top:14px">
          {payment.status === "unpaid" ? "Marcar pagado" : "El pago está bien"}
        </button>
      </form>
      {payment.status === "unpaid" ? null : (
        <form method="post" action={`/operador/pagos/${payment.id}/revisar`}>
          <input type="hidden" name="estado" value="unpaid" />
          <label class="fl" for="unpaid-note">
            No se pagó: qué pasó
          </label>
          <input
            type="text"
            name="note"
            id="unpaid-note"
            required
            maxlength={TEXT_LIMITS.operatorNote}
          />
          <button class="btn danger" type="submit" style="margin-top:14px">
            Marcar no pagado
          </button>
        </form>
      )}
    </div>
    <p class="muted">
      Marcarlo no pagado no cierra el reporte: la banda deja de poder crear o publicar eventos, y de
      abrir otro reporte pagado, hasta que lo resuelvan. Lo que ya está a la venta sigue vendiendo.
      Para escribirle: {band.contactEmail}.
    </p>

    <h2>Factura</h2>
    <form class="inline" method="post" action={`/operador/pagos/${payment.id}/factura`}>
      <div style="flex:1;min-width:200px">
        <label class="fl" for="invoice">
          Número de la factura enviada
        </label>
        <input
          type="text"
          name="invoice"
          id="invoice"
          maxlength={60}
          value={payment.invoiceNumber ?? ""}
        />
      </div>
      <button class="btn" type="submit">
        Guardar
      </button>
    </form>
  </OperatorLayout>
);

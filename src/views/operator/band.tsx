import type { FC } from "hono/jsx";
import type { OperatorEventRow } from "../../db/queries/operator";
import { formatDayMonth } from "../../lib/core";
import type { FeeStatus } from "../../lib/fees";
import { TEXT_LIMITS } from "../../lib/text-limits";
import { FeeStatusChip } from "./fee-status";
import { OperatorLayout } from "./layout";
import { passLastDay, StandingChips } from "./standing";

type Band = {
  id: string;
  name: string;
  contactEmail: string;
  createdAt: string;
  bannedAt: string | null;
  banReason: string | null;
  freePassGrantedAt: string | null;
  freePassUntil: string | null;
  freePassNote: string | null;
  promoGrantedAt: string | null;
  promoPercent: number | null;
  promoReportsLeft: number | null;
  promoUntil: string | null;
  promoNote: string | null;
};

type Action = {
  id: string;
  operatorEmail: string;
  action: string;
  note: string | null;
  createdAt: string;
};

/** What each confirmation in the URL says, so no free text travels in a link. */
const DONE: Record<string, string> = {
  suspendida: "Banda suspendida. Ya no puede entrar y sus eventos dejaron de vender en línea.",
  reactivada: "Banda reactivada.",
  pase: "Pase libre guardado.",
  "sin-pase": "Pase libre quitado.",
  promo: "Promo guardada. Se aplica sola en sus próximos reportes.",
  "sin-promo": "Promo quitada.",
};

/** An event's status as the operator reads it. */
const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: "borrador",
  live: "a la venta",
  closed: "venta cerrada",
  settled: "liquidado",
};

const ACTION_LABEL: Record<string, string> = {
  ban: "Suspendida",
  unban: "Reactivada",
  free_pass: "Pase libre",
  free_pass_end: "Pase quitado",
  promo: "Promo",
  promo_end: "Promo quitada",
  fee_resolved: "Pago revisado",
  fee_unpaid: "Pago no pagado",
};

const SuspendForm: FC<{ band: Band }> = ({ band }) =>
  band.bannedAt ? (
    <>
      <div class="note crit">
        <b>Suspendida desde el {formatDayMonth(band.bannedAt, { year: true })}.</b>
        {band.banReason ? <p style="margin:8px 0 0">Motivo: {band.banReason}</p> : null}
      </div>
      <form method="post" action={`/operador/bandas/${band.id}/reactivar`}>
        <label class="fl" for="unban-note">
          Nota (opcional)
        </label>
        <textarea name="note" id="unban-note" rows={2} maxlength={TEXT_LIMITS.operatorNote} />
        <button class="btn" type="submit" style="margin-top:14px">
          Reactivar banda
        </button>
      </form>
    </>
  ) : (
    <form method="post" action={`/operador/bandas/${band.id}/suspender`}>
      <p class="sub" style="margin-top:0">
        No va a poder entrar ni crear eventos, y sus eventos dejan de vender en línea. Los boletos
        que ya vendió siguen funcionando: sus compradores ya le pagaron.
      </p>
      <label class="fl" for="reason">
        Motivo
      </label>
      <textarea name="reason" id="reason" rows={2} required maxlength={TEXT_LIMITS.operatorNote} />
      <button class="btn danger" type="submit" style="margin-top:14px">
        Suspender banda
      </button>
    </form>
  );

const PromoForm: FC<{ band: Band }> = ({ band }) => {
  // A promo with no reports left is spent: shown as used, and the form starts fresh.
  const active = !!band.promoGrantedAt && !!band.promoPercent && (band.promoReportsLeft ?? 0) > 0;
  const spent = !!band.promoGrantedAt && !active;
  return (
    <>
      {active ? (
        <div class="note ok">
          <b>
            {band.promoPercent}% de descuento,{" "}
            {band.promoReportsLeft === 1
              ? "le queda 1 reporte"
              : `le quedan ${band.promoReportsLeft ?? 0} reportes`}
            {band.promoUntil ? `, para eventos hasta el ${passLastDay(band.promoUntil)}` : ""}.
          </b>
          {band.promoNote ? <p style="margin:8px 0 0">{band.promoNote}</p> : null}
          <form
            method="post"
            action={`/operador/bandas/${band.id}/promo/quitar`}
            style="margin-top:12px"
          >
            <button class="btn sm ghost" type="submit">
              Quitar promo
            </button>
          </form>
        </div>
      ) : (
        <p class="sub" style="margin-top:0">
          {spent ? `La promo del ${band.promoPercent ?? 0}% ya se usó en todos sus reportes. ` : ""}
          Un descuento tuyo para esta banda, en sus próximos reportes cobrados. No se suma a otro:
          si un reporte ya es gratis por el pase o por su primer evento, la promo queda para el
          siguiente.
        </p>
      )}
      <form method="post" action={`/operador/bandas/${band.id}/promo`}>
        <div class="field-pair">
          <div>
            <label class="fl" for="percent">
              Descuento (%)
            </label>
            <input
              type="number"
              name="percent"
              id="percent"
              required
              min={1}
              max={100}
              value={active ? (band.promoPercent ?? "") : ""}
            />
          </div>
          <div>
            <label class="fl" for="reports">
              Para cuántos reportes
            </label>
            <input
              type="number"
              name="reports"
              id="reports"
              required
              min={1}
              max={20}
              value={active ? (band.promoReportsLeft ?? 1) : 1}
            />
          </div>
        </div>
        <div class="field-pair" style="margin-top:14px">
          <div>
            <label class="fl" for="promo-until">
              Para eventos hasta (vacío: sin fecha)
            </label>
            <input
              type="date"
              name="until"
              id="promo-until"
              value={active ? (band.promoUntil ?? "") : ""}
            />
          </div>
          <div>
            <label class="fl" for="promo-note">
              De qué es
            </label>
            <input
              type="text"
              name="note"
              id="promo-note"
              required
              maxlength={TEXT_LIMITS.operatorNote}
              value={active ? (band.promoNote ?? "") : ""}
            />
          </div>
        </div>
        <button class="btn" type="submit" style="margin-top:14px">
          {active ? "Actualizar promo" : "Dar promo"}
        </button>
      </form>
    </>
  );
};

const FreePassForm: FC<{ band: Band }> = ({ band }) => (
  <>
    {band.freePassGrantedAt ? (
      <div class="note ok">
        <b>
          {band.freePassUntil
            ? `Pase libre hasta el ${passLastDay(band.freePassUntil)}.`
            : "Pase libre sin fecha de fin."}
        </b>
        {band.freePassNote ? <p style="margin:8px 0 0">{band.freePassNote}</p> : null}
        <form
          method="post"
          action={`/operador/bandas/${band.id}/pase/quitar`}
          style="margin-top:12px"
        >
          <button class="btn sm ghost" type="submit">
            Quitar pase
          </button>
        </form>
      </div>
    ) : (
      <p class="sub" style="margin-top:0">
        Con un pase libre, los reportes de reparto de sus eventos no se cobran. Cuenta la fecha del
        evento, no la del desbloqueo.
      </p>
    )}
    <form method="post" action={`/operador/bandas/${band.id}/pase`}>
      <div class="field-pair">
        <div>
          <label class="fl" for="until">
            Hasta (vacío: sin fecha de fin)
          </label>
          <input type="date" name="until" id="until" value={band.freePassUntil ?? ""} />
        </div>
        <div>
          <label class="fl" for="pass-note">
            Para qué es
          </label>
          <input
            type="text"
            name="note"
            id="pass-note"
            required
            maxlength={TEXT_LIMITS.operatorNote}
            value={band.freePassNote ?? ""}
          />
        </div>
      </div>
      <button class="btn" type="submit" style="margin-top:14px">
        {band.freePassGrantedAt ? "Actualizar pase" : "Dar pase libre"}
      </button>
    </form>
  </>
);

/** One band in full: its standing and the controls for it, its events, and every change made. */
export const OperatorBandPage: FC<{
  band: Band;
  events: OperatorEventRow[];
  actions: Action[];
  done?: string;
  error?: string;
}> = ({ band, events, actions, done, error }) => (
  <OperatorLayout title={`${band.name} — Coverr operación`} signedIn active="bands">
    <p class="sub">
      <a href="/operador">← Bandas</a>
    </p>
    <h1>{band.name}</h1>
    <p class="sub">
      {band.contactEmail} · alta el {formatDayMonth(band.createdAt, { year: true })}{" "}
      <StandingChips
        bannedAt={band.bannedAt}
        freePassGrantedAt={band.freePassGrantedAt}
        freePassUntil={band.freePassUntil}
        promoPercent={band.promoPercent}
        promoReportsLeft={band.promoReportsLeft}
      />
    </p>
    {done && DONE[done] ? <div class="note ok">{DONE[done]}</div> : null}
    {error ? <div class="note crit">{error}</div> : null}

    <h2>Suspensión</h2>
    <SuspendForm band={band} />

    <h2>Pase libre</h2>
    <FreePassForm band={band} />

    <h2>Promo</h2>
    <PromoForm band={band} />

    <h2>Eventos</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Evento</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th class="n">Boletos pagados</th>
            <th>Reporte</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colspan={5} class="muted">
                Todavía no tiene eventos.
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr key={event.id}>
                <td>{event.name}</td>
                <td>{formatDayMonth(event.startsAt, { year: true })}</td>
                <td class="muted">{EVENT_STATUS_LABEL[event.status] ?? event.status}</td>
                <td class="n">{event.paidTickets}</td>
                <td>
                  {event.unlockBracket === null ? (
                    "—"
                  ) : event.feePaymentId ? (
                    <a href={`/operador/pagos/${event.feePaymentId}`}>
                      <FeeStatusChip
                        status={event.feeStatus as FeeStatus}
                        bracket={event.unlockBracket}
                      />
                    </a>
                  ) : (
                    <FeeStatusChip status={null} bracket={event.unlockBracket} />
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <h2>Historial</h2>
    {actions.length === 0 ? (
      <p class="muted">Sin cambios todavía.</p>
    ) : (
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cambio</th>
              <th>Nota</th>
              <th>Quién</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id}>
                <td>{formatDayMonth(action.createdAt, { year: true })}</td>
                <td>{ACTION_LABEL[action.action] ?? action.action}</td>
                <td>{action.note ?? "—"}</td>
                <td class="muted">{action.operatorEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </OperatorLayout>
);

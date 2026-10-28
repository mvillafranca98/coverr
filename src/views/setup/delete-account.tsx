import type { FC } from "hono/jsx";
import type { DeletionBlocker } from "../../lib/account-deletion";
import { formatEventDate } from "../../lib/core";
import { AdminLayout } from "../admin/layout";

/** Stated here rather than imported from the query layer: a view names the shape it needs. */
type BandFootprint = {
  events: number;
  orders: number;
  tickets: number;
  proofImages: number;
  members: number;
  accounts: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Why the account cannot go yet, as a sentence that says what to do about it. */
function describeBlocker(blocker: DeletionBlocker): string {
  if (blocker.kind === "open_refunds") {
    const answer =
      blocker.count === 1 ? "Respondela desde su orden." : "Respondelas desde cada orden.";
    return `${plural(blocker.count, "solicitud de reembolso", "solicitudes de reembolso")} sin responder. ${answer}`;
  }
  const refund = blocker.liveTickets === 1 ? "Reembolsalo" : "Reembolsalos";
  return `«${blocker.eventName}» (${formatEventDate(blocker.startsAt)}) todavía tiene ${plural(
    blocker.liveTickets,
    "boleto activo",
    "boletos activos",
  )}. ${refund}, o esperá a que pase el evento.`;
}

/**
 * The one screen between a band and the permanent deletion of everything it
 * has in Coverr. It lists what goes before asking, refuses with reasons while
 * a buyer is still owed something, and asks for the band's name typed out —
 * a deliberate act, not a stray tap.
 */
export const DeleteAccountPage: FC<{
  bandName: string;
  footprint: BandFootprint;
  blockers: DeletionBlocker[];
  error?: string;
}> = ({ bandName, footprint, blockers, error }) => (
  <AdminLayout title={`Borrar la cuenta — ${bandName}`} bandName={bandName} active="band">
    <h1>Borrar la cuenta</h1>
    <p class="sub">
      Esto borra a {bandName} de Coverr para siempre. <b>No se puede deshacer.</b>
    </p>
    {error ? <div class="note crit">{error}</div> : null}

    <h2>Qué se borra</h2>
    <div class="note">
      <ul style="margin:0;padding-left:18px">
        <li>
          {plural(footprint.events, "evento", "eventos")}, con sus precios, gastos y adelantos
        </li>
        <li>
          {plural(footprint.orders, "orden", "órdenes")} y{" "}
          {plural(footprint.tickets, "boleto", "boletos")}, con el nombre, correo y teléfono de
          quien compró
        </li>
        {footprint.proofImages > 0 ? (
          <li>
            {plural(footprint.proofImages, "comprobante", "comprobantes")} de pago que todavía
            guardan su imagen
          </li>
        ) : null}
        <li>
          {plural(footprint.members, "integrante", "integrantes")} y{" "}
          {plural(footprint.accounts, "cuenta bancaria", "cuentas bancarias")}
        </li>
        <li>La lista de fans y tu acceso a este panel</li>
      </ul>
    </div>
    <p class="sub">
      Se borra en el momento. Las copias de seguridad automáticas de la base de datos lo guardan
      hasta 30 días más y después desaparecen solas. Los correos que ya se mandaron, y los
      comprobantes que ya se mandaron a leer, quedan sujetos a lo que guarda cada servicio — ver la{" "}
      <a href="/privacidad">política de privacidad</a>.
    </p>

    {blockers.length > 0 ? (
      <>
        <div class="note crit">
          <b>Todavía no se puede borrar.</b> Primero hay que cumplirle a quien compró:
          <ul style="margin:8px 0 0;padding-left:18px">
            {blockers.map((blocker) => (
              <li>{describeBlocker(blocker)}</li>
            ))}
          </ul>
        </div>
        <a class="btn ghost" href="/admin/banda">
          Volver a ajustes
        </a>
      </>
    ) : (
      <form method="post" action="/admin/banda/borrar" style="max-width:520px">
        <label class="fl" for="confirm">
          Para confirmar, escribí el nombre de la banda: <b>{bandName}</b>
        </label>
        <input
          type="text"
          name="confirm"
          id="confirm"
          required
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
        />
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn danger" type="submit">
            Borrar la cuenta para siempre
          </button>
          <a class="btn ghost" href="/admin/banda">
            Cancelar
          </a>
        </div>
      </form>
    )}
  </AdminLayout>
);

/** Shown once, after everything is gone. There is no session left to go back to. */
export const AccountDeletedPage: FC<{ bandName: string }> = ({ bandName }) => (
  <AdminLayout title="Cuenta borrada — Coverr">
    <h1>Cuenta borrada</h1>
    <p class="sub">
      {bandName} ya no está en Coverr. Borramos sus eventos, órdenes, boletos y comprobantes.
    </p>
    <a class="btn ghost" href="/">
      Ir al inicio
    </a>
  </AdminLayout>
);

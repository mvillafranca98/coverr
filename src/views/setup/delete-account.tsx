import type { FC } from "hono/jsx";
import type { DeletionBlocker } from "../../lib/account-deletion";
import { formatEventDate, formatLpsShort } from "../../lib/core";
import { AdminLayout } from "../admin/layout";
import { CONTACT_EMAIL } from "../legal/constants";

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

/**
 * Why the account cannot go yet, as a sentence that says what to do about it.
 * An unanswered refund links straight to its order: "answer it from its order"
 * alone left the band hunting through every event for the one that asked.
 */
const BlockerItem: FC<{ blocker: DeletionBlocker }> = ({ blocker }) => {
  if (blocker.kind === "upcoming_event") {
    const refund = blocker.liveTickets === 1 ? "Reembolsalo" : "Reembolsalos";
    return (
      <li>
        «{blocker.eventName}» ({formatEventDate(blocker.startsAt)}) todavía tiene{" "}
        {plural(blocker.liveTickets, "boleto activo", "boletos activos")}. {refund}, o esperá a que
        pase el evento.
      </li>
    );
  }
  if (blocker.kind === "unsettled_fee") {
    const report = `El reporte de «${blocker.eventName}» (${formatLpsShort(blocker.amount)})`;
    const contact = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
    return blocker.owed ? (
      <li>
        {report} todavía no está pagado. Escribinos a {contact} y lo resolvemos.
      </li>
    ) : (
      <li>
        {report}: estamos revisando tu pago. Cuando lo confirmemos vas a poder borrar la cuenta; si
        tarda, escribinos a {contact}.
      </li>
    );
  }
  const unlisted = blocker.count - blocker.orders.length;
  return (
    <li>
      {plural(blocker.count, "solicitud de reembolso", "solicitudes de reembolso")} sin responder.{" "}
      {blocker.count === 1 ? "Respondela desde su orden:" : "Respondelas desde cada orden:"}
      <ul style="margin:4px 0 0;padding-left:18px">
        {blocker.orders.map((order) => (
          <li key={order.orderId}>
            <a href={`/admin/e/${order.eventSlug}/orden/${order.orderId}`}>
              Orden {order.shortCode}
            </a>{" "}
            · «{order.eventName}»
          </li>
        ))}
        {unlisted > 0 ? (
          <li>
            y {plural(unlisted, "otra", "otras")} más, en <b>Órdenes → Reembolsos pedidos</b> de
            cada evento
          </li>
        ) : null}
      </ul>
    </li>
  );
};

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
          <b>Todavía no se puede borrar.</b> Primero hay que resolver esto:
          <ul style="margin:8px 0 0;padding-left:18px">
            {blockers.map((blocker) => (
              <BlockerItem blocker={blocker} />
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

import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import { AdminLayout } from "../admin/layout";
import { CONTACT_EMAIL } from "../legal/constants";
import { Fields } from "./event-form";

export const NewEventPage: FC<{
  bandName: string;
  error?: string;
  /**
   * A report fee an operator has marked unpaid. While there is one the band
   * cannot create events — the ones already on sale keep selling.
   */
  owed?: { eventName: string; amount: number } | null;
}> = ({ bandName, error, owed }) => (
  <AdminLayout title={`Nuevo evento — ${bandName}`} bandName={bandName}>
    <h1>Nuevo evento</h1>
    {owed ? (
      <div class="note crit">
        <b>Tenés un pago pendiente.</b>
        <p style="margin:8px 0 0">
          El reporte de <b>{owed.eventName}</b> ({formatLpsShort(owed.amount)}) todavía no está
          pagado, así que por ahora no podés crear eventos. Los que ya están a la venta siguen
          vendiendo. Escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y lo
          resolvemos.
        </p>
      </div>
    ) : (
      <>
        <p class="sub">Se crea como borrador. Nadie puede comprar hasta que lo publiqués.</p>
        {error ? <div class="note crit">{error}</div> : null}
        <form method="post" action="/admin/nuevo" style="max-width:620px">
          <Fields v={{}} />
          <button class="btn" type="submit" style="margin-top:22px">
            Crear evento
          </button>
        </form>
      </>
    )}
  </AdminLayout>
);

import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import type { EventInput } from "../../lib/event-form";
import { AdminLayout } from "../admin/layout";
import { CONTACT_EMAIL } from "../legal/constants";
import { Fields } from "./event-form";

export const NewEventPage: FC<{
  bandName: string;
  error?: string;
  /** What was typed before a refusal, so the form comes back filled in. */
  typed?: Partial<EventInput>;
  /**
   * A report fee an operator has marked unpaid. While there is one the band
   * cannot create events — the ones already on sale keep selling.
   */
  owed?: { eventName: string; amount: number; bandName: string } | null;
}> = ({ bandName, error, typed, owed }) => (
  <AdminLayout title={`Nuevo evento — ${bandName}`} bandName={bandName}>
    <h1>Nuevo evento</h1>
    {owed ? (
      <div class="note crit">
        <b>Tenés un pago pendiente.</b>
        <p style="margin:8px 0 0">
          El reporte de <b>{owed.eventName}</b>, de {owed.bandName} ({formatLpsShort(owed.amount)}),
          todavía no está pagado, así que por ahora no podés crear eventos. Los que ya están a la
          venta siguen vendiendo. Escribinos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y lo resolvemos.
        </p>
      </div>
    ) : (
      <>
        <p class="sub">Se crea como borrador. Nadie puede comprar hasta que lo publiqués.</p>
        {error ? <div class="note crit">{error}</div> : null}
        <form method="post" action="/admin/nuevo" style="max-width:620px">
          <Fields v={typed ?? {}} />
          <button class="btn" type="submit" style="margin-top:22px">
            Crear evento
          </button>
        </form>
      </>
    )}
  </AdminLayout>
);

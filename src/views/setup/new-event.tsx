import type { FC } from "hono/jsx";
import { AdminLayout } from "../admin/layout";
import { Fields } from "./event-form";

export const NewEventPage: FC<{ bandName: string; error?: string }> = ({ bandName, error }) => (
  <AdminLayout title={`Nuevo evento — ${bandName}`} bandName={bandName}>
    <h1>Nuevo evento</h1>
    <p class="sub">Se crea como borrador. Nadie puede comprar hasta que lo publiqués.</p>
    {error ? <div class="note crit">{error}</div> : null}
    <form method="post" action="/admin/nuevo" style="max-width:620px">
      <Fields v={{}} />
      <button class="btn" type="submit" style="margin-top:22px">
        Crear evento
      </button>
    </form>
  </AdminLayout>
);

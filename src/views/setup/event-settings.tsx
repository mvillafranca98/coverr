import type { FC } from "hono/jsx";
import { AdminLayout } from "../admin/layout";
import { Fields, type EventFormValues } from "./event-form";

export const EventSettingsPage: FC<{
  bandName: string;
  event: {
    slug: string;
    name: string;
    status: string;
    staffToken: string | null;
    startsAt: string;
  };
  values: EventFormValues;
  origin: string;
  soldCount: number;
  error?: string;
  saved?: boolean;
}> = ({ bandName, event, values, origin, soldCount, error, saved }) => (
  <AdminLayout
    title={`Ajustes — ${event.name}`}
    bandName={bandName}
    active="settings"
    eventSlug={event.slug}
  >
    <h1>Ajustes</h1>
    <p class="sub">
      {event.name} · <span class={`chip ${event.status === "live" ? "ok" : "info"}`}>{event.status}</span>
    </p>
    {saved ? <div class="note ok">Guardado.</div> : null}
    {error ? <div class="note crit">{error}</div> : null}

    <h2>Estado y enlaces</h2>
    <div class="note">
      {event.status === "live" ? (
        <>
          <b>La venta está abierta.</b> Este es el enlace que va en el flyer o la bio:
          <div style="margin-top:8px;font-family:var(--mono);font-size:13px;word-break:break-all;color:var(--text)">
            {origin}/e/{event.slug}
          </div>
        </>
      ) : (
        <>
          <b>Todavía no está publicado.</b> Nadie puede comprar hasta que lo publiqués.
        </>
      )}
      <form method="post" action={`/admin/e/${event.slug}/ajustes/estado`} style="margin-top:12px">
        <input
          type="hidden"
          name="status"
          value={event.status === "live" ? "closed" : "live"}
        />
        <button class={`btn sm ${event.status === "live" ? "ghost" : ""}`} type="submit">
          {event.status === "live" ? "Cerrar la venta" : "Publicar y abrir la venta"}
        </button>
      </form>
    </div>

    <div class="note">
      <b>Enlace del personal de puerta.</b> Quien lo tenga puede registrar entradas — compartilo sólo
      con tu staff.
      {event.staffToken ? (
        <div style="margin-top:8px;font-family:var(--mono);font-size:13px;word-break:break-all;color:var(--text)">
          {origin}/scan/{event.staffToken}
        </div>
      ) : (
        <div style="margin-top:8px" class="muted">
          Todavía no se ha generado.
        </div>
      )}
      <form method="post" action={`/admin/e/${event.slug}/ajustes/token`} style="margin-top:12px">
        <button class="btn sm ghost" type="submit">
          {event.staffToken ? "Generar uno nuevo (el anterior deja de servir)" : "Generar enlace"}
        </button>
      </form>
    </div>

    <form method="post" action={`/admin/e/${event.slug}/ajustes`} style="max-width:620px">
      <Fields v={values} />
      {soldCount > 0 ? (
        <div class="note warn" style="margin-top:18px">
          Ya se vendieron {soldCount} boletos. Cambiar los precios sólo afecta compras nuevas — las
          órdenes existentes conservan el precio que pagaron.
        </div>
      ) : null}
      <button class="btn" type="submit" style="margin-top:22px">
        Guardar cambios
      </button>
    </form>
  </AdminLayout>
);

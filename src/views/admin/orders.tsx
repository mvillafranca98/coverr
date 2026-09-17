import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import { AdminLayout } from "./layout";
import { CHANNEL_LABEL, type OrderRow } from "./order-row";

export const OrdersPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  orders: OrderRow[];
  q: string;
  filter: string;
  total: number;
}> = ({ bandName, event, orders, q, filter, total }) => (
  <AdminLayout
    title={`Órdenes — ${event.name}`}
    bandName={bandName}
    active="orders"
    eventSlug={event.slug}
  >
    <h1>Órdenes</h1>
    <p class="sub">
      {total} {total === 1 ? "orden" : "órdenes"} · {event.name}
    </p>

    <form class="inline" method="get">
      <div style="flex:1;min-width:200px">
        <label class="fl" for="q">
          Buscar
        </label>
        <input type="text" name="q" id="q" value={q} placeholder="Nombre, correo o código" />
      </div>
      <div style="min-width:150px">
        <label class="fl" for="filtro">
          Filtro
        </label>
        <select name="filtro" id="filtro">
          <option value="" selected={filter === ""}>
            Todas
          </option>
          <option value="flagged" selected={filter === "flagged"}>
            Por revisar
          </option>
          <option value="online" selected={filter === "online"}>
            Preventa
          </option>
          <option value="door_cash" selected={filter === "door_cash"}>
            Efectivo en puerta
          </option>
          <option value="manual" selected={filter === "manual"}>
            Venta manual
          </option>
          <option value="comp" selected={filter === "comp"}>
            Cortesías
          </option>
          <option value="inside" selected={filter === "inside"}>
            Ya entraron
          </option>
          <option value="refunds" selected={filter === "refunds"}>
            Reembolsos pedidos
          </option>
        </select>
      </div>
      <button class="btn" type="submit">
        Aplicar
      </button>
      <a class="btn ghost" href={`/admin/e/${event.slug}/ordenes.csv`}>
        CSV
      </a>
    </form>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Comprador</th>
            <th>Asistentes</th>
            <th>Canal</th>
            <th class="n">Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colspan={6} class="muted">
                Nada que mostrar con ese filtro.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <a href={`/admin/e/${event.slug}/orden/${o.id}`}>{o.shortCode}</a>
                </td>
                <td>
                  {o.payerName}
                  <div class="muted" style="font-size:12px">
                    {o.payerEmail}
                  </div>
                </td>
                <td style="max-width:220px">
                  {o.attendees}
                  <div class="muted" style="font-size:12px">
                    {o.checkedIn}/{o.quantity} adentro
                  </div>
                </td>
                <td>{CHANNEL_LABEL[o.channel] ?? o.channel}</td>
                <td class="n">{formatLpsShort(o.expectedAmount)}</td>
                <td>
                  {o.status !== "confirmed" ? (
                    <span class="chip crit">{o.status}</span>
                  ) : o.flag ? (
                    <span class="chip warn">revisar</span>
                  ) : (
                    <span class="chip ok">ok</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </AdminLayout>
);

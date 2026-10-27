import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { findEventBySlug } from "../../db/queries/events";
import { type EventOrderRow, listOrdersForEvent } from "../../db/queries/orders";
import * as s from "../../db/schema";
import { CSV_CONTENT_TYPE, csvAttachment, toCsv } from "../../lib/csv";
import { filterOrders } from "../../lib/order-filter";
import { OrdersPage } from "../../views/admin/orders";
import type { AdminEnv } from "./context";

export const ordersRoutes = new Hono<AdminEnv>();

ordersRoutes.get("/e/:slug/ordenes", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const query = c.req.query("q") ?? "";
  const view = c.req.query("filtro") ?? "";
  const orders = filterOrders(await listOrdersForEvent(db, event.id), { query, view });

  return c.html(
    <OrdersPage
      bandName={band.name}
      event={event}
      orders={orders}
      q={query}
      filter={view}
      total={orders.length}
    />,
  );
});

const CSV_HEADER = [
  "codigo",
  "comprador",
  "correo",
  "telefono",
  "asistentes",
  "cantidad",
  "adentro",
  "canal",
  "monto_lps",
  "estado",
  "banco",
  "fecha",
  "nota",
  "alerta",
] as const;

function csvRow(order: EventOrderRow): unknown[] {
  return [
    order.shortCode,
    order.payerName,
    order.payerEmail,
    order.payerPhone ?? "",
    order.attendees,
    order.quantity,
    order.checkedIn,
    order.channel,
    (order.expectedAmount / 100).toFixed(2),
    order.status,
    order.bankSelected ?? "",
    order.createdAt,
    order.note ?? "",
    order.flag ?? "",
  ];
}

/** Exports every order, ignoring whatever filter the screen is showing. */
ordersRoutes.get("/e/:slug/ordenes.csv", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const orders = await listOrdersForEvent(db, event.id);

  return c.body(toCsv(CSV_HEADER, orders.map(csvRow)), 200, {
    "Content-Type": CSV_CONTENT_TYPE,
    "Content-Disposition": csvAttachment(`ordenes-${event.slug}.csv`),
  });
});

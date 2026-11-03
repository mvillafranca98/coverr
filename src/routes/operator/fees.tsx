import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import {
  feePaymentWithContext,
  ledgerForMonth,
  reviewFeePayment,
  setFeeInvoiceNumber,
} from "../../db/queries/fees";
import * as s from "../../db/schema";
import { formatLpsShort, nowIso } from "../../lib/core";
import { CSV_CONTENT_TYPE, csvAttachment, toCsv } from "../../lib/csv";
import { type FeeStatus, isMonth, monthBounds, monthOf, shiftMonth } from "../../lib/fees";
import { safeProofDelivery } from "../../lib/file-type";
import { TEXT_LIMITS, tooLong } from "../../lib/text-limits";
import type { Flag } from "../../lib/verify";
import { FeePaymentPage } from "../../views/operator/fee";
import { LedgerPage } from "../../views/operator/ledger";
import type { OperatorEnv } from "./context";

export const operatorFeeRoutes = new Hono<OperatorEnv>();

const PAGE_SIZE = 100;
const INVOICE_MAX = 60;

const paymentPath = (id: string) => `/operador/pagos/${id}`;

/** The month asked for, or this one in Honduras. */
function monthFrom(value: string | undefined): string {
  return value && isMonth(value) ? value : monthOf(new Date());
}

/** The flags a payment's check stored, or none if the column is empty or not what we wrote. */
function storedFlags(json: string | null): Flag[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Flag[]) : [];
  } catch (err) {
    console.error(`[fee] unreadable flags column: ${String(err)}`);
    return [];
  }
}

const STATUS_FOR_CSV: Record<FeeStatus, string> = {
  checking: "leyendo",
  ok: "recibido",
  flagged: "por revisar",
  resolved: "revisado",
  unpaid: "no pagado",
};

operatorFeeRoutes.get("/cobros", async (c) => {
  const month = monthFrom(c.req.query("mes"));
  const page = Math.max(1, Number.parseInt(c.req.query("pagina") ?? "1", 10) || 1);
  const { rows, totals } = await ledgerForMonth(c.env.DB, monthBounds(month), {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const thisMonth = monthOf(new Date());
  return c.html(
    <LedgerPage
      month={month}
      previousMonth={shiftMonth(month, -1)}
      nextMonth={month < thisMonth ? shiftMonth(month, 1) : null}
      rows={rows}
      totals={totals}
      page={page}
      pageSize={PAGE_SIZE}
    />,
  );
});

/** The whole month as a spreadsheet, for the accountant. */
operatorFeeRoutes.get("/cobros.csv", async (c) => {
  const month = monthFrom(c.req.query("mes"));
  const { rows } = await ledgerForMonth(c.env.DB, monthBounds(month), { limit: 10_000, offset: 0 });
  const header = ["fecha", "banda", "evento", "monto", "estado", "factura"];
  const csvRows = rows.map((row) => [
    row.paidAt,
    row.bandName,
    row.eventName,
    row.feePaymentId ? formatLpsShort(row.amount) : "",
    row.status ? STATUS_FOR_CSV[row.status] : `gratis (${row.bracket})`,
    row.invoiceNumber ?? "",
  ]);
  return c.body(toCsv(header, csvRows), 200, {
    "Content-Type": CSV_CONTENT_TYPE,
    "Content-Disposition": csvAttachment(`cobros-${month}.csv`),
  });
});

operatorFeeRoutes.get("/pagos/:id", async (c) => {
  const found = await feePaymentWithContext(drizzle(c.env.DB, { schema: s }), c.req.param("id"));
  if (!found) return c.notFound();
  return c.html(
    <FeePaymentPage
      payment={{ ...found.fee, status: found.fee.status as FeeStatus }}
      flags={storedFlags(found.fee.flags)}
      band={found.band}
      event={found.event}
      done={c.req.query("listo")}
      error={c.req.query("error")}
    />,
  );
});

/** The screenshot itself, only ever to an operator and never cached. */
operatorFeeRoutes.get("/pagos/:id/comprobante", async (c) => {
  const found = await feePaymentWithContext(drizzle(c.env.DB, { schema: s }), c.req.param("id"));
  if (!found?.fee.fileKey) return c.notFound();
  const object = await c.env.PROOFS.get(found.fee.fileKey);
  if (!object) return c.notFound();
  const delivery = safeProofDelivery(found.fee.contentType);
  return c.body(object.body, 200, {
    "Content-Type": delivery.contentType,
    "Content-Disposition": delivery.disposition,
    "Cache-Control": "private, no-store",
  });
});

operatorFeeRoutes.post("/pagos/:id/revisar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await feePaymentWithContext(db, c.req.param("id"));
  if (!found) return c.notFound();
  const path = paymentPath(found.fee.id);

  const body = await c.req.parseBody();
  const status =
    body["estado"] === "unpaid" ? "unpaid" : body["estado"] === "resolved" ? "resolved" : null;
  const note = String(body["note"] ?? "").trim();
  const fail = (message: string) => c.redirect(`${path}?error=${encodeURIComponent(message)}`, 303);
  if (!status) return fail("Elegí si el pago está bien o no se pagó.");
  const tooLongNote = tooLong(note, TEXT_LIMITS.operatorNote, "La nota");
  if (tooLongNote) return fail(tooLongNote);
  // Saying it was not paid is the one verdict with a consequence, so it never goes unexplained.
  if (status === "unpaid" && !note) return fail("Escribí qué pasó con el pago.");

  await reviewFeePayment(db, {
    feePaymentId: found.fee.id,
    bandId: found.band.id,
    status,
    note: note || (status === "resolved" ? "Revisado" : ""),
    operatorEmail: c.get("operatorEmail"),
    at: nowIso(),
  });
  return c.redirect(`${path}?listo=${status === "resolved" ? "revisado" : "no-pagado"}`, 303);
});

operatorFeeRoutes.post("/pagos/:id/factura", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await feePaymentWithContext(db, c.req.param("id"));
  if (!found) return c.notFound();
  const invoice = String((await c.req.parseBody())["invoice"] ?? "").trim();
  if (invoice.length > INVOICE_MAX) {
    return c.redirect(
      `${paymentPath(found.fee.id)}?error=${encodeURIComponent(`El número de factura puede tener hasta ${INVOICE_MAX} caracteres.`)}`,
      303,
    );
  }
  await setFeeInvoiceNumber(db, found.fee.id, invoice || null);
  return c.redirect(`${paymentPath(found.fee.id)}?listo=factura`, 303);
});

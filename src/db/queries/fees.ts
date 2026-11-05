import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { newId } from "../../lib/core";
import { type FeeStatus, feeAccountFor } from "../../lib/fees";
import type { Flag } from "../../lib/verify";
import * as s from "../schema";
import { spendPromoUse } from "./unlocks";

type Db = DrizzleD1Database<typeof s>;

// ------------------------------------------------------ Coverr's own accounts

/** Every account Coverr collects into: active first, the main one at the top. */
export async function listPlatformAccounts(db: Db) {
  return db
    .select()
    .from(s.platformAccounts)
    .orderBy(
      desc(s.platformAccounts.active),
      desc(s.platformAccounts.isMain),
      asc(s.platformAccounts.createdAt),
    );
}

/**
 * The account this band is told to pay its fee into, chosen by the band's own
 * bank (the one its buyers pay into first). Null when Coverr has no active
 * account, and then nothing can be charged.
 */
export async function feeAccountForBand(db: Db, bandId: string) {
  const [ownAccount] = await db
    .select({ bank: s.bankAccounts.bank })
    .from(s.bankAccounts)
    .where(and(eq(s.bankAccounts.bandId, bandId), eq(s.bankAccounts.active, 1)))
    .orderBy(desc(s.bankAccounts.isDefault), asc(s.bankAccounts.sortOrder))
    .limit(1);
  return feeAccountFor(await listPlatformAccounts(db), ownAccount?.bank ?? null);
}

/** Adds an account. The first one, or one marked main, becomes the only main one. */
export async function addPlatformAccount(
  db: Db,
  input: { bank: string; holderName: string; accountNumber: string; makeMain: boolean; at: string },
) {
  const id = newId("pac");
  const hasMain = await db
    .select({ id: s.platformAccounts.id })
    .from(s.platformAccounts)
    .where(and(eq(s.platformAccounts.isMain, 1), eq(s.platformAccounts.active, 1)))
    .limit(1);
  const isMain = input.makeMain || hasMain.length === 0;
  const insert = db.insert(s.platformAccounts).values({
    id,
    bank: input.bank,
    holderName: input.holderName,
    accountNumber: input.accountNumber,
    isMain: isMain ? 1 : 0,
    active: 1,
    createdAt: input.at,
  });
  // A new main account takes the place of the old one in the same batch, so
  // there is never a moment with two.
  if (isMain) await db.batch([db.update(s.platformAccounts).set({ isMain: 0 }), insert]);
  else await insert;
}

/** Makes one active account the main one, and no other. */
export async function setMainPlatformAccount(db: Db, accountId: string) {
  await db.batch([
    db.update(s.platformAccounts).set({ isMain: 0 }),
    db
      .update(s.platformAccounts)
      .set({ isMain: 1 })
      .where(and(eq(s.platformAccounts.id, accountId), eq(s.platformAccounts.active, 1))),
  ]);
}

/**
 * Stops showing an account. Kept rather than deleted: a payment already made
 * into it still has to pass the destination check when it is read.
 */
export async function deactivatePlatformAccount(db: Db, accountId: string) {
  await db
    .update(s.platformAccounts)
    .set({ active: 0, isMain: 0 })
    .where(eq(s.platformAccounts.id, accountId));
}

// --------------------------------------------------------------- fee payments

export type NewFeePayment = {
  id: string;
  fileKey: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  uploadedAt: string;
  purgeAfter: string;
};

/**
 * Unlocks a report paid by transfer and records the payment, in one batch: a
 * report is never open without the payment that opened it, nor the reverse.
 */
export async function unlockByTransfer(
  db: Db,
  input: {
    bandId: string;
    eventId: string;
    bracket: string;
    amount: number;
    /** Set when a promo priced this report; that promo is spent in the same batch. */
    discountPercent: number | null;
    fee: NewFeePayment;
  },
) {
  const unlockId = newId("unl");
  const unlock = db.insert(s.eventUnlocks).values({
    id: unlockId,
    eventId: input.eventId,
    bracket: input.bracket,
    amount: input.amount,
    discountPercent: input.discountPercent,
    paidAt: input.fee.uploadedAt,
    method: "transfer",
    reference: null,
  });
  const payment = db.insert(s.feePayments).values({
    ...input.fee,
    unlockId,
    bandId: input.bandId,
    amount: input.amount,
    status: "checking",
  });
  if (input.discountPercent === null) await db.batch([unlock, payment]);
  else await db.batch([unlock, payment, spendPromoUse(db, input.bandId)]);
}

/** A fee payment with what reading it needs: its band and its event. */
export async function feePaymentWithContext(db: Db, feePaymentId: string) {
  const rows = await db
    .select({ fee: s.feePayments, band: s.bands, event: s.events, unlock: s.eventUnlocks })
    .from(s.feePayments)
    .innerJoin(s.bands, eq(s.feePayments.bandId, s.bands.id))
    .innerJoin(s.eventUnlocks, eq(s.feePayments.unlockId, s.eventUnlocks.id))
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .where(eq(s.feePayments.id, feePaymentId))
    .limit(1);
  return rows[0] ?? null;
}

/** True when another fee payment carries this reference or this exact file. */
export async function feeEvidenceSeenBefore(
  db: Db,
  input: { feePaymentId: string; reference: string | null; sha256: string },
) {
  const sameFile = await db
    .select({ id: s.feePayments.id })
    .from(s.feePayments)
    .where(and(eq(s.feePayments.sha256, input.sha256), ne(s.feePayments.id, input.feePaymentId)))
    .limit(1);
  const sameReference = input.reference
    ? await db
        .select({ id: s.feePayments.id })
        .from(s.feePayments)
        .where(
          and(
            eq(s.feePayments.xReference, input.reference),
            ne(s.feePayments.id, input.feePaymentId),
          ),
        )
        .limit(1)
    : [];
  return { sameFile: sameFile.length > 0, sameReference: sameReference.length > 0 };
}

/** What reading the screenshot found, and the status it leads to. */
export async function recordFeeCheck(
  db: Db,
  feePaymentId: string,
  input: {
    status: FeeStatus;
    flags: Flag[];
    read?: {
      amount: number | null;
      destAccount: string | null;
      reference: string | null;
      datetime: string | null;
      senderName: string | null;
      bank: string | null;
    };
  },
) {
  await db
    .update(s.feePayments)
    .set({
      status: input.status,
      flags: JSON.stringify(input.flags),
      ...(input.read
        ? {
            xAmount: input.read.amount,
            xDestAccount: input.read.destAccount,
            xReference: input.read.reference,
            xDatetime: input.read.datetime,
            xSenderName: input.read.senderName,
            xBank: input.read.bank,
          }
        : {}),
    })
    .where(eq(s.feePayments.id, feePaymentId));
}

/**
 * An operator's verdict on a payment, written with its line in the band's log.
 * `resolved` means the payment stands; `unpaid` means it does not, and stops
 * the band creating events until it is resolved.
 */
export async function reviewFeePayment(
  db: Db,
  input: {
    feePaymentId: string;
    bandId: string;
    status: "resolved" | "unpaid";
    note: string;
    operatorEmail: string;
    at: string;
  },
) {
  await db.batch([
    db
      .update(s.feePayments)
      .set({
        status: input.status,
        reviewNote: input.note,
        reviewedBy: input.operatorEmail,
        reviewedAt: input.at,
      })
      .where(eq(s.feePayments.id, input.feePaymentId)),
    db.insert(s.operatorActions).values({
      id: newId("opa"),
      bandId: input.bandId,
      operatorEmail: input.operatorEmail,
      action: input.status === "resolved" ? "fee_resolved" : "fee_unpaid",
      note: input.note,
      createdAt: input.at,
    }),
  ]);
}

export async function setFeeInvoiceNumber(db: Db, feePaymentId: string, invoice: string | null) {
  await db
    .update(s.feePayments)
    .set({ invoiceNumber: invoice })
    .where(eq(s.feePayments.id, feePaymentId));
}

/**
 * A report still owed, if an operator has marked one unpaid — on this band or
 * any band that shares its email (F22). One person, one debt: otherwise
 * starting a second band would walk around the first band's. While there is
 * one, none of that person's bands can create or publish events or open
 * another paid report.
 */
export async function unpaidFeeFor(db: Db, bandId: string) {
  const [band] = await db
    .select({ email: s.bands.contactEmail })
    .from(s.bands)
    .where(eq(s.bands.id, bandId))
    .limit(1);
  if (!band) return null;
  const rows = await db
    .select({ eventName: s.events.name, amount: s.feePayments.amount, bandName: s.bands.name })
    .from(s.feePayments)
    .innerJoin(s.eventUnlocks, eq(s.feePayments.unlockId, s.eventUnlocks.id))
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.feePayments.bandId, s.bands.id))
    .where(and(eq(s.bands.contactEmail, band.email), eq(s.feePayments.status, "unpaid")))
    .limit(1);
  return rows[0] ?? null;
}

/** A band's fee payments for the operator, newest first. */
export async function feePaymentsForBand(db: Db, bandId: string) {
  return db
    .select({
      id: s.feePayments.id,
      eventId: s.eventUnlocks.eventId,
      status: s.feePayments.status,
    })
    .from(s.feePayments)
    .innerJoin(s.eventUnlocks, eq(s.feePayments.unlockId, s.eventUnlocks.id))
    .where(eq(s.feePayments.bandId, bandId))
    .orderBy(desc(s.feePayments.uploadedAt))
    .limit(500);
}

// --------------------------------------------------------------------- ledger

export type LedgerRow = {
  unlockId: string;
  paidAt: string;
  bracket: string;
  /** The promo's percentage off, when one priced this report. */
  discountPercent: number | null;
  bandId: string;
  bandName: string;
  eventName: string;
  feePaymentId: string | null;
  amount: number;
  status: FeeStatus | null;
  invoiceNumber: string | null;
};

export type LedgerTotals = {
  charged: number;
  received: number;
  inReview: number;
  unpaid: number;
  waived: number;
  rows: number;
};

/**
 * One month of unlocks with their payments, newest first, and the month's
 * totals. Every figure is summed from the rows themselves — nothing typed.
 * Waived reports are counted, not valued: nothing was charged for them.
 */
export async function ledgerForMonth(
  db: D1Database,
  bounds: { from: string; to: string },
  page: { limit: number; offset: number },
): Promise<{ rows: LedgerRow[]; totals: LedgerTotals }> {
  const [list, sums] = await db.batch([
    db
      .prepare(
        `SELECT u.id AS unlock_id, u.paid_at, u.bracket, u.discount_percent,
                b.id AS band_id, b.name AS band_name,
                e.name AS event_name, f.id AS fee_id, f.amount AS fee_amount, f.status,
                f.invoice_number
           FROM event_unlocks u
           JOIN events e ON e.id = u.event_id
           JOIN bands b ON b.id = e.band_id
           LEFT JOIN fee_payments f ON f.unlock_id = u.id
          WHERE u.paid_at >= ?1 AND u.paid_at < ?2
          ORDER BY u.paid_at DESC
          LIMIT ?3 OFFSET ?4`,
      )
      .bind(bounds.from, bounds.to, page.limit, page.offset),
    db
      .prepare(
        `SELECT COALESCE(SUM(f.amount), 0) AS charged,
                COALESCE(SUM(CASE WHEN f.status IN ('ok', 'resolved') THEN f.amount END), 0) AS received,
                COALESCE(SUM(CASE WHEN f.status IN ('checking', 'flagged') THEN f.amount END), 0) AS in_review,
                COALESCE(SUM(CASE WHEN f.status = 'unpaid' THEN f.amount END), 0) AS unpaid,
                COUNT(CASE WHEN f.id IS NULL AND u.bracket IN ('free_first', 'free_pass', 'promo') THEN 1 END) AS waived,
                COUNT(*) AS row_count
           FROM event_unlocks u
           LEFT JOIN fee_payments f ON f.unlock_id = u.id
          WHERE u.paid_at >= ?1 AND u.paid_at < ?2`,
      )
      .bind(bounds.from, bounds.to),
  ]);

  const rows = (list?.results ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      unlockId: String(row["unlock_id"]),
      paidAt: String(row["paid_at"]),
      bracket: String(row["bracket"]),
      discountPercent: row["discount_percent"] === null ? null : Number(row["discount_percent"]),
      bandId: String(row["band_id"]),
      bandName: String(row["band_name"]),
      eventName: String(row["event_name"]),
      feePaymentId: (row["fee_id"] as string | null) ?? null,
      amount: Number(row["fee_amount"] ?? 0),
      status: (row["status"] as FeeStatus | null) ?? null,
      invoiceNumber: (row["invoice_number"] as string | null) ?? null,
    };
  });
  const sum = (sums?.results?.[0] ?? {}) as Record<string, unknown>;
  return {
    rows,
    totals: {
      charged: Number(sum["charged"] ?? 0),
      received: Number(sum["received"] ?? 0),
      inReview: Number(sum["in_review"] ?? 0),
      unpaid: Number(sum["unpaid"] ?? 0),
      waived: Number(sum["waived"] ?? 0),
      rows: Number(sum["row_count"] ?? 0),
    },
  };
}

// ---------------------------------------------------------------------- purge

/** Fee screenshots past their date that still have a file. The caller decides which may go. */
export async function feeProofsPastRetention(db: Db, now: string) {
  return db
    .select({ id: s.feePayments.id, fileKey: s.feePayments.fileKey, status: s.feePayments.status })
    .from(s.feePayments)
    .where(
      and(
        lte(s.feePayments.purgeAfter, now),
        isNull(s.feePayments.purgedAt),
        isNotNull(s.feePayments.fileKey),
      ),
    )
    .limit(500);
}

/** Marks these payments' screenshots gone, keeping everything read off them. */
export async function markFeeProofsPurged(db: Db, feePaymentIds: string[], at: string) {
  if (feePaymentIds.length === 0) return;
  await db
    .update(s.feePayments)
    .set({ fileKey: null, purgedAt: at })
    .where(inArray(s.feePayments.id, feePaymentIds));
}

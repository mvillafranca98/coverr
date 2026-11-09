import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { readFlags } from "../db/queries/flags";
import { referenceUsedOnOtherOrder } from "../db/queries/proofs";
import * as s from "../db/schema";
import { isReadableProof, newId, nowIso } from "../lib/core";
import { extractProof } from "../lib/extract";
import { type Flag, NOTE_ONLY_FLAG, verifyProof } from "../lib/verify";

type Env = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ANTHROPIC_API_KEY?: string;
};

/**
 * The verification pipeline, run after a purchase.
 *
 * Runs in waitUntil, never in the request path: the buyer already has their QR
 * codes by the time this starts, and nothing here can take them away. A flag
 * is internal bookkeeping — it shows on the admin dashboard and tints the door
 * scanner amber with a reason staff can read out.
 *
 * The purchase leaves a NOT_YET_READ flag on the order, and only a read that
 * completes replaces it. Every early return below therefore leaves the order
 * amber, never clean: missing evidence is not a pass. The hourly
 * retry-proof-reads job tries the ones that failed again.
 *
 * Safe to re-run on the same proof; it replaces the machine-raised flags each
 * time and leaves anything an admin already resolved alone.
 *
 * Returns the flags a completed read raised, and nothing when no read
 * completed, so a caller can tell a new finding from one already reported.
 */
export async function runVerification(env: Env, orderId: string): Promise<Flag[]> {
  const db = drizzle(env.DB, { schema: s });

  const rows = await db
    .select({ order: s.orders, event: s.events, proof: s.paymentProofs })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.paymentProofs, eq(s.paymentProofs.orderId, s.orders.id))
    .where(eq(s.orders.id, orderId))
    .limit(1);

  const row = rows[0];
  if (!row) return [];
  const { order, event, proof } = row;

  if (!env.ANTHROPIC_API_KEY) {
    console.warn(`[verify] ANTHROPIC_API_KEY unset — skipping extraction for ${order.shortCode}`);
    return [];
  }

  // The switch for a runaway bill. The order keeps its QR and the proof is
  // still in the bucket; only the paid call is skipped, so the band reads the
  // screenshot itself and the door shows it amber until this is turned back
  // on and the hourly retry reads it.
  const switches = await readFlags(db);
  if (!switches.proof_extraction) {
    console.warn(`[verify] proof_extraction off — no vision call for ${order.shortCode}`);
    return [];
  }

  // A format we cannot read is not the buyer's problem — they have already paid
  // and already have their QR. Flag it so the admin asks for a re-send.
  if (!isReadableProof(proof.contentType)) {
    console.warn(`[verify] unreadable format ${proof.contentType} for ${order.shortCode}`);
    await replaceMachineFlags(db, order.id, proof.id, nowIso(), [
      {
        code: "UNREADABLE",
        severity: "info",
        detail: `El comprobante viene en formato ${proof.contentType}, que no podemos abrir — pedile una captura de pantalla (PNG o JPG)`,
      },
    ]);
    return [];
  }

  const obj = await env.PROOFS.get(proof.fileKey);
  if (!obj) {
    console.error(`[verify] proof object missing: ${proof.fileKey}`);
    return [];
  }

  const result = await extractProof(env.ANTHROPIC_API_KEY, {
    bytes: await obj.arrayBuffer(),
    contentType: proof.contentType,
  });

  const ts = nowIso();

  if (!result.ok) {
    console.error(`[verify] extraction failed for ${order.shortCode}: ${result.error}`);
    await db
      .update(s.paymentProofs)
      .set({ docType: "unknown", ocrRaw: JSON.stringify({ error: result.error }) })
      .where(eq(s.paymentProofs.id, proof.id));
    await replaceMachineFlags(db, order.id, proof.id, ts, [
      {
        code: "UNREADABLE",
        severity: "info",
        detail: "No se pudo leer el comprobante automáticamente — revisar a mano",
      },
    ]);
    return [];
  }

  const f = result.fields;
  // Digits only, the same normalisation the REF_DUPLICATE rule compares with.
  const reference = f.reference ? f.reference.replace(/\D/g, "") : null;

  await db
    .update(s.paymentProofs)
    .set({
      docType: f.doc_type,
      ocrRaw: JSON.stringify(f),
      ocrConfidence: f.legible ? 1 : 0,
      xSenderName: f.sender_name,
      xSenderAccount: f.sender_account,
      xDestAccount: f.dest_account,
      xDestName: f.dest_name,
      xAmount: f.amount == null ? null : Math.round(f.amount * 100),
      xCurrency: f.currency,
      xDatetime: f.datetime,
      xReference: reference,
      xDetail: f.detail,
      xBank: f.bank,
    })
    .where(eq(s.paymentProofs.id, proof.id));

  const referenceReused = reference
    ? await referenceUsedOnOtherOrder(db, {
        bandId: event.bandId,
        reference,
        exceptOrderId: order.id,
      })
    : false;

  const accounts = await db
    .select({ n: s.bankAccounts.accountNumber })
    .from(s.bankAccounts)
    .where(eq(s.bankAccounts.bandId, event.bandId));

  const flags = verifyProof({
    fields: f,
    expectedAmount: order.expectedAmount,
    payerName: order.payerName,
    bandAccounts: accounts.map((a) => a.n),
    eventCreatedAt: event.createdAt,
    // The rule only asks whether this proof's reference is known, so the one
    // reference that matters is all it needs to be handed.
    knownReferences: referenceReused && reference ? new Set([reference]) : new Set(),
  });

  await replaceMachineFlags(db, order.id, proof.id, ts, flags);

  // Matched only when nothing is left for a person to look at, by the same
  // exception the panel and the door make: an unreadable receipt is info
  // severity, but it is not a matched one. Counted from the table rather than
  // from `flags`, because a HASH_DUPLICATE raised at upload survives the
  // replacement above and counts as much as anything read here.
  const [open] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.verificationFlags)
    .where(
      and(
        eq(s.verificationFlags.orderId, order.id),
        isNull(s.verificationFlags.resolvedAt),
        ne(s.verificationFlags.code, NOTE_ONLY_FLAG),
      ),
    );
  await db
    .update(s.orders)
    .set({ verificationStatus: Number(open?.n ?? 0) > 0 ? "flagged" : "matched" })
    .where(eq(s.orders.id, order.id));

  console.log(
    `[verify] ${order.shortCode} ${f.doc_type} amount=${f.amount} ref=${f.reference} flags=${
      flags.map((x) => x.code).join(",") || "none"
    }`,
  );
  return flags;
}

/**
 * Machine-raised flags are replaced wholesale on each run so a re-check can
 * clear a stale one. Anything an admin resolved by hand stays resolved, and
 * HASH_DUPLICATE is left alone because it is raised at upload from the file
 * itself, not from anything the model read.
 */
async function replaceMachineFlags(
  db: ReturnType<typeof drizzle>,
  orderId: string,
  proofId: string,
  ts: string,
  flags: Flag[],
): Promise<void> {
  await db
    .delete(s.verificationFlags)
    .where(
      and(
        eq(s.verificationFlags.orderId, orderId),
        sql`${s.verificationFlags.resolvedAt} is null`,
        ne(s.verificationFlags.code, "HASH_DUPLICATE"),
      ),
    );

  if (flags.length === 0) return;
  await db.insert(s.verificationFlags).values(
    flags.map((flag) => ({
      id: newId("flg"),
      orderId,
      proofId,
      code: flag.code,
      severity: flag.severity,
      detail: flag.detail,
      createdAt: ts,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    })),
  );
}

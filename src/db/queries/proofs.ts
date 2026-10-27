import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";

type UploadedProof = {
  id: string;
  orderId: string;
  /** R2 object key. The bytes themselves never go in D1. */
  fileKey: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  uploadedAt: string;
  /** When the row and its object are due for deletion — a proof is PII. */
  purgeAfter: string;
};

/**
 * Stores a proof the buyer just uploaded, with every extracted field still
 * empty. The vision pass runs after the response and fills them in, so a
 * purchase never waits on reading the image.
 */
export async function insertUnreadProof(
  db: DrizzleD1Database<typeof s>,
  proof: UploadedProof,
): Promise<void> {
  await db.insert(s.paymentProofs).values({
    ...proof,
    phash: null,
    docType: "unknown",
    ocrRaw: null,
    ocrConfidence: null,
    xSenderName: null,
    xSenderAccount: null,
    xDestAccount: null,
    xDestName: null,
    xAmount: null,
    xCurrency: null,
    xDatetime: null,
    xReference: null,
    xDetail: null,
    xBank: null,
  });
}

/**
 * Looks for an earlier upload of the exact same file, by content hash.
 *
 * Returns the short code of the order that already used it so the flag can
 * name it. The code is null when that order's row is gone, which is still a
 * duplicate — the caller must treat "found, unnamed" and "not found" as
 * different answers.
 */
export async function findDuplicateProof(
  db: DrizzleD1Database<typeof s>,
  sha256: string,
  exceptOrderId: string,
): Promise<{ orderShortCode: string | null } | null> {
  const duplicates = await db
    .select({ orderId: s.paymentProofs.orderId })
    .from(s.paymentProofs)
    .where(
      and(eq(s.paymentProofs.sha256, sha256), sql`${s.paymentProofs.orderId} != ${exceptOrderId}`),
    )
    .limit(1);
  if (duplicates.length === 0) return null;

  const prior = await db
    .select({ shortCode: s.orders.shortCode })
    .from(s.orders)
    .where(eq(s.orders.id, duplicates[0]!.orderId))
    .limit(1);
  return { orderShortCode: prior[0]?.shortCode ?? null };
}

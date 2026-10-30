import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as s from "../schema";

type BuyerRefundRequest = {
  id: string;
  orderId: string;
  reason: string;
  requestedAt: string;
};

/**
 * Records a buyer's refund request unless one is already open for the order.
 * True when this call wrote it.
 *
 * One statement, so the check and the insert cannot interleave: two submits
 * that land together - a double tap, a retried POST - leave one row, and only
 * the call that wrote it goes on to email the band. Checking first and
 * inserting second would let both through.
 */
export async function openRefundRequest(
  db: DrizzleD1Database<typeof s>,
  request: BuyerRefundRequest,
): Promise<boolean> {
  const result = await db.run(sql`
    INSERT INTO refund_requests (id, order_id, requested_at, reason, status)
    SELECT ${request.id}, ${request.orderId}, ${request.requestedAt}, ${request.reason}, 'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM refund_requests WHERE order_id = ${request.orderId} AND status = 'open'
    )
  `);
  return (result.meta.changes ?? 0) > 0;
}

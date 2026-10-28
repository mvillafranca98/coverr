/**
 * Where payment proofs live in R2, and how a whole event's worth goes away.
 *
 * The one place that knows the key layout, so the code that writes a proof and
 * the code that deletes an account cannot disagree about where to look.
 */

/** Every proof for one event sits under this prefix. */
export function proofPrefix(eventId: string): string {
  return `proofs/${eventId}/`;
}

/** The key one order's proof is stored under. */
export function proofObjectKey(eventId: string, orderId: string): string {
  return `${proofPrefix(eventId)}${orderId}`;
}

/** R2's ceiling for one list page and for one bulk delete. */
const R2_BATCH = 1000;

/**
 * Deletes every object under these events' prefixes and returns how many.
 *
 * Works from the bucket's listing rather than from database rows on purpose.
 * A proof is stored before its order is written, so a purchase that failed in
 * between leaves an object no row points to — and an image of someone's bank
 * transfer must not outlive the account just because its row never existed.
 */
export async function deleteProofsForEvents(bucket: R2Bucket, eventIds: string[]): Promise<number> {
  let deleted = 0;
  for (const eventId of eventIds) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: proofPrefix(eventId), cursor, limit: R2_BATCH });
      const keys = page.objects.map((object) => object.key);
      if (keys.length > 0) {
        await bucket.delete(keys);
        deleted += keys.length;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return deleted;
}

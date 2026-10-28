import { describe, expect, it } from "vitest";
import { deleteProofsForEvents, proofObjectKey, proofPrefix } from "../src/lib/proof-storage";

/**
 * Deleting an account has to find every proof image the band has, including
 * one whose order row was never written. These hold the key layout and the
 * paging to that.
 */

/** Just enough of R2 to list by prefix, page, and bulk-delete. */
function fakeBucket(keys: string[], pageSize: number) {
  const stored = new Set(keys);
  const deleteCalls: string[][] = [];
  const bucket = {
    async list(options: { prefix: string; cursor?: string; limit: number }) {
      const matching = [...stored].filter((key) => key.startsWith(options.prefix)).sort();
      const start = Number(options.cursor ?? 0);
      const page = matching.slice(start, start + Math.min(options.limit, pageSize));
      const end = start + page.length;
      return {
        objects: page.map((key) => ({ key })),
        truncated: end < matching.length,
        cursor: String(end),
      };
    },
    async delete(batch: string[]) {
      deleteCalls.push(batch);
    },
  };
  return { bucket: bucket as unknown as R2Bucket, deleteCalls };
}

describe("the key layout", () => {
  it("puts an order's proof under its event's prefix", () => {
    expect(proofObjectKey("evt_1", "ord_2")).toBe("proofs/evt_1/ord_2");
    expect(proofObjectKey("evt_1", "ord_2").startsWith(proofPrefix("evt_1"))).toBe(true);
  });

  // `proofs/evt_1` would also match `proofs/evt_10/…` — another band's event.
  it("ends the prefix with a slash so one event never matches another", () => {
    expect(proofObjectKey("evt_10", "ord_9").startsWith(proofPrefix("evt_1"))).toBe(false);
  });
});

describe("deleting an account's proofs", () => {
  it("deletes every object under each of the band's events and nothing else", async () => {
    const { bucket, deleteCalls } = fakeBucket(
      ["proofs/evt_a/ord_1", "proofs/evt_a/ord_2", "proofs/evt_b/ord_3", "proofs/evt_other/ord_4"],
      1000,
    );
    const deleted = await deleteProofsForEvents(bucket, ["evt_a", "evt_b"]);
    expect(deleted).toBe(3);
    expect(deleteCalls.flat().sort()).toEqual([
      "proofs/evt_a/ord_1",
      "proofs/evt_a/ord_2",
      "proofs/evt_b/ord_3",
    ]);
  });

  it("follows the listing past its first page", async () => {
    const keys = Array.from({ length: 7 }, (_, i) => `proofs/evt_a/ord_${i}`);
    const { bucket, deleteCalls } = fakeBucket(keys, 3);
    expect(await deleteProofsForEvents(bucket, ["evt_a"])).toBe(7);
    expect(deleteCalls.map((call) => call.length)).toEqual([3, 3, 1]);
  });

  it("makes no delete call for an event with nothing stored", async () => {
    const { bucket, deleteCalls } = fakeBucket([], 1000);
    expect(await deleteProofsForEvents(bucket, ["evt_empty"])).toBe(0);
    expect(deleteCalls).toEqual([]);
  });
});

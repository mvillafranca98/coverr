import type { ScanRecord } from "./scan-request";

/**
 * What a door sync means, decided without the database.
 *
 * A sync carries every scan a device queued, possibly hundreds made offline.
 * The tickets are read in a few queries and the check-ins written in one
 * batch (`db/queries/check-ins.ts`); this decides, scan by scan and in the
 * order the device made them, what each one was.
 */

/** A ticket as the database has it when the sync arrives. */
export type TicketState = {
  id: string;
  checkedInAt: string | null;
  checkedInDevice: string | null;
  voidedAt: string | null;
  orderStatus: string;
};

/** What the scanner is told about one scan. */
export type ScanResult = {
  t: string;
  status: "ok" | "already" | "unknown" | "voided";
  at?: string;
  by?: string;
};

/** A ticket this sync is the first to let in, to be written. */
export type CheckInClaim = { attendeeId: string; at: string; device: string | null };

/**
 * Each scan's result, and the check-ins to write.
 *
 * A ticket already inside, or let in by an earlier scan in this same sync, is
 * `already` and names who let it in and when: that is a double scan the door
 * should look into, not a second entry. Refunded and voided tickets are
 * refused even though a stale device may still have queued them.
 */
export function decideCheckIns(
  scans: ScanRecord[],
  tickets: Map<string, TicketState>,
): { results: ScanResult[]; claims: Map<string, CheckInClaim> } {
  const results: ScanResult[] = [];
  const claims = new Map<string, CheckInClaim>();

  for (const scan of scans) {
    const ticket = tickets.get(scan.t);
    if (!ticket) {
      results.push({ t: scan.t, status: "unknown" });
      continue;
    }
    if (ticket.orderStatus !== "confirmed" || ticket.voidedAt !== null) {
      results.push({ t: scan.t, status: "voided" });
      continue;
    }
    if (ticket.checkedInAt) {
      results.push({
        t: scan.t,
        status: "already",
        at: ticket.checkedInAt,
        by: ticket.checkedInDevice ?? undefined,
      });
      continue;
    }
    const earlier = claims.get(scan.t);
    if (earlier) {
      results.push({
        t: scan.t,
        status: "already",
        at: earlier.at,
        by: earlier.device ?? undefined,
      });
      continue;
    }
    claims.set(scan.t, { attendeeId: ticket.id, at: scan.at, device: scan.device });
    results.push({ t: scan.t, status: "ok" });
  }

  return { results, claims };
}

/**
 * Corrects the results for check-ins another device's sync wrote first.
 *
 * The write only lets a ticket in while it is still outside, so a sync that
 * lands between this one's read and its write wins the ticket. Every scan of
 * that ticket in this sync is then a double scan, and says who was first.
 */
export function settleLostClaims(
  results: ScanResult[],
  winners: Map<string, TicketState>,
): ScanResult[] {
  return results.map((result) => {
    const winner = winners.get(result.t);
    if (!winner?.checkedInAt) return result;
    return {
      t: result.t,
      status: "already",
      at: winner.checkedInAt,
      by: winner.checkedInDevice ?? undefined,
    };
  });
}

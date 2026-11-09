/**
 * How long a door link keeps working after its event starts.
 *
 * The link goes to volunteers' own phones, often through a group chat. It
 * reads the attendee list, names and notes included, and writes cash sales,
 * comps and check-ins. Until 2026-11-09 it worked forever: last month's
 * volunteer could still read the list and add cash sales to a night the band
 * had already settled (security review S4).
 *
 * Measured from the start time, never from the event's status: an event whose
 * online sale is closed still sells at the door that night.
 */

/** The door, its list and its cash sales stay open this long after the start. */
export const DOOR_OPEN_HOURS = 24;

/**
 * A device that lost signal keeps its scans and syncs them when it is next
 * online; check-ins are accepted this long after the start so that late sync
 * still counts. Nothing else is.
 */
export const LATE_SYNC_DAYS = 7;

const HOUR_MS = 60 * 60 * 1000;

export type DoorAccess = "open" | "sync-only" | "closed";

/**
 * What a door link may still do at `now`.
 *
 * A start time that cannot be read leaves the door open: a bad date must
 * never be what locks staff out on the night.
 */
export function doorAccess(startsAt: string, now: Date): DoorAccess {
  const start = Date.parse(startsAt);
  if (Number.isNaN(start)) return "open";
  const elapsed = now.getTime() - start;
  if (elapsed <= DOOR_OPEN_HOURS * HOUR_MS) return "open";
  if (elapsed <= LATE_SYNC_DAYS * 24 * HOUR_MS) return "sync-only";
  return "closed";
}

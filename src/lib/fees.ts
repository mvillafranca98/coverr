import { HN_OFFSET } from "./core";
import { MAX_PROOF_BYTES } from "./purchase-form";
import type { Flag } from "./verify";

/**
 * The rules around paying the settlement fee. No database here: the routes and
 * the fee job decide with these, and the tests hold them.
 */

/**
 * How long a fee screenshot is kept. It carries a band member's bank details,
 * but it is also Coverr's record of being paid, so it outlives a buyer's 30
 * days. The privacy notice quotes this number.
 */
export const FEE_PROOF_RETENTION_DAYS = 90;

/**
 * Where a fee payment stands.
 *
 * - checking: uploaded, the report already open, the screenshot not read yet
 * - ok: the checks found nothing
 * - flagged: something to look at; every operator was emailed
 * - resolved: an operator looked and the payment stands
 * - unpaid: an operator, after talking to the band, says it was not paid
 */
export type FeeStatus = "checking" | "ok" | "flagged" | "resolved" | "unpaid";

/** The screenshot a band sent with its fee, or what to tell it when there is none fit to keep. */
export function readFeeProofFile(
  value: unknown,
): { ok: true; file: File } | { ok: false; message: string } {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, message: "Subí la captura de tu transferencia." };
  }
  if (value.size > MAX_PROOF_BYTES) {
    return { ok: false, message: "El archivo es muy grande (máximo 10 MB)." };
  }
  return { ok: true, file: value };
}

/** The instant a fee screenshot uploaded now becomes due for deletion. */
export function feeProofPurgeAfter(uploadedAt: Date): string {
  return new Date(uploadedAt.getTime() + FEE_PROOF_RETENTION_DAYS * 86_400_000).toISOString();
}

/**
 * Whether a payment's image may be deleted now. One still in question —
 * being read, flagged and unreviewed, or marked unpaid — keeps its evidence.
 */
export function feeProofPurgeable(status: string): boolean {
  return status === "ok" || status === "resolved";
}

type AccountChoice = { bank: string; isMain: number; active: number };

/**
 * The Coverr account a band is told to pay into: one at the band's own bank
 * when there is one, so it pays no interbank fee, otherwise the main account.
 * Null when none is active, and then nothing can be charged.
 */
export function feeAccountFor<T extends AccountChoice>(
  accounts: readonly T[],
  bandBank: string | null,
): T | null {
  const active = accounts.filter((account) => account.active === 1);
  return (
    (bandBank ? active.find((account) => account.bank === bandBank) : undefined) ??
    active.find((account) => account.isMain === 1) ??
    active[0] ??
    null
  );
}

/**
 * What the checks on a fee screenshot mean for the payment.
 *
 * NAME_MISMATCH is dropped: whoever in the band pays, pays from their own
 * account, so a sender name that is not the band's says nothing. Anything
 * else, even an unreadable screenshot, sends it to an operator — this is
 * Coverr's own money, and a person looking is cheaper than a wrong guess.
 */
export function feeCheckOutcome(flags: readonly Flag[]): { status: FeeStatus; flags: Flag[] } {
  const kept = flags.filter((flag) => flag.code !== "NAME_MISMATCH");
  return { status: kept.length > 0 ? "flagged" : "ok", flags: kept };
}

/** A month as the ledger names it, YYYY-MM. */
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month an instant falls in, Honduras time. */
export function monthOf(instant: Date): string {
  const local = new Date(instant.getTime() - 6 * 3_600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month before or after, YYYY-MM. */
export function shiftMonth(month: string, by: number): string {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const shifted = new Date(Date.UTC(year, monthIndex - 1 + by, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A month's bounds as ISO instants in UTC, start inclusive and end exclusive,
 * for comparing against stored timestamps. The month is Honduras's, so a fee
 * paid at 11pm on the 31st counts in the month it was paid in there.
 */
export function monthBounds(month: string): { from: string; to: string } {
  const from = new Date(`${month}-01T00:00:00${HN_OFFSET}`);
  const to = new Date(`${shiftMonth(month, 1)}-01T00:00:00${HN_OFFSET}`);
  return { from: from.toISOString(), to: to.toISOString() };
}

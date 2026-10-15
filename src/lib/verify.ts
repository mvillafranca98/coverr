import type { ProofFields } from "./extract";
import { formatLps } from "./core";

/**
 * Turns extracted fields into flags.
 *
 * Every rule here is a comparison against something we already know — an
 * account we own, an amount we quoted, a reference we've seen before. None of
 * them is a judgement about whether a document "looks fake", because that
 * judgement can't be defended to a buyer standing at the door. A flag's detail
 * string is written to be read aloud.
 */

export type FlagCode =
  | "REF_DUPLICATE"
  | "DEST_MISMATCH"
  | "HASH_DUPLICATE"
  | "AMOUNT_SHORT"
  | "AMOUNT_OVER"
  | "DATE_STALE"
  | "UNREADABLE"
  | "NAME_MISMATCH"
  | "NOT_A_RECEIPT";

export type Severity = "critical" | "warning" | "info";

export type Flag = { code: FlagCode; severity: Severity; detail: string };

export type VerifyInput = {
  fields: ProofFields;
  expectedAmount: number;
  payerName: string;
  /** Every account the band collects into, so we can tell "not ours" from "ours". */
  bandAccounts: string[];
  /** When the event opened for sale — a transfer older than that is recycled. */
  eventCreatedAt: string;
  /** References already seen on other orders. */
  knownReferences: Set<string>;
};

const digits = (s: string): string => s.replace(/\D/g, "");

/**
 * Bank documents show the destination account in three shapes: full
 * (000000001), masked (*****7371), and occasionally spaced. Comparing on the
 * last four digits handles all three without ever matching a genuinely
 * different account, since we only compare against accounts we own.
 */
function accountMatches(extracted: string, ours: string[]): boolean {
  const e = digits(extracted);
  if (!e) return false;
  return ours.some((acc) => {
    const a = digits(acc);
    if (!a) return false;
    if (a === e) return true;
    const n = Math.min(4, a.length, e.length);
    return n >= 4 && a.slice(-n) === e.slice(-n);
  });
}

/** Loose comparison: accents, case, and middle names all vary in practice. */
function nameLooselyMatches(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const wa = norm(a);
  const wb = norm(b);
  if (!wa.length || !wb.length) return true;
  return wa.some((w) => wb.includes(w));
}

/**
 * An extracted datetime we can actually place in time: ISO-8601 beginning with
 * a four-digit year. Anything shorter is discarded rather than guessed at,
 * because JavaScript will happily invent a year for a partial date.
 */
const HAS_FULL_YEAR = /^\d{4}-\d{2}-\d{2}/;

export function verifyProof(input: VerifyInput): Flag[] {
  const { fields, expectedAmount, payerName, bandAccounts, eventCreatedAt, knownReferences } = input;
  const flags: Flag[] = [];

  if (!fields.is_payment_confirmation) {
    flags.push({
      code: "NOT_A_RECEIPT",
      severity: "warning",
      detail: "El archivo no parece ser un comprobante de transferencia",
    });
    return flags;
  }

  if (!fields.legible) {
    flags.push({
      code: "UNREADABLE",
      severity: "info",
      detail: "No se pudo leer el comprobante — revisar a mano",
    });
  }

  // --- reference already used elsewhere -------------------------------------
  // A reference is unique per transaction, so the same one on two orders means
  // one is recycled. Deterministic, and it works across events.
  const ref = fields.reference ? digits(fields.reference) : "";
  if (ref && knownReferences.has(ref)) {
    flags.push({
      code: "REF_DUPLICATE",
      severity: "critical",
      detail: `Esa referencia (${ref}) ya se usó en otra compra`,
    });
  }

  // --- did the money come to us at all? -------------------------------------
  if (fields.dest_account && bandAccounts.length > 0) {
    if (!accountMatches(fields.dest_account, bandAccounts)) {
      flags.push({
        code: "DEST_MISMATCH",
        severity: "critical",
        detail: `La transferencia fue a la cuenta ${fields.dest_account}, que no es nuestra`,
      });
    }
  }

  // --- amount ---------------------------------------------------------------
  if (fields.amount != null && expectedAmount > 0) {
    const paid = Math.round(fields.amount * 100);
    const diff = paid - expectedAmount;
    // A couple of lempiras either way is rounding or a bank fee, not a problem.
    const TOLERANCE = 200;
    if (diff < -TOLERANCE) {
      flags.push({
        code: "AMOUNT_SHORT",
        severity: "warning",
        detail: `Faltan ${formatLps(-diff)} — pagó ${formatLps(paid)} de ${formatLps(expectedAmount)}`,
      });
    } else if (diff > TOLERANCE) {
      flags.push({
        code: "AMOUNT_OVER",
        severity: "warning",
        detail: `Pagó ${formatLps(diff)} de más — puede estar cubriendo a alguien más`,
      });
    }
  }

  // --- transfer older than the sale ----------------------------------------
  // Only a date carrying its own year can be compared. BAC's app notification
  // prints "15 octubre" and nothing else, which the extractor faithfully
  // returns as "10-15" — and `new Date("10-15")` is the year 2001, which read
  // as a transfer made twenty-five years before the sale opened. A date we
  // cannot place is not evidence of a stale one, so it raises nothing.
  if (fields.datetime && HAS_FULL_YEAR.test(fields.datetime)) {
    const when = new Date(fields.datetime);
    const opened = new Date(eventCreatedAt);
    if (!Number.isNaN(when.getTime()) && when.getTime() < opened.getTime() - 86400000) {
      flags.push({
        code: "DATE_STALE",
        severity: "warning",
        detail: `La transferencia es del ${when.toLocaleDateString("es-HN")}, antes de que abriera la venta`,
      });
    }
  }

  // --- sender name ----------------------------------------------------------
  // INFO ONLY, and never surfaced to the buyer or to door staff. Paying for
  // friends is the common case, not the suspicious one — the baseline event is
  // full of one person buying four tickets.
  if (fields.sender_name && payerName && !nameLooselyMatches(fields.sender_name, payerName)) {
    flags.push({
      code: "NAME_MISMATCH",
      severity: "info",
      detail: `Transfirió ${fields.sender_name}, compró ${payerName} — normalmente es alguien pagando por otro`,
    });
  }

  return flags;
}

/** Highest severity present, for setting the order's verification status. */
export function worstSeverity(flags: Flag[]): Severity | null {
  if (flags.some((f) => f.severity === "critical")) return "critical";
  if (flags.some((f) => f.severity === "warning")) return "warning";
  if (flags.some((f) => f.severity === "info")) return "info";
  return null;
}

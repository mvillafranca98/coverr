import { formatLps } from "./core";
import type { ProofFields } from "./extract";

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
  | "MISSING_FIELDS"
  | "NAME_MISMATCH"
  | "NOT_A_RECEIPT";

export type Severity = "critical" | "warning" | "info";

export type Flag = { code: FlagCode; severity: Severity; detail: string };

/** What each check is called wherever a person reads it. The code itself stays internal. */
const FLAG_LABEL: Record<FlagCode, string> = {
  REF_DUPLICATE: "Referencia repetida",
  HASH_DUPLICATE: "Comprobante repetido",
  DEST_MISMATCH: "Otra cuenta",
  AMOUNT_SHORT: "Pagó de menos",
  AMOUNT_OVER: "Pagó de más",
  DATE_STALE: "Transferencia vieja",
  UNREADABLE: "No se pudo leer",
  MISSING_FIELDS: "Faltan datos",
  NAME_MISMATCH: "Pagó otra persona",
  NOT_A_RECEIPT: "No es un comprobante",
};

/** A stored flag's name for people, or its code if it is one this version does not know. */
export function flagLabel(code: string): string {
  return (FLAG_LABEL as Record<string, string>)[code] ?? code;
}

/**
 * The one flag that is a note rather than something to review. One person
 * paying for a group is the common case, so a different sender never asks the
 * band to do anything: it is left out of every "revisar" count and chip, and
 * the door never sees it (routes/scan.ts).
 *
 * Every other flag, whatever its severity, means a person should look: the
 * panel, the door and the order's status all go by this one exception.
 */
export const NOTE_ONLY_FLAG: FlagCode = "NAME_MISMATCH";

/**
 * Flags that are evidence the upload is not a payment for this order: not a
 * receipt at all, a file or a reference already used on another order, or
 * money sent to an account that is not the band's. While one is open, the
 * order holds no place in the room or in a price's allocation
 * (`db/queries/orders.ts`, `holdsAPlace`), so junk uploads cannot sell an event
 * out from under real buyers. The buyer keeps the QR either way, and resolving
 * the flag gives the place back.
 *
 * Missing fields and an unread receipt are deliberately not here: they are
 * also what a genuine buyer's cropped screenshot, or an outage at the API,
 * look like, and taking those buyers' places would oversell the room.
 */
export const FLAGS_THAT_FREE_A_PLACE: readonly FlagCode[] = [
  "NOT_A_RECEIPT",
  "HASH_DUPLICATE",
  "REF_DUPLICATE",
  "DEST_MISMATCH",
];

/**
 * Raised at upload, before anything has read the proof, and replaced by the
 * first read that completes. When no read ever completes — the switch is off,
 * the key is missing, the job was cut off — it stays, so a proof nobody read
 * is amber at the door rather than green.
 */
export const NOT_YET_READ: Flag = {
  code: "UNREADABLE",
  severity: "info",
  detail: "Todavía no se leyó el comprobante — revisar a mano",
};

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
  const { fields, expectedAmount, payerName, bandAccounts, eventCreatedAt, knownReferences } =
    input;
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
  // Fewer than four digits printed is too little to compare, which is not the
  // same as somebody else's account: it is treated as not shown, below.
  const destAccount = fields.dest_account ?? "";
  const accountShown = digits(destAccount).length >= 4;
  if (accountShown && bandAccounts.length > 0 && !accountMatches(destAccount, bandAccounts)) {
    flags.push({
      code: "DEST_MISMATCH",
      severity: "critical",
      detail: `La transferencia fue a la cuenta ${destAccount}, que no es nuestra`,
    });
  }

  // --- amount ---------------------------------------------------------------
  if (fields.amount != null && expectedAmount > 0) {
    const paid = Math.round(fields.amount * 100);
    const diff = paid - expectedAmount;
    // No tolerance. There used to be L2 of slack "for rounding", but rounding
    // cannot produce a gap that size — both sides are integer centavos and
    // Math.round absorbs sub-centavo noise — and the ACH fee is charged to the
    // sender on top rather than deducted. What it did produce was a check that
    // silently disabled itself whenever a ticket cost less than the tolerance.
    //
    // A transfer funded in another currency can also convert to slightly more
    // or less than quoted, and that is exactly an order a band should look at.
    // Both amount flags are warnings: the QR still issues and no buyer is ever
    // blocked by this. See docs/QA-FINDINGS.md F6.
    if (diff < 0) {
      flags.push({
        code: "AMOUNT_SHORT",
        severity: "warning",
        detail: `Faltan ${formatLps(-diff)} — pagó ${formatLps(paid)} de ${formatLps(expectedAmount)}`,
      });
    } else if (diff > 0) {
      flags.push({
        code: "AMOUNT_OVER",
        severity: "warning",
        detail: `Pagó ${formatLps(diff)} de más — puede estar cubriendo a alguien más`,
      });
    }
  }

  // --- what the two checks above could not see ------------------------------
  // A field the receipt does not show is not evidence the payment was right.
  // Before this rule, cropping the account out of any old transfer for the
  // right amount produced a clean order, green at the door. Not raised on an
  // illegible receipt, where UNREADABLE already says why nothing was read.
  const notShown = [
    bandAccounts.length > 0 && !accountShown ? "la cuenta de destino" : null,
    expectedAmount > 0 && fields.amount == null ? "el monto" : null,
  ].filter((field): field is string => field !== null);
  if (fields.legible && notShown.length > 0) {
    flags.push({
      code: "MISSING_FIELDS",
      severity: "warning",
      detail: `El comprobante no muestra ${notShown.join(" ni ")} — revisar a mano`,
    });
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

import { BANKS, isShortCode } from "./core";
import { type ProofMediaType, sniffProof } from "./file-type";
import { TEXT_LIMITS, tooLong } from "./text-limits";

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_TICKETS = 10;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type PurchaseInput = {
  quantity: number;
  payerName: string;
  payerEmail: string;
  payerPhone: string | null;
  /** Which bank the buyer says they paid from. Narrows reconciliation later. */
  bankSelected: string | null;
  /** The code the buyer may have pasted into the transfer's "Detalle". */
  shortCode: string | null;
  attendees: { name: string; note: string | null }[];
  proof: File;
};

/** `field` is the name of the input at fault, so the page can point at it. */
export type PurchaseFormResult =
  | { ok: true; values: PurchaseInput }
  | { ok: false; message: string; field?: string };

/**
 * Validate the buyer's checkout form.
 *
 * Nothing here concerns money: the price, the rule and the total are resolved
 * server-side from the event, so a form field claiming an amount would be
 * ignored even if the client sent one.
 *
 * Returns a result rather than throwing — every failure is something the buyer
 * can fix, so the caller sends them back to the form with the message.
 */
export function readPurchaseForm(body: Record<string, unknown>): PurchaseFormResult {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");

  const quantity = Math.min(MAX_TICKETS, Math.max(1, parseInt(text("quantity"), 10) || 1));
  const payerName = text("payer_name");
  const payerEmail = text("payer_email");

  if (!payerName) return { ok: false, message: "Falta tu nombre.", field: "payer_name" };
  if (!EMAIL_PATTERN.test(payerEmail)) {
    return { ok: false, message: "Revisá tu correo electrónico.", field: "payer_email" };
  }
  const payerPhone = text("payer_phone");
  const tooLongBuyerField = firstTooLong([
    { value: payerName, max: TEXT_LIMITS.name, label: "Tu nombre", field: "payer_name" },
    { value: payerEmail, max: TEXT_LIMITS.email, label: "Tu correo", field: "payer_email" },
    { value: payerPhone, max: TEXT_LIMITS.phone, label: "Tu teléfono", field: "payer_phone" },
  ]);
  if (tooLongBuyerField) return { ok: false, ...tooLongBuyerField };
  if (body["consent"] !== "1") {
    return {
      ok: false,
      message: "Tenés que aceptar los términos para continuar.",
      field: "consent",
    };
  }

  // One named ticket per person: each attendee gets their own QR at the door.
  const attendees: { name: string; note: string | null }[] = [];
  for (let position = 1; position <= quantity; position++) {
    const name = text(`attendee_name_${position}`);
    if (!name) {
      return {
        ok: false,
        message: `Falta el nombre de la persona ${position}.`,
        field: `attendee_name_${position}`,
      };
    }
    const note = text(`attendee_note_${position}`);
    const tooLongAttendeeField = firstTooLong([
      {
        value: name,
        max: TEXT_LIMITS.name,
        label: `El nombre de la persona ${position}`,
        field: `attendee_name_${position}`,
      },
      {
        value: note,
        max: TEXT_LIMITS.ticketNote,
        label: `La nota de la persona ${position}`,
        field: `attendee_note_${position}`,
      },
    ]);
    if (tooLongAttendeeField) return { ok: false, ...tooLongAttendeeField };
    attendees.push({ name, note: note || null });
  }

  const proof = body["proof"];
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, message: "Subí tu comprobante de pago.", field: "proof" };
  }
  if (proof.size > MAX_PROOF_BYTES) {
    return { ok: false, message: "El archivo es muy grande (máximo 10 MB).", field: "proof" };
  }

  return {
    ok: true,
    values: {
      quantity,
      payerName,
      payerEmail,
      payerPhone: payerPhone || null,
      // Both come back from hidden or fixed inputs the page filled in. Anything
      // that is not one of ours is dropped rather than stored as the buyer sent it.
      bankSelected: BANKS.some((b) => b.code === text("bank")) ? text("bank") : null,
      shortCode: isShortCode(text("short_code")) ? text("short_code") : null,
      attendees,
      proof,
    },
  };
}

/** The first field over its length limit, as the error to send the buyer back with. */
function firstTooLong(
  fields: { value: string; max: number; label: string; field: string }[],
): { message: string; field: string } | null {
  for (const f of fields) {
    const message = tooLong(f.value, f.max, f.label);
    if (message) return { message, field: f.field };
  }
  return null;
}

/** The proof's real type, or why it cannot be accepted. */
export type ProofCheckResult =
  | { ok: true; contentType: ProofMediaType }
  | { ok: false; message: string; field: "proof" };

/**
 * Decides whether the uploaded bytes are a proof at all.
 *
 * Split from `readPurchaseForm` because it needs the file's contents, which
 * only the route can await — but the refusal copy belongs here with every
 * other thing this form can say no to.
 */
export function checkProofBytes(bytes: ArrayBuffer | Uint8Array): ProofCheckResult {
  const sniffed = sniffProof(bytes);

  if (sniffed.kind === "ok") return { ok: true, contentType: sniffed.mediaType };

  if (sniffed.kind === "phone-photo") {
    return {
      ok: false,
      field: "proof",
      message:
        "Tu teléfono guardó la foto en un formato que no podemos leer. " +
        "Tomale una captura de pantalla y subila, o compartila como JPG.",
    };
  }

  return {
    ok: false,
    field: "proof",
    message: "Ese archivo no es una imagen ni un PDF. Subí la captura de tu transferencia.",
  };
}

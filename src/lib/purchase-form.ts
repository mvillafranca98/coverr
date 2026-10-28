import { type ProofMediaType, sniffProof } from "./file-type";

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
    attendees.push({ name, note: text(`attendee_note_${position}`) || null });
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
      payerPhone: text("payer_phone") || null,
      bankSelected: text("bank") || null,
      shortCode: text("short_code") || null,
      attendees,
      proof,
    },
  };
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

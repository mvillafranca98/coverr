import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

/**
 * Reads a payment confirmation.
 *
 * This is an OCR assistant, never a judge. It extracts what the document says
 * and nothing else — it is not asked whether the document looks genuine, and
 * it never decides anything. Every verdict downstream comes from a
 * deterministic comparison against facts we already hold (see verify.ts), so a
 * flag can always be explained to a buyer in one sentence.
 *
 * Four real formats it has to survive, all seen in the wild:
 *   app_notification — the BAC app receipt card
 *   web_result      — the Banca Electrónica result page, often cropped mid-screenshot
 *   alert_email     — the account holder's own alert (no sender, no reference)
 *   pdf_export      — a PDF printout with a real text layer
 * The same format renders at different widths, so extraction is by label and
 * never by position.
 */

export const ProofSchema = z.object({
  doc_type: z
    .enum(["app_notification", "web_result", "alert_email", "pdf_export", "unknown"])
    .describe("Which kind of document this is. 'unknown' if it is not a payment confirmation."),
  is_payment_confirmation: z
    .boolean()
    .describe("False for anything that is not a bank transfer confirmation at all."),
  bank: z.string().nullable().describe("Issuing bank, e.g. BAC, FICOHSA, ATLANTIDA."),
  sender_name: z.string().nullable().describe("Full name of the person who sent the money."),
  sender_account: z.string().nullable().describe("Sender's account number if shown."),
  dest_account: z
    .string()
    .nullable()
    .describe("Destination account number exactly as printed, including any masking like *****7371."),
  dest_name: z.string().nullable().describe("Name of the destination account holder."),
  amount: z
    .number()
    .nullable()
    .describe("Amount transferred as a plain number in the document's currency. 1,200.00 -> 1200."),
  currency: z.string().nullable().describe("Currency code, e.g. HNL for lempiras, USD."),
  datetime: z
    .string()
    .nullable()
    .describe("Transaction date and time as ISO-8601. Use the document's own timezone if shown."),
  reference: z.string().nullable().describe("Reference or transaction number, digits only."),
  detail: z
    .string()
    .nullable()
    .describe("Free-text detail/description/concepto the sender typed, if any."),
  legible: z
    .boolean()
    .describe("False if the image is too blurry, dark or cropped to read the key fields."),
});

export type ProofFields = z.infer<typeof ProofSchema>;

const SYSTEM = `Extraés datos de comprobantes de transferencia bancaria de Honduras.

Reglas:
- Devolvé únicamente lo que el documento dice. No infieras, no completes, no adivines.
- Si un campo no aparece, devolvé null. Nunca inventes un valor plausible.
- Copiá los números de cuenta exactamente como están impresos, incluyendo enmascarado (*****7371).
- El monto es un número: "L1,200.00" -> 1200, "400.00 LPS" -> 400.
- Los montos en Honduras son lempiras (HNL) salvo que diga otra cosa.
- Las capturas suelen estar recortadas y el mismo formato se ve en distintos anchos.
  Ubicá los campos por su etiqueta ("Monto", "Referencia", "Detalle", "Cuenta"), nunca por posición.
- No opines sobre si el documento es auténtico. No es tu trabajo y no se te pregunta.`;

export type ExtractResult =
  | { ok: true; fields: ProofFields; model: string }
  | { ok: false; error: string };

export async function extractProof(
  apiKey: string,
  file: { bytes: ArrayBuffer; contentType: string },
): Promise<ExtractResult> {
  const client = new Anthropic({ apiKey });

  const b64 = bytesToBase64(new Uint8Array(file.bytes));
  const isPdf = file.contentType.includes("pdf");

  // PDFs go in as documents, not images — Claude reads the text layer directly,
  // which is exact and avoids OCR on something that was never a picture.
  const media: Anthropic.MessageParam["content"] = isPdf
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 },
        },
      ]
    : [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: normalizeImageType(file.contentType),
            data: b64,
          },
        },
      ];

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2000,
      system: SYSTEM,
      // Reading labelled fields off a receipt is a simple extraction; low
      // effort keeps latency and spend down without hurting accuracy.
      output_config: { effort: "low", format: zodOutputFormat(ProofSchema) },
      messages: [
        {
          role: "user",
          content: [...media, { type: "text", text: "Extraé los datos de este comprobante." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: `refusal: ${response.stop_details?.category ?? "unknown"}` };
    }
    if (!response.parsed_output) {
      return { ok: false, error: "no parsed output" };
    }
    return { ok: true, fields: response.parsed_output, model: response.model };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `anthropic ${err.status}: ${err.message}`.slice(0, 300) };
    }
    return { ok: false, error: String(err).slice(0, 300) };
  }
}

function normalizeImageType(contentType: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = contentType.toLowerCase();
  if (t.includes("png")) return "image/png";
  if (t.includes("gif")) return "image/gif";
  if (t.includes("webp")) return "image/webp";
  return "image/jpeg";
}

/** Chunked so a multi-megabyte proof doesn't blow the argument limit on spread. */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

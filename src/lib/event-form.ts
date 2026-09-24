import { localInputToIso, lpsToCentavos } from "./core";

export type EventInput = {
  name: string;
  venue: string;
  startsAt: string;
  doorsAt: string | null;
  description: string | null;
  musicType: string | null;
  thankYouNote: string | null;
  capacityCap: number | null;
  refundPolicy: string;
  wristbandsStart: number | null;
  presaleAmount: number;
  presaleMaxQty: number | null;
  doorAmount: number;
};

/**
 * The refund text stored on the order at purchase. Copied onto each order
 * rather than read from the event, so changing the policy later never applies
 * retroactively to someone who already bought.
 */
export const REFUND_TEXT: Record<string, string | null> = {
  none: "Esta compra no admite reembolsos.",
  "24h":
    "Podés solicitar reembolso dentro de las 24 horas siguientes a tu compra escribiendo al correo de la banda.",
};

export type EventFormResult =
  | { ok: true; values: EventInput }
  | { ok: false; message: string };

/**
 * Validate the new-event and event-settings form, which are the same shape.
 *
 * Returns a result rather than throwing: every failure here is a typo the admin
 * can fix, so the caller re-renders the form with the message instead of
 * handling an exception.
 */
export function readEventForm(body: Record<string, unknown>): EventFormResult {
  const text = (key: string) =>
    typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const nonNegativeInt = (key: string) => {
    const raw = text(key);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const name = text("name");
  const venue = text("venue");
  if (!name) return { ok: false, message: "Falta el nombre del evento." };
  if (!venue) return { ok: false, message: "Falta el lugar." };

  const startsAt = localInputToIso(text("starts_at"));
  if (!startsAt) return { ok: false, message: "Revisá la fecha de inicio." };
  const doorsAt = text("doors_at") ? localInputToIso(text("doors_at")) : null;

  // Both prices are required. A blank one used to reach the database as L0,
  // which published an event whose door tickets were free.
  if (!text("presale_amount")) return { ok: false, message: "Falta el precio de preventa." };
  if (!text("door_amount")) return { ok: false, message: "Falta el precio de taquilla." };

  const presaleAmount = lpsToCentavos(text("presale_amount"));
  const doorAmount = lpsToCentavos(text("door_amount"));
  if (presaleAmount == null) return { ok: false, message: "Revisá el precio de preventa." };
  if (doorAmount == null) return { ok: false, message: "Revisá el precio de taquilla." };

  return {
    ok: true,
    values: {
      name,
      venue,
      startsAt,
      doorsAt,
      description: text("description") || null,
      musicType: text("music_type") || null,
      thankYouNote: text("thank_you") || null,
      capacityCap: nonNegativeInt("capacity"),
      refundPolicy: text("refund_policy") === "24h" ? "24h" : "none",
      wristbandsStart: nonNegativeInt("wristbands"),
      presaleAmount,
      presaleMaxQty: nonNegativeInt("presale_max"),
      doorAmount,
    },
  };
}

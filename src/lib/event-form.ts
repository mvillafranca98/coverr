import { localInputToIso, lpsToCentavos } from "./core";
import { TEXT_LIMITS, tooLong } from "./text-limits";

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

export type EventFormResult = { ok: true; values: EventInput } | { ok: false; message: string };

/**
 * What the band typed, in the form's own shape, so a refused form comes back
 * filled in rather than blank. Nothing here is checked: it only ever goes back
 * into the same fields it came from.
 */
export function typedEventValues(body: Record<string, unknown>): Partial<EventInput> {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
  const wholeNumber = (key: string) => {
    const parsed = Number.parseInt(text(key), 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    name: text("name"),
    venue: text("venue"),
    startsAt: text("starts_at"),
    doorsAt: text("doors_at") || null,
    description: text("description") || null,
    musicType: text("music_type") || null,
    thankYouNote: text("thank_you") || null,
    capacityCap: wholeNumber("capacity"),
    refundPolicy: text("refund_policy") === "24h" ? "24h" : "none",
    wristbandsStart: wholeNumber("wristbands"),
    presaleAmount: lpsToCentavos(text("presale_amount")) ?? undefined,
    presaleMaxQty: wholeNumber("presale_max"),
    doorAmount: lpsToCentavos(text("door_amount")) ?? undefined,
  };
}

/** How long before the start doors may open. Wider than any real gig, narrower than a typo. */
const MAX_DOORS_LEAD_HOURS = 12;

/**
 * Why a doors time cannot be right, or null when it can. Presale ends at
 * doors, and buyers are only shown its time, not its date — so a doors time
 * on the wrong day silently moves the whole event to the door price.
 */
function doorsTimeProblem(startsAt: string, doorsAt: string): string | null {
  const leadMs = Date.parse(startsAt) - Date.parse(doorsAt);
  if (leadMs < 0) return "Puertas tiene que ser antes de que empiece el evento.";
  if (leadMs > MAX_DOORS_LEAD_HOURS * 3600 * 1000) {
    return `Puertas tiene que ser como mucho ${MAX_DOORS_LEAD_HOURS} horas antes de que empiece. Revisá el día.`;
  }
  return null;
}

/**
 * Validate the new-event and event-settings form, which are the same shape.
 *
 * Returns a result rather than throwing: every failure here is a typo the admin
 * can fix, so the caller re-renders the form with the message instead of
 * handling an exception.
 */
export function readEventForm(body: Record<string, unknown>): EventFormResult {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
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

  // Each of these is printed on every buyer's page and ticket.
  const lengthError =
    tooLong(name, TEXT_LIMITS.eventName, "El nombre del evento") ??
    tooLong(venue, TEXT_LIMITS.venue, "El lugar") ??
    tooLong(text("description"), TEXT_LIMITS.description, "La descripción") ??
    tooLong(text("music_type"), TEXT_LIMITS.musicType, "El tipo de música") ??
    tooLong(text("thank_you"), TEXT_LIMITS.thankYouNote, "La nota de agradecimiento");
  if (lengthError) return { ok: false, message: lengthError };

  const startsAt = localInputToIso(text("starts_at"));
  if (!startsAt) return { ok: false, message: "Revisá la fecha de inicio." };
  const doorsAt = text("doors_at") ? localInputToIso(text("doors_at")) : null;
  if (text("doors_at") && !doorsAt) return { ok: false, message: "Revisá la hora de puertas." };
  const doorsProblem = doorsAt ? doorsTimeProblem(startsAt, doorsAt) : null;
  if (doorsProblem) return { ok: false, message: doorsProblem };

  // Both prices are required. A blank one used to reach the database as L0,
  // which published an event whose door tickets were free.
  if (!text("presale_amount")) return { ok: false, message: "Falta el precio de preventa." };
  if (!text("door_amount")) return { ok: false, message: "Falta el precio de taquilla." };

  // Zero is refused too: a buyer would be asked to transfer L0 and upload a
  // receipt for it. Free entry is a comp, issued from the door or a manual sale.
  const presaleAmount = lpsToCentavos(text("presale_amount"));
  const doorAmount = lpsToCentavos(text("door_amount"));
  if (!presaleAmount) {
    return { ok: false, message: "El precio de preventa tiene que ser mayor que cero." };
  }
  if (!doorAmount) {
    return { ok: false, message: "El precio de taquilla tiene que ser mayor que cero." };
  }

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

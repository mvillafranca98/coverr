const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Open, or closed with the reason the buyer is shown. */
export type RefundWindow =
  | { open: true }
  | { open: false; headline: string; detail: string };

/**
 * Decides whether a refund can still be asked for.
 *
 * `policy` is the event's refund policy as it stands now — the orders table
 * holds no policy of its own — so editing the event also moves the window for
 * orders that were already sold.
 */
export function refundGate(
  order: { status: string; createdAt: string; channel: string },
  policy: string,
): RefundWindow {
  if (order.status === "refunded") {
    return { open: false, headline: "Ya está reembolsado", detail: "Esta orden ya fue devuelta." };
  }
  if (order.status === "void") {
    return { open: false, headline: "Orden anulada", detail: "Esta orden ya no está activa." };
  }
  if (order.channel === "comp") {
    return { open: false, headline: "Cortesía", detail: "Esta entrada no se pagó, así que no hay nada que devolver." };
  }
  if (policy === "none") {
    return {
      open: false,
      headline: "Esta compra no admite reembolsos",
      detail: "Así estaba indicado al momento de comprar.",
    };
  }
  const age = Date.now() - new Date(order.createdAt).getTime();
  if (age > REFUND_WINDOW_MS) {
    return {
      open: false,
      headline: "Pasaron más de 24 horas",
      detail: "El plazo para pedir reembolso ya venció.",
    };
  }
  return { open: true };
}

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Open, or closed with the reason the buyer is shown. */
export type RefundWindow = { open: true } | { open: false; headline: string; detail: string };

/**
 * Decides whether a refund can still be asked for.
 *
 * Reads the policy off the order, not off the event: each order stores the
 * policy it was sold under, so a band editing the event later never closes a
 * window a buyer was shown and agreed to at checkout.
 */
export function refundGate(order: {
  status: string;
  createdAt: string;
  channel: string;
  refundPolicy: string;
}): RefundWindow {
  if (order.status === "refunded") {
    return { open: false, headline: "Ya está reembolsado", detail: "Esta orden ya fue devuelta." };
  }
  if (order.status === "void") {
    return { open: false, headline: "Orden anulada", detail: "Esta orden ya no está activa." };
  }
  if (order.channel === "comp") {
    return {
      open: false,
      headline: "Cortesía",
      detail: "Esta entrada no se pagó, así que no hay nada que devolver.",
    };
  }
  if (order.refundPolicy === "none") {
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

/**
 * What a band's ticket selection means when it refunds part of an order.
 *
 * Pure and separate from the route because the consequences diverge sharply:
 * covering every live ticket refunds the order and marks it `refunded`, while
 * covering some of them leaves the order `confirmed` with fewer tickets on it.
 * Getting that boundary wrong either strands an order that should be closed or
 * closes one that still has people coming.
 */

export type TicketRefundPlan =
  | {
      ok: true;
      /** Tickets to stamp `voidedAt`. Never includes one already voided. */
      voidIds: string[];
      /** True when nothing live is left afterwards, so the order is done. */
      voidsWholeOrder: boolean;
    }
  | { ok: false; message: string };

/**
 * Works out which tickets to void.
 *
 * Deliberately forgiving in one direction and strict in the other. Ids that
 * are not on the order, or are already voided, are dropped rather than
 * refused: a double submit or a stale page must not write a second refund or
 * throw an error at somebody mid-task. An empty selection *is* refused,
 * because the alternative — treating "nothing chosen" as "everything" — would
 * turn an unticked form into a full refund, which is the one mistake here that
 * costs real money.
 */
export function planTicketRefund(input: {
  attendees: { id: string; voidedAt: string | null }[];
  selectedIds: string[];
}): TicketRefundPlan {
  const live = input.attendees.filter((a) => a.voidedAt === null);
  if (live.length === 0) {
    return { ok: false, message: "Esta orden ya no tiene boletos activos." };
  }

  const liveIds = new Set(live.map((a) => a.id));
  const voidIds = [...new Set(input.selectedIds)].filter((id) => liveIds.has(id));

  if (voidIds.length === 0) {
    return { ok: false, message: "Elegí al menos un boleto para reembolsar." };
  }

  return { ok: true, voidIds, voidsWholeOrder: voidIds.length === live.length };
}

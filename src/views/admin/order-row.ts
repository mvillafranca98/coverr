/**
 * How an order is described across the admin screens. Shared by the list and
 * the detail page so the two never drift — a channel renamed here is renamed
 * in both.
 *
 * Structural rather than imported from the query layer: a view states the
 * shape it needs and nothing more, which keeps presentation independent of how
 * the rows were fetched.
 */
export type OrderRow = {
  id: string;
  shortCode: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string | null;
  quantity: number;
  unitAmount: number;
  expectedAmount: number;
  channel: string;
  status: string;
  verificationStatus: string;
  bankSelected: string | null;
  createdAt: string;
  note: string | null;
  attendees: string;
  checkedIn: number;
  refundedTickets: number;
  flag: string | null;
};

/** How an order that is no longer confirmed reads. A confirmed one shows its check instead. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  refunded: "reembolsada",
  void: "anulada",
};

export const CHANNEL_LABEL: Record<string, string> = {
  online: "Preventa",
  door_online: "Taquilla",
  door_cash: "Efectivo",
  manual: "Manual",
  comp: "Cortesía",
};

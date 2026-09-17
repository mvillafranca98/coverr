/**
 * The subset of an order the orders screen searches and filters on. Kept
 * structural so this stays pure logic with no dependency on the query layer.
 */
export type FilterableOrder = {
  id: string;
  shortCode: string;
  payerName: string;
  payerEmail: string;
  attendees: string;
  channel: string;
  checkedIn: number;
  flag: string | null;
  hasOpenRefund: boolean;
};

export type OrderFilterCriteria = {
  /** Free text matched against payer, attendees and the order's short code. */
  query?: string;
  /** One of the named views, or "" for all orders. */
  view?: string;
};

const CHANNEL_VIEWS = new Set(["online", "door_online", "door_cash", "manual", "comp"]);

function matchesQuery(order: FilterableOrder, needle: string): boolean {
  return (
    order.payerName.toLowerCase().includes(needle) ||
    order.payerEmail.toLowerCase().includes(needle) ||
    order.shortCode.toLowerCase().includes(needle) ||
    order.attendees.toLowerCase().includes(needle)
  );
}

function matchesView(order: FilterableOrder, view: string): boolean {
  if (view === "flagged") return order.flag != null;
  if (view === "inside") return order.checkedIn > 0;
  if (view === "refunds") return order.hasOpenRefund;
  if (CHANNEL_VIEWS.has(view)) return order.channel === view;
  return true;
}

/** Narrow a list of orders in place of a WHERE clause — the rows are already loaded. */
export function filterOrders<T extends FilterableOrder>(
  orders: T[],
  criteria: OrderFilterCriteria = {},
): T[] {
  const needle = (criteria.query ?? "").trim().toLowerCase();
  const view = criteria.view ?? "";
  return orders.filter(
    (order) => (!needle || matchesQuery(order, needle)) && matchesView(order, view),
  );
}

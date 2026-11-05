import type { FC } from "hono/jsx";

/**
 * An event's status in words. The database keeps `draft | live | closed |
 * settled`; nobody on either panel should have to read those.
 */
const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  live: "A la venta",
  closed: "Venta cerrada",
  settled: "Liquidado",
};

export function eventStatusLabel(status: string): string {
  return EVENT_STATUS_LABEL[status] ?? status;
}

/** The status as a chip: filled while it sells, quiet otherwise. */
export const EventStatusChip: FC<{ status: string }> = ({ status }) => (
  <span class={`chip ${status === "live" ? "ok" : "info"}`}>{eventStatusLabel(status)}</span>
);

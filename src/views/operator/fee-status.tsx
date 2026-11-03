import type { FC } from "hono/jsx";
import type { FeeStatus } from "../../lib/fees";

/** How each payment status reads, and the colour that says how urgent it is. */
const STATUS: Record<FeeStatus, { label: string; tone: string }> = {
  checking: { label: "Leyendo", tone: "info" },
  ok: { label: "Recibido", tone: "ok" },
  flagged: { label: "Por revisar", tone: "warn" },
  resolved: { label: "Revisado", tone: "ok" },
  unpaid: { label: "No pagado", tone: "crit" },
};

/**
 * Where an unlocked report's payment stands: its status when it was paid by
 * transfer, or why nothing was charged.
 */
export const FeeStatusChip: FC<{ status: FeeStatus | null; bracket: string }> = ({
  status,
  bracket,
}) => {
  if (status) {
    const { label, tone } = STATUS[status];
    return <span class={`chip ${tone}`}>{label}</span>;
  }
  if (bracket === "free_first") return <span class="chip info">Gratis · primer evento</span>;
  if (bracket === "free_pass") return <span class="chip info">Gratis · pase libre</span>;
  return <span class="chip info">Sin pago</span>;
};

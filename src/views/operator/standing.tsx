import type { FC } from "hono/jsx";
import { formatDayMonth, HN_OFFSET } from "../../lib/core";

/** A pass's last day as copy reads it. Stored as YYYY-MM-DD, a day in Honduras. */
export function passLastDay(until: string): string {
  return formatDayMonth(`${until}T12:00:00${HN_OFFSET}`, { year: true });
}

/** A band's standing at a glance: suspended or active, any free pass, any promo still unused. */
export const StandingChips: FC<{
  bannedAt: string | null;
  freePassGrantedAt: string | null;
  freePassUntil: string | null;
  promoPercent?: number | null;
  promoReportsLeft?: number | null;
}> = ({ bannedAt, freePassGrantedAt, freePassUntil, promoPercent, promoReportsLeft }) => (
  <>
    {bannedAt ? <span class="chip crit">Suspendida</span> : <span class="chip info">Activa</span>}{" "}
    {freePassGrantedAt ? (
      <span class="chip ok">
        {freePassUntil ? `Pase hasta ${passLastDay(freePassUntil)}` : "Pase libre"}
      </span>
    ) : null}{" "}
    {promoPercent && promoReportsLeft ? (
      <span class="chip ok">
        Promo {promoPercent}% · {promoReportsLeft}
      </span>
    ) : null}
  </>
);

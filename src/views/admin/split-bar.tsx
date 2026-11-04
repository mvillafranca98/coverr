import type { FC } from "hono/jsx";
import { formatLps } from "../../lib/core";
import { formatPct } from "../../lib/member-split";
import type { ChartTone } from "./trend-chart";

/**
 * Member colours in a fixed order, never cycled. Yellow and lime sit apart:
 * they have the same lightness, so side by side they blur for a colour-blind
 * eye. Beyond four members there are no more colours to give, so every part
 * takes one colour and the names in the table carry who is who.
 */
const MEMBER_TONES: readonly ChartTone[] = ["yellow", "pink", "blue", "lime"];

/** The colour of the member at `index`, or null when the band is too big for one each. */
export function memberTone(index: number, memberCount: number): ChartTone | null {
  return memberCount <= MEMBER_TONES.length ? (MEMBER_TONES[index] ?? null) : null;
}

/**
 * How the net is split, as one bar: a part per member, as wide as their share,
 * the share printed inside when it fits. The table under it is the legend and
 * holds every exact amount. Sits behind the report lock like the table does.
 */
export const SplitBar: FC<{ members: { name: string; splitPct: number; share: number }[] }> = ({
  members,
}) => {
  const parts = members.filter((member) => member.splitPct > 0);
  if (parts.length === 0) return null;
  const summary = `Reparto: ${parts.map((m) => `${m.name} ${formatPct(m.splitPct)}%`).join(", ")}`;
  return (
    <div class="split" role="img" aria-label={summary}>
      {parts.map((member, index) => (
        <span
          key={member.name + index}
          class={`split__part tone-${memberTone(members.indexOf(member), members.length) ?? "lime"}`}
          style={`flex-grow:${member.splitPct}`}
          title={`${member.name} · ${formatPct(member.splitPct)}% · ${formatLps(member.share)}`}
        >
          <b>{formatPct(member.splitPct)}%</b>
        </span>
      ))}
    </div>
  );
};

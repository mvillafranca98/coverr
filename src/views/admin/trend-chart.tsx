import type { FC } from "hono/jsx";
import { columnPath, layoutColumns } from "../../lib/chart";

/** The four sticker colours, each paired with one measure everywhere on the band's pages. */
export type ChartTone = "yellow" | "pink" | "lime" | "blue";

export type TrendPoint = { name: string; date: string; value: number };

/** The drawing's own units; the SVG scales to its card. */
const WIDTH = 320;
const HEIGHT = 150;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 22;
const PLOT_HEIGHT = HEIGHT - PLOT_TOP - PLOT_BOTTOM;

/**
 * One measure across the band's recent events, oldest on the left: a column
 * per event in the measure's colour, the round top of the scale, the latest
 * value printed over its column, and the first and last dates under the axis.
 * Everything else — every exact value — is in the table under the charts, and
 * each column names its event and value on hover.
 *
 * Drawn on the server as plain SVG: no chart library, no script.
 */
export const TrendChart: FC<{
  title: string;
  tone: ChartTone;
  points: TrendPoint[];
  format: (value: number) => string;
}> = ({ title, tone, points, format }) => {
  const layout = layoutColumns(
    points.map((point) => point.value),
    WIDTH,
    PLOT_HEIGHT,
  );
  const last = points.length - 1;
  const lastColumn = layout.columns[last];
  const latestLabelY = lastColumn
    ? PLOT_TOP + (lastColumn.up ? lastColumn.y : lastColumn.y + lastColumn.height) - 6
    : 0;
  const summary = `${title}: ${points.map((point) => `${point.name}, ${format(point.value)}`).join("; ")}`;
  return (
    <figure class={`trend trend--${tone}`}>
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary}>
        {layout.top > 0 ? (
          <>
            <line class="trend__grid" x1={0} x2={WIDTH} y1={PLOT_TOP} y2={PLOT_TOP} />
            <text class="trend__tick" x={0} y={PLOT_TOP - 8}>
              {format(layout.top)}
            </text>
          </>
        ) : null}
        <line
          class="trend__base"
          x1={0}
          x2={WIDTH}
          y1={PLOT_TOP + layout.baselineY}
          y2={PLOT_TOP + layout.baselineY}
        />
        <g transform={`translate(0 ${PLOT_TOP})`}>
          {layout.columns.map((column, index) => (
            <path
              key={points[index]?.date ?? index}
              class={`trend__bar ${column.up ? "" : "trend__bar--down"}`}
              d={columnPath(column)}
              style={`--i:${index}`}
            />
          ))}
          {/* Hover targets: the whole column's height, wider than the bar. */}
          {layout.columns.map((column, index) => {
            const point = points[index];
            const slot = WIDTH / points.length;
            return point ? (
              <rect
                key={`hit-${point.date}-${index}`}
                class="trend__hit"
                x={column.x - (slot - column.width) / 2}
                y={0}
                width={slot}
                height={PLOT_HEIGHT}
              >
                <title>{`${point.name} · ${point.date} · ${format(point.value)}`}</title>
              </rect>
            ) : null;
          })}
        </g>
        {lastColumn && points[last] ? (
          <text
            class="trend__value"
            x={lastColumn.x + lastColumn.width}
            y={Math.max(12, latestLabelY)}
            text-anchor="end"
          >
            {format(points[last].value)}
          </text>
        ) : null}
        {points.length > 0 ? (
          <>
            <text class="trend__tick" x={0} y={HEIGHT - 4}>
              {points[0]?.date}
            </text>
            {last > 0 ? (
              <text class="trend__tick" x={WIDTH} y={HEIGHT - 4} text-anchor="end">
                {points[last]?.date}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
    </figure>
  );
};

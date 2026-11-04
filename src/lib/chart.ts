/**
 * Geometry for the small column charts on the band's pages: where each column
 * goes and how tall it is, from the values alone. No drawing here — the view
 * turns this into SVG — so the arithmetic can be tested on its own.
 */

/** Columns never get wider than this, however few there are: the rest of the slot is air. */
const MAX_COLUMN_WIDTH = 24;

/** The rounded corner on a column's data end; the baseline end stays square. */
const DATA_END_RADIUS = 4;

/** The smallest round number at or above `value`: 1, 2 or 5 times a power of ten. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5]) if (step * power >= value) return step * power;
  return 10 * power;
}

export type Column = { x: number; y: number; width: number; height: number; up: boolean };

export type ColumnLayout = {
  columns: Column[];
  /** Where zero sits, measured down from the top of the plot. */
  baselineY: number;
  /** The round value the top of the plot stands for. */
  top: number;
  /** The round value the bottom stands for: 0, or below it when something is negative. */
  bottom: number;
};

/**
 * One column per value across a `width` × `height` plot. A negative value — a
 * night that lost money — hangs below a zero line drawn where zero is, not
 * from the bottom of the plot, so a loss never reads as a small win.
 */
export function layoutColumns(
  values: readonly number[],
  width: number,
  height: number,
): ColumnLayout {
  const top = niceCeiling(Math.max(0, ...values));
  const bottom = -niceCeiling(Math.max(0, ...values.map((value) => -value)));
  const span = top - bottom || 1;
  const baselineY = (top / span) * height;
  const slot = values.length > 0 ? width / values.length : width;
  const columnWidth = Math.min(MAX_COLUMN_WIDTH, slot * 0.6);
  const columns = values.map((value, index) => {
    const columnHeight = (Math.abs(value) / span) * height;
    return {
      x: index * slot + (slot - columnWidth) / 2,
      y: value >= 0 ? baselineY - columnHeight : baselineY,
      width: columnWidth,
      height: columnHeight,
      up: value >= 0,
    };
  });
  return { columns, baselineY, top, bottom };
}

/** Rounds to two decimals, so the SVG carries short, stable numbers. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The SVG path for one column: square where it meets the baseline, rounded at
 * the end that carries the value. Empty for a zero, which draws nothing.
 */
export function columnPath(column: Column): string {
  const { x, y, width: w, height: h } = column;
  if (h <= 0) return "";
  const r = Math.min(DATA_END_RADIUS, h, w / 2);
  if (column.up) {
    return `M${r2(x)} ${r2(y + h)}V${r2(y + r)}Q${r2(x)} ${r2(y)} ${r2(x + r)} ${r2(y)}H${r2(x + w - r)}Q${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + r)}V${r2(y + h)}Z`;
  }
  return `M${r2(x)} ${r2(y)}H${r2(x + w)}V${r2(y + h - r)}Q${r2(x + w)} ${r2(y + h)} ${r2(x + w - r)} ${r2(y + h)}H${r2(x + r)}Q${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - r)}Z`;
}

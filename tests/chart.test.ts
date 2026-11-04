import { describe, expect, it } from "vitest";
import { columnPath, layoutColumns, niceCeiling } from "../src/lib/chart";

/**
 * The band's charts must never misstate a night: the axis tops out at a round
 * number at or above the best one, and a loss hangs below zero.
 */

describe("niceCeiling", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect(niceCeiling(7)).toBe(10);
    expect(niceCeiling(12)).toBe(20);
    expect(niceCeiling(230)).toBe(500);
    expect(niceCeiling(1_000)).toBe(1_000);
    expect(niceCeiling(5_200_000)).toBe(10_000_000);
  });

  it("is zero for nothing", () => {
    expect(niceCeiling(0)).toBe(0);
    expect(niceCeiling(-5)).toBe(0);
  });
});

describe("layoutColumns", () => {
  it("scales the best night against the round top, and keeps columns 24px or less", () => {
    const layout = layoutColumns([50, 100], 200, 100);
    expect(layout.top).toBe(100);
    expect(layout.baselineY).toBe(100);
    expect(layout.columns[1]).toMatchObject({ y: 0, height: 100, width: 24, up: true });
    expect(layout.columns[0]).toMatchObject({ y: 50, height: 50 });
  });

  it("puts zero mid-plot when a night lost money, and hangs the loss below it", () => {
    const layout = layoutColumns([100, -50], 200, 120);
    expect(layout.bottom).toBe(-50);
    expect(layout.baselineY).toBe(80);
    expect(layout.columns[1]).toMatchObject({ y: 80, height: 40, up: false });
  });

  it("narrows columns when many share the width, never filling the slot", () => {
    const layout = layoutColumns(
      Array.from({ length: 12 }, () => 1),
      120,
      50,
    );
    expect(layout.columns[0]?.width).toBe(6);
  });
});

describe("columnPath", () => {
  it("draws nothing for a zero", () => {
    expect(columnPath({ x: 0, y: 10, width: 20, height: 0, up: true })).toBe("");
  });

  it("starts at the baseline for a gain and at zero for a loss", () => {
    expect(columnPath({ x: 0, y: 0, width: 20, height: 50, up: true })).toMatch(/^M0 50V4Q/);
    expect(columnPath({ x: 0, y: 50, width: 20, height: 30, up: false })).toMatch(/^M0 50H20V76Q/);
  });
});

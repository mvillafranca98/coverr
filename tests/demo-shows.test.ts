import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_SHOWS, pickDemoShow } from "../src/views/demo-shows";

/**
 * The landing page shows one invented show per visit, with that show's own
 * screenshots. A show added without running `npm run shots` would put three
 * broken images on the front page for a sixth of all visitors.
 */

const SHOT_FILES = ["shot-dashboard", "shot-scanner", "shot-ticket"];

describe("the invented shows", () => {
  it("each have their three screenshots", () => {
    const missing = DEMO_SHOWS.flatMap((show) =>
      SHOT_FILES.map((file) => `public/img/${file}-${show.key}.webp`),
    ).filter((path) => !existsSync(new URL(`../${path}`, import.meta.url)));
    expect(missing).toEqual([]);
  });

  it("have a key each, since the key names the screenshots", () => {
    const keys = DEMO_SHOWS.map((show) => show.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("picking a show", () => {
  it("can land on the first and the last", () => {
    expect(pickDemoShow(() => 0)).toBe(DEMO_SHOWS[0]);
    expect(pickDemoShow(() => 0.999999)).toBe(DEMO_SHOWS[DEMO_SHOWS.length - 1]);
  });

  it("stays inside the list even if the random source returns exactly 1", () => {
    expect(pickDemoShow(() => 1)).toBe(DEMO_SHOWS[DEMO_SHOWS.length - 1]);
  });
});

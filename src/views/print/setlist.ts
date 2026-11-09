import type { PageSize, PdfDocument } from "../../lib/pdf";
import { fitText, wrapText } from "../../lib/pdf-fonts";
import { MARGIN } from "./common";

export type SetlistInput = {
  bandName: string;
  eventName: string;
  /** "24 oct", short: it shares a line with the band and the event. */
  date: string;
};

/** A song, or a pause between parts of the set (a blank line where it was typed). */
export type SetlistLine = { song: string } | { pause: true };

/**
 * Letter sizes, in points, for the songs. The floor is what a player reads
 * from a monitor wedge's distance without leaning in: 32 pt bold capitals
 * stand about 8 mm tall. A short set grows up to the ceiling; a long one
 * keeps the floor and runs onto a second sheet rather than shrinking.
 */
export const SETLIST_MAX_SIZE = 64;
export const SETLIST_MIN_SIZE = 32;
/** A title too long for three rows shrinks, but to no less than this share of the set's size. */
const LONG_TITLE_SHRINK = 0.7;
/** The most rows one title may take before it is cut short. */
const MAX_ROWS = 3;
const LINE = 1.4;
/** Rows of one long title sit closer than songs do, so a title never reads as two songs. */
const WRAP = 1.05;
const PAUSE = 0.7;
const TITLE_BLOCK = 46;

/**
 * Reads what the band typed: one song per line, a blank line for a pause.
 * Runs of blank lines count as one pause, and none is kept at either end.
 */
export function readSetlist(text: string): SetlistLine[] {
  const lines: SetlistLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const song = raw.trim();
    const last = lines[lines.length - 1];
    if (song) lines.push({ song });
    else if (last && "song" in last) lines.push({ pause: true });
  }
  const last = lines[lines.length - 1];
  if (last && "pause" in last) lines.pop();
  return lines;
}

/** A song as it is drawn: one row, or more when the title is long, at its own size. */
export type PlacedSong = { rows: string[]; size: number };

export type SetlistPage = { size: number; items: (PlacedSong | { pause: true })[] };

/**
 * A title in capitals at the set's size, broken onto as many as three rows
 * when it is long, so it stays as big as its neighbours; failing that, as
 * large as it fits in three rows, down to a floor; and only past that, cut.
 */
export function placeSong(song: string, size: number, width: number): PlacedSong {
  const text = song.toLocaleUpperCase("es");
  const floor = size * LONG_TITLE_SHRINK;
  for (let s = size; s >= floor; s -= 1) {
    const rows = wrapText(text, "bold", s, width, MAX_ROWS);
    if (rows.join(" ") === text.split(/s+/).join(" ")) return { rows, size: s };
  }
  return { rows: wrapText(text, "bold", floor, width, MAX_ROWS), size: floor };
}

const heightOf = (item: PlacedSong | { pause: true }, size: number) =>
  "pause" in item ? PAUSE * size : (LINE + (item.rows.length - 1) * WRAP) * size;

/**
 * Which songs go on which sheet, and how big. One size for the whole set, so
 * no song looks more important than another: the largest, up to the ceiling,
 * at which the set fits one sheet. Below the floor, the set is split across
 * sheets at the floor size instead, and no sheet starts with a pause.
 */
export function layoutSetlist(
  lines: SetlistLine[],
  area: { width: number; height: number },
): SetlistPage[] {
  if (!lines.some((line) => "song" in line)) return [];
  const place = (size: number) =>
    lines.map((line) => ("song" in line ? placeSong(line.song, size, area.width) : line));

  for (let size = SETLIST_MAX_SIZE; size >= SETLIST_MIN_SIZE; size -= 1) {
    const items = place(size);
    const total = items.reduce((sum, item) => sum + heightOf(item, size), 0);
    if (total <= area.height) return [{ size, items }];
  }

  const size = SETLIST_MIN_SIZE;
  const pages: SetlistPage[] = [];
  let items: SetlistPage["items"] = [];
  let used = 0;
  for (const item of place(size)) {
    const step = heightOf(item, size);
    if (used + step > area.height && items.length > 0) {
      pages.push({ size, items });
      items = [];
      used = 0;
    }
    if ("pause" in item && items.length === 0) continue;
    items.push(item);
    used += step;
  }
  if (items.length > 0) pages.push({ size, items });
  return pages;
}

/**
 * The set list, one copy per musician: songs in large bold capitals, centred,
 * the way bands already tape them to the floor. Black on white, so it reads
 * under coloured stage light and copies cleanly.
 */
export function addSetlist(
  doc: PdfDocument,
  paper: PageSize,
  input: SetlistInput,
  lines: SetlistLine[],
): void {
  const width = paper.width - 2 * MARGIN;
  const pages = layoutSetlist(lines, {
    width,
    height: paper.height - 2 * MARGIN - TITLE_BLOCK,
  });
  const centre = paper.width / 2;
  const title = `${input.bandName} · ${input.eventName} · ${input.date}`.toUpperCase();

  pages.forEach((sheet, index) => {
    const page = doc.addPage(paper);
    const label = pages.length > 1 ? `${title} · ${index + 1}/${pages.length}` : title;
    page.text(fitText(label, "bold", 12, width), {
      x: centre,
      y: MARGIN + 12,
      size: 12,
      font: "bold",
      align: "center",
    });
    page.line(
      { x: MARGIN, y: MARGIN + 22 },
      { x: MARGIN + width, y: MARGIN + 22 },
      { lineWidth: 2 },
    );

    let y = MARGIN + TITLE_BLOCK;
    for (const item of sheet.items) {
      if ("pause" in item) {
        y += PAUSE * sheet.size;
        continue;
      }
      // Spacing follows the set's own size, whatever size the title was set
      // at, so songs line up down the page; a title's own rows sit closer.
      item.rows.forEach((row, index) => {
        page.text(row, {
          x: centre,
          y: y + sheet.size + index * WRAP * sheet.size,
          size: item.size,
          font: "bold",
          align: "center",
        });
      });
      y += heightOf(item, sheet.size);
    }
  });
}

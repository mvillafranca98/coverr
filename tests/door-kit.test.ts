import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import {
  musiciansIn,
  type PresaleTicket,
  presaleRows,
  readCopies,
  readPaper,
} from "../src/lib/door-kit";
import { PAPER } from "../src/lib/pdf";
import { textWidth } from "../src/lib/pdf-fonts";
import { qrModules } from "../src/lib/qr";
import { paginatePresale, presaleRowsPerPage } from "../src/views/print/presale-list";
import {
  layoutSetlist,
  placeSong,
  readSetlist,
  SETLIST_MAX_SIZE,
  SETLIST_MIN_SIZE,
} from "../src/views/print/setlist";

/**
 * The band's printouts for the night: the presale list, the QR poster for the
 * entrance and the set list. What goes on them, and how they are laid out.
 */

const ticket = (over: Partial<PresaleTicket>): PresaleTicket => ({
  orderId: "o1",
  name: "Ana Prueba",
  note: null,
  code: "ACE-1000",
  channel: "online",
  flagCode: null,
  ...over,
});

describe("the presale list", () => {
  it("orders by name the way people are looked up, accents and case aside", () => {
    const rows = presaleRows([
      ticket({ name: "beto" }),
      ticket({ name: "Óscar" }),
      ticket({ name: "Ana" }),
      ticket({ name: "Oscar Alto" }),
    ]);
    expect(rows.map((row) => row.name)).toEqual(["Ana", "beto", "Óscar", "Oscar Alto"]);
  });

  it("says when a ticket is a comp and what is still to review, beside the buyer's note", () => {
    const [row] = presaleRows([
      ticket({ note: "Llega tarde", channel: "comp", flagCode: "MISSING_FIELDS" }),
    ]);
    expect(row?.note).toBe("Llega tarde · Cortesía · Revisar: Faltan datos");
    expect(presaleRows([ticket({})])[0]?.note).toBe("");
  });

  it("fits a full heading on the first page and more rows on the rest", () => {
    const perPage = presaleRowsPerPage(PAPER.carta);
    expect(perPage.first).toBeGreaterThanOrEqual(20);
    expect(perPage.later).toBeGreaterThan(perPage.first);
    const pages = paginatePresale(
      Array.from({ length: 58 }, (_, i) => i),
      perPage,
    );
    expect(pages.flat()).toHaveLength(58);
    expect(pages[0]).toHaveLength(perPage.first);
  });

  it("is still one page, saying so, when nothing has sold", () => {
    expect(paginatePresale([], presaleRowsPerPage(PAPER.carta))).toEqual([[]]);
  });
});

describe("the door poster's QR", () => {
  // Rendered square by square and read back the way a phone would.
  it("opens the event's buy page", () => {
    const url = "https://coverr.live/e/probando-1-2";
    const modules = qrModules(url);
    const scale = 6;
    const quiet = 4;
    const side = (modules.length + 2 * quiet) * scale;
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
    for (const [r, row] of modules.entries()) {
      for (const [c, dark] of row.entries()) {
        if (!dark) continue;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const at = (((r + quiet) * scale + y) * side + (c + quiet) * scale + x) * 4;
            pixels.fill(0, at, at + 3);
          }
        }
      }
    }
    expect(jsQR(pixels, side, side)?.data).toBe(url);
  });
});

describe("the set list", () => {
  it("reads one song per line, a blank line as a pause, and trims the ends", () => {
    expect(readSetlist("\n  Uno \n\n\n Dos\nTres\n\n")).toEqual([
      { song: "Uno" },
      { pause: true },
      { song: "Dos" },
      { song: "Tres" },
    ]);
    expect(readSetlist("  \n\n")).toEqual([]);
  });

  const area = { width: 516, height: 650 };
  const songs = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ song: `Canción ${i + 1}` }));

  it("prints a short set on one sheet, as large as fits, up to the ceiling", () => {
    const pages = layoutSetlist(songs(6), area);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.size).toBe(SETLIST_MAX_SIZE);
    const twelve = layoutSetlist(songs(12), area);
    expect(twelve).toHaveLength(1);
    expect(twelve[0]?.size).toBeLessThan(SETLIST_MAX_SIZE);
    expect(twelve[0]?.size).toBeGreaterThanOrEqual(SETLIST_MIN_SIZE);
  });

  it("runs a long set onto more sheets rather than shrinking below the floor", () => {
    const pages = layoutSetlist(songs(30), area);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.size).toBe(SETLIST_MIN_SIZE);
    expect(pages.flatMap((page) => page.items).filter((item) => "rows" in item)).toHaveLength(30);
  });

  it("never starts a sheet with a pause", () => {
    const lines = songs(40).flatMap((line, i) =>
      i % 5 === 4 ? [line, { pause: true as const }] : [line],
    );
    for (const page of layoutSetlist(lines, area)) {
      expect("pause" in (page.items[0] ?? { pause: true })).toBe(false);
    }
  });

  it("breaks a long title onto more rows at full size before shrinking it", () => {
    const title = "Why'd you only call me when you're high";
    const placed = placeSong(title, 40, 516);
    expect(placed.size).toBe(40);
    expect(placed.rows.length).toBeGreaterThan(1);
    expect(placed.rows.join(" ")).toBe(title.toLocaleUpperCase("es"));
    for (const row of placed.rows) expect(textWidth(row, "bold", 40)).toBeLessThanOrEqual(516);
  });

  it("prints nothing for a set with no songs", () => {
    expect(layoutSetlist([], area)).toEqual([]);
  });
});

describe("copies and paper", () => {
  it("prints one set list per musician, never for the band's fund", () => {
    expect(musiciansIn(["Keyla", "Marvin", "Josué", "Fondo de la banda"])).toBe(3);
    expect(musiciansIn(["FONDO", "fondo común"])).toBe(1);
    expect(musiciansIn([])).toBe(1);
  });

  it("reads a copies field as a whole number from 0 to 20, else its default", () => {
    expect(readCopies(undefined, 4)).toBe(4);
    expect(readCopies("", 4)).toBe(4);
    expect(readCopies("0", 4)).toBe(0);
    expect(readCopies("7", 4)).toBe(7);
    expect(readCopies("500", 4)).toBe(20);
    expect(readCopies("-1", 4)).toBe(4);
    expect(readCopies("2.5", 4)).toBe(4);
    expect(readCopies("dos", 4)).toBe(4);
  });

  it("prints on Carta unless A4 is asked for", () => {
    expect(readPaper("a4")).toBe("a4");
    expect(readPaper("carta")).toBe("carta");
    expect(readPaper("legal")).toBe("carta");
    expect(readPaper(undefined)).toBe("carta");
  });
});

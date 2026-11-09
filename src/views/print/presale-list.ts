import type { PageSize, PdfDocument, PdfPage } from "../../lib/pdf";
import { fitText, textWidth, wrapText } from "../../lib/pdf-fonts";
import { MARGIN, type PrintEvent } from "./common";

/** One ticket on the list. */
export type PresaleRow = {
  name: string;
  /** The order's short code, which the buyer can read off their own ticket. */
  code: string;
  /** The attendee's note, "Cortesía", or what is still to review, joined. */
  note: string;
};

const ROW = 24;
const FIRST_HEADER = 112;
const LATER_HEADER = 40;
const COLUMN_HEADER = 22;
const FOOTER = 28;

/**
 * How many rows fit on the first page and on each page after it. The first
 * page carries the full heading; the rest only a reminder of whose list it is.
 */
export function presaleRowsPerPage(paper: PageSize): { first: number; later: number } {
  const body = paper.height - 2 * MARGIN - COLUMN_HEADER - FOOTER;
  return {
    first: Math.floor((body - FIRST_HEADER) / ROW),
    later: Math.floor((body - LATER_HEADER) / ROW),
  };
}

/** The rows on each page, in order. An empty list is still one page, saying so. */
export function paginatePresale<T>(rows: T[], perPage: { first: number; later: number }): T[][] {
  const pages: T[][] = [rows.slice(0, perPage.first)];
  for (let start = perPage.first; start < rows.length; start += perPage.later) {
    pages.push(rows.slice(start, start + perPage.later));
  }
  return pages;
}

/**
 * The presale list: every ticket sold before the door, ordered by name, with
 * a box to tick as people come in. It is the door's fallback when a phone
 * dies or the signal does, so it carries what staff need to find a person and
 * nothing else — no amounts, no emails, no phone numbers.
 */
export function addPresaleList(
  doc: PdfDocument,
  paper: PageSize,
  event: PrintEvent,
  rows: PresaleRow[],
  printedAt: string,
): void {
  const pages = paginatePresale(rows, presaleRowsPerPage(paper));
  let number = 0;
  pages.forEach((pageRows, index) => {
    const page = doc.addPage(paper);
    let y = MARGIN;
    if (index === 0) {
      y = firstHeader(page, event, rows.length, printedAt);
    } else {
      page.text(fitText(`LISTA DE PREVENTA · ${event.eventName}`, "bold", 11, contentWidth(page)), {
        x: MARGIN,
        y: y + 12,
        size: 11,
        font: "bold",
      });
      page.line(
        { x: MARGIN, y: y + 22 },
        { x: page.size.width - MARGIN, y: y + 22 },
        { lineWidth: 1 },
      );
      y += LATER_HEADER;
    }

    y = columnHeader(page, y);
    if (rows.length === 0) {
      page.text("Todavía no hay boletos vendidos.", { x: MARGIN, y: y + 20, size: 12 });
    }
    for (const row of pageRows) {
      number += 1;
      drawRow(page, y, number, row);
      y += ROW;
    }
    footer(page, index + 1, pages.length);
  });
}

const contentWidth = (page: PdfPage) => page.size.width - 2 * MARGIN;

/** Column edges, from the left margin. The name gets the room; notes take what is left. */
function columns(page: PdfPage) {
  const width = contentWidth(page);
  const tick = MARGIN;
  const number = tick + 24;
  const name = number + 40;
  const code = name + Math.round((width - 24 - 40) * 0.5);
  const note = code + 70;
  return { tick, number, name, code, note, end: MARGIN + width };
}

function firstHeader(page: PdfPage, event: PrintEvent, count: number, printedAt: string): number {
  const width = contentWidth(page);
  page.text(fitText(event.bandName.toUpperCase(), "bold", 11, width), {
    x: MARGIN,
    y: MARGIN + 11,
    size: 11,
    font: "bold",
  });
  page.text("LISTA DE PREVENTA", { x: MARGIN, y: MARGIN + 42, size: 26, font: "bold" });
  page.text(fitText(`${event.eventName} · ${event.when} · ${event.venue}`, "regular", 11, width), {
    x: MARGIN,
    y: MARGIN + 64,
    size: 11,
  });
  const summary = `${count} ${count === 1 ? "boleto" : "boletos"}, por nombre · impresa el ${printedAt} · marcá la casilla al entrar`;
  page.text(fitText(summary, "regular", 9, width), { x: MARGIN, y: MARGIN + 82, size: 9 });
  page.line(
    { x: MARGIN, y: MARGIN + 96 },
    { x: MARGIN + width, y: MARGIN + 96 },
    { lineWidth: 2.5 },
  );
  return MARGIN + FIRST_HEADER;
}

function columnHeader(page: PdfPage, y: number): number {
  const col = columns(page);
  const baseline = y + 14;
  page.text("#", { x: col.name - 10, y: baseline, size: 8, font: "bold", align: "right" });
  page.text("NOMBRE", { x: col.name, y: baseline, size: 8, font: "bold" });
  page.text("CÓDIGO", { x: col.code, y: baseline, size: 8, font: "bold" });
  page.text("NOTAS", { x: col.note, y: baseline, size: 8, font: "bold" });
  page.line(
    { x: col.tick, y: y + COLUMN_HEADER },
    { x: col.end, y: y + COLUMN_HEADER },
    { lineWidth: 1 },
  );
  return y + COLUMN_HEADER;
}

function drawRow(page: PdfPage, y: number, number: number, row: PresaleRow): void {
  const col = columns(page);
  const baseline = y + 16;
  page.box(col.tick + 1, y + 6, 12, 12, 1);
  page.text(String(number), { x: col.name - 10, y: baseline, size: 10, align: "right" });
  // A long name steps down a size before it loses letters: four-part names
  // are common, and the door looks people up by the last one.
  const nameWidth = col.code - col.name - 8;
  const nameSize = textWidth(row.name, "bold", 11) <= nameWidth ? 11 : 9.5;
  page.text(fitText(row.name, "bold", nameSize, nameWidth), {
    x: col.name,
    y: baseline,
    size: nameSize,
    font: "bold",
  });
  page.text(row.code, { x: col.code, y: baseline, size: 10 });
  if (row.note) {
    const lines = wrapText(row.note, "regular", 8.5, col.end - col.note, 2);
    lines.forEach((line, index) => {
      const lineY = lines.length === 1 ? baseline : y + 10 + index * 10;
      page.text(line, { x: col.note, y: lineY, size: 8.5 });
    });
  }
  page.line({ x: col.tick, y: y + ROW }, { x: col.end, y: y + ROW }, { lineWidth: 0.4 });
}

function footer(page: PdfPage, number: number, total: number): void {
  const y = page.size.height - MARGIN + 8;
  page.text("Coverr · lista de preventa", { x: MARGIN, y, size: 8 });
  page.text(`Página ${number} de ${total}`, {
    x: page.size.width - MARGIN,
    y,
    size: 8,
    align: "right",
  });
}

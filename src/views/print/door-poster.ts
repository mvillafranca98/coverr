import type { PageSize, PdfDocument, PdfPage } from "../../lib/pdf";
import { fitText, textWidth } from "../../lib/pdf-fonts";
import { MARGIN, type PrintEvent } from "./common";

export type DoorPosterInput = PrintEvent & {
  /** The event's buy page; what the QR opens. */
  url: string;
  /** The same address without the scheme, for someone who would rather type it. */
  displayUrl: string;
  /** "L250", the price at the door, or null when the event has none set. */
  price: string | null;
  /** The QR's modules, row by row, from `lib/qr.ts`. */
  qr: boolean[][];
};

/** A QR needs four modules of blank border around it to be found. */
const QUIET_ZONE = 4;

/**
 * The poster for the entrance: one big QR that opens the event's buy page, so
 * whoever arrives without a ticket pays by transfer from the queue instead of
 * holding it up (the "walk-up transfer" in coverr-spec.html).
 *
 * The QR takes most of the page, about 13.5 cm square on Carta, and its
 * squares come out 3 to 4 mm wide for an event's address: big enough for a
 * phone to read it off a wall or a door from a metre or two, without walking
 * up to it. It is drawn as vector squares, so a copy of a copy still prints
 * sharp edges.
 */
export function addDoorPoster(doc: PdfDocument, paper: PageSize, input: DoorPosterInput): void {
  const page = doc.addPage(paper);
  const width = page.size.width - 2 * MARGIN;
  const centre = page.size.width / 2;

  frame(page);

  page.text(fitText(input.bandName.toUpperCase(), "bold", 15, width - 40), {
    x: centre,
    y: MARGIN + 44,
    size: 15,
    font: "bold",
    align: "center",
  });
  const headline = "COMPRÁ TU ENTRADA";
  const headlineSize = Math.min(
    46,
    ((width - 48) * 1000) / (textWidth(headline, "bold", 1000) || 1),
  );
  page.text(headline, {
    x: centre,
    y: MARGIN + 96,
    size: headlineSize,
    font: "bold",
    align: "center",
  });
  page.text("Sin hacer fila: pagás por transferencia desde tu teléfono.", {
    x: centre,
    y: MARGIN + 124,
    size: 14,
    align: "center",
  });

  const qrTop = MARGIN + 146;
  const bottomBlock = 168;
  const side = Math.min(width - 80, page.size.height - MARGIN - bottomBlock - qrTop);
  drawQr(page, input.qr, centre - side / 2, qrTop, side);

  let y = qrTop + side + 34;
  page.text("1  Escaneá     2  Transferí     3  Mostrá tu QR al entrar", {
    x: centre,
    y,
    size: 14,
    font: "bold",
    align: "center",
  });
  y += 40;
  if (input.price) {
    page.text(`Entrada: ${input.price}`, { x: centre, y, size: 28, font: "bold", align: "center" });
    y += 26;
  }
  page.text(fitText(`o entrá a ${input.displayUrl}`, "regular", 12, width - 40), {
    x: centre,
    y,
    size: 12,
    align: "center",
  });

  const footer = page.size.height - MARGIN - 22;
  page.text(fitText(input.eventName, "bold", 13, width - 40), {
    x: centre,
    y: footer,
    size: 13,
    font: "bold",
    align: "center",
  });
  page.text(fitText(`${input.when} · ${input.venue}`, "regular", 11, width - 40), {
    x: centre,
    y: footer + 16,
    size: 11,
    align: "center",
  });
}

/**
 * The poster's sticker outline: a heavy border with a hard shadow down and to
 * the right, as on screen. The shadow is two thin bars, not a filled block.
 */
function frame(page: PdfPage): void {
  const inset = MARGIN - 18;
  const w = page.size.width - 2 * inset - 8;
  const h = page.size.height - 2 * inset - 8;
  page.box(inset, inset, w, h, 3);
  page.fill(inset + 8, inset + h, w, 8);
  page.fill(inset + w, inset + 8, 8, h);
}

/** The QR inside a ruled box, with its quiet zone kept white inside the box. */
function drawQr(page: PdfPage, modules: boolean[][], x: number, y: number, side: number): void {
  const count = modules.length;
  const module = side / (count + 2 * QUIET_ZONE);
  const origin = { x: x + QUIET_ZONE * module, y: y + QUIET_ZONE * module };
  page.box(x, y, side, side, 2);
  // One rectangle per run of dark squares in a row rather than one per square:
  // a fraction of the drawing operations, and no hairline seams across a run.
  modules.forEach((row, r) => {
    let start = -1;
    for (let c = 0; c <= count; c++) {
      const dark = c < count && row[c];
      if (dark && start < 0) start = c;
      if (!dark && start >= 0) {
        page.fill(origin.x + start * module, origin.y + r * module, (c - start) * module, module);
        start = -1;
      }
    }
  });
}

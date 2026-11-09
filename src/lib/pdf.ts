import { type PdfFont, textWidth, winAnsiCodes } from "./pdf-fonts";

/**
 * A small PDF writer for the band's printouts: black text, black lines, black
 * squares, on as many pages as a printout needs.
 *
 * Written here rather than pulled in as a library because the printouts need
 * nothing more, and a general PDF library is a large bundle for a Worker. The
 * output is plain PDF 1.4 that every reader and printer driver opens. Nothing
 * is compressed: a page of a list or a QR is a few kilobytes as it is.
 *
 * Coordinates are in points (1/72 in) measured from the **top-left** of the
 * page, the way layout is thought about, and turned into PDF's bottom-left
 * origin here. A text `y` is its baseline.
 */

export type PageSize = { width: number; height: number };

/** Carta is what a print shop in Honduras loads by default; A4 is the alternative. */
export const PAPER = {
  carta: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
} satisfies Record<string, PageSize>;

export type Paper = keyof typeof PAPER;

type Align = "left" | "center" | "right";

const FONT_RESOURCE: Record<PdfFont, string> = { regular: "F1", bold: "F2" };

/** A number as PDF writes it: no exponent, at most two decimals. */
const num = (value: number): string => String(Math.round(value * 100) / 100);

/** A PDF literal string of WinAnsi codes, with its three special characters escaped. */
function literal(text: string): string {
  let out = "(";
  for (const code of winAnsiCodes(text)) {
    if (code === 40 || code === 41 || code === 92) out += "\\";
    out += String.fromCharCode(code);
  }
  return `${out})`;
}

export class PdfPage {
  readonly ops: string[] = [];

  constructor(readonly size: PageSize) {}

  /** Writes one line of text. `x` is where the line starts, centres or ends, per `align`. */
  text(
    text: string,
    at: { x: number; y: number; size: number; font?: PdfFont; align?: Align },
  ): void {
    const font = at.font ?? "regular";
    const width = textWidth(text, font, at.size);
    const left =
      at.align === "center" ? at.x - width / 2 : at.align === "right" ? at.x - width : at.x;
    this.ops.push(
      `BT /${FONT_RESOURCE[font]} ${num(at.size)} Tf ${num(left)} ${num(this.size.height - at.y)} Td ${literal(text)} Tj ET`,
    );
  }

  /** A filled black rectangle, `y` being its top edge. */
  fill(x: number, y: number, width: number, height: number): void {
    this.ops.push(
      `${num(x)} ${num(this.size.height - y - height)} ${num(width)} ${num(height)} re f`,
    );
  }

  /** A black rectangle outline, `y` being its top edge. */
  box(x: number, y: number, width: number, height: number, lineWidth = 1): void {
    this.ops.push(
      `${num(lineWidth)} w ${num(x)} ${num(this.size.height - y - height)} ${num(width)} ${num(height)} re S`,
    );
  }

  /** A straight black line, dashed when `dash` gives the dash and gap lengths. */
  line(
    from: { x: number; y: number },
    to: { x: number; y: number },
    opts: { lineWidth?: number; dash?: [number, number] } = {},
  ): void {
    const dash = opts.dash ? `[${num(opts.dash[0])} ${num(opts.dash[1])}] 0 d` : "[] 0 d";
    const h = this.size.height;
    this.ops.push(
      `${num(opts.lineWidth ?? 1)} w ${dash} ${num(from.x)} ${num(h - from.y)} m ${num(to.x)} ${num(h - to.y)} l S [] 0 d`,
    );
  }
}

export class PdfDocument {
  readonly pages: PdfPage[] = [];

  constructor(private readonly title: string) {}

  addPage(size: PageSize): PdfPage {
    const page = new PdfPage(size);
    this.pages.push(page);
    return page;
  }

  /**
   * The finished file. Every character written is one byte (WinAnsi or plain
   * ASCII), so an object's offset in the cross-reference table is simply its
   * position in the string.
   */
  toBytes(): Uint8Array<ArrayBuffer> {
    const objects: string[] = [];
    const add = (body: string): number => objects.push(body);

    const catalog = add("");
    const pageTree = add("");
    const regular = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    const bold = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );
    const info = add(`<< /Title ${literal(this.title)} /Producer (Coverr) >>`);

    const pageIds = this.pages.map((page) => {
      const stream = page.ops.join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      return add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${num(page.size.width)} ${num(page.size.height)}] ` +
          `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`,
      );
    });

    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
    objects[pageTree - 1] =
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(out.length);
      out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
    return bytes;
  }
}

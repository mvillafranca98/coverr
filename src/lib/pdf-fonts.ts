/**
 * The two fonts the printable PDFs use, Helvetica and Helvetica Bold, and how
 * wide their letters are.
 *
 * They are two of the fourteen fonts every PDF reader carries, so a file names
 * them and embeds nothing: no font file to ship, nothing to license, and the
 * same crisp black letters on any printer. Text is written in WinAnsi, the
 * encoding they come with, which covers Spanish (á é í ó ú ü ñ ¿ ¡) and the
 * typographer's quotes and dashes.
 *
 * The widths are in thousandths of the font size, for codes 32 to 255. They
 * were measured from Arial in a browser, which was drawn to Helvetica's exact
 * widths so that documents would not reflow, and they match Helvetica's own
 * metrics file for every letter a set list or a name uses. Layout needs them to
 * centre a line and to tell whether a name fits its column.
 */

export type PdfFont = "regular" | "bold";

/* prettier-ignore */
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333,
  333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 260,
  556, 333, 737, 370, 556, 584, 333, 737, 552, 400, 549, 333, 333, 333, 556, 537, 333, 333, 333,
  365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278,
  278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 549, 611, 556, 556, 556, 556, 500, 556, 500,
];

/* prettier-ignore */
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500,
  500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 280,
  556, 333, 737, 370, 556, 584, 333, 737, 552, 400, 549, 333, 333, 333, 556, 556, 333, 333, 333,
  365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278,
  278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611,
  611, 611, 611, 611, 549, 611, 611, 611, 611, 611, 556, 611, 556,
];

const WIDTHS: Record<PdfFont, number[]> = { regular: REGULAR, bold: BOLD };

/** The characters WinAnsi keeps in 128–159, where Latin-1 has control codes. */
const WIN_ANSI_HIGH: Record<number, number> = {
  8364: 0x80,
  8218: 0x82,
  402: 0x83,
  8222: 0x84,
  8230: 0x85,
  8224: 0x86,
  8225: 0x87,
  710: 0x88,
  8240: 0x89,
  352: 0x8a,
  8249: 0x8b,
  338: 0x8c,
  381: 0x8e,
  8216: 0x91,
  8217: 0x92,
  8220: 0x93,
  8221: 0x94,
  8226: 0x95,
  8211: 0x96,
  8212: 0x97,
  732: 0x98,
  8482: 0x99,
  353: 0x9a,
  8250: 0x9b,
  339: 0x9c,
  382: 0x9e,
  376: 0x9f,
};

/**
 * The WinAnsi codes for a piece of text, one per character. Anything the
 * encoding cannot hold — an emoji, a letter from another script — becomes a
 * question mark rather than a gap, so a name never silently loses a letter.
 * Tabs and line breaks become spaces: a PDF line is laid out by us, not by them.
 */
export function winAnsiCodes(text: string): number[] {
  const codes: number[] = [];
  for (const char of text.normalize("NFC")) {
    const point = char.codePointAt(0) ?? 63;
    if (point === 9 || point === 10 || point === 13) codes.push(32);
    else if ((point >= 32 && point <= 126) || (point >= 160 && point <= 255)) codes.push(point);
    else codes.push(WIN_ANSI_HIGH[point] ?? 63);
  }
  return codes;
}

/** How wide `text` is, in points, set in `font` at `size`. */
export function textWidth(text: string, font: PdfFont, size: number): number {
  const widths = WIDTHS[font];
  let total = 0;
  for (const code of winAnsiCodes(text)) total += widths[code - 32] ?? 556;
  return (total * size) / 1000;
}

/**
 * `text` broken into at most `maxLines` lines that each fit `maxWidth`, at
 * spaces. Whatever does not fit in the last line is cut with an ellipsis.
 */
export function wrapText(
  text: string,
  font: PdfFont,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  const words = text.split(/\s+/).filter(Boolean);
  for (const [index, word] of words.entries()) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, font, size) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    if (lines.length === maxLines - 1) {
      return [
        ...lines,
        fitText(`${current} ${words.slice(index).join(" ")}`, font, size, maxWidth),
      ];
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(fitText(current, font, size, maxWidth));
  return lines;
}

/**
 * `text` cut to fit `maxWidth`, ending in an ellipsis when it had to be cut.
 * A long name in a narrow column should still show where it was cut.
 */
export function fitText(text: string, font: PdfFont, size: number, maxWidth: number): string {
  if (textWidth(text, font, size) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 0 && textWidth(`${chars.join("")}…`, font, size) > maxWidth) chars.pop();
  return chars.length > 0 ? `${chars.join("").trimEnd()}…` : "";
}

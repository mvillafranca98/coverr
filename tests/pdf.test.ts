import { describe, expect, it } from "vitest";
import { PAPER, PdfDocument } from "../src/lib/pdf";
import { fitText, textWidth, winAnsiCodes, wrapText } from "../src/lib/pdf-fonts";

/**
 * The PDF writer behind the band's printouts, and the font metrics it lays
 * text out with. A file that a reader cannot open, or a name that loses its
 * accents, is a printout the band cannot use on the night.
 */

const latin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe("winAnsiCodes", () => {
  it("keeps every Spanish letter and sign as one byte", () => {
    expect(winAnsiCodes("ñÑáéíóúü¿¡")).toEqual([241, 209, 225, 233, 237, 243, 250, 252, 191, 161]);
  });

  it("maps typographer's quotes and dashes into WinAnsi's own range", () => {
    expect(winAnsiCodes("’“”–—…")).toEqual([0x92, 0x93, 0x94, 0x96, 0x97, 0x85]);
  });

  it("turns what the encoding cannot hold into a question mark, never a gap", () => {
    expect(winAnsiCodes("ok 🎸 ж")).toEqual([111, 107, 32, 63, 32, 63]);
  });

  it("joins a decomposed accent to its letter first", () => {
    expect(winAnsiCodes("José")).toEqual(winAnsiCodes("José"));
  });
});

describe("text measurement", () => {
  it("uses Helvetica's widths", () => {
    expect(textWidth("A", "bold", 1000)).toBe(722);
    expect(textWidth("A", "regular", 1000)).toBe(667);
    expect(textWidth("i", "regular", 10)).toBeCloseTo(2.22);
  });

  it("cuts a line that does not fit, and says so with an ellipsis", () => {
    const cut = fitText("Samuel Edgardo Gonzales Villatoro", "bold", 11, 100);
    expect(cut.endsWith("…")).toBe(true);
    expect(textWidth(cut, "bold", 11)).toBeLessThanOrEqual(100);
    expect(fitText("Ana", "bold", 11, 100)).toBe("Ana");
  });

  it("wraps at spaces, and cuts only what is left past the last line", () => {
    expect(wrapText("uno dos tres", "regular", 10, 1000, 2)).toEqual(["uno dos tres"]);
    const lines = wrapText(
      "una nota bastante larga que no entra en una sola línea",
      "regular",
      10,
      90,
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
    for (const line of lines) expect(textWidth(line, "regular", 10)).toBeLessThanOrEqual(90);
  });
});

describe("PdfDocument", () => {
  const doc = new PdfDocument("Lista (prueba)");
  const page = doc.addPage(PAPER.carta);
  page.text("Año (2026) \\ ñandú", { x: 48, y: 60, size: 12, font: "bold" });
  page.box(48, 80, 12, 12);
  page.fill(48, 100, 10, 10);
  page.line({ x: 48, y: 120 }, { x: 200, y: 120 }, { dash: [4, 2] });
  doc.addPage(PAPER.a4);
  const file = latin1(doc.toBytes());

  it("is a PDF 1.4 file with its pages counted and sized", () => {
    expect(file.startsWith("%PDF-1.4\n")).toBe(true);
    expect(file.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(file).toContain("/Count 2");
    expect(file).toContain("/MediaBox [0 0 612 792]");
    expect(file).toContain("/MediaBox [0 0 595.28 841.89]");
  });

  it("points every cross-reference entry at the object it names", () => {
    const xrefAt = Number(file.match(/startxref\n(\d+)/)?.[1]);
    const entries = file.slice(xrefAt).match(/^\d{10} 00000 n $/gm) ?? [];
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(file.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
  });

  it("escapes brackets and backslashes and writes accents as WinAnsi bytes", () => {
    expect(file).toContain("(A\xF1o \\(2026\\) \\\\ \xF1and\xFA) Tj");
  });

  it("measures each content stream in bytes", () => {
    for (const match of file.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = (match.index ?? 0) + match[0].length;
      expect(file.slice(start + Number(match[1]), start + Number(match[1]) + 10)).toBe(
        "\nendstream",
      );
    }
  });

  it("names the two built-in fonts and embeds none", () => {
    expect(file).toContain("/BaseFont /Helvetica /Encoding /WinAnsiEncoding");
    expect(file).toContain("/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding");
    expect(file).not.toContain("/FontFile");
  });
});

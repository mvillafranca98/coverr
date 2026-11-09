import qrcode from "qrcode-generator";
import { matrixToPng } from "./png";

/**
 * Renders a QR as a standalone SVG string. Server-rendered so the buyer's
 * ticket paints with the page — no client JS, no library download, works on a
 * bad connection at the door.
 *
 * Error correction M: survives a cracked phone screen or a bad camera angle
 * without inflating the module count the way H would.
 */
export function qrSvg(
  text: string,
  opts: { size?: number; dark?: string; light?: string } = {},
): string {
  const { size = 320, dark = "#000000", light = "#FFFFFF" } = opts;

  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const margin = 2;
  const dim = count + margin * 2;

  // One path for every dark module beats 1,000 <rect> elements.
  let d = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) d += `M${c + margin},${r + margin}h1v1h-1z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="Código QR del boleto">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
    `<path d="${d}" fill="${dark}"/>` +
    `</svg>`
  );
}

/**
 * A QR's modules, row by row, `true` for dark. For a printed poster, which
 * draws them as vector squares so they stay sharp at any size. Same error
 * correction as the ticket's: M keeps the squares big, which is what lets a
 * phone read a poster from a few steps back.
 */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, r) =>
    Array.from({ length: count }, (_, c) => qr.isDark(r, c)),
  );
}

/** Data URI so a QR can sit in an <img src> or be saved by long-pressing. */
export function qrDataUri(text: string, size = 320): string {
  const svg = qrSvg(text, { size });
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/** QR as a PNG. The only format email clients reliably render — see lib/png.ts. */
export async function qrPng(text: string, scale = 8): Promise<Uint8Array<ArrayBuffer>> {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return matrixToPng((r, c) => qr.isDark(r, c), qr.getModuleCount(), { scale });
}

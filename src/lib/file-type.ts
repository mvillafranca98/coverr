/**
 * What an uploaded payment proof actually is, read from its bytes.
 *
 * A browser's `File.type` is whatever the client chose to say. Believing it
 * means a buyer can upload `comprobante.html`, declare it `text/html`, and have
 * the band's browser execute it inside an admin session when somebody opens the
 * proof — the CSP allows inline script on this origin, so that is the real
 * thing, not a theoretical one.
 *
 * So the type is decided here, from magic numbers, and the client's claim is
 * never stored or served.
 */

/** The formats the vision model accepts and a browser can display. */
export type ProofMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

export type SniffResult =
  | { kind: "ok"; mediaType: ProofMediaType }
  /**
   * HEIC, HEIF or AVIF. Worth telling apart from plain junk: it is what an
   * iPhone produces by default, so it is the one rejection a buyer standing in
   * a queue is likely to hit while doing everything right.
   */
  | { kind: "phone-photo" }
  | { kind: "unknown" };

const bytesOf = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/** ISO base-media brands that are not JPEG and that we cannot read. */
const PHONE_PHOTO_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
  "avis",
]);

function matches(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * Identifies a proof from its leading bytes.
 *
 * Signatures only — no extension, no declared type, nothing the uploader
 * controls beyond the file content itself.
 */
export function sniffProof(input: ArrayBuffer | Uint8Array): SniffResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  const ok = (mediaType: ProofMediaType): SniffResult => ({ kind: "ok", mediaType });

  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ok("image/png");
  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) return ok("image/jpeg");
  if (matches(bytes, 0, bytesOf("GIF8"))) return ok("image/gif");
  // WebP is a RIFF container; the form name sits four bytes after the size.
  if (matches(bytes, 0, bytesOf("RIFF")) && matches(bytes, 8, bytesOf("WEBP"))) {
    return ok("image/webp");
  }
  if (matches(bytes, 0, bytesOf("%PDF-"))) return ok("application/pdf");

  if (matches(bytes, 4, bytesOf("ftyp"))) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (PHONE_PHOTO_BRANDS.has(brand)) return { kind: "phone-photo" };
  }

  return { kind: "unknown" };
}

/**
 * How a stored proof may be sent back to the band, whatever its row claims.
 *
 * Separate from the sniffing above because it also has to cover rows written
 * before uploads were checked, whose `contentType` is still the uploader's
 * word. Anything not a displayable image is downloaded rather than rendered,
 * so a surprise in the bucket cannot become a page in the admin's session.
 */
export function safeProofDelivery(storedContentType: string): {
  contentType: string;
  disposition: string;
} {
  const declared = storedContentType.toLowerCase().split(";")[0]?.trim() ?? "";

  const inlineImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (inlineImages.includes(declared)) {
    return { contentType: declared, disposition: "inline" };
  }
  if (declared === "application/pdf") {
    return { contentType: declared, disposition: 'attachment; filename="comprobante.pdf"' };
  }
  return {
    contentType: "application/octet-stream",
    disposition: 'attachment; filename="comprobante.bin"',
  };
}

import { describe, expect, it } from "vitest";
import { safeProofDelivery, sniffProof } from "../src/lib/file-type";

/**
 * What an uploaded proof is allowed to be, and how it is allowed to come back
 * out. Both halves exist because `File.type` is the uploader's word: a proof
 * that claims to be a PNG and holds a page would otherwise render inside the
 * band's admin session.
 */

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") flat.push(...[...part].map((c) => c.charCodeAt(0)));
    else flat.push(...part);
  }
  return new Uint8Array(flat);
}

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF");
const GIF = bytes("GIF89a", [1, 0, 1, 0]);
const WEBP = bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ");
const PDF = bytes("%PDF-1.4", [0x0a]);

/** 4 bytes of box length, then the brand. */
const isoMedia = (brand: string) => bytes([0, 0, 0, 0x18], "ftyp", brand, "    ");

describe("sniffProof", () => {
  it("recognises the formats a bank app produces", () => {
    expect(sniffProof(PNG)).toEqual({ kind: "ok", mediaType: "image/png" });
    expect(sniffProof(JPEG)).toEqual({ kind: "ok", mediaType: "image/jpeg" });
    expect(sniffProof(GIF)).toEqual({ kind: "ok", mediaType: "image/gif" });
    expect(sniffProof(WEBP)).toEqual({ kind: "ok", mediaType: "image/webp" });
    expect(sniffProof(PDF)).toEqual({ kind: "ok", mediaType: "application/pdf" });
  });

  it("reads an ArrayBuffer as happily as a view", () => {
    expect(sniffProof(PNG.buffer)).toEqual({ kind: "ok", mediaType: "image/png" });
  });

  // The one rejection a buyer hits while doing everything right, so it is
  // told apart from junk and gets its own instruction.
  it("names an iPhone photo as such", () => {
    for (const brand of ["heic", "heix", "mif1", "avif"]) {
      expect(sniffProof(isoMedia(brand))).toEqual({ kind: "phone-photo" });
    }
  });

  it("does not mistake other ISO media for a photo", () => {
    expect(sniffProof(isoMedia("mp42"))).toEqual({ kind: "unknown" });
  });

  describe("the attacks this exists to stop", () => {
    // Stored XSS in an admin session: the proof is opened from the order page.
    it("rejects HTML however it is dressed up", () => {
      expect(sniffProof(bytes("<!doctype html><script>alert(1)</script>"))).toEqual({
        kind: "unknown",
      });
      expect(sniffProof(bytes("<html><body onload=alert(1)>"))).toEqual({ kind: "unknown" });
    });

    // An SVG displays like an image and executes like a document.
    it("rejects SVG", () => {
      expect(sniffProof(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toEqual({
        kind: "unknown",
      });
    });

    it("rejects a script with an image extension — the name is never read", () => {
      expect(sniffProof(bytes("#!/bin/sh\nrm -rf /"))).toEqual({ kind: "unknown" });
    });

    // A polyglot: valid PNG magic is the whole claim, so this is accepted as a
    // PNG and served as one. That is the point — `image/png` cannot execute.
    it("treats a file with real PNG magic as a PNG, whatever follows it", () => {
      const polyglot = bytes(
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        "<script>x</script>",
      );
      expect(sniffProof(polyglot)).toEqual({ kind: "ok", mediaType: "image/png" });
    });
  });

  describe("files too small to identify", () => {
    it("rejects an empty upload", () => {
      expect(sniffProof(new Uint8Array(0))).toEqual({ kind: "unknown" });
    });

    it("rejects a truncated header rather than reading past the end", () => {
      expect(sniffProof(bytes([0x89, 0x50]))).toEqual({ kind: "unknown" });
      expect(sniffProof(bytes("RIFF"))).toEqual({ kind: "unknown" });
      expect(sniffProof(bytes("%PD"))).toEqual({ kind: "unknown" });
    });

    it("rejects RIFF that is not WebP", () => {
      expect(sniffProof(bytes("RIFF", [0x24, 0, 0, 0], "WAVEfmt "))).toEqual({ kind: "unknown" });
    });
  });
});

describe("safeProofDelivery", () => {
  it("renders the image formats inline, which is the whole point of the page", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(safeProofDelivery(type)).toEqual({ contentType: type, disposition: "inline" });
    }
  });

  it("normalises case and parameters before deciding", () => {
    expect(safeProofDelivery("IMAGE/PNG; charset=binary")).toEqual({
      contentType: "image/png",
      disposition: "inline",
    });
  });

  it("downloads a PDF instead of rendering it", () => {
    expect(safeProofDelivery("application/pdf")).toEqual({
      contentType: "application/pdf",
      disposition: 'attachment; filename="comprobante.pdf"',
    });
  });

  // Rows written before uploads were sniffed still hold the uploader's word,
  // so this is the layer that protects them.
  it("never serves a document as a document", () => {
    for (const type of ["text/html", "image/svg+xml", "application/xhtml+xml", ""]) {
      const delivery = safeProofDelivery(type);
      expect(delivery.contentType).toBe("application/octet-stream");
      expect(delivery.disposition).toContain("attachment");
    }
  });
});

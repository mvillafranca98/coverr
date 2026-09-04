/**
 * Minimal grayscale PNG encoder.
 *
 * Why this exists: the ticket email needs to show a QR, and email clients rule
 * out every easier option. Gmail strips `data:` URI images and refuses SVG
 * entirely, so the QR must be a hosted raster the client can fetch over HTTP.
 * Workers have no canvas, so we encode the PNG by hand — a QR is a 1-bit
 * matrix, which makes this about sixty lines rather than a dependency.
 *
 * CompressionStream("deflate") emits zlib-wrapped deflate (RFC 1950), which is
 * exactly what a PNG IDAT chunk wants.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  void writer.write(data);
  void writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Renders a boolean module matrix as an 8-bit grayscale PNG.
 * `scale` is pixels per module; `quiet` is the margin in modules (4 per spec —
 * scanners need it, and phone cameras at a dark venue need all the help going).
 */
export async function matrixToPng(
  isDark: (row: number, col: number) => boolean,
  count: number,
  opts: { scale?: number; quiet?: number } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const scale = opts.scale ?? 8;
  const quiet = opts.quiet ?? 4;
  const dim = (count + quiet * 2) * scale;

  // One filter byte (0 = None) per scanline, then `dim` grayscale samples.
  const raw = new Uint8Array((dim + 1) * dim);
  raw.fill(0xff);
  for (let y = 0; y < dim; y++) raw[y * (dim + 1)] = 0;

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!isDark(r, c)) continue;
      const x0 = (c + quiet) * scale;
      const y0 = (r + quiet) * scale;
      for (let dy = 0; dy < scale; dy++) {
        const rowStart = (y0 + dy) * (dim + 1) + 1 + x0;
        raw.fill(0x00, rowStart, rowStart + scale);
      }
    }
  }

  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, dim);
  hv.setUint32(4, dim);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = await deflate(raw);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];

  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    png.set(p, at);
    at += p.length;
  }
  return png;
}

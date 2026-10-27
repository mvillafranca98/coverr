/** RFC 4180 quoting: wrap everything, double any embedded quote. */
function escapeCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * A CSV document Excel opens correctly on a Spanish-language Windows machine,
 * which is what the bands actually use.
 *
 * The BOM and the CRLF line endings are both load-bearing: without the BOM
 * Excel reads UTF-8 as Latin-1 and every accented name arrives mangled, and
 * without CRLF it treats the whole file as one row.
 */
export function toCsv(header: readonly string[], rows: readonly unknown[][]): string {
  const lines = [
    header.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  return `﻿${lines.join("\r\n")}`;
}

export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

/** `Content-Disposition` value that makes a browser download rather than render. */
export function csvAttachment(filename: string): string {
  return `attachment; filename="${filename}"`;
}

/**
 * What the door scanner sends, read field by field.
 *
 * Only `public/scanner.js` posts to the scanner API, and it always sends
 * well-formed JSON. Anything else is a broken client or someone with the
 * staff link poking at it, and must be refused or cleaned up here rather than
 * reach an insert and crash — which would also page the operator for nothing.
 */

import { isRecord } from "./json";

/** Far beyond any honest sync — 500 queued scans are well under 100 KB. */
export const MAX_SCANNER_BODY_CHARS = 256_000;

/** The most scans one sync request may carry. The scanner sends batches of this size. */
export const MAX_SCANS_PER_SYNC = 500;

const MAX_DEVICE_CHARS = 40;

/** One scan as the server will record it. */
export type ScanRecord = {
  /** The QR token scanned. */
  t: string;
  /** When the device scanned it, or when it reached the server if the device's time is unusable. */
  at: string;
  device: string | null;
};

/**
 * The scans in a check-in sync.
 *
 * The scan time comes from the device on purpose: a scan queued offline at
 * 21:10 and synced at 23:40 happened at 21:10. A time that is missing or not
 * a readable date falls back to `now`, the moment the sync arrived, rather
 * than failing the whole batch over one bad entry.
 */
export function readCheckinBatch(body: Record<string, unknown>, now: string): ScanRecord[] {
  const entries = Array.isArray(body.scans) ? body.scans.slice(0, MAX_SCANS_PER_SYNC) : [];
  return entries.flatMap((entry): ScanRecord[] => {
    if (!isRecord(entry) || typeof entry.t !== "string" || entry.t === "") return [];
    return [{ t: entry.t, at: readableTime(entry.at) ?? now, device: deviceName(entry.device) }];
  });
}

/** A cash sale or comp from the door: quantity clamped to 1–20, as the scanner's stepper is. */
export function readCashSale(body: Record<string, unknown>): {
  quantity: number;
  comp: boolean;
  device: string | null;
} {
  return {
    quantity: Math.min(20, Math.max(1, Math.floor(Number(body.quantity) || 1))),
    comp: body.comp === true,
    device: deviceName(body.device),
  };
}

function readableTime(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function deviceName(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value.slice(0, MAX_DEVICE_CHARS) : null;
}

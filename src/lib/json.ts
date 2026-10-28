/**
 * Reading JSON that arrived from outside.
 *
 * `JSON.parse` succeeds on `null`, `42` and `[]`, and every handler here then
 * reads a property off the result — so "valid JSON" is not the same as "a
 * body we can read". These collapse every case that is not a plain object to
 * null, so a caller only ever deals with an object or a clean refusal.
 */

/** A plain object — not null, not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The object `raw` holds, or null for invalid JSON or anything that is not an object. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

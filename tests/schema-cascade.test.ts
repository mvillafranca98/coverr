import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";

/**
 * Deleting a band is a single `DELETE FROM bands`; the foreign keys' ON DELETE
 * CASCADE takes everything else. That only holds while every table holding a
 * band's data reaches `bands` through cascading keys. A table added later
 * without one would survive every deletion silently — this test is what
 * notices.
 */

/** Tables that belong to no band, and so are not deleted with one. */
const BELONGS_TO_NO_BAND = new Set(["error_log", "platform_flags"]);

const tables = Object.values(schema).filter(
  (value): value is SQLiteTable =>
    typeof value === "object" && value !== null && "getSQL" in value && isTable(value),
);

function isTable(value: object): boolean {
  try {
    getTableConfig(value as SQLiteTable);
    return true;
  } catch {
    return false;
  }
}

/** Table name → the tables it cascades from. */
const cascadesFrom = new Map(
  tables.map((table) => {
    const config = getTableConfig(table);
    const parents = config.foreignKeys
      .filter((fk) => fk.onDelete === "cascade")
      .map((fk) => getTableConfig(fk.reference().foreignTable).name);
    return [config.name, parents] as const;
  }),
);

function reachesBands(name: string, seen = new Set<string>()): boolean {
  if (name === "bands") return true;
  if (seen.has(name)) return false;
  seen.add(name);
  return (cascadesFrom.get(name) ?? []).some((parent) => reachesBands(parent, seen));
}

describe("deleting a band deletes everything it owns", () => {
  it("finds the schema's tables", () => {
    expect(cascadesFrom.size).toBeGreaterThan(10);
  });

  it("reaches every table except the ones that belong to nobody", () => {
    const stranded = [...cascadesFrom.keys()].filter(
      (name) => !BELONGS_TO_NO_BAND.has(name) && !reachesBands(name),
    );
    expect(stranded).toEqual([]);
  });

  it("covers the tables that hold buyers' personal data", () => {
    for (const name of ["orders", "attendees", "payment_proofs", "contacts", "refund_requests"]) {
      expect(reachesBands(name)).toBe(true);
    }
  });
});

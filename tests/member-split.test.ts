import { describe, expect, it } from "vitest";
import { memberIdsChanged, readMemberTable, typedMemberRows } from "../src/lib/member-split";

/**
 * The members table is saved whole and must total exactly 100%, so the report
 * always assigns every lempira of the net to someone named.
 */

type Row = { id?: string; name?: string; pct?: string; remove?: boolean };

function form(rows: Row[]): Record<string, unknown> {
  const body: Record<string, unknown> = { member_rows: String(rows.length) };
  rows.forEach((row, i) => {
    if (row.id) body[`member_id_${i}`] = row.id;
    body[`member_name_${i}`] = row.name ?? "";
    body[`member_pct_${i}`] = row.pct ?? "";
    if (row.remove) body[`member_remove_${i}`] = "1";
  });
  return body;
}

function refusal(rows: Row[]): string | null {
  const result = readMemberTable(form(rows));
  return result.ok ? null : result.message;
}

describe("reading the members table", () => {
  it("accepts a split that totals 100, in the order shown", () => {
    const result = readMemberTable(
      form([
        { id: "mem_a", name: "Ana", pct: "60" },
        { name: "Beto", pct: "40" },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      rows: [
        { id: "mem_a", name: "Ana", splitPct: 60 },
        { id: null, name: "Beto", splitPct: 40 },
      ],
      removeIds: [],
    });
  });

  it("accepts thirds written to the hundredth", () => {
    expect(
      refusal([
        { name: "Ana", pct: "33.33" },
        { name: "Beto", pct: "33.33" },
        { name: "Caro", pct: "33.34" },
      ]),
    ).toBeNull();
  });

  it("refuses a total under 100 and says how to keep a fund", () => {
    expect(
      refusal([
        { name: "Ana", pct: "60" },
        { name: "Beto", pct: "30" },
      ]),
    ).toBe(
      'Los porcentajes suman 90%, y tienen que sumar 100%. Si una parte queda para la banda, agregá una fila "Fondo de la banda" con ese porcentaje.',
    );
  });

  it("refuses a total over 100", () => {
    expect(
      refusal([
        { name: "Ana", pct: "60" },
        { name: "Beto", pct: "60" },
      ]),
    ).toContain("suman 120%");
  });

  it("skips empty new rows and accepts an empty table", () => {
    expect(refusal([{ name: "Ana", pct: "100" }, {}, {}])).toBeNull();
    expect(readMemberTable(form([{}, {}]))).toEqual({ ok: true, rows: [], removeIds: [] });
  });

  it("removes a ticked member and leaves them out of the total", () => {
    const result = readMemberTable(
      form([
        { id: "mem_a", name: "Ana", pct: "100" },
        { id: "mem_b", name: "Beto", pct: "40", remove: true },
      ]),
    );
    expect(result).toMatchObject({ ok: true, removeIds: ["mem_b"] });
  });

  it("names the row with a missing name, and how to remove someone", () => {
    expect(refusal([{ name: "", pct: "100" }])).toBe("Falta el nombre en la fila 1.");
    expect(refusal([{ id: "mem_a", name: "", pct: "" }])).toBe(
      "Falta el nombre en la fila 1. Para sacar a alguien, marcá Quitar.",
    );
  });

  it("names the member whose percentage is missing or out of range", () => {
    expect(refusal([{ name: "Ana", pct: "" }])).toBe("Falta el porcentaje de Ana.");
    expect(refusal([{ name: "Ana", pct: "120" }])).toBe(
      "El porcentaje de Ana tiene que estar entre 0 y 100.",
    );
  });

  it("reads no more rows than the cap, whatever the form claims", () => {
    expect(typedMemberRows({ member_rows: "5000" })).toHaveLength(40);
  });
});

describe("checking the ids against the band's own", () => {
  const table = (ids: string[], removeIds: string[] = []) => ({
    rows: ids.map((id) => ({ id, name: id, splitPct: 0 })),
    removeIds,
  });

  it("passes when the form lists exactly the band's members", () => {
    expect(memberIdsChanged(table(["a"], ["b"]), ["b", "a"])).toBe(false);
  });

  it("catches another band's member, a duplicate, and a stale form", () => {
    expect(memberIdsChanged(table(["a", "x"]), ["a", "b"])).toBe(true);
    expect(memberIdsChanged(table(["a", "a"]), ["a", "b"])).toBe(true);
    expect(memberIdsChanged(table(["a"]), ["a", "b"])).toBe(true);
  });
});

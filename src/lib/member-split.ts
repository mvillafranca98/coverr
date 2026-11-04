import { TEXT_LIMITS, tooLong } from "./text-limits";

/**
 * The band's split, read from the one form that edits the whole members table.
 *
 * Saved all at once so it can be held to exactly 100%: added one member at a
 * time, only the last save could ever total 100. A band that keeps a fund gives
 * it a row of its own ("Fondo de la banda"), so every lempira of the net goes to
 * a name on the report.
 */

export type MemberRow = { id: string | null; name: string; splitPct: number };

export type MemberTable = {
  /** In the order shown, which becomes the order saved. Existing rows carry their id. */
  rows: MemberRow[];
  /** Existing members ticked "Quitar". */
  removeIds: string[];
};

export type MemberTableResult = ({ ok: true } & MemberTable) | { ok: false; message: string };

/** More rows than any band, fewer than a form could be stuffed with. */
export const MAX_MEMBER_ROWS = 40;

/** The form's field names for row `index`, shared by the view and the reader. */
export const memberField = {
  id: (index: number) => `member_id_${index}`,
  name: (index: number) => `member_name_${index}`,
  pct: (index: number) => `member_pct_${index}`,
  remove: (index: number) => `member_remove_${index}`,
  /** How many rows the form sent. */
  count: "member_rows",
};

/** A percentage in hundredths, so 33.33 + 33.33 + 33.34 is exactly 100. */
const hundredths = (pct: number) => Math.round(pct * 100);

/** "33.5", "40": a total as the band would write it. */
export function formatPct(pct: number): string {
  return String(hundredths(pct) / 100);
}

/** One row of the form as typed, before any checking. */
export type MemberFormRow = { id: string | null; name: string; pct: string; remove: boolean };

/** The rows exactly as typed, so a refused table comes back as the band left it. */
export function typedMemberRows(body: Record<string, unknown>): MemberFormRow[] {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
  const sent = Number.parseInt(text(memberField.count), 10);
  const count = Number.isFinite(sent) ? Math.min(Math.max(sent, 0), MAX_MEMBER_ROWS) : 0;
  return Array.from({ length: count }, (_, index) => ({
    id: text(memberField.id(index)) || null,
    name: text(memberField.name(index)),
    pct: text(memberField.pct(index)),
    remove: text(memberField.remove(index)) === "1",
  }));
}

/** Reads and checks the whole table. Blank new rows are skipped; nothing else is guessed. */
export function readMemberTable(body: Record<string, unknown>): MemberTableResult {
  const rows: MemberRow[] = [];
  const removeIds: string[] = [];
  for (const [index, typed] of typedMemberRows(body).entries()) {
    const { id, name, pct: pctText } = typed;
    if (typed.remove) {
      if (id) removeIds.push(id);
      continue;
    }
    if (!id && !name && !pctText) continue;

    const rowNumber = index + 1;
    if (!name) {
      return {
        ok: false,
        message: id
          ? `Falta el nombre en la fila ${rowNumber}. Para sacar a alguien, marcá Quitar.`
          : `Falta el nombre en la fila ${rowNumber}.`,
      };
    }
    const nameError = tooLong(name, TEXT_LIMITS.name, "El nombre del integrante");
    if (nameError) return { ok: false, message: nameError };
    if (!pctText) return { ok: false, message: `Falta el porcentaje de ${name}.` };
    const splitPct = Number(pctText);
    if (!Number.isFinite(splitPct) || splitPct < 0 || splitPct > 100) {
      return { ok: false, message: `El porcentaje de ${name} tiene que estar entre 0 y 100.` };
    }
    rows.push({ id, name, splitPct: hundredths(splitPct) / 100 });
  }

  const total = rows.reduce((sum, row) => sum + hundredths(row.splitPct), 0);
  if (rows.length > 0 && total !== 10_000) {
    return {
      ok: false,
      message: `Los porcentajes suman ${formatPct(total / 100)}%, y tienen que sumar 100%. Si una parte queda para la banda, agregá una fila "Fondo de la banda" con ese porcentaje.`,
    };
  }
  return { ok: true, rows, removeIds };
}

/**
 * True when the form's member ids are not exactly the band's current ones: an
 * id from another band, one listed twice, or a member added or removed in
 * another tab since the form was drawn. Any of these means the total the band
 * checked is not the total that would be saved.
 */
export function memberIdsChanged(table: MemberTable, currentIds: readonly string[]): boolean {
  const formIds = [...table.rows.flatMap((row) => (row.id ? [row.id] : [])), ...table.removeIds];
  if (formIds.length !== currentIds.length) return true;
  const current = new Set(currentIds);
  return new Set(formIds).size !== formIds.length || formIds.some((id) => !current.has(id));
}

import type { Paper } from "./pdf";
import { flagLabel } from "./verify";

/**
 * The band's printouts for the night — the presale list, the QR poster for
 * the entrance and the set list — and what decides what goes on them. Pure:
 * the queries are in `db/queries/door-kit.ts`, the drawing in `views/print`.
 */

/** A ticket as the presale list needs it, straight from the database. */
export type PresaleTicket = {
  orderId: string;
  name: string;
  note: string | null;
  code: string;
  channel: string;
  /** The first open flag on the order that someone still has to look at. */
  flagCode: string | null;
};

/** How many copies of each printout the download pack starts with. */
export const DEFAULT_COPIES = { list: 2, poster: 4 } as const;

/** The most copies of one printout in one download. A class trip's worth, not a print run. */
export const MAX_COPIES = 20;

/** The longest set list kept, in characters: well past three hours of songs. */
export const MAX_SETLIST_CHARS = 3000;

/**
 * The list's rows: by name, the way the door looks people up, with what staff
 * need to know beside it. "Revisar" names what is open, as amber does at the
 * door, so a paper list never hides a flag the scanner would show.
 */
export function presaleRows(tickets: PresaleTicket[]) {
  return [...tickets]
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
    .map((ticket) => ({
      name: ticket.name,
      code: ticket.code,
      note: [
        ticket.note,
        ticket.channel === "comp" ? "Cortesía" : null,
        ticket.flagCode ? `Revisar: ${flagLabel(ticket.flagCode)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}

/**
 * How many musicians to print a set list for: one per row of the members
 * table, except the band's fund, which the guide calls "Fondo de la banda"
 * and which plays nothing. At least one.
 */
export function musiciansIn(memberNames: string[]): number {
  const fund = /^fondo\b/i;
  const players = memberNames.filter((name) => !fund.test(name.normalize("NFD").trim()));
  return Math.max(1, players.length);
}

/** A copies field from a download link: a whole number from 0 to MAX_COPIES, else `fallback`. */
export function readCopies(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const copies = Number(value);
  if (!Number.isInteger(copies) || copies < 0) return fallback;
  return Math.min(MAX_COPIES, copies);
}

/** The paper a download asks for. Carta unless A4 is asked for by name. */
export function readPaper(value: string | undefined): Paper {
  return value === "a4" ? "a4" : "carta";
}

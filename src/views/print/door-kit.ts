import { PAPER, type Paper, PdfDocument } from "../../lib/pdf";
import type { PrintEvent } from "./common";
import { addDoorPoster, type DoorPosterInput } from "./door-poster";
import { addPresaleList, type PresaleRow } from "./presale-list";
import { addSetlist, type SetlistInput, type SetlistLine } from "./setlist";

/** Which printouts go in the file, and how many copies of each. A part left out is not printed. */
export type DoorKitParts = {
  list?: { copies: number; rows: PresaleRow[]; printedAt: string };
  poster?: { copies: number; input: DoorPosterInput };
  setlist?: { copies: number; input: SetlistInput; lines: SetlistLine[] };
};

/**
 * One PDF with every copy asked for, in the order a band hands them out: the
 * lists for the door, the posters for the entrance, a set list per musician.
 * One file prints in one go, collated, from a phone or a print shop's
 * computer alike; a single printout is the same file with one part.
 */
export function doorKitPdf(
  title: string,
  paper: Paper,
  event: PrintEvent,
  parts: DoorKitParts,
): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument(title);
  const size = PAPER[paper];
  for (let i = 0; i < (parts.list?.copies ?? 0); i++) {
    addPresaleList(doc, size, event, parts.list?.rows ?? [], parts.list?.printedAt ?? "");
  }
  for (let i = 0; i < (parts.poster?.copies ?? 0); i++) {
    if (parts.poster) addDoorPoster(doc, size, parts.poster.input);
  }
  for (let i = 0; i < (parts.setlist?.copies ?? 0); i++) {
    if (parts.setlist) addSetlist(doc, size, parts.setlist.input, parts.setlist.lines);
  }
  return doc.toBytes();
}

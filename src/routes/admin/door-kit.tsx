import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import {
  doorPrice,
  latestOtherSetlist,
  memberNames,
  presaleTickets,
  saveSetlist,
} from "../../db/queries/door-kit";
import { findEventBySlug } from "../../db/queries/events";
import * as s from "../../db/schema";
import {
  formatEventDate,
  formatEventTime,
  formatLpsShort,
  formatMoment,
  formatShortDate,
  nowIso,
} from "../../lib/core";
import {
  DEFAULT_COPIES,
  MAX_SETLIST_CHARS,
  musiciansIn,
  presaleRows,
  readCopies,
  readPaper,
} from "../../lib/door-kit";
import { qrModules } from "../../lib/qr";
import { DoorKitPage } from "../../views/admin/door-kit";
import type { PrintEvent } from "../../views/print/common";
import { type DoorKitParts, doorKitPdf } from "../../views/print/door-kit";
import { readSetlist } from "../../views/print/setlist";
import type { AdminContext, AdminEnv } from "./context";

export const doorKitRoutes = new Hono<AdminEnv>();

const kitPath = (slug: string) => `/admin/e/${slug}/imprimir`;

/** The band and the event in the URL, or null when the event is not this band's. */
async function findKit(c: AdminContext) {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  const event = await findEventBySlug(db, bandId, c.req.param("slug") ?? "");
  return band && event ? { db, band, event } : null;
}

type Kit = NonNullable<Awaited<ReturnType<typeof findKit>>>;

doorKitRoutes.get("/e/:slug/imprimir", async (c) => {
  const kit = await findKit(c);
  if (!kit) return c.notFound();
  const { db, band, event } = kit;

  const [tickets, members, price, earlier] = await Promise.all([
    presaleTickets(db, event.id),
    memberNames(db, band.id),
    doorPrice(db, event.id),
    event.setlist ? Promise.resolve(null) : latestOtherSetlist(db, band.id, event.id),
  ]);

  return c.html(
    <DoorKitPage
      bandName={band.name}
      event={event}
      ticketCount={tickets.length}
      musicians={musiciansIn(members)}
      doorPrice={price == null ? null : formatLpsShort(price)}
      setlist={event.setlist ?? earlier ?? ""}
      setlistSaved={!!event.setlist}
      setlistFromEarlier={!event.setlist && !!earlier}
      saved={c.req.query("guardado") === "1"}
      error={c.req.query("error")}
    />,
  );
});

doorKitRoutes.post("/e/:slug/imprimir/setlist", async (c) => {
  const kit = await findKit(c);
  if (!kit) return c.notFound();
  const setlist = String((await c.req.parseBody())["setlist"] ?? "");
  if (setlist.length > MAX_SETLIST_CHARS) {
    const error = `El setlist es muy largo: el máximo es ${MAX_SETLIST_CHARS} caracteres.`;
    return c.redirect(`${kitPath(kit.event.slug)}?error=${encodeURIComponent(error)}#setlist`, 303);
  }
  await saveSetlist(kit.db, kit.event.id, setlist);
  return c.redirect(`${kitPath(kit.event.slug)}?guardado=1#setlist`, 303);
});

type Part = "list" | "poster" | "setlist";

/**
 * The four downloads: each printout on its own, and all three together. Each
 * reads only its own copies field, with the same defaults the page shows.
 */
const DOWNLOADS: { file: string; parts: Part[] }[] = [
  { file: "lista", parts: ["list"] },
  { file: "puerta", parts: ["poster"] },
  { file: "setlist", parts: ["setlist"] },
  { file: "todo", parts: ["list", "poster", "setlist"] },
];

for (const download of DOWNLOADS) {
  doorKitRoutes.get(`/e/:slug/imprimir/${download.file}.pdf`, async (c) => {
    const kit = await findKit(c);
    if (!kit) return c.notFound();
    const parts = await kitParts(c, kit, download.parts);
    const pages =
      (parts.list?.copies ?? 0) + (parts.poster?.copies ?? 0) + (parts.setlist?.copies ?? 0);
    if (pages === 0) {
      const error =
        download.parts.includes("setlist") && !kit.event.setlist
          ? "Guardá el setlist antes de descargarlo, o pedí al menos una copia de otra cosa."
          : "Pedí al menos una copia.";
      return c.redirect(`${kitPath(kit.event.slug)}?error=${encodeURIComponent(error)}`, 303);
    }

    const pdf = doorKitPdf(
      `${kit.event.name} — ${kit.band.name}`,
      readPaper(c.req.query("papel")),
      printEvent(kit),
      parts,
    );
    return c.body(pdf, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${download.file}-${kit.event.slug}.pdf"`,
      // The list names every buyer: never kept by a shared cache.
      "Cache-Control": "private, no-store",
    });
  });
}

function printEvent({ band, event }: Kit): PrintEvent {
  return {
    bandName: band.name,
    eventName: event.name,
    when: `${formatEventDate(event.startsAt)} · ${formatEventTime(event.startsAt)}`,
    venue: event.venue,
  };
}

/** Loads what each asked-for part needs, and nothing for the parts left out. */
async function kitParts(c: AdminContext, kit: Kit, wanted: Part[]): Promise<DoorKitParts> {
  const { db, band, event } = kit;
  const parts: DoorKitParts = {};

  if (wanted.includes("list")) {
    const copies = readCopies(c.req.query("lista"), DEFAULT_COPIES.list);
    if (copies > 0) {
      parts.list = {
        copies,
        rows: presaleRows(await presaleTickets(db, event.id)),
        printedAt: formatMoment(nowIso()),
      };
    }
  }

  if (wanted.includes("poster")) {
    const copies = readCopies(c.req.query("puerta"), DEFAULT_COPIES.poster);
    if (copies > 0) {
      const url = `${c.env.APP_ORIGIN}/e/${event.slug}`;
      const price = await doorPrice(db, event.id);
      parts.poster = {
        copies,
        input: {
          ...printEvent(kit),
          url,
          displayUrl: url.replace(/^https?:\/\//, ""),
          price: price == null ? null : formatLpsShort(price),
          qr: qrModules(url),
        },
      };
    }
  }

  const lines = readSetlist(event.setlist ?? "");
  if (wanted.includes("setlist") && lines.length > 0) {
    const copies = readCopies(c.req.query("setlist"), musiciansIn(await memberNames(db, band.id)));
    if (copies > 0) {
      parts.setlist = {
        copies,
        input: {
          bandName: band.name,
          eventName: event.name,
          date: formatShortDate(event.startsAt),
        },
        lines,
      };
    }
  }

  return parts;
}

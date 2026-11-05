import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import {
  type DeletionState,
  deleteBandRows,
  loadDeletionState,
} from "../../db/queries/account-deletion";
import { findBand } from "../../db/queries/bands";
import * as s from "../../db/schema";
import {
  confirmsDeletion,
  type DeletionBlocker,
  deletionBlockers,
} from "../../lib/account-deletion";
import { clearCookie } from "../../lib/auth";
import { deleteFeeProofsForBand, deleteProofsForEvents } from "../../lib/proof-storage";
import { AccountDeletedPage, DeleteAccountPage } from "../../views/setup/delete-account";
import type { AdminContext, AdminEnv } from "./context";

export const accountDeletionRoutes = new Hono<AdminEnv>();

const NAME_MISMATCH =
  "Eso no coincide con el nombre de la banda. Escribilo tal como aparece arriba.";

function blockersFor(state: DeletionState): DeletionBlocker[] {
  return deletionBlockers({
    events: state.events,
    unansweredRefunds: state.unansweredRefunds,
    now: new Date(),
  });
}

function renderPage(
  c: AdminContext,
  view: { bandName: string; state: DeletionState; blockers: DeletionBlocker[]; error?: string },
  status: 200 | 400 | 409 = 200,
) {
  return c.html(
    <DeleteAccountPage
      bandName={view.bandName}
      footprint={view.state.footprint}
      blockers={view.blockers}
      error={view.error}
    />,
    status,
  );
}

accountDeletionRoutes.get("/banda/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);

  const state = await loadDeletionState(db, band.id);
  return renderPage(c, { bandName: band.name, state, blockers: blockersFor(state) });
});

/**
 * Deletes the band's account: every row and every stored proof, for good.
 *
 * Blockers are worked out again here rather than trusted from the page, so a
 * ticket sold since it loaded still stops this.
 *
 * Files go before rows, deliberately. If the rows went first and the bucket
 * then failed, the proofs would be left with nothing pointing at them and
 * nothing would ever clean them up. This way round a failure leaves the
 * account in place, and deleting again finishes the job.
 */
accountDeletionRoutes.post("/banda/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);

  const state = await loadDeletionState(db, band.id);
  const blockers = blockersFor(state);
  if (blockers.length > 0) return renderPage(c, { bandName: band.name, state, blockers }, 409);

  const body = await c.req.parseBody();
  if (!confirmsDeletion(String(body["confirm"] ?? ""), band.name)) {
    return renderPage(c, { bandName: band.name, state, blockers, error: NAME_MISMATCH }, 400);
  }

  const proofFiles =
    (await deleteProofsForEvents(
      c.env.PROOFS,
      state.events.map((event) => event.id),
    )) + (await deleteFeeProofsForBand(c.env.PROOFS, band.id));
  await deleteBandRows(db, band.id);

  // An opaque id and counts, nothing that names anyone: the operator needs to
  // know a deletion happened — to repeat it after a restore, for one — and
  // nothing more.
  console.log(
    `[account] deleted band=${band.id} events=${state.footprint.events} orders=${state.footprint.orders} proof_files=${proofFiles}`,
  );

  c.header("Set-Cookie", clearCookie(c.env.APP_ORIGIN.startsWith("https://")));
  return c.html(<AccountDeletedPage bandName={band.name} />);
});

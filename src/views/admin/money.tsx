import type { FC } from "hono/jsx";
import { formatLps, formatLpsShort } from "../../lib/core";
import type { OwedFee } from "../../lib/fees";
import type { Settlement, UnlockPrice } from "../../lib/settlement";
import { COST_CATEGORY_LABEL, costCategoryLabel } from "./cost-category";
import { AdminLayout } from "./layout";
import { type FeeAccount, ReportLock } from "./report-lock";
import { memberTone, SplitBar } from "./split-bar";

export const MoneyPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  expenses: { id: string; label: string; category: string; amount: number; paid: number }[];
  settlement: Settlement;
  /** The part of the gross whose orders still have something to review. */
  underReview: { orders: number; amount: number };
  advancesByMember: Record<string, number>;
  unlocked: boolean;
  /** What unlocking costs, and why it is free when it is. */
  price: UnlockPrice;
  /** Where to transfer a charged fee; null when it is free or Coverr has no account yet. */
  feeAccount: FeeAccount | null;
  /** An earlier report marked unpaid: until it is settled this one cannot be paid for. */
  owed?: OwedFee | null;
  /** The band has just uploaded its fee screenshot and the report opened. */
  justPaid?: boolean;
  error?: string;
}> = ({
  bandName,
  event,
  expenses,
  settlement,
  underReview,
  unlocked,
  price,
  feeAccount,
  owed,
  justPaid,
  error,
}) => (
  <AdminLayout
    title={`Dinero — ${event.name}`}
    bandName={bandName}
    active="money"
    eventSlug={event.slug}
    eventName={event.name}
  >
    <h1>Dinero</h1>
    <p class="sub">{event.name}</p>
    {error ? <div class="note crit">{error}</div> : null}
    {justPaid ? (
      <div class="note ok">
        Recibimos la captura de tu pago y el reporte ya está abierto. Si algo no cuadra con la
        transferencia, te escribimos.
      </div>
    ) : null}

    <h2>Costos</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Categoría</th>
            <th class="n">Monto</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colspan={4} class="muted">
                Sin costos registrados.
              </td>
            </tr>
          ) : (
            expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.label}</td>
                <td class="muted">{costCategoryLabel(e.category)}</td>
                <td class="n">{formatLps(e.amount)}</td>
                <td class="right">
                  <form method="post" action={`/admin/e/${event.slug}/dinero/costo/borrar`}>
                    <input type="hidden" name="id" value={e.id} />
                    <button class="btn sm ghost" type="submit">
                      Quitar
                    </button>
                  </form>
                </td>
              </tr>
            ))
          )}
          <tr class="tot">
            <td>Total</td>
            <td />
            <td class="n">{formatLps(settlement.costs)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>

    <form class="inline" method="post" action={`/admin/e/${event.slug}/dinero/costo`}>
      <div style="flex:1;min-width:170px">
        <label class="fl" for="label">
          Concepto
        </label>
        <input type="text" name="label" id="label" required placeholder="Sonido" />
      </div>
      <div style="min-width:130px">
        <label class="fl" for="category">
          Categoría
        </label>
        <select name="category" id="category">
          {Object.entries(COST_CATEGORY_LABEL).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div style="min-width:120px">
        <label class="fl" for="amount">
          Monto (L)
        </label>
        <input type="number" name="amount" id="amount" step="0.01" min="0" required />
      </div>
      <button class="btn" type="submit">
        Agregar
      </button>
    </form>

    <h2>Reparto</h2>
    {settlement.pctTotal !== 100 ? (
      <div class="note warn">
        Los porcentajes suman <b>{settlement.pctTotal}%</b>, no 100%. Corregilos en{" "}
        <a href="/admin/banda">Banda</a>: si una parte queda para la banda, va en una fila "Fondo de
        la banda".
      </div>
    ) : null}

    {/* The totals show before the unlock too: the band sees how the night went,
        and the fee buys who gets paid what. */}
    <div class="cards">
      <div class="card">
        <span>Bruto</span>
        <b>{formatLpsShort(settlement.gross)}</b>
      </div>
      <div class="card">
        <span>Costos</span>
        <b>−{formatLpsShort(settlement.costs)}</b>
      </div>
      <div class="card">
        <span>Neto</span>
        <b>{formatLpsShort(settlement.net)}</b>
      </div>
    </div>

    {/* The gross is what the receipts say, so it names the part a person has
        not confirmed yet. Shown locked or not: it is a warning, not the report. */}
    {underReview.orders > 0 ? (
      <div class="note warn" style="margin-top:16px">
        <b>{formatLps(underReview.amount)}</b> de este bruto viene de {underReview.orders}{" "}
        {underReview.orders === 1 ? "orden" : "órdenes"} por revisar.{" "}
        <a href={`/admin/e/${event.slug}/ordenes?filtro=flagged`}>Revisalas</a> antes de repartir:
        si una nunca se pagó, anulala y sale de los totales.
      </div>
    ) : null}

    {unlocked ? (
      <>
        <div style="margin-top:16px">
          <SplitBar members={settlement.members} />
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Integrante</th>
                <th class="n">%</th>
                <th class="n">Parte</th>
                <th class="n">Adelantos</th>
                <th class="n">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {settlement.members.map((m, index) => {
                const tone = memberTone(index, settlement.members.length);
                return (
                  <tr key={m.id}>
                    <td>
                      {tone ? <i class={`swatch tone-${tone}`} aria-hidden="true" /> : null}
                      {m.name}
                    </td>
                    <td class="n">{m.splitPct}%</td>
                    <td class="n">{formatLps(m.share)}</td>
                    <td class="n">{m.advances ? `−${formatLps(m.advances)}` : "—"}</td>
                    <td class="n">
                      <b>{formatLps(m.payout)}</b>
                    </td>
                  </tr>
                );
              })}
              {settlement.unallocated !== 0 ? (
                <tr class="tot">
                  <td colspan={4}>Sin asignar</td>
                  <td class="n">{formatLps(settlement.unallocated)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </>
    ) : (
      <ReportLock slug={event.slug} price={price} feeAccount={feeAccount} owed={owed ?? null} />
    )}
  </AdminLayout>
);

import type { FC } from "hono/jsx";
import { formatLps, formatLpsShort } from "../../lib/core";
import { BILLING_ENABLED, type Settlement } from "../../lib/settlement";
import { AdminLayout } from "./layout";

export const MoneyPage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  expenses: { id: string; label: string; category: string; amount: number; paid: number }[];
  settlement: Settlement;
  advancesByMember: Record<string, number>;
  unlocked: boolean;
  bracket: { bracket: string; amount: number };
  isFirstEvent: boolean;
}> = ({ bandName, event, expenses, settlement, unlocked, bracket, isFirstEvent }) => (
  <AdminLayout
    title={`Dinero — ${event.name}`}
    bandName={bandName}
    active="money"
    eventSlug={event.slug}
    eventName={event.name}
  >
    <h1>Dinero</h1>
    <p class="sub">{event.name}</p>

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
                <td class="muted">{e.category}</td>
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
          <option value="sound">Sonido</option>
          <option value="stage">Tarima</option>
          <option value="promo">Promoción</option>
          <option value="food">Comida</option>
          <option value="art">Arte</option>
          <option value="staff">Personal</option>
          <option value="photo">Fotos</option>
          <option value="decor">Decoración</option>
          <option value="rental">Alquiler</option>
          <option value="other">Otro</option>
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
        Los porcentajes suman <b>{settlement.pctTotal}%</b>, no 100%. Puede ser intencional (algo
        queda en el fondo de la banda), pero revisalo.
      </div>
    ) : null}

    {unlocked || !BILLING_ENABLED ? (
      <>
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
        <div class="scroll" style="margin-top:12px">
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
              {settlement.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td class="n">{m.splitPct}%</td>
                  <td class="n">{formatLps(m.share)}</td>
                  <td class="n">{m.advances ? `−${formatLps(m.advances)}` : "—"}</td>
                  <td class="n">
                    <b>{formatLps(m.payout)}</b>
                  </td>
                </tr>
              ))}
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
      <div class="note warn">
        <b>El reporte de reparto está bloqueado.</b>
        <p style="margin:8px 0 0">
          Todo lo demás — preventa, códigos QR, entrada, ventas en efectivo, el resumen en vivo — es
          gratis y siempre lo va a ser. El reparto final de este evento cuesta{" "}
          <b>{formatLpsShort(bracket.amount)}</b>
          {isFirstEvent ? " (pero tu primer evento es gratis)" : ""}.
        </p>
        <form
          method="post"
          action={`/admin/e/${event.slug}/dinero/desbloquear`}
          style="margin-top:12px"
        >
          <button class="btn" type="submit">
            {isFirstEvent
              ? "Desbloquear gratis"
              : `Desbloquear por ${formatLpsShort(bracket.amount)}`}
          </button>
        </form>
      </div>
    )}
  </AdminLayout>
);

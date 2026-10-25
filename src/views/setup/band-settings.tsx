import type { FC } from "hono/jsx";
import { BANKS, bankLabel, formatLps, formatEventDate } from "../../lib/core";
import { AdminLayout } from "../admin/layout";

export const BandSettingsPage: FC<{
  band: { name: string; contactEmail: string };
  accounts: {
    id: string;
    bank: string;
    accountNumber: string;
    holderName: string;
    isDefault: number;
    active: number;
  }[];
  members: { id: string; name: string; splitPct: number }[];
  advances: { id: string; memberName: string; amount: number; date: string; eventName: string | null }[];
  events: { id: string; name: string; startsAt: string }[];
  saved?: boolean;
  error?: string;
}> = ({ band, accounts, members, advances, events, saved, error }) => {
  const pctTotal = members.reduce((n, m) => n + m.splitPct, 0);
  return (
    <AdminLayout title={`Ajustes — ${band.name}`} bandName={band.name} active="band">
      <h1>Ajustes de la banda</h1>
      <p class="sub">Cuentas, integrantes y adelantos.</p>
      {saved ? <div class="note ok">Guardado.</div> : null}
      {error ? <div class="note crit">{error}</div> : null}

      <h2>La banda</h2>
      <form method="post" action="/admin/banda" class="inline" style="max-width:620px">
        <div style="flex:1;min-width:180px">
          <label class="fl" for="band_name">
            Nombre
          </label>
          <input type="text" name="name" id="band_name" required value={band.name} />
        </div>
        <div style="flex:1;min-width:200px">
          <label class="fl" for="contact_email">
            Correo (con este entrás al panel)
          </label>
          <input type="email" name="contact_email" id="contact_email" required value={band.contactEmail} />
        </div>
        <button class="btn" type="submit">
          Guardar
        </button>
      </form>

      <h2>Cuentas bancarias</h2>
      <p class="sub" style="margin-bottom:10px">
        Agregá una cuenta por banco. Al comprador le mostramos la de su propio banco para que no
        pague comisión ACH.
      </p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Banco</th>
              <th>Cuenta</th>
              <th>Titular</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colspan={5} class="muted">
                  Sin cuentas. Agregá al menos una o nadie puede comprar.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id}>
                  <td>{bankLabel(a.bank)}</td>
                  <td style="font-family:var(--mono)">{a.accountNumber}</td>
                  <td>{a.holderName}</td>
                  <td>
                    {a.isDefault ? <span class="chip ok">principal</span> : null}{" "}
                    {a.active ? null : <span class="chip info">inactiva</span>}
                  </td>
                  <td class="right">
                    <form method="post" action="/admin/banda/cuenta/borrar">
                      <input type="hidden" name="id" value={a.id} />
                      <button class="btn sm ghost" type="submit">
                        Quitar
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form method="post" action="/admin/banda/cuenta" class="inline">
        <div style="min-width:150px">
          <label class="fl" for="acc_bank">
            Banco
          </label>
          <select name="bank" id="acc_bank">
            {BANKS.filter((b) => b.code !== "OTHER").map((b) => (
              <option value={b.code} key={b.code}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div style="min-width:150px">
          <label class="fl" for="acc_number">
            Número de cuenta
          </label>
          <input type="text" name="account_number" id="acc_number" required inputmode="numeric" />
        </div>
        <div style="flex:1;min-width:180px">
          <label class="fl" for="acc_holder">
            Titular
          </label>
          <input type="text" name="holder_name" id="acc_holder" required />
        </div>
        <button class="btn" type="submit">
          Agregar
        </button>
      </form>

      <h2>Integrantes y reparto</h2>
      {members.length > 0 && pctTotal !== 100 ? (
        <div class="note warn">
          Los porcentajes suman <b>{pctTotal}%</b>, no 100%. Puede ser intencional, pero revisalo.
        </div>
      ) : null}
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th class="n">%</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colspan={3} class="muted">
                  Sin integrantes.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <form method="post" action="/admin/banda/integrante" style="display:flex;gap:6px">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="text" name="name" value={m.name} style="min-width:140px" />
                      <input
                        type="number"
                        name="split_pct"
                        value={String(m.splitPct)}
                        min="0"
                        max="100"
                        step="0.5"
                        style="width:80px"
                      />
                      <button class="btn sm ghost" type="submit">
                        Guardar
                      </button>
                    </form>
                  </td>
                  <td class="n">{m.splitPct}%</td>
                  <td class="right">
                    <form method="post" action="/admin/banda/integrante/borrar">
                      <input type="hidden" name="id" value={m.id} />
                      <button class="btn sm ghost" type="submit">
                        Quitar
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form method="post" action="/admin/banda/integrante" class="inline">
        <div style="flex:1;min-width:170px">
          <label class="fl" for="m_name">
            Nuevo integrante
          </label>
          <input type="text" name="name" id="m_name" required />
        </div>
        <div style="min-width:110px">
          <label class="fl" for="m_pct">
            Porcentaje
          </label>
          <input type="number" name="split_pct" id="m_pct" min="0" max="100" step="0.5" required />
        </div>
        <button class="btn" type="submit">
          Agregar
        </button>
      </form>

      <h2>Adelantos</h2>
      <p class="sub" style="margin-bottom:10px">
        Plata que un integrante ya recibió. Se descuenta de su parte al repartir.
      </p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Integrante</th>
              <th>Evento</th>
              <th>Fecha</th>
              <th class="n">Monto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <tr>
                <td colspan={5} class="muted">
                  Sin adelantos.
                </td>
              </tr>
            ) : (
              advances.map((a) => (
                <tr key={a.id}>
                  <td>{a.memberName}</td>
                  <td class="muted">{a.eventName ?? "—"}</td>
                  <td class="muted">{a.date}</td>
                  <td class="n">{formatLps(a.amount)}</td>
                  <td class="right">
                    <form method="post" action="/admin/banda/adelanto/borrar">
                      <input type="hidden" name="id" value={a.id} />
                      <button class="btn sm ghost" type="submit">
                        Quitar
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {members.length > 0 ? (
        <form method="post" action="/admin/banda/adelanto" class="inline">
          <div style="min-width:150px">
            <label class="fl" for="adv_member">
              Integrante
            </label>
            <select name="member_id" id="adv_member">
              {members.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div style="min-width:160px">
            <label class="fl" for="adv_event">
              Evento
            </label>
            <select name="event_id" id="adv_event">
              {events.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name} · {formatEventDate(e.startsAt)}
                </option>
              ))}
            </select>
          </div>
          <div style="min-width:120px">
            <label class="fl" for="adv_amount">
              Monto (L)
            </label>
            <input type="number" name="amount" id="adv_amount" step="0.01" min="0" required />
          </div>
          <button class="btn" type="submit">
            Agregar
          </button>
        </form>
      ) : null}
    </AdminLayout>
  );
};

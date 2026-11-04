import type { FC } from "hono/jsx";
import { BANKS, bankLabel, formatEventDate, formatLps } from "../../lib/core";
import { formatPct, type MemberFormRow } from "../../lib/member-split";
import { AdminLayout } from "../admin/layout";
import { MemberTable, savedMemberRows } from "./member-table";

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
  advances: {
    id: string;
    memberName: string;
    amount: number;
    date: string;
    eventName: string | null;
  }[];
  events: { id: string; name: string; startsAt: string }[];
  /** The members table as typed, when a save was just refused. */
  typedMembers?: MemberFormRow[];
  saved?: boolean;
  error?: string;
}> = ({ band, accounts, members, advances, events, typedMembers, saved, error }) => {
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
          <input
            type="email"
            name="contact_email"
            id="contact_email"
            required
            value={band.contactEmail}
          />
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
      {/* Only a split saved before the table had to total 100 can show this. */}
      {members.length > 0 && Math.round(pctTotal * 100) !== 10_000 ? (
        <div class="note warn">
          Los porcentajes guardados suman <b>{formatPct(pctTotal)}%</b>, no 100%. Corregilos y
          guardá el reparto.
        </div>
      ) : null}
      <MemberTable rows={typedMembers ?? savedMemberRows(members)} />

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

      <h2>Borrar la cuenta</h2>
      <p class="sub">
        Borra a la banda y todo lo que tiene en Coverr: eventos, órdenes, boletos y comprobantes. No
        se puede deshacer, y antes te mostramos exactamente qué se va.
      </p>
      <a class="btn danger" href="/admin/banda/borrar">
        Borrar la cuenta…
      </a>
    </AdminLayout>
  );
};

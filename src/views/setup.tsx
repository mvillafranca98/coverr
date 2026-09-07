import type { FC } from "hono/jsx";
import { AdminLayout } from "./admin";
import { BANKS, bankLabel, formatLps, isoToLocalInput, formatEventDate } from "../lib/core";

/** Deliberately plain markup — the visual pass comes later. */

export type EventFormValues = {
  name: string;
  venue: string;
  startsAt: string;
  doorsAt: string | null;
  description: string | null;
  musicType: string | null;
  thankYouNote: string | null;
  capacityCap: number | null;
  refundPolicy: string;
  refundPolicyText: string | null;
  wristbandsStart: number | null;
  presaleAmount: number;
  presaleMaxQty: number | null;
  doorAmount: number;
};

const Fields: FC<{ v: Partial<EventFormValues> }> = ({ v }) => (
  <>
    <h2>El evento</h2>
    <label class="fl" for="name">
      Nombre
    </label>
    <input type="text" name="name" id="name" required value={v.name ?? ""} placeholder="Noche de rock" />

    <label class="fl" for="venue">
      Lugar
    </label>
    <input type="text" name="venue" id="venue" required value={v.venue ?? ""} placeholder="La Jungla" />

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label class="fl" for="starts_at">
          Empieza
        </label>
        <input
          type="datetime-local"
          name="starts_at"
          id="starts_at"
          required
          value={isoToLocalInput(v.startsAt ?? null)}
        />
      </div>
      <div>
        <label class="fl" for="doors_at">
          Puertas <span style="font-weight:400;color:var(--dim)">(opcional)</span>
        </label>
        <input
          type="datetime-local"
          name="doors_at"
          id="doors_at"
          value={isoToLocalInput(v.doorsAt ?? null)}
        />
      </div>
    </div>

    <label class="fl" for="music_type">
      Tipo de música <span style="font-weight:400;color:var(--dim)">(opcional)</span>
    </label>
    <input type="text" name="music_type" id="music_type" value={v.musicType ?? ""} placeholder="Rock / indie" />

    <label class="fl" for="description">
      Descripción <span style="font-weight:400;color:var(--dim)">(opcional)</span>
    </label>
    <input
      type="text"
      name="description"
      id="description"
      value={v.description ?? ""}
      placeholder="Lo que ve el comprador en el enlace"
    />

    <h2>Precios</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label class="fl" for="presale_amount">
          Preventa (L)
        </label>
        <input
          type="number"
          name="presale_amount"
          id="presale_amount"
          step="1"
          min="0"
          required
          value={v.presaleAmount != null ? String(v.presaleAmount / 100) : "200"}
        />
      </div>
      <div>
        <label class="fl" for="door_amount">
          Taquilla (L)
        </label>
        <input
          type="number"
          name="door_amount"
          id="door_amount"
          step="1"
          min="0"
          required
          value={v.doorAmount != null ? String(v.doorAmount / 100) : "250"}
        />
      </div>
    </div>
    <label class="fl" for="presale_max">
      Límite de preventa <span style="font-weight:400;color:var(--dim)">(opcional — en blanco = sin límite)</span>
    </label>
    <input
      type="number"
      name="presale_max"
      id="presale_max"
      min="1"
      value={v.presaleMaxQty != null ? String(v.presaleMaxQty) : ""}
      placeholder="120"
    />
    <p class="sub" style="margin:6px 0 0">
      Cuando se acaba la preventa o llega la hora de puertas, el precio cambia solo al de taquilla.
    </p>

    <h2>La entrada</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label class="fl" for="wristbands">
          Brazaletes que llevás <span style="font-weight:400;color:var(--dim)">(opcional)</span>
        </label>
        <input
          type="number"
          name="wristbands"
          id="wristbands"
          min="0"
          value={v.wristbandsStart != null ? String(v.wristbandsStart) : ""}
          placeholder="250"
        />
      </div>
      <div>
        <label class="fl" for="capacity">
          Cupo máximo <span style="font-weight:400;color:var(--dim)">(opcional)</span>
        </label>
        <input
          type="number"
          name="capacity"
          id="capacity"
          min="1"
          value={v.capacityCap != null ? String(v.capacityCap) : ""}
          placeholder="sin límite"
        />
      </div>
    </div>

    <h2>Reembolsos y mensaje</h2>
    <label class="fl" for="refund_policy">
      Política
    </label>
    <select name="refund_policy" id="refund_policy">
      <option value="none" selected={v.refundPolicy === "none"}>
        Sin reembolsos
      </option>
      <option value="24h" selected={v.refundPolicy === "24h"}>
        Reembolso dentro de 24 horas
      </option>
    </select>
    <p class="sub" style="margin:6px 0 0">
      Esto se le muestra al comprador antes de pagar, y se guarda con cada orden — cambiarlo después
      no afecta compras viejas.
    </p>

    <label class="fl" for="thank_you">
      Mensaje de agradecimiento <span style="font-weight:400;color:var(--dim)">(opcional)</span>
    </label>
    <input
      type="text"
      name="thank_you"
      id="thank_you"
      value={v.thankYouNote ?? ""}
      placeholder="¡Gracias por tu compra! Nos vemos ahí."
    />
  </>
);

export const NewEventPage: FC<{ bandName: string; error?: string }> = ({ bandName, error }) => (
  <AdminLayout title={`Nuevo evento — ${bandName}`} bandName={bandName}>
    <h1>Nuevo evento</h1>
    <p class="sub">Se crea como borrador. Nadie puede comprar hasta que lo publiqués.</p>
    {error ? <div class="note crit">{error}</div> : null}
    <form method="post" action="/admin/nuevo" style="max-width:620px">
      <Fields v={{}} />
      <button class="btn" type="submit" style="margin-top:22px">
        Crear evento
      </button>
    </form>
  </AdminLayout>
);

export const EventSettingsPage: FC<{
  bandName: string;
  event: {
    slug: string;
    name: string;
    status: string;
    staffToken: string | null;
    startsAt: string;
  };
  values: EventFormValues;
  origin: string;
  soldCount: number;
  error?: string;
  saved?: boolean;
}> = ({ bandName, event, values, origin, soldCount, error, saved }) => (
  <AdminLayout
    title={`Ajustes — ${event.name}`}
    bandName={bandName}
    active="settings"
    eventSlug={event.slug}
  >
    <h1>Ajustes</h1>
    <p class="sub">
      {event.name} · <span class={`chip ${event.status === "live" ? "ok" : "info"}`}>{event.status}</span>
    </p>
    {saved ? <div class="note ok">Guardado.</div> : null}
    {error ? <div class="note crit">{error}</div> : null}

    <h2>Estado y enlaces</h2>
    <div class="note">
      {event.status === "live" ? (
        <>
          <b>La venta está abierta.</b> Este es el enlace que va en el flyer o la bio:
          <div style="margin-top:8px;font-family:var(--mono);font-size:13px;word-break:break-all;color:var(--text)">
            {origin}/e/{event.slug}
          </div>
        </>
      ) : (
        <>
          <b>Todavía no está publicado.</b> Nadie puede comprar hasta que lo publiqués.
        </>
      )}
      <form method="post" action={`/admin/e/${event.slug}/ajustes/estado`} style="margin-top:12px">
        <input
          type="hidden"
          name="status"
          value={event.status === "live" ? "closed" : "live"}
        />
        <button class={`btn sm ${event.status === "live" ? "ghost" : ""}`} type="submit">
          {event.status === "live" ? "Cerrar la venta" : "Publicar y abrir la venta"}
        </button>
      </form>
    </div>

    <div class="note">
      <b>Enlace del personal de puerta.</b> Quien lo tenga puede registrar entradas — compartilo sólo
      con tu staff.
      {event.staffToken ? (
        <div style="margin-top:8px;font-family:var(--mono);font-size:13px;word-break:break-all;color:var(--text)">
          {origin}/scan/{event.staffToken}
        </div>
      ) : (
        <div style="margin-top:8px" class="muted">
          Todavía no se ha generado.
        </div>
      )}
      <form method="post" action={`/admin/e/${event.slug}/ajustes/token`} style="margin-top:12px">
        <button class="btn sm ghost" type="submit">
          {event.staffToken ? "Generar uno nuevo (el anterior deja de servir)" : "Generar enlace"}
        </button>
      </form>
    </div>

    <form method="post" action={`/admin/e/${event.slug}/ajustes`} style="max-width:620px">
      <Fields v={values} />
      {soldCount > 0 ? (
        <div class="note warn" style="margin-top:18px">
          Ya se vendieron {soldCount} boletos. Cambiar los precios sólo afecta compras nuevas — las
          órdenes existentes conservan el precio que pagaron.
        </div>
      ) : null}
      <button class="btn" type="submit" style="margin-top:22px">
        Guardar cambios
      </button>
    </form>
  </AdminLayout>
);

// ------------------------------------------------------------ band settings

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
    <AdminLayout title={`Ajustes — ${band.name}`} bandName={band.name}>
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

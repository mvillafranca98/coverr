import type { FC } from "hono/jsx";
import { isoToLocalInput } from "../../lib/core";

/**
 * The event form, shared by the create and the settings screens so the two
 * never drift — a field added here shows up on both, under the same name and
 * with the same default.
 *
 * Deliberately plain markup — the visual pass comes later.
 */
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

export const Fields: FC<{ v: Partial<EventFormValues> }> = ({ v }) => (
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

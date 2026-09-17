import type { FC } from "hono/jsx";
import { AdminLayout } from "./admin/layout";
import { formatLpsShort } from "../lib/core";

/**
 * A sale the band makes away from both the link and the door: a friend hands
 * over cash at rehearsal, or tickets go to the sound engineer against his bill.
 *
 * Distinct from the scanner's cash button, which exists for a queue at the
 * entrance — that one takes a count and checks people in on the spot. This one
 * takes names, an amount the admin sets, and a reason, and does *not* check
 * anyone in, because nobody is standing there yet.
 */
export const ManualSalePage: FC<{
  bandName: string;
  event: { slug: string; name: string };
  defaultPrice: number;
  priceLabel: string;
  created?: { shortCode: string; quantity: number; amount: number; orderId: string } | null;
  error?: string;
}> = ({ bandName, event, defaultPrice, priceLabel, created, error }) => (
  <AdminLayout
    title={`Venta manual — ${event.name}`}
    bandName={bandName}
    active="manual"
    eventSlug={event.slug}
  >
    <h1>Venta manual</h1>
    <p class="sub">
      Para cuando cobrás por fuera: alguien te paga en efectivo, o das boletos a cuenta de algo que
      debías.
    </p>

    {error ? <div class="note crit">{error}</div> : null}
    {created ? (
      <div class="note ok">
        <b>Listo — {created.shortCode}</b>
        <div style="margin-top:6px">
          {created.quantity} {created.quantity === 1 ? "boleto" : "boletos"} ·{" "}
          {created.amount > 0 ? formatLpsShort(created.amount) : "sin cobro"}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn sm" href={`/boletos/${created.orderId}`}>
            Ver los códigos QR
          </a>
          <a class="btn sm ghost" href={`/admin/e/${event.slug}/orden/${created.orderId}`}>
            Ver la orden
          </a>
        </div>
      </div>
    ) : null}

    <form method="post" style="max-width:560px">
      <h2>¿Quiénes entran?</h2>
      <p class="sub" style="margin-top:0">
        Un nombre por línea. Cada uno recibe su propio código QR.
      </p>
      <textarea
        name="names"
        id="names"
        rows={4}
        required
        placeholder={"Marvin Mora\nKeyla Discua"}
      ></textarea>

      <h2>¿Cuánto cobraste?</h2>
      <label class="fl" for="unit_price">
        Por persona (L)
      </label>
      <input
        type="number"
        name="unit_price"
        id="unit_price"
        step="0.01"
        min="0"
        required
        value={String(defaultPrice / 100)}
      />
      <p class="sub" style="margin:6px 0 0">
        Viene con el precio de {priceLabel.toLowerCase()}. Cambialo si hiciste un trato, o poné{" "}
        <b>0</b> si es cortesía o canje — en ese caso cuenta como asistencia y no como ingreso.
      </p>

      <label class="fl" for="note">
        ¿Por qué?
      </label>
      <input
        type="text"
        name="note"
        id="note"
        required
        placeholder="Efectivo en el ensayo · A cuenta del sonido · Canje con el fotógrafo"
      />
      <p class="sub" style="margin:6px 0 0">
        Queda guardado con la orden. En un mes esto es lo único que explica de dónde salió.
      </p>

      <h2>Contacto</h2>
      <label class="fl" for="payer_name">
        Nombre de quien te pagó <span style="font-weight:400;color:var(--dim)">(opcional)</span>
      </label>
      <input type="text" name="payer_name" id="payer_name" placeholder="Si es distinto al de arriba" />

      <label class="fl" for="payer_email">
        Correo <span style="font-weight:400;color:var(--dim)">(opcional)</span>
      </label>
      <input type="email" name="payer_email" id="payer_email" />
      <p class="sub" style="margin:6px 0 0">
        Si lo ponés, le mandamos los códigos QR. Si no, se los pasás vos desde la pantalla
        siguiente.
      </p>

      <button class="btn" type="submit" style="margin-top:22px">
        Registrar venta
      </button>
    </form>

    <div class="note" style="margin-top:24px">
      Esto <b>no</b> marca a nadie como que ya entró — el código se escanea en la puerta como
      cualquier otro. Para cobrar en la fila usá el botón de efectivo del enlace de puerta.
    </div>
  </AdminLayout>
);

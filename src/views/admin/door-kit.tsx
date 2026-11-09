import type { FC } from "hono/jsx";
import { DEFAULT_COPIES, MAX_COPIES, MAX_SETLIST_CHARS } from "../../lib/door-kit";
import { AdminLayout } from "./layout";

/**
 * Imprimir: the printouts for the night. Everything is a PDF in black and
 * white, downloaded one at a time or as one pack, each with its own number of
 * copies. One form holds the copies and the paper, and each button sends it to
 * its own file, so the counts set once serve every download.
 */
export const DoorKitPage: FC<{
  bandName: string;
  event: { slug: string; name: string; status: string };
  ticketCount: number;
  musicians: number;
  /** "L250", or null when the event has no price yet. */
  doorPrice: string | null;
  /** What the set list box starts with: this event's, or the last one written. */
  setlist: string;
  setlistSaved: boolean;
  setlistFromEarlier: boolean;
  saved?: boolean;
  error?: string;
}> = (p) => {
  const base = `/admin/e/${p.event.slug}/imprimir`;
  return (
    <AdminLayout
      title={`Imprimir — ${p.event.name}`}
      bandName={p.bandName}
      active="print"
      eventSlug={p.event.slug}
      eventName={p.event.name}
    >
      <h1>Imprimir</h1>
      <p class="sub">
        Todo sale en blanco y negro: se fotocopia limpio y gasta poca tinta. Cada archivo es un PDF
        listo para la impresora o para la fotocopiadora.
      </p>
      {p.saved ? <div class="note ok">Setlist guardado.</div> : null}
      {p.error ? <div class="note crit">{p.error}</div> : null}

      <h2 id="setlist">Setlist</h2>
      <p class="sub">
        Una canción por línea; una línea vacía deja una pausa. Sale en mayúsculas grandes, para
        leerlo desde el piso del escenario.
      </p>
      {p.setlistFromEarlier ? (
        <div class="note">
          Empieza con el setlist de tu evento anterior. Cambialo si hace falta y guardalo para este.
        </div>
      ) : null}
      <form method="post" action={`${base}/setlist`} class="kit-setlist">
        <label class="fl" for="setlist_text">
          Canciones
        </label>
        <textarea id="setlist_text" name="setlist" rows={14} maxlength={MAX_SETLIST_CHARS}>
          {p.setlist}
        </textarea>
        <button class="btn" type="submit">
          Guardar setlist
        </button>
      </form>

      <h2>Descargar</h2>
      <form method="get" action={`${base}/todo.pdf`} class="kit">
        <div class="kit-paper">
          <label class="fl" for="papel">
            Papel
          </label>
          <select id="papel" name="papel">
            <option value="carta">Carta</option>
            <option value="a4">A4</option>
          </select>
        </div>

        <div class="kit-item">
          <div>
            <h3>Lista de preventa</h3>
            <p>
              {p.ticketCount} {p.ticketCount === 1 ? "boleto" : "boletos"}, por nombre, con una
              casilla para marcar quién entra. Es el respaldo si un teléfono se queda sin batería o
              sin señal.
            </p>
          </div>
          <Copies name="lista" value={DEFAULT_COPIES.list} />
          <button class="btn ghost" type="submit" formaction={`${base}/lista.pdf`}>
            Descargar
          </button>
        </div>

        <div class="kit-item">
          <div>
            <h3>QR para la puerta</h3>
            <p>
              Un cartel con un QR grande que abre la compra de este evento: quien llega sin boleto
              lo compra desde su teléfono, por transferencia
              {p.doorPrice ? `, a ${p.doorPrice}` : ""}, sin hacer la fila para pagar.
            </p>
            {p.event.status !== "live" ? (
              <p class="kit-warn">
                La venta está cerrada: el QR abre el evento, pero no deja comprar hasta que la abras
                en Ajustes.
              </p>
            ) : null}
          </div>
          <Copies name="puerta" value={DEFAULT_COPIES.poster} />
          <button class="btn ghost" type="submit" formaction={`${base}/puerta.pdf`}>
            Descargar
          </button>
        </div>

        <div class="kit-item">
          <div>
            <h3>Setlist</h3>
            <p>
              {p.setlistSaved
                ? `Uno por músico: ${p.musicians} según tus integrantes.`
                : "Guardá el setlist de arriba para descargarlo."}
            </p>
          </div>
          {/* Nothing to print until a set list is saved, so no control offers to. */}
          {p.setlistSaved ? (
            <>
              <Copies name="setlist" value={p.musicians} />
              <button class="btn ghost" type="submit" formaction={`${base}/setlist.pdf`}>
                Descargar
              </button>
            </>
          ) : null}
        </div>

        <div class="kit-all">
          <button class="btn" type="submit">
            Descargar todo junto
          </button>
          <p>Un solo PDF con todas las copias, en orden: listas, carteles y setlists.</p>
        </div>
      </form>
    </AdminLayout>
  );
};

const Copies: FC<{ name: string; value: number }> = ({ name, value }) => (
  <div class="kit-copies">
    <label class="fl" for={`copias_${name}`}>
      Copias
    </label>
    <input
      type="number"
      id={`copias_${name}`}
      name={name}
      value={String(value)}
      min="0"
      max={String(MAX_COPIES)}
      step="1"
      inputmode="numeric"
    />
  </div>
);

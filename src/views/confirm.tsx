import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { qrDataUri } from "../lib/qr";
import { formatLpsShort, formatEventDate, formatEventTime } from "../lib/core";

export type ConfirmProps = {
  band: { name: string };
  event: {
    name: string; venue: string; startsAt: string;
    thankYouNote: string | null; refundPolicy: string;
  };
  order: {
    id: string; shortCode: string; quantity: number;
    expectedAmount: number; payerEmail: string;
  };
  attendees: { name: string; note: string | null; qrToken: string }[];
};

export const ConfirmPage: FC<ConfirmProps> = ({ band, event, order, attendees }) => (
  <Layout title={`Tus boletos — ${event.name}`}>
    <header class="done-hero">
      <div class="done-mark" aria-hidden="true">
        ✓
      </div>
      <h1>¡Listo, ya estás adentro!</h1>
      <p>
        {order.quantity === 1
          ? "Tu boleto está abajo."
          : `Tus ${order.quantity} boletos están abajo.`}{" "}
        También te los mandamos a <b>{order.payerEmail}</b>.
      </p>
    </header>

    <div class="keep">
      Guardá una captura de cada código QR. En la entrada te lo escanean desde el teléfono — no
      necesitás imprimir nada.
    </div>

    {attendees.map((a, i) => (
      <div class="tk" key={a.qrToken}>
        <div class="tk-top">
          <div class="tk-name">{a.name}</div>
          <div class="tk-meta">
            Boleto {i + 1} de {attendees.length} · {event.name}
          </div>
          {a.note ? <div class="tk-note">{a.note}</div> : null}
        </div>
        <div class="tk-perf" />
        <div class="tk-qr">
          <img src={qrDataUri(a.qrToken, 520)} alt={`Código QR de ${a.name}`} />
          <div class="tk-code">{order.shortCode}</div>
        </div>
        <a class="tk-save" href={`/t/${a.qrToken}.svg`} download={`boleto-${i + 1}.svg`}>
          Descargar este código
        </a>
      </div>
    ))}

    <div class="summary">
      <h3>Resumen</h3>
      <div class="srow">
        <span>Evento</span>
        <b>{event.name}</b>
      </div>
      <div class="srow">
        <span>Fecha</span>
        <b>
          {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)}
        </b>
      </div>
      <div class="srow">
        <span>Lugar</span>
        <b>{event.venue}</b>
      </div>
      <div class="srow">
        <span>Boletos</span>
        <b>{order.quantity}</b>
      </div>
      <div class="srow">
        <span>Total</span>
        <b>{formatLpsShort(order.expectedAmount)}</b>
      </div>
      <div class="srow">
        <span>Código</span>
        <b>{order.shortCode}</b>
      </div>
    </div>

    {event.thankYouNote ? (
      <div class="summary" style="margin-top:14px">
        <h3>{band.name}</h3>
        <p style="margin:0;font-size:14.5px;color:var(--muted)">{event.thankYouNote}</p>
      </div>
    ) : null}

    {event.refundPolicy === "none" ? null : (
      <p class="hint" style="text-align:center;margin-top:20px">
        <a href={`/reembolso/${order.id}`} style="color:var(--muted)">
          Solicitar un reembolso
        </a>
      </p>
    )}

    <footer>
      <div>{band.name} · Coverr</div>
    </footer>
  </Layout>
);

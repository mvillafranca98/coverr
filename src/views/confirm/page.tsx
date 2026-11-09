import type { FC } from "hono/jsx";
import { formatEventDate, formatEventTime, formatLpsShort } from "../../lib/core";
import { qrDataUri } from "../../lib/qr";
import { Wordmark } from "../brand";
import { InlineScript } from "../inline-script";
import { Layout } from "../layout";
import { LegalLinks } from "../legal/links";
import { ticketScript } from "./ticket-script";

export type ConfirmProps = {
  band: { name: string };
  event: {
    name: string;
    venue: string;
    startsAt: string;
    thankYouNote: string | null;
    /** Only used to clear the buy form's saved draft, which is keyed by slug. */
    slug: string;
  };
  order: {
    id: string;
    shortCode: string;
    quantity: number;
    expectedAmount: number;
    payerEmail: string;
    /** The policy this order was sold under, not the event's current one. */
    refundPolicy: string;
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
      // The data-* attributes are the script's whole input: it reads the card
      // rather than being handed a second copy of the order in JavaScript.
      <div
        class="tk"
        key={a.qrToken}
        data-token={a.qrToken}
        data-name={a.name}
        data-note={a.note ?? ""}
        data-index={String(i + 1)}
        data-total={String(attendees.length)}
      >
        <div class="tk-head">
          <span>{band.name}</span>
          <span>
            Boleto {i + 1} de {attendees.length}
          </span>
        </div>
        <div class="tk-top">
          <div class="tk-event">{event.name}</div>
          <div class="tk-name">{a.name}</div>
          {a.note ? <div class="tk-note">{a.note}</div> : null}
          <dl class="tk-meta">
            <div class="wide">
              <dt>Fecha</dt>
              <dd>{formatEventDate(event.startsAt)}</dd>
            </div>
            <div>
              <dt>Lugar</dt>
              <dd>{event.venue}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{formatEventTime(event.startsAt)}</dd>
            </div>
          </dl>
        </div>
        <div class="tk-perf" />
        <div class="tk-qr">
          <div class="tk-qr-frame">
            <img src={qrDataUri(a.qrToken, 520)} alt={`Código QR de ${a.name}`} />
          </div>
          <div class="tk-code">{order.shortCode}</div>
        </div>
        <div class="tk-actions">
          {/* Revealed by the script only once the browser confirms it can
              share a file. On iOS this one sheet carries both Save Image and
              WhatsApp, which is the whole point. */}
          <button type="button" class="tk-save share" data-share hidden>
            Compartir
          </button>
          {/* Works with no JavaScript at all, pointing at the bare QR PNG.
              The script upgrades it in place to the composed ticket. */}
          <a
            class="tk-save"
            data-download
            href={`/t/${a.qrToken}.png`}
            download={`boleto-${i + 1}.png`}
          >
            Descargar
          </a>
        </div>
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
      <div class="summary">
        <h3>{band.name}</h3>
        <p>{event.thankYouNote}</p>
      </div>
    ) : null}

    {order.refundPolicy === "none" ? null : (
      <p class="hint refund-link">
        <a href={`/reembolso/${order.id}`}>Solicitar un reembolso</a>
      </p>
    )}

    <footer>
      <Wordmark size={20} />
      <div>{band.name} · Coverr</div>
      <LegalLinks />
    </footer>

    <InlineScript
      code={ticketScript({
        eventSlug: event.slug,
        bandName: band.name,
        eventName: event.name,
        whenLine: `${formatEventDate(event.startsAt)} · ${formatEventTime(event.startsAt)}`,
        venue: event.venue,
        shortCode: order.shortCode,
        total: attendees.length,
      })}
    />
  </Layout>
);

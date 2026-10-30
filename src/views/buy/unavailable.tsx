import type { FC } from "hono/jsx";
import { MessagePage } from "../message";

/** What the event's own link shows when it cannot take an order. */
type Props = {
  band: { name: string };
  event: { name: string };
};

/**
 * The `sales` switch is off. No price and no bank account on the page,
 * because the reason for throwing that switch is usually that one of those
 * two was wrong.
 */
export const SalesPausedPage: FC<Props> = ({ band, event }) => (
  <MessagePage
    title={`La venta está pausada — ${event.name}`}
    label={band.name}
    headline="La venta está pausada"
  >
    <p class="blurb">Es temporal. Volvé a intentarlo en un rato, o escribile a la banda.</p>
    <p class="blurb">Si ya transferiste, guardá tu comprobante — escribinos y lo resolvemos.</p>
  </MessagePage>
);

/** The event is still a draft, or the band has closed or settled it. */
export const SaleNotOpenPage: FC<Props> = ({ band, event }) => (
  <MessagePage
    title={`Esta venta no está abierta — ${event.name}`}
    label={band.name}
    headline="Esta venta no está abierta"
  >
    <p class="blurb">Escribinos si creés que es un error.</p>
  </MessagePage>
);

/** Every price rule is used up or out of its window. */
export const SoldOutPage: FC<Props> = ({ band, event }) => (
  <MessagePage
    title={`Boletos agotados — ${event.name}`}
    label={band.name}
    headline="Boletos agotados"
  >
    <p class="blurb">Ya no hay boletos disponibles en línea.</p>
  </MessagePage>
);

import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { LegalLinks } from "./legal/links";
import { formatLpsShort, formatEventDate } from "../lib/core";

/**
 * Buyer-facing refund request.
 *
 * Coverr never holds the money, so this cannot move a single lempira — it
 * records the ask, alerts the band, and lets them mark what they decided. The
 * transfer back happens in their banking app like everything else.
 */

type Common = {
  band: { name: string; contactEmail: string };
  event: { name: string; startsAt: string };
  order: { shortCode: string; quantity: number; expectedAmount: number };
};

const Head: FC<Common> = ({ band, event, order }) => (
  <header class="hero">
    <div class="band">{band.name}</div>
    <h1>Reembolso</h1>
    <div class="when">
      <div>
        <b>{event.name}</b> · {formatEventDate(event.startsAt)}
      </div>
      <div>
        {order.shortCode} · {order.quantity}{" "}
        {order.quantity === 1 ? "boleto" : "boletos"} · {formatLpsShort(order.expectedAmount)}
      </div>
    </div>
  </header>
);

const Contact: FC<{ email: string }> = ({ email }) => (
  <p class="hint">
    Si creés que hay un error, escribile a la banda a{" "}
    <a href={`mailto:${email}`} style="color:var(--accent-text)">
      {email}
    </a>
    .
  </p>
);

export const RefundRequestPage: FC<
  Common & { policyText: string | null; error?: string }
> = ({ band, event, order, policyText, error }) => (
  <Layout title={`Reembolso — ${event.name}`}>
    <Head band={band} event={event} order={order} />
    <section class="step">
      {error ? <div class="err" style="margin-bottom:14px">{error}</div> : null}
      {policyText ? <p class="hint">{policyText}</p> : null}
      <form method="post">
        <label class="fl" for="reason">
          ¿Por qué querés el reembolso?
        </label>
        <textarea
          name="reason"
          id="reason"
          rows={4}
          required
          placeholder="Contanos brevemente qué pasó."
        ></textarea>
        <button type="submit" class="submit">
          Enviar solicitud
        </button>
      </form>
      <p class="hint" style="margin-top:16px">
        Esto le avisa a la banda. Ellos revisan y te contactan — el dinero lo devuelven ellos
        directamente, Coverr nunca lo tuvo.
      </p>
    </section>
    <footer>
      <div>{band.name} · Coverr</div>
      <LegalLinks />
    </footer>
  </Layout>
);

export const RefundSentPage: FC<Common> = ({ band, event, order }) => (
  <Layout title={`Solicitud enviada — ${event.name}`}>
    <Head band={band} event={event} order={order} />
    <section class="step">
      <div class="free" style="margin-top:0">
        <span>✓</span>
        <div>
          Le avisamos a {band.name}. Te van a contactar al correo con el que compraste.
        </div>
      </div>
      <Contact email={band.contactEmail} />
    </section>
    <footer>
      <div>{band.name} · Coverr</div>
      <LegalLinks />
    </footer>
  </Layout>
);

/** Policy says no, the window closed, or it was already handled. */
export const RefundClosedPage: FC<Common & { headline: string; detail: string }> = ({
  band,
  event,
  order,
  headline,
  detail,
}) => (
  <Layout title={`Reembolso — ${event.name}`}>
    <Head band={band} event={event} order={order} />
    <section class="step">
      <div class="fee" style="margin-top:0">
        <span>!</span>
        <div>
          <b>{headline}</b>
          <div style="margin-top:4px">{detail}</div>
        </div>
      </div>
      <Contact email={band.contactEmail} />
    </section>
    <footer>
      <div>{band.name} · Coverr</div>
      <LegalLinks />
    </footer>
  </Layout>
);

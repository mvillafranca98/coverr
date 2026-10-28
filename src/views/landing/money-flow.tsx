import type { FC } from "hono/jsx";
import { BANKS } from "../../lib/core";
import { Monogram } from "../brand";

/** The real banks, minus the "Otro banco" catch-all, which is not a bank. */
const BANK_NAMES = BANKS.filter((b) => b.code !== "OTHER").map((b) => b.label);

/**
 * The one fact that makes Coverr what it is, drawn: the transfer goes from
 * the buyer's banking app straight to the band's account, and Coverr sits
 * beside that path, not on it. See CLAUDE.md — this is what keeps the product
 * a SaaS tool rather than a money transmitter, so the diagram must never
 * suggest otherwise.
 *
 * Hidden from assistive tech: the paragraph above it says the same thing in
 * words, and a diagram read box by box would only repeat it.
 */
export const MoneyFlow: FC = () => (
  <div class="flow" aria-hidden="true" data-reveal>
    <div class="flow__node">
      <span class="flow__k">Comprador</span>
      <span class="flow__v">Transfiere desde la app de su banco</span>
    </div>
    <div class="flow__wire">
      <span class="flow__amount">L250</span>
      <i class="flow__packet" />
    </div>
    <div class="flow__node flow__node--band">
      <span class="flow__k">Cuenta de tu banda</span>
      <span class="flow__v">{BANK_NAMES.join(" · ")}</span>
    </div>
    <div class="flow__side">
      <Monogram size={26} />
      <span>
        <b>Coverr</b> entrega los QR, revisa el comprobante y lleva las cuentas.
      </span>
      <span class="flow__never">No toca el dinero</span>
    </div>
  </div>
);

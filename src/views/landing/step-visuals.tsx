import type { FC } from "hono/jsx";

/**
 * One small drawing per step of "Cómo funciona", built from HTML so it stays
 * sharp at any size and costs nothing to load. Each is a sketch of the real
 * screen, not a screenshot, and uses the names of the show the page picked.
 *
 * Decorative: every step's own heading and paragraph already say what the
 * drawing shows.
 */

export const ShareLinkVisual: FC<{ slug: string }> = ({ slug }) => (
  <div class="sv" aria-hidden="true">
    <div class="sv-url">
      <span>…/e/</span>
      <b>{slug}</b>
      <span class="sv-chip">Copiar</span>
    </div>
  </div>
);

export const TransferVisual: FC = () => (
  <div class="sv sv--row" aria-hidden="true">
    <div class="sv-receipt">
      <span class="sv-ok">✓</span>
      <span>
        Transferencia
        <b>L250.00</b>
      </span>
    </div>
    <span class="sv-arrow">→</span>
    <div class="sv-qr">
      <i />
      <span>QR listo</span>
    </div>
  </div>
);

export const DoorVisual: FC = () => (
  <div class="sv" aria-hidden="true">
    <div class="sv-verdict">
      <b>Adelante</b>
      <span>Boleto 1 de 2 · 7QKG3F</span>
    </div>
  </div>
);

export const AccountsVisual: FC = () => (
  <div class="sv sv-bars" aria-hidden="true">
    <div>
      <span>Preventa</span>
      <i style="--w:.86" />
    </div>
    <div>
      <span>Taquilla</span>
      <i style="--w:.62" />
    </div>
    <div>
      <span>Efectivo</span>
      <i style="--w:.44" />
    </div>
  </div>
);

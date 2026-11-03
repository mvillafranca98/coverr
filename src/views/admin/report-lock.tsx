import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import type { UnlockPrice } from "../../lib/settlement";
import { CONTACT_EMAIL } from "../legal/constants";
import { CopyLink } from "./copy-link";

export type FeeAccount = { bank: string; holderName: string; accountNumber: string };

/**
 * What stands in for the member split until the band unlocks it: the price,
 * and either the free unlock or how to pay.
 *
 * Paying is a transfer to Coverr's account and a screenshot of it, the same
 * motion a buyer makes for a ticket, and like a buyer the band is not kept
 * waiting: the report opens on the upload. The account sits outside the yellow
 * note, on the page's own surface, because the band side's greys are only
 * legible there.
 */
export const ReportLock: FC<{
  slug: string;
  price: UnlockPrice;
  feeAccount: FeeAccount | null;
}> = ({ slug, price, feeAccount }) => {
  const action = `/admin/e/${slug}/dinero/desbloquear`;
  return (
    <>
      <div class="note warn">
        <b>Lo que le toca a cada integrante está bloqueado.</b>
        <p style="margin:8px 0 0">
          Todo lo demás — preventa, códigos QR, entrada, ventas en efectivo, el resumen en vivo — es
          gratis y siempre lo va a ser. El reparto final de este evento cuesta{" "}
          <b>{formatLpsShort(price.bracket.amount)}</b>
          {price.waiver === "free_pass" ? " (pero tenés pase libre, así que no pagás)" : ""}
          {price.waiver === "free_first" ? " (pero tu primer evento es gratis)" : ""}.
        </p>
        {price.waiver ? (
          <form method="post" action={action} style="margin-top:12px">
            <button class="btn" type="submit">
              Desbloquear gratis
            </button>
          </form>
        ) : null}
      </div>

      {price.waiver ? null : feeAccount ? (
        <div class="fee-pay">
          <p style="margin-top:0">
            Transferí <b>{formatLpsShort(price.amount)}</b> a esta cuenta y subí la captura. El
            reporte se abre en cuanto la subís.
          </p>
          <dl class="kv">
            <dt>Banco</dt>
            <dd>{feeAccount.bank}</dd>
            <dt>A nombre de</dt>
            <dd>{feeAccount.holderName}</dd>
            <dt>Monto</dt>
            <dd>{formatLpsShort(price.amount)}</dd>
          </dl>
          <CopyLink url={feeAccount.accountNumber} />
          <form method="post" action={action} enctype="multipart/form-data" style="margin-top:16px">
            <label class="fl" for="proof">
              Captura de la transferencia
            </label>
            <input type="file" name="proof" id="proof" required accept="image/*,application/pdf" />
            <button class="btn" type="submit" style="margin-top:14px">
              Subir y desbloquear
            </button>
          </form>
          <p class="muted" style="margin-bottom:0">
            Si algo no cuadra con la transferencia, te escribimos. El reporte no se vuelve a cerrar.
          </p>
        </div>
      ) : (
        <div class="note crit" style="margin-top:12px">
          El cobro todavía no está listo. Escribinos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </div>
      )}
    </>
  );
};

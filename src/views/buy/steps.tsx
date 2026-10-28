import type { FC } from "hono/jsx";
import { ACH_FEE_CENTAVOS, BANKS, bankLabel, formatLpsShort } from "../../lib/core";

export type BankAccount = {
  id: string;
  bank: string;
  accountNumber: string;
  holderName: string;
  isDefault: number;
};

type ConsentStepProps = { refundPolicy: string; refundPolicyText: string | null };

type BankStepProps = {
  defaultAccount: BankAccount;
  /** Banks the band actually holds an account with — the rest pay an ACH fee. */
  banksWithAccounts: Set<string>;
  shortCode: string;
};

/** Step 01. The running total is what makes the amount to transfer unambiguous. */
export const QuantityStep: FC<{ rule: { label: string; amount: number } }> = ({ rule }) => (
  <section class="step">
    <div class="step-h">
      <span class="step-n">01</span>
      <h2>¿Cuántos boletos?</h2>
    </div>
    <p class="hint">
      {rule.label} · {formatLpsShort(rule.amount)} por persona
    </p>
    <div class="qty">
      <button type="button" class="qty-btn" id="minus" aria-label="Quitar un boleto">
        −
      </button>
      <span class="qty-val" id="qtyVal">
        1
      </span>
      <button type="button" class="qty-btn" id="plus" aria-label="Agregar un boleto">
        +
      </button>
      <input type="hidden" name="quantity" id="qty" value="1" />
      <span class="qty-total">
        <b id="qtyTotal">{formatLpsShort(rule.amount)}</b>
        <span>total a transferir</span>
      </span>
    </div>
    <p class="hint qty-echo" id="qtyEcho" aria-live="polite">
      Vas a poner el nombre de 1 persona más abajo.
    </p>
  </section>
);

/**
 * Step 02. Picking a bank swaps in that bank's account so the buyer transfers
 * within their own bank and pays no ACH fee. The detail code below it is a
 * matching hint: never required, never validated, never blocks the QR.
 */
export const BankStep: FC<BankStepProps> = ({ defaultAccount, banksWithAccounts, shortCode }) => (
  <section class="step">
    <div class="step-h">
      <span class="step-n">02</span>
      <h2>¿Con qué banco vas a pagar?</h2>
    </div>
    <p class="hint">Te mostramos la cuenta correcta para que no pagués comisión.</p>
    <div class="banks">
      {BANKS.map((b) => (
        <label class="bank" key={b.code}>
          <input type="radio" name="bank" value={b.code} checked={b.code === defaultAccount.bank} />
          <span>{b.label}</span>
        </label>
      ))}
    </div>

    <div class="acct">
      <div class="acct-top">
        <div class="acct-label">Número de cuenta</div>
        <div class="acct-num" id="acctNum">
          {defaultAccount.accountNumber}
        </div>
        <div class="acct-holder" id="acctHolder">
          {defaultAccount.holderName}
        </div>
        <div class="acct-bank" id="acctBank">
          {bankLabel(defaultAccount.bank)}
        </div>
      </div>
      <button type="button" class="copy" id="copyAcct">
        Copiar número de cuenta
      </button>
    </div>

    <div class="free" id="freeBox" hidden={!banksWithAccounts.has(defaultAccount.bank)}>
      <span>✓</span>
      <div>Mismo banco — tu transferencia no paga comisión.</div>
    </div>
    <div class="fee" id="feeBox" hidden>
      <span>!</span>
      <div>
        Tu banco te va a cobrar una comisión de <b>~{formatLpsShort(ACH_FEE_CENTAVOS)}</b> por
        transferir a otro banco (ACH). El precio del boleto no cambia.
      </div>
    </div>

    <button type="button" class="chipcopy" id="copyCode">
      <div class="chipcopy-text">
        <code>{shortCode}</code>
        <small>
          Opcional: pegá esto en “Detalle” al hacer la transferencia. Nos ayuda a confirmarte más
          rápido.
        </small>
      </div>
      <span class="chip-action">Copiar</span>
    </button>
  </section>
);

/** Step 03. Image or PDF — whatever their banking app produced. */
export const ProofStep: FC = () => (
  <section class="step">
    <div class="step-h">
      <span class="step-n">03</span>
      <h2>Subí tu comprobante</h2>
    </div>
    <p class="hint">Ya que hiciste la transferencia, subí la captura o el PDF del comprobante.</p>
    <label class="drop" id="drop">
      <input
        type="file"
        name="proof"
        id="proof"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
      />
      <div class="drop-t">Tocá para elegir el archivo</div>
      <div class="drop-s">Captura de pantalla o PDF</div>
      <div class="drop-s name" id="dropName"></div>
    </label>
  </section>
);

/** Step 04. Where the QR codes get sent. */
export const PayerStep: FC = () => (
  <section class="step">
    <div class="step-h">
      <span class="step-n">04</span>
      <h2>Tus datos</h2>
    </div>
    <p class="hint">Aquí te mandamos los códigos QR.</p>
    <label class="fl" for="payer_name">
      Tu nombre
    </label>
    <input type="text" name="payer_name" id="payer_name" required autocomplete="name" />
    <label class="fl" for="payer_email">
      Correo electrónico
    </label>
    <input type="email" name="payer_email" id="payer_email" required autocomplete="email" />
    <label class="fl" for="payer_phone">
      Teléfono <span>(opcional)</span>
    </label>
    <input type="tel" name="payer_phone" id="payer_phone" autocomplete="tel" />
  </section>
);

/**
 * Step 05. One QR per person, because a group of four arrives separately.
 * The <template> is cloned by the client script as the quantity goes up.
 */
export const AttendeesStep: FC = () => (
  <section class="step">
    <div class="step-h">
      <span class="step-n">05</span>
      <h2>¿Quiénes entran?</h2>
    </div>
    <p class="hint">Un código QR por persona. Poné el nombre como aparece en su identidad.</p>
    <div id="atts">
      <div class="att">
        <div class="att-n">Persona 1</div>
        <label class="fl lbl-name" for="attendee_name_1">
          Nombre completo
        </label>
        <input type="text" class="att-name" name="attendee_name_1" id="attendee_name_1" required />
        <label class="fl lbl-note" for="attendee_note_1">
          Nota <span>(opcional)</span>
        </label>
        <textarea
          class="att-note"
          name="attendee_note_1"
          id="attendee_note_1"
          rows={1}
          placeholder="Ej: me dicen Mando"
        ></textarea>
      </div>
    </div>
    {/* Inert until cloned. The labels carry no `for` and the inputs no `id`
        because the template is stamped once per extra attendee and duplicate
        ids would be worse than none — form-script.ts assigns both at clone
        time, giving attendee_name_2, _3 and so on. Verified in a browser:
        every cloned field is properly associated. */}
    <template id="attTpl">
      <div class="att">
        <div class="att-n">Persona</div>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: wired up on clone */}
        <label class="fl lbl-name">Nombre completo</label>
        <input type="text" class="att-name" required />
        {/* biome-ignore lint/a11y/noLabelWithoutControl: wired up on clone */}
        <label class="fl lbl-note">
          Nota <span>(opcional)</span>
        </label>
        <textarea class="att-note" rows={1} placeholder="Ej: me dicen Mando"></textarea>
      </div>
    </template>
  </section>
);

/**
 * The refund policy is shown before purchase and consented to explicitly — the
 * exact wording of that checkbox is frozen onto the order, so a later change
 * never moves a window a buyer was already shown.
 *
 * The terms and privacy notice sit outside the label on purpose: a link inside
 * a <label> toggles the checkbox instead of opening, which would make reading
 * what you are agreeing to actively hard. They attach to the submit button
 * instead, which is the moment of acceptance (LEG-03).
 */
export const ConsentStep: FC<ConsentStepProps> = ({ refundPolicy, refundPolicyText }) => (
  <section class="step">
    <label class="consent">
      <input type="checkbox" name="consent" value="1" required />
      <span>
        {refundPolicy === "none"
          ? "Entiendo que esta compra no admite reembolsos."
          : (refundPolicyText ??
            "Puedo solicitar reembolso dentro de las 24 horas siguientes a mi compra.")}
      </span>
    </label>
    <p class="accept">
      Al confirmar aceptás los <a href="/terminos">términos</a> y el{" "}
      <a href="/privacidad">aviso de privacidad</a>. Tenés que tener 18 años o más.
    </p>
    <button type="submit" class="submit" id="submitBtn">
      Confirmar compra
    </button>
  </section>
);

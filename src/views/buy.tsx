import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import {
  BANKS,
  bankLabel,
  formatLpsShort,
  formatEventDate,
  formatEventTime,
  ACH_FEE_CENTAVOS,
} from "../lib/core";

export type BuyProps = {
  band: { name: string; slug: string };
  event: {
    name: string;
    slug: string;
    venue: string;
    startsAt: string;
    doorsAt: string | null;
    description: string | null;
    musicType: string | null;
    refundPolicy: string;
    refundPolicyText: string | null;
  };
  rule: { id: string; label: string; amount: number };
  accounts: { id: string; bank: string; accountNumber: string; holderName: string; isDefault: number }[];
  shortCode: string;
  origin: string;
  error?: string;
};

export const BuyPage: FC<BuyProps> = ({ band, event, rule, accounts, shortCode, origin, error }) => {
  const defaultAccount = accounts.find((a) => a.isDefault === 1) ?? accounts[0]!;
  const banksWithAccounts = new Set(accounts.map((a) => a.bank));

  const title = `${event.name} — ${band.name}`;
  const description = `${formatEventDate(event.startsAt)} · ${event.venue} · ${rule.label} ${formatLpsShort(rule.amount)}`;

  // Client-side state that the server can't hold: the buyer leaves for their
  // bank app mid-flow, so everything typed so far is mirrored into localStorage
  // and restored on return. Losing a half-filled form after they've already
  // sent the money is the worst failure this page has.
  const script = `
(function(){
  var KEY = 'coverr:${event.slug}';
  var qty = document.getElementById('qty');
  var qtyVal = document.getElementById('qtyVal');
  var qtyTotal = document.getElementById('qtyTotal');
  var minus = document.getElementById('minus');
  var plus = document.getElementById('plus');
  var atts = document.getElementById('atts');
  var tpl = document.getElementById('attTpl');
  var UNIT = ${rule.amount};
  var MAX = 10;

  var ACCOUNTS = ${JSON.stringify(
    Object.fromEntries(
      accounts.map((a) => [a.bank, { n: a.accountNumber, h: a.holderName, b: bankLabel(a.bank) }]),
    ),
  )};
  var DEFAULT_BANK = ${JSON.stringify(defaultAccount.bank)};

  function money(c){
    var w = Math.floor(c/100), r = c%100;
    var s = w.toLocaleString('en-US');
    return r === 0 ? 'L'+s : 'L'+s+'.'+String(r).padStart(2,'0');
  }

  function renderQty(){
    var n = parseInt(qty.value,10) || 1;
    qtyVal.textContent = n;
    qtyTotal.textContent = money(n*UNIT);
    var echo = document.getElementById('qtyEcho');
    echo.textContent = n === 1
      ? 'Vas a poner el nombre de 1 persona más abajo.'
      : 'Vas a poner los nombres de las ' + n + ' personas más abajo.';
    minus.disabled = n <= 1;
    plus.disabled = n >= MAX;
    var blocks = atts.querySelectorAll('.att');
    for (var i = blocks.length; i < n; i++){
      var clone = tpl.content.cloneNode(true);
      var idx = i + 1;
      clone.querySelector('.att-n').textContent = 'Persona ' + idx;
      var nm = clone.querySelector('.att-name');
      nm.name = 'attendee_name_' + idx;
      nm.id = 'attendee_name_' + idx;
      var nt = clone.querySelector('.att-note');
      nt.name = 'attendee_note_' + idx;
      nt.id = 'attendee_note_' + idx;
      clone.querySelector('.lbl-name').htmlFor = 'attendee_name_' + idx;
      clone.querySelector('.lbl-note').htmlFor = 'attendee_note_' + idx;
      atts.appendChild(clone);
    }
    while (atts.querySelectorAll('.att').length > n) atts.removeChild(atts.lastElementChild);
    atts.querySelectorAll('.att-name').forEach(function(el){ el.required = true; });
    save();
  }

  minus.addEventListener('click', function(){ qty.value = Math.max(1,(parseInt(qty.value,10)||1)-1); renderQty(); });
  plus.addEventListener('click',  function(){ qty.value = Math.min(MAX,(parseInt(qty.value,10)||1)+1); renderQty(); });

  // Bank picker: show that bank's account so the transfer stays same-bank and
  // free. "Otro" falls back to the default account plus an honest fee warning.
  var acctNum = document.getElementById('acctNum');
  var acctHolder = document.getElementById('acctHolder');
  var acctBank = document.getElementById('acctBank');
  var feeBox = document.getElementById('feeBox');
  var freeBox = document.getElementById('freeBox');

  function renderBank(){
    var sel = document.querySelector('input[name=bank]:checked');
    var code = sel ? sel.value : DEFAULT_BANK;
    var match = ACCOUNTS[code];
    var acct = match || ACCOUNTS[DEFAULT_BANK];
    acctNum.textContent = acct.n;
    acctHolder.textContent = acct.h;
    acctBank.textContent = acct.b;
    feeBox.hidden = !!match;
    freeBox.hidden = !match;
    save();
  }
  document.querySelectorAll('input[name=bank]').forEach(function(el){
    el.addEventListener('change', renderBank);
  });

  function copy(text, btn, okLabel){
    var done = function(){
      var old = btn.dataset.label || btn.textContent;
      btn.dataset.label = old;
      btn.classList.add('done');
      btn.textContent = okLabel;
      setTimeout(function(){ btn.classList.remove('done'); btn.textContent = old; }, 1800);
    };
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(done, function(){ fallback(text); done(); });
    } else { fallback(text); done(); }
  }
  function fallback(text){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e){}
    document.body.removeChild(ta);
  }

  document.getElementById('copyAcct').addEventListener('click', function(){
    copy(acctNum.textContent.trim(), this, '¡Copiado!');
  });
  var chip = document.getElementById('copyCode');
  chip.addEventListener('click', function(){
    var label = chip.querySelector('.chip-action');
    copy(${JSON.stringify(shortCode)}, label, 'Copiado');
    chip.classList.add('done');
  });

  // File picker feedback
  var file = document.getElementById('proof');
  var drop = document.getElementById('drop');
  var dropName = document.getElementById('dropName');
  file.addEventListener('change', function(){
    if (file.files && file.files[0]){
      drop.classList.add('has');
      dropName.textContent = file.files[0].name;
    } else {
      drop.classList.remove('has');
      dropName.textContent = '';
    }
  });

  // ---- persistence across the trip to the bank app ----
  var form = document.getElementById('buyForm');
  function save(){
    try {
      var data = {};
      form.querySelectorAll('input,textarea').forEach(function(el){
        if (el.type === 'file') return;
        if (el.type === 'radio'){ if (el.checked) data[el.name] = el.value; }
        else if (el.type === 'checkbox'){ data[el.name] = el.checked; }
        else if (el.name) data[el.name] = el.value;
      });
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch(e){}
  }
  function restore(){
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (data.quantity) { qty.value = data.quantity; renderQty(); }
      Object.keys(data).forEach(function(name){
        var els = form.querySelectorAll('[name="'+CSS.escape(name)+'"]');
        els.forEach(function(el){
          if (el.type === 'radio') el.checked = (el.value === data[name]);
          else if (el.type === 'checkbox') el.checked = !!data[name];
          else if (el.type !== 'file') el.value = data[name];
        });
      });
      return true;
    } catch(e){ return false; }
  }

  form.addEventListener('input', save);
  form.addEventListener('change', save);
  form.addEventListener('submit', function(){
    try { localStorage.removeItem(KEY); } catch(e){}
    var btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
  });

  restore();
  renderQty();
  renderBank();
})();`;

  return (
    <Layout title={title} description={description} ogUrl={`${origin}/e/${event.slug}`}>
      <header class="hero">
        <div class="band">{band.name}</div>
        <h1>{event.name}</h1>
        <div class="when">
          <div>
            <b>{formatEventDate(event.startsAt)}</b> · {formatEventTime(event.startsAt)}
            {event.doorsAt ? ` · puertas ${formatEventTime(event.doorsAt)}` : ""}
          </div>
          <div>{event.venue}</div>
          {event.musicType ? <div>{event.musicType}</div> : null}
        </div>
        {event.description ? <p class="blurb">{event.description}</p> : null}
      </header>

      {error ? <div class="err">{error}</div> : null}

      <form id="buyForm" method="post" action={`/e/${event.slug}/comprar`} enctype="multipart/form-data">
        <input type="hidden" name="short_code" value={shortCode} />
        <input type="hidden" name="price_rule_id" value={rule.id} />

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
          <p class="hint" id="qtyEcho" style="margin:12px 0 0">
            Vas a poner el nombre de 1 persona más abajo.
          </p>
        </section>

        <section class="step">
          <div class="step-h">
            <span class="step-n">02</span>
            <h2>¿Con qué banco vas a pagar?</h2>
          </div>
          <p class="hint">Te mostramos la cuenta correcta para que no pagués comisión.</p>
          <div class="banks">
            {BANKS.map((b) => (
              <label class="bank" key={b.code}>
                <input
                  type="radio"
                  name="bank"
                  value={b.code}
                  checked={b.code === defaultAccount.bank}
                />
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
            <div style="flex:1">
              <code>{shortCode}</code>
              <small>
                Opcional: pegá esto en “Detalle” al hacer la transferencia. Nos ayuda a confirmarte
                más rápido.
              </small>
            </div>
            <span class="chip-action" style="font-size:13px;font-weight:600;color:var(--accent)">
              Copiar
            </span>
          </button>
        </section>

        <section class="step">
          <div class="step-h">
            <span class="step-n">03</span>
            <h2>Subí tu comprobante</h2>
          </div>
          <p class="hint">
            Ya que hiciste la transferencia, subí la captura o el PDF del comprobante.
          </p>
          <label class="drop" id="drop">
            <input
              type="file"
              name="proof"
              id="proof"
              accept="image/*,application/pdf"
              required
            />
            <div class="drop-t">Tocá para elegir el archivo</div>
            <div class="drop-s">Captura de pantalla o PDF</div>
            <div class="drop-s name" id="dropName"></div>
          </label>
        </section>

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
              <input
                type="text"
                class="att-name"
                name="attendee_name_1"
                id="attendee_name_1"
                required
              />
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
          <template id="attTpl">
            <div class="att">
              <div class="att-n">Persona</div>
              <label class="fl lbl-name">Nombre completo</label>
              <input type="text" class="att-name" required />
              <label class="fl lbl-note">
                Nota <span>(opcional)</span>
              </label>
              <textarea class="att-note" rows={1} placeholder="Ej: me dicen Mando"></textarea>
            </div>
          </template>
        </section>

        <section class="step">
          <label class="consent">
            <input type="checkbox" name="consent" value="1" required />
            <span>
              {event.refundPolicy === "none"
                ? "Entiendo que esta compra no admite reembolsos."
                : (event.refundPolicyText ??
                  "Puedo solicitar reembolso dentro de las 24 horas siguientes a mi compra.")}
            </span>
          </label>
          <button type="submit" class="submit" id="submitBtn">
            Confirmar compra
          </button>
        </section>
      </form>

      <footer>
        <div>{band.name} · Coverr</div>
      </footer>

      <script dangerouslySetInnerHTML={{ __html: script }} />
    </Layout>
  );
};

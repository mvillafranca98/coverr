/**
 * Client-side state the server cannot hold.
 *
 * The buyer leaves for their bank app in the middle of this form, so every
 * field is mirrored into localStorage and restored on return. Losing a
 * half-filled form after they have already sent the money is the worst failure
 * this page has, which is why the script is inline rather than a second
 * request: on a bad connection the page must be usable the moment it paints.
 *
 * Written as ES5 in a template literal on purpose — it ships to whatever
 * browser a buyer has, with no build step between here and them.
 */
export type ScriptAccount = { n: string; h: string; b: string };

export function buyFormScript(i: {
  eventSlug: string;
  defaultBank: string;
  shortCode: string;
  unitAmount: number;
  /** Keyed by bank code: account number, holder, and the bank's display label. */
  accountsByBank: Record<string, ScriptAccount>;
}): string {
  return `
(function(){
  var KEY = 'coverr:${i.eventSlug}';
  var qty = document.getElementById('qty');
  var qtyVal = document.getElementById('qtyVal');
  var qtyTotal = document.getElementById('qtyTotal');
  var minus = document.getElementById('minus');
  var plus = document.getElementById('plus');
  var atts = document.getElementById('atts');
  var tpl = document.getElementById('attTpl');
  var UNIT = ${i.unitAmount};
  var MAX = 10;

  var ACCOUNTS = ${JSON.stringify(i.accountsByBank)};
  var DEFAULT_BANK = ${JSON.stringify(i.defaultBank)};

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
    copy(${JSON.stringify(i.shortCode)}, label, 'Copiado');
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
}

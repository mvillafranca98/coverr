/* Coverr door scanner.
 *
 * Design constraints, all from the venue rather than the browser:
 *  - Signal is unreliable and a queue forms in seconds, so every scan is
 *    validated against a cached manifest on-device. The network is only used
 *    to sync afterwards.
 *  - Staff are holding a phone in one hand and a wristband in the other, so
 *    the result must be readable at arm's length: colour first, name second.
 *  - iOS Safari has no BarcodeDetector, so jsQR is bundled as the fallback.
 *    A scanner that only works on Android is not a scanner.
 */
(function () {
  "use strict";

  var TOKEN = document.body.dataset.token;
  var KEY = "coverr:scan:" + TOKEN;
  var DEVICE =
    localStorage.getItem(KEY + ":device") ||
    (function () {
      var d = "dev-" + Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem(KEY + ":device", d); } catch (e) {}
      return d;
    })();

  var state = {
    manifest: null,
    byToken: {},
    queue: [],
    scanning: false,
    lastToken: null,
    lastAt: 0,
  };

  var el = {
    video: document.getElementById("video"),
    canvas: document.getElementById("canvas"),
    result: document.getElementById("result"),
    statInside: document.getElementById("statInside"),
    statTotal: document.getElementById("statTotal"),
    statBands: document.getElementById("statBands"),
    statQueue: document.getElementById("statQueue"),
    net: document.getElementById("net"),
    startBtn: document.getElementById("startBtn"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults"),
    cashQty: document.getElementById("cashQty"),
    cashBtn: document.getElementById("cashBtn"),
    compBtn: document.getElementById("compBtn"),
    cashNote: document.getElementById("cashNote"),
    tabs: document.querySelectorAll(".tab"),
    panes: document.querySelectorAll(".pane"),
  };

  // ---------------------------------------------------------------- storage

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        state.manifest = d.manifest || null;
        state.queue = d.queue || [];
        indexManifest();
      }
    } catch (e) {}
  }

  function save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ manifest: state.manifest, queue: state.queue })
      );
    } catch (e) {}
  }

  function indexManifest() {
    state.byToken = {};
    if (!state.manifest) return;
    state.manifest.attendees.forEach(function (a) {
      state.byToken[a.t] = a;
    });
  }

  // ----------------------------------------------------------------- sync

  function online() {
    return navigator.onLine !== false;
  }

  function setNet(text, cls) {
    el.net.textContent = text;
    el.net.className = "net " + (cls || "");
  }

  async function refreshManifest() {
    if (!online()) return false;
    try {
      var res = await fetch("/api/scan/" + TOKEN + "/manifest", { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
      state.manifest = await res.json();
      indexManifest();
      save();
      renderStats();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function flush() {
    if (!state.queue.length) { renderStats(); return; }
    if (!online()) { setNet("Sin conexión · " + state.queue.length + " en cola", "off"); return; }
    var batch = state.queue.slice();
    try {
      var res = await fetch("/api/scan/" + TOKEN + "/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scans: batch }),
      });
      if (!res.ok) throw new Error("http " + res.status);
      var data = await res.json();

      // A conflict here means another device already scanned this ticket while
      // both were offline. Surfaced, not silently dropped.
      var conflicts = (data.results || []).filter(function (r) { return r.status === "already"; });
      var voided = (data.results || []).filter(function (r) { return r.status === "voided"; });
      state.queue = state.queue.filter(function (q) {
        return !batch.some(function (b) { return b.t === q.t && b.at === q.at; });
      });
      save();
      if (state.manifest) {
        state.manifest.attendees.forEach(function (a) {
          var hit = (data.results || []).find(function (r) { return r.t === a.t; });
          if (hit && (hit.status === "ok" || hit.status === "already")) a.c = hit.at || nowIso();
        });
        indexManifest();
      }
      renderStats(data);
      if (voided.length) {
        setNet(voided.length + " boleto(s) anulado(s) o reembolsado(s) — no deben entrar", "off");
      } else if (conflicts.length) {
        setNet(conflicts.length + " ya estaban adentro — revisá brazaletes", "warn");
      } else {
        setNet("Sincronizado", "ok");
      }
    } catch (e) {
      setNet("Sin conexión · " + state.queue.length + " en cola", "off");
    }
  }

  function nowIso() { return new Date().toISOString(); }

  // ---------------------------------------------------------------- render

  function renderStats(data) {
    var m = state.manifest;
    if (!m) return;
    // Voided tickets ride along so a scan can name the reason; they are not
    // sold, not inside, and not a wristband.
    var live = m.attendees.filter(function (a) { return !a.v; });
    var total = data && data.total != null ? data.total : live.length;
    var inside =
      data && data.inside != null
        ? data.inside
        : live.filter(function (a) { return !!a.c; }).length;

    el.statInside.textContent = inside;
    el.statTotal.textContent = total;
    el.statQueue.textContent = state.queue.length;
    document.getElementById("queueRow").hidden = state.queue.length === 0;

    var start = m.event.wristbandsStart;
    el.statBands.textContent = start != null ? start - inside : "—";
  }

  /**
   * An amber panel that waits for a decision. The buttons own what happens
   * next, so nothing is written until somebody taps. `state.pending` blocks
   * further scans while it is up — without that, the next person in the queue
   * wipes the decision off the screen before anyone has made it.
   *
   * Used for the two cases where the device is about to commit something on a
   * person's behalf: admitting a flagged ticket, and taking money.
   */
  function askConfirm(o) {
    state.pending = true;
    el.result.className = "result amber";
    el.result.innerHTML =
      '<div class="r-title"></div><div class="r-sub"></div><div class="r-detail"></div>' +
      '<div class="r-actions"><button type="button" class="r-go"></button>' +
      '<button type="button" class="r-no"></button></div>';
    el.result.querySelector(".r-title").textContent = o.title;
    el.result.querySelector(".r-sub").textContent = o.sub || "";
    el.result.querySelector(".r-detail").textContent = o.detail || "";
    var go = el.result.querySelector(".r-go");
    var no = el.result.querySelector(".r-no");
    go.textContent = o.go;
    no.textContent = o.no;
    go.onclick = function () { state.pending = false; o.onGo(); };
    no.onclick = function () { state.pending = false; o.onNo(); };
    el.result.hidden = false;
    if (navigator.vibrate) navigator.vibrate([60, 50, 60]);
  }

  function show(kind, title, sub, detail) {
    el.result.className = "result " + kind;
    el.result.innerHTML =
      '<div class="r-title"></div><div class="r-sub"></div>' +
      (detail ? '<div class="r-detail"></div>' : "");
    el.result.querySelector(".r-title").textContent = title;
    el.result.querySelector(".r-sub").textContent = sub || "";
    if (detail) el.result.querySelector(".r-detail").textContent = detail;
    el.result.hidden = false;
    if (navigator.vibrate) navigator.vibrate(kind === "green" ? 40 : [60, 50, 60]);
  }

  // ------------------------------------------------------------- check-in

  function handleToken(token) {
    // A pending amber decision owns the screen until staff answer it.
    if (state.pending) return;
    var now = Date.now();
    // The camera fires many frames a second; ignore repeats of the same code.
    if (token === state.lastToken && now - state.lastAt < 2500) return;
    state.lastToken = token;
    state.lastAt = now;

    var a = state.byToken[token];
    if (!a) {
      show("red", "No encontrado", "Este código no es de este evento");
      return;
    }
    // Voided tickets are carried in the manifest precisely so this can be
    // said. Dropping them made a refunded ticket look like a stranger's, and
    // the door told the buyer they were at the wrong event.
    if (a.v) {
      show("red", "Boleto anulado", a.n, "Esta compra fue reembolsada");
      return;
    }
    if (a.c) {
      var when = new Date(a.c);
      var hh = String(when.getHours()).padStart(2, "0");
      var mm = String(when.getMinutes()).padStart(2, "0");
      show("red", "Ya entró", a.n, "Registrado a las " + hh + ":" + mm + " · revisá el brazalete");
      return;
    }

    var sub = a.n + (a.q > 1 ? " · boleto de " + a.q : "");

    // A flagged order stops here. It used to be admitted first and the reason
    // shown afterwards, which is backwards for the one scan where somebody
    // might reasonably be held at the door. A clean scan stays a single tap:
    // the queue does not wait on the 95% that are fine.
    if (a.f) {
      askConfirm({
        title: "Revisar antes de dejar pasar",
        sub: sub,
        detail: a.f,
        go: "Verificar y dejar pasar",
        no: "No dejar pasar",
        onGo: function () {
          commitCheckIn(a);
          show("green", "Adelante", sub, a.no || a.sc);
          flush();
        },
        onNo: function () {
          show("red", "No ingresó", sub, "Nadie fue registrado — avisale a la banda");
        },
      });
      return;
    }

    commitCheckIn(a);
    show("green", "Adelante", sub, a.no || a.sc);
    flush();
  }

  /** Marks the attendee in and queues the scan for sync. */
  function commitCheckIn(a) {
    a.c = nowIso();
    state.queue.push({ t: a.t, at: a.c, device: DEVICE });
    indexManifest();
    save();
    renderStats();
  }

  // ---------------------------------------------------------------- camera

  var detector = null;
  var raf = null;

  async function startCamera() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      el.video.srcObject = stream;
      el.video.setAttribute("playsinline", "true");
      await el.video.play();
      el.startBtn.hidden = true;
      document.getElementById("cam").hidden = false;
      state.scanning = true;

      if ("BarcodeDetector" in window) {
        try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { detector = null; }
      }
      tick();
    } catch (e) {
      show("red", "Sin cámara", "Permití el acceso a la cámara para escanear");
      el.startBtn.hidden = false;
    }
  }

  async function tick() {
    if (!state.scanning) return;
    var v = el.video;
    if (v.readyState === v.HAVE_ENOUGH_DATA) {
      try {
        if (detector) {
          var codes = await detector.detect(v);
          if (codes.length) handleToken(codes[0].rawValue.trim());
        } else if (window.jsQR) {
          var c = el.canvas;
          var w = (c.width = 320);
          var h = (c.height = Math.round((v.videoHeight / v.videoWidth) * 320) || 240);
          var ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(v, 0, 0, w, h);
          var img = ctx.getImageData(0, 0, w, h);
          var code = window.jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (code && code.data) handleToken(code.data.trim());
        }
      } catch (e) {}
    }
    raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- search

  /**
   * With a query, the matches. With an empty box, the whole list.
   *
   * The device already holds every attendee — it says so on load — but the
   * list could only be interrogated by typing an exact-ish name. Staff hit
   * this constantly: a name misheard at the door, a misspelling, a buyer who
   * does not know whose name the ticket is under. Showing the list costs
   * nothing and needs no network.
   */
  function renderSearch() {
    var q = el.searchInput.value.trim().toLowerCase();
    if (!state.manifest) { el.searchResults.innerHTML = ""; return; }

    var all = state.manifest.attendees;
    var hits = q
      // Voided tickets stay searchable on purpose: somebody typing a refunded
      // code should be told it was refunded, not "nadie con ese nombre".
      ? all.filter(function (a) {
          return a.n.toLowerCase().indexOf(q) >= 0 || a.sc.toLowerCase().indexOf(q) >= 0;
        })
      // Browsing: still waiting outside first, because that is who staff are
      // looking for. Alphabetical within each group.
      : all.slice().sort(function (x, y) {
          var xi = x.c || x.v ? 1 : 0;
          var yi = y.c || y.v ? 1 : 0;
          if (xi !== yi) return xi - yi;
          return x.n.localeCompare(y.n, "es");
        });

    el.searchResults.innerHTML = "";

    if (!q) {
      var pending = hits.filter(function (a) { return !a.c && !a.v; }).length;
      var head = document.createElement("div");
      head.className = "hint";
      head.textContent =
        pending + (pending === 1 ? " persona por entrar" : " personas por entrar") +
        " · " + hits.length + " en la lista";
      el.searchResults.appendChild(head);
    }

    if (!hits.length) {
      var none = document.createElement("div");
      none.className = "hint";
      none.textContent = q ? "Nadie con ese nombre." : "La lista está vacía.";
      el.searchResults.appendChild(none);
      return;
    }
    hits.forEach(function (a) {
      var row = document.createElement("div");
      row.className = "srow" + (a.c ? " in" : "") + (a.v ? " voided" : "");
      var left = document.createElement("div");
      left.innerHTML = "<b></b><small></small>";
      left.querySelector("b").textContent = a.n;
      left.querySelector("small").textContent = a.v
        ? a.sc + " · reembolsado"
        : a.sc + (a.f ? " · " + a.f : "") + (a.c ? " · ya entró" : "");
      var btn = document.createElement("button");
      btn.textContent = a.v ? "Anulado" : a.c ? "Adentro" : "Marcar";
      btn.disabled = !!a.c || !!a.v;
      btn.onclick = function () { handleToken(a.t); renderSearch(); };
      row.appendChild(left);
      row.appendChild(btn);
      el.searchResults.appendChild(row);
    });
  }

  // ------------------------------------------------------------------ cash

  /**
   * Cash sales and comps always confirm. Unlike a scan there is no fast path
   * worth protecting — these are typed on a phone, in the dark, by somebody
   * holding a queue, and both write records that move attendance and
   * settlement. A comp in particular is a free ticket that counts toward the
   * headcount and never toward revenue.
   *
   * The amount is restated before the tap, because the one irreversible part
   * happens off-screen: the staff member takes the cash.
   */
  function sell(isComp) {
    var qty = Math.max(1, parseInt(el.cashQty.value, 10) || 1);
    if (!online()) {
      el.cashNote.textContent = "Necesitás conexión para registrar ventas. Anotalo y registralo después.";
      el.cashNote.className = "hint warn";
      return;
    }
    var price = (state.manifest && state.manifest.doorPrice) || 0;
    var people = qty + (qty === 1 ? " persona" : " personas");
    askConfirm({
      title: isComp ? "Confirmar cortesía" : "Confirmar venta en efectivo",
      sub: people,
      detail: isComp
        ? "No se cobra nada. Cuenta para la asistencia y no suma a los ingresos."
        : "Cobrá L" + Math.round((qty * price) / 100) + " antes de confirmar.",
      go: isComp ? "Registrar cortesía" : "Ya cobré — registrar",
      no: "Cancelar",
      onGo: function () { commitSale(isComp, qty); },
      onNo: function () {
        el.result.hidden = true;
        el.cashNote.textContent = "Cancelado. No se registró nada.";
        el.cashNote.className = "hint";
      },
    });
  }

  async function commitSale(isComp, qty) {
    el.result.hidden = true;
    var btn = isComp ? el.compBtn : el.cashBtn;
    btn.disabled = true;
    try {
      var res = await fetch("/api/scan/" + TOKEN + "/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty, device: DEVICE, comp: isComp }),
      });
      var d = await res.json();
      if (!res.ok) throw new Error("http " + res.status);
      el.cashNote.textContent =
        (isComp ? "Cortesía registrada" : "Venta registrada") +
        ": " + d.quantity + (d.quantity === 1 ? " persona" : " personas") +
        (isComp ? "" : " · L" + Math.round(d.amount / 100));
      el.cashNote.className = "hint ok";
      renderStats(d);
      await refreshManifest();
    } catch (e) {
      el.cashNote.textContent = "No se pudo registrar. Intentá de nuevo.";
      el.cashNote.className = "hint warn";
    } finally {
      btn.disabled = false;
    }
  }

  // ------------------------------------------------------------------ init

  el.tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      el.tabs.forEach(function (x) { x.classList.toggle("on", x === t); });
      el.panes.forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; });
      if (t.dataset.tab === "buscar") {
        el.searchInput.focus();
        // Opening the tab shows the list, not an empty box over a cached list.
        renderSearch();
      }
    });
  });

  el.startBtn.addEventListener("click", startCamera);
  el.searchInput.addEventListener("input", renderSearch);
  el.cashBtn.addEventListener("click", function () { sell(false); });
  el.compBtn.addEventListener("click", function () { sell(true); });
  document.getElementById("cashPlus").addEventListener("click", function () {
    el.cashQty.value = Math.min(20, (parseInt(el.cashQty.value, 10) || 1) + 1);
  });
  document.getElementById("cashMinus").addEventListener("click", function () {
    el.cashQty.value = Math.max(1, (parseInt(el.cashQty.value, 10) || 1) - 1);
  });

  window.addEventListener("online", function () { setNet("Reconectado", "ok"); flush(); refreshManifest(); });
  window.addEventListener("offline", function () { setNet("Sin conexión · escaneo local", "off"); });

  load();
  renderStats();
  refreshManifest().then(function (ok) {
    setNet(ok ? "Lista descargada · listo" : "Sin conexión · usando lista guardada", ok ? "ok" : "off");
    renderStats();
  });
  flush();
  setInterval(function () { if (state.queue.length) flush(); }, 15000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }
})();

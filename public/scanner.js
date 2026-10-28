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

  // ---------------------------------------------------------------- errors
  //
  // A scanner that breaks mid-queue is invisible to everyone except the person
  // holding it, and they are busy. Uncaught errors go to the server, which
  // emails the operator. Set up first so a failure further down this file is
  // caught too.
  //
  // Throttled hard on the device: the camera loop runs every frame, so one bug
  // there would otherwise send sixty reports a second. Each distinct message
  // goes once per page load, five at most, and at most five wait in storage
  // while the venue has no signal. They go out with the next sync.

  var ERRORS_KEY = KEY + ":errors";
  var MAX_QUEUED_ERRORS = 5;
  var seenErrors = {};
  var errorBudget = 5;
  var sendingErrors = false;
  var pendingErrors = readPendingErrors();

  function queueErrorReport(message, stack) {
    // "Script error." is all a browser says about another origin's script.
    if (!message || message === "Script error." || seenErrors[message]) return;
    if (errorBudget <= 0 || pendingErrors.length >= MAX_QUEUED_ERRORS) return;
    seenErrors[message] = true;
    errorBudget -= 1;
    pendingErrors.push({ message: String(message), stack: stack ? String(stack) : "", at: nowIso() });
    writePendingErrors();
    sendPendingErrors();
  }

  function readPendingErrors() {
    try {
      var saved = JSON.parse(localStorage.getItem(ERRORS_KEY) || "[]");
      return Array.isArray(saved) ? saved.slice(0, MAX_QUEUED_ERRORS) : [];
    } catch (e) {
      return [];
    }
  }

  function writePendingErrors() {
    try {
      localStorage.setItem(ERRORS_KEY, JSON.stringify(pendingErrors));
    } catch (e) {
      // Storage full or blocked. The queue still lives in memory, so the
      // report goes out from this page load; it just will not survive a reload.
    }
  }

  function sendPendingErrors() {
    if (sendingErrors || !pendingErrors.length || !online()) return;
    sendingErrors = true;
    var batch = pendingErrors.slice();
    fetch("/api/scan/" + TOKEN + "/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: batch }),
      keepalive: true,
    })
      .then(function (res) {
        // A 4xx other than a rate limit will never succeed, so it is dropped
        // rather than retried forever. Anything else stays for the next sync.
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
          pendingErrors = pendingErrors.slice(batch.length);
          writePendingErrors();
        }
      })
      .catch(function () {
        // No signal. The batch stays queued and goes with the next sync.
      })
      .then(function () {
        sendingErrors = false;
      });
  }

  window.addEventListener("error", function (e) {
    queueErrorReport(e.message, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    queueErrorReport(reason && reason.message ? reason.message : String(reason), reason && reason.stack);
  });

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
    verdict: document.getElementById("verdict"),
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
    // The badge is a live region, and the sync timer reports "Sincronizado"
    // again and again. Rewriting identical text would have a screen reader
    // repeat it every time.
    if (el.net.textContent !== text) el.net.textContent = text;
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

  // The most scans one sync request carries — the server reads no more than
  // this (MAX_SCANS_PER_SYNC in src/lib/scan-request.ts). A longer queue builds
  // up when the venue loses signal for a big crowd. Sending it whole used to
  // drop everything past this many while the device marked it all synced.
  var SYNC_BATCH = 500;
  var flushing = false;

  async function flush() {
    if (!state.queue.length) { renderStats(); return; }
    if (!online()) { setNet("Sin conexión · " + state.queue.length + " en cola", "off"); return; }
    // One sync at a time. The timer and the reconnect event can both call this,
    // and two overlapping syncs would report this device's own scans back to
    // it as conflicts.
    if (flushing) return;
    flushing = true;
    // Counted across every batch, so a clean last batch cannot hide a warning
    // raised by an earlier one.
    var conflicts = 0;
    var voided = 0;
    try {
      while (state.queue.length) {
        var batch = state.queue.slice(0, SYNC_BATCH);
        var res = await fetch("/api/scan/" + TOKEN + "/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scans: batch }),
        });
        if (!res.ok) throw new Error("http " + res.status);
        var data = await res.json();

        // A conflict here means another device already scanned this ticket while
        // both were offline. Surfaced, not silently dropped.
        conflicts += (data.results || []).filter(function (r) { return r.status === "already"; }).length;
        voided += (data.results || []).filter(function (r) { return r.status === "voided"; }).length;
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
      }
      if (voided) {
        setNet(voided + " boleto(s) anulado(s) o reembolsado(s) — no deben entrar", "off");
      } else if (conflicts) {
        setNet(conflicts + " ya estaban adentro — revisá brazaletes", "warn");
      } else {
        setNet("Sincronizado", "ok");
      }
    } catch (e) {
      setNet("Sin conexión · " + state.queue.length + " en cola", "off");
    } finally {
      flushing = false;
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
    announce(o.title, o.sub, o.detail);
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
    announce(title, sub, detail);
    if (navigator.vibrate) navigator.vibrate(kind === "green" ? 40 : [60, 50, 60]);
  }

  /**
   * Says the verdict through the live region. The colour carries it for
   * everyone else, so the words have to carry it here — which is why the
   * title, the one line that names the verdict, always goes first.
   */
  function announce(title, sub, detail) {
    el.verdict.textContent = [title, sub, detail].filter(Boolean).join(". ");
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

  function selectTab(t) {
    el.tabs.forEach(function (x) {
      var on = x === t;
      x.classList.toggle("on", on);
      x.setAttribute("aria-selected", on ? "true" : "false");
      // One tab stop for the whole row; the arrow keys move within it.
      x.tabIndex = on ? 0 : -1;
    });
    el.panes.forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; });
    // Opening the tab shows the list, not an empty box over a cached list.
    if (t.dataset.tab === "buscar") renderSearch();
  }

  el.tabs.forEach(function (t, i) {
    t.addEventListener("click", function () {
      selectTab(t);
      // Only on a tap or Enter. Arrowing across the row must keep focus on
      // the tabs, or the next arrow press would move the text cursor instead.
      if (t.dataset.tab === "buscar") el.searchInput.focus();
    });
    t.addEventListener("keydown", function (e) {
      var last = el.tabs.length - 1;
      var next =
        e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
        : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
        : e.key === "Home" ? 0
        : e.key === "End" ? last
        : -1;
      if (next < 0) return;
      e.preventDefault();
      selectTab(el.tabs[next]);
      el.tabs[next].focus();
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

  window.addEventListener("online", function () {
    setNet("Reconectado", "ok");
    flush();
    refreshManifest();
    sendPendingErrors();
  });
  window.addEventListener("offline", function () { setNet("Sin conexión · escaneo local", "off"); });

  load();
  renderStats();
  refreshManifest().then(function (ok) {
    setNet(ok ? "Lista descargada · listo" : "Sin conexión · usando lista guardada", ok ? "ok" : "off");
    renderStats();
  });
  flush();
  sendPendingErrors();
  setInterval(function () {
    if (state.queue.length) flush();
    if (pendingErrors.length) sendPendingErrors();
  }, 15000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }
})();

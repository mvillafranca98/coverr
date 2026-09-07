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
    var total = data && data.total != null ? data.total : m.attendees.length;
    var inside =
      data && data.inside != null
        ? data.inside
        : m.attendees.filter(function (a) { return !!a.c; }).length;

    el.statInside.textContent = inside;
    el.statTotal.textContent = total;
    el.statQueue.textContent = state.queue.length;
    document.getElementById("queueRow").hidden = state.queue.length === 0;

    var start = m.event.wristbandsStart;
    el.statBands.textContent = start != null ? start - inside : "—";
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
    if (a.c) {
      var when = new Date(a.c);
      var hh = String(when.getHours()).padStart(2, "0");
      var mm = String(when.getMinutes()).padStart(2, "0");
      show("red", "Ya entró", a.n, "Registrado a las " + hh + ":" + mm + " · revisá el brazalete");
      return;
    }

    a.c = nowIso();
    state.queue.push({ t: token, at: a.c, device: DEVICE });
    indexManifest();
    save();
    renderStats();

    var sub = a.n + (a.q > 1 ? " · boleto de " + a.q : "");
    if (a.f) {
      show("amber", "Revisar", sub, a.f);
    } else {
      show("green", "Adelante", sub, a.no || a.sc);
    }
    flush();
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

  function renderSearch() {
    var q = el.searchInput.value.trim().toLowerCase();
    if (!q || !state.manifest) { el.searchResults.innerHTML = ""; return; }
    var hits = state.manifest.attendees
      .filter(function (a) {
        return a.n.toLowerCase().indexOf(q) >= 0 || a.sc.toLowerCase().indexOf(q) >= 0;
      })
      .slice(0, 25);

    el.searchResults.innerHTML = "";
    if (!hits.length) {
      var none = document.createElement("div");
      none.className = "hint";
      none.textContent = "Nadie con ese nombre.";
      el.searchResults.appendChild(none);
      return;
    }
    hits.forEach(function (a) {
      var row = document.createElement("div");
      row.className = "srow" + (a.c ? " in" : "");
      var left = document.createElement("div");
      left.innerHTML = "<b></b><small></small>";
      left.querySelector("b").textContent = a.n;
      left.querySelector("small").textContent =
        a.sc + (a.f ? " · " + a.f : "") + (a.c ? " · ya entró" : "");
      var btn = document.createElement("button");
      btn.textContent = a.c ? "Adentro" : "Marcar";
      btn.disabled = !!a.c;
      btn.onclick = function () { handleToken(a.t); renderSearch(); };
      row.appendChild(left);
      row.appendChild(btn);
      el.searchResults.appendChild(row);
    });
  }

  // ------------------------------------------------------------------ cash

  async function sell(isComp) {
    var qty = Math.max(1, parseInt(el.cashQty.value, 10) || 1);
    if (!online()) {
      el.cashNote.textContent = "Necesitás conexión para registrar ventas. Anotalo y registralo después.";
      el.cashNote.className = "hint warn";
      return;
    }
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
      if (t.dataset.tab === "buscar") el.searchInput.focus();
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

import { escapeHtml } from "../lib/core";

type ScannerShellInput = {
  eventName: string;
  venue: string;
  bandName: string;
  /** The staff token the shell was opened with; the PWA reads it off <body>. */
  token: string;
};

/**
 * The scanner's HTML shell. It ships nothing but the event's name and the
 * token: the attendee list, the counts and every decision at the door come
 * from `/api/scan`, cached on the device so the page keeps working with no
 * signal.
 *
 * Every interpolation below is escaped. The event name, venue and band name
 * are free text the band typed, and this is a hand-written template rather
 * than JSX, so nothing escapes them for us. An unescaped apostrophe in a venue
 * name would break the page at the door, mid-show — and a tag would run in the
 * browser of whoever is scanning.
 */
export function scannerShellHtml(i: ScannerShellInput): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1">
<meta name="theme-color" content="#0C0B09">
<meta name="robots" content="noindex,nofollow">
<title>Entrada — ${escapeHtml(i.eventName)}</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/scanner.css">
</head>
<body data-token="${escapeHtml(i.token)}">
<div class="wrap">
  <header>
    <div class="ev">${escapeHtml(i.eventName)}</div>
    <div class="vn">${escapeHtml(i.venue)} · ${escapeHtml(i.bandName)}</div>
    <span class="net" id="net">Cargando…</span>
  </header>

  <div class="stats">
    <div class="stat"><b id="statInside">0</b><span>Adentro</span></div>
    <div class="stat"><b id="statTotal">0</b><span>Vendidos</span></div>
    <div class="stat"><b id="statBands">—</b><span>Brazaletes</span></div>
  </div>
  <div id="queueRow" hidden><b id="statQueue">0</b> escaneos esperando conexión</div>

  <div class="tabs">
    <button class="tab on" data-tab="escanear">Escanear</button>
    <button class="tab" data-tab="buscar">Buscar</button>
    <button class="tab" data-tab="efectivo">Efectivo</button>
  </div>

  <section class="pane" data-pane="escanear">
    <button class="big" id="startBtn">Abrir cámara</button>
    <div id="cam" hidden><video id="video" muted playsinline></video></div>
    <canvas id="canvas" hidden></canvas>
    <div class="result" id="result" hidden></div>
  </section>

  <section class="pane" data-pane="buscar" hidden>
    <h2>Buscar por nombre</h2>
    <p class="hint" style="margin-top:0">Para quien no encuentra su código.</p>
    <input type="text" id="searchInput" placeholder="Nombre o código" autocomplete="off">
    <div id="searchResults"></div>
  </section>

  <section class="pane" data-pane="efectivo" hidden>
    <h2>Venta en efectivo</h2>
    <p class="hint" style="margin-top:0">Cobrás, registrás, ponés el brazalete.</p>
    <div class="qty">
      <button type="button" id="cashMinus" aria-label="Menos">−</button>
      <input type="number" id="cashQty" value="1" min="1" max="20" inputmode="numeric">
      <button type="button" id="cashPlus" aria-label="Más">+</button>
    </div>
    <button class="big" id="cashBtn">Registrar venta</button>
    <button class="ghost" id="compBtn">Registrar cortesía</button>
    <p class="hint" id="cashNote"></p>
  </section>
</div>
<script src="/vendor/jsQR.js"></script>
<script src="/scanner.js"></script>
</body></html>`;
}

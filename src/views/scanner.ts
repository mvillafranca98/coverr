import { escapeHtml } from "../lib/core";

type ScannerShellInput = {
  eventName: string;
  venue: string;
  bandName: string;
  /** The staff token the shell was opened with; the PWA reads it off <body>. */
  token: string;
};

/**
 * What a door link shows once it has closed for good, a week after its event
 * (`lib/door-window.ts`). It loads the scanner script only so the script can
 * clear what an earlier night left on this phone: the list, unsent scans and
 * the cached page. `data-closed` tells it to do that and nothing else.
 */
export function scannerClosedHtml(i: { eventName: string; bandName: string; token: string }) {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#141414">
<meta name="robots" content="noindex,nofollow">
<title>Entrada — ${escapeHtml(i.eventName)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/scanner.css">
</head>
<body data-token="${escapeHtml(i.token)}" data-closed="1">
<main class="wrap">
  <header>
    <h1 class="ev">${escapeHtml(i.eventName)}</h1>
    <div class="vn">${escapeHtml(i.bandName)}</div>
  </header>
  <p class="hint">Este enlace de puerta ya no sirve: el evento terminó. La lista de asistentes ya no está en este teléfono.</p>
</main>
<script src="/scanner.js"></script>
</body></html>`;
}

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
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#141414">
<meta name="robots" content="noindex,nofollow">
<title>Entrada — ${escapeHtml(i.eventName)}</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/scanner.css">
</head>
<body data-token="${escapeHtml(i.token)}">
<main class="wrap">
  <header>
    <h1 class="ev">${escapeHtml(i.eventName)}</h1>
    <div class="vn">${escapeHtml(i.venue)} · ${escapeHtml(i.bandName)}</div>
    <span class="net" id="net" role="status">Cargando…</span>
  </header>

  <div class="stats">
    <div class="stat"><b id="statInside">0</b><span>Adentro</span></div>
    <div class="stat"><b id="statTotal">0</b><span>Vendidos</span></div>
    <div class="stat"><b id="statBands">—</b><span>Brazaletes</span></div>
  </div>
  <div id="queueRow" hidden><b id="statQueue">0</b> escaneos esperando conexión</div>

  <div class="tabs" role="tablist" aria-label="Modo">
    <button class="tab on" data-tab="escanear" role="tab" id="tab-escanear" aria-controls="pane-escanear" aria-selected="true">Escanear</button>
    <button class="tab" data-tab="buscar" role="tab" id="tab-buscar" aria-controls="pane-buscar" aria-selected="false" tabindex="-1">Buscar</button>
    <button class="tab" data-tab="efectivo" role="tab" id="tab-efectivo" aria-controls="pane-efectivo" aria-selected="false" tabindex="-1">Efectivo</button>
  </div>

  <!-- The result sits outside the panes on purpose. It used to live inside
       "escanear", so a check-in driven from "buscar" — or a cash sale from
       "efectivo" — rendered where nobody could see it. Harmless while a result
       was only ever informational; not harmless once an amber result carries
       the buttons that decide whether somebody gets in. -->
  <div class="result" id="result" hidden></div>
  <!-- What a screen reader says for each verdict. A live region that was
       display:none when its text changed is not reliably announced, and the
       result above is hidden between scans, so the verdict is also written
       here: always present, never shown. -->
  <p class="sr-only" id="verdict" aria-live="assertive" aria-atomic="true"></p>

  <section class="pane" data-pane="escanear" role="tabpanel" id="pane-escanear" aria-labelledby="tab-escanear">
    <button class="big" id="startBtn">Abrir cámara</button>
    <div id="cam" hidden><video id="video" muted playsinline></video></div>
    <canvas id="canvas" hidden></canvas>
  </section>

  <section class="pane" data-pane="buscar" role="tabpanel" id="pane-buscar" aria-labelledby="tab-buscar" hidden>
    <h2>Buscar por nombre</h2>
    <p class="hint" style="margin-top:0">Para quien no encuentra su código.</p>
    <label class="sr-only" for="searchInput">Nombre o código</label>
    <input type="text" id="searchInput" placeholder="Nombre o código" autocomplete="off">
    <div id="searchResults"></div>
  </section>

  <section class="pane" data-pane="efectivo" role="tabpanel" id="pane-efectivo" aria-labelledby="tab-efectivo" hidden>
    <h2>Venta en efectivo</h2>
    <p class="hint" style="margin-top:0">Cobrás, registrás, ponés el brazalete.</p>
    <div class="qty">
      <button type="button" id="cashMinus" aria-label="Menos">−</button>
      <label class="sr-only" for="cashQty">Personas</label>
      <input type="number" id="cashQty" value="1" min="1" max="20" inputmode="numeric">
      <button type="button" id="cashPlus" aria-label="Más">+</button>
    </div>
    <button class="big" id="cashBtn">Registrar venta</button>
    <button class="ghost" id="compBtn">Registrar cortesía</button>
    <p class="hint" id="cashNote" role="status"></p>
  </section>
</main>
<script src="/vendor/jsQR.js"></script>
<script src="/scanner.js"></script>
</body></html>`;
}

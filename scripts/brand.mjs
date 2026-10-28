#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
/**
 * Generates every brand image from the mark, so none is ever drawn by hand:
 *
 *   public/favicon.svg            the mark itself
 *   public/favicon-32.png         fallback for browsers without SVG favicons
 *   public/apple-touch-icon.png   180px, full bleed — iOS adds its own corners
 *   public/icon-192.png           PWA icon, transparent
 *   public/icon-512.png           PWA icon, transparent
 *   public/icon-maskable-512.png  PWA icon with the safe zone Android crops to
 *   public/og.png                 1200x630 card for links shared in WhatsApp,
 *                                 Instagram and the rest
 *
 *   node scripts/brand.mjs
 *
 * Same rig as shoot.mjs: the Chrome already on the machine, through
 * playwright-core, so nothing downloads a second browser. Needs no server —
 * every page is built here and handed to the browser whole, fonts inlined as
 * data URIs because a page set from a string has no origin to load files from.
 *
 * The mark's paths are duplicated in src/views/brand.tsx. Change both together.
 */
import { chromium } from "playwright-core";
import qrcode from "qrcode-generator";

const MARK_PATHS = `
  <path fill="#FFD43B" stroke="#111111" stroke-width="4" stroke-linejoin="round" d="M16 4h32a12 12 0 0 1 12 12v10a6 6 0 0 0 0 12v10a12 12 0 0 1-12 12H16A12 12 0 0 1 4 48V38a6 6 0 0 0 0-12V16A12 12 0 0 1 16 4z"/>
  <path fill="none" stroke="#111111" stroke-width="8" stroke-linecap="round" d="M40.7 22.3A13 13 0 1 0 40.7 41.7"/>`;

const markSvg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${MARK_PATHS}</svg>`;

/** The production origin, so the QR on the share card opens the real site. */
const ORIGIN = readFileSync("wrangler.jsonc", "utf8").match(/"APP_ORIGIN":\s*"([^"]+)"/)[1];

const font = (file) =>
  `data:font/woff2;base64,${readFileSync(`public/vendor/fonts/${file}`).toString("base64")}`;

function qrPath(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c + 2},${r + 2}h1v1h-1z`;
  }
  const dim = count + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** An icon: the mark at `scale` of the canvas, on `bg` or on nothing. */
const iconPage = (size, scale, bg) => `<!doctype html><html><body style="margin:0">
  <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg ?? "transparent"}">
    ${markSvg(Math.round(size * scale))}
  </div></body></html>`;

const ogPage = () => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Archivo Black";src:url(${font("archivo-black-latin-400-normal.woff2")}) format("woff2")}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;background:#fff4de;color:#111;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.copy{position:absolute;left:68px;top:56px;width:650px}
.mark{display:inline-flex;align-items:center;gap:12px;padding:8px 16px 8px 10px;border:3px solid #111;border-radius:14px;background:#ffd43b;box-shadow:5px 5px 0 #111;font-family:"Archivo Black";font-size:30px;letter-spacing:-.02em}
h1{margin:44px 0 0;font-family:"Archivo Black";font-weight:400;font-size:64px;line-height:1.16;letter-spacing:-.035em}
em{font-style:normal;white-space:nowrap;padding:0 .14em;border:3px solid #111;border-radius:.18em;background:#ffd43b;-webkit-box-decoration-break:clone}
.facts{position:absolute;left:68px;bottom:52px;display:flex;gap:12px}
.facts span{padding:7px 14px;border:3px solid #111;border-radius:999px;background:#fff;font-weight:800;font-size:18px}
.disc{position:absolute;right:58px;top:96px;width:400px;height:400px;border:3px solid #111;border-radius:50%;background:#ff6ec7}
.tix{position:absolute;right:96px;top:92px;width:320px;transform:rotate(-4deg);filter:drop-shadow(9px 9px 0 #111)}
.card{border:3px solid #111;border-radius:18px;background:#b8f35a;overflow:hidden;
  -webkit-mask:radial-gradient(circle 13px at 0 calc(100% - 126px),#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 13px at 100% calc(100% - 126px),#0000 97%,#000) right/51% 100% no-repeat}
.head{padding:12px 18px;background:#111;color:#b8f35a;font:700 12px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase}
.body{padding:18px 18px 16px}
.band{font:700 12px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}
.event{margin:8px 0 14px;font-family:"Archivo Black";font-size:32px;line-height:1;letter-spacing:-.03em}
.meta{display:flex;gap:8px}
.meta span{padding:5px 9px;border:2px solid #111;border-radius:8px;background:#fff;font-weight:700;font-size:13px}
.perf{border-top:3px dashed #111}
.stub{height:126px;display:flex;align-items:center;gap:16px;padding:12px 18px}
.stub img{width:96px;height:96px;padding:3px;border:3px solid #111;border-radius:10px;background:#fff}
.code{font:700 20px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em}
.small{margin-top:8px;font:700 11px/1 ui-monospace,Menlo,Consolas,monospace;text-transform:uppercase}
.sticker{position:absolute;right:66px;top:58px;width:100px;height:100px;display:grid;place-items:center;padding:10px;border:3px solid #111;border-radius:50%;background:#4d7cfe;font-family:"Archivo Black";font-size:15px;line-height:1.05;text-align:center;transform:rotate(12deg)}
</style></head><body>
<div class="copy">
  <div class="mark">${markSvg(40)}<span>coverr</span></div>
  <h1>Vendé tus boletos sin que el dinero pase por <em>nadie más</em>.</h1>
</div>
<div class="facts"><span>✓ Preventa</span><span>✓ QR al instante</span><span>✓ Entrada sin señal</span></div>
<div class="disc"></div>
<div class="tix"><div class="card">
  <div class="head">Preventa · Admite 1</div>
  <div class="body">
    <div class="band">Tu banda</div>
    <div class="event">Tu próximo toque</div>
    <div class="meta"><span>Sábado</span><span>8:00 pm</span><span>A tu cuenta</span></div>
  </div>
  <div class="perf"></div>
  <div class="stub">
    <img src="data:image/svg+xml;base64,${Buffer.from(qrPath(ORIGIN)).toString("base64")}">
    <div><div class="code">COVERR</div><div class="small">Boleto 1 de 1</div></div>
  </div>
</div></div>
<div class="sticker">¡QR al instante!</div>
</body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
try {
  writeFileSync("public/favicon.svg", `${markSvg(64)}\n`);

  const shots = [
    { file: "favicon-32.png", size: 32, html: iconPage(32, 1) },
    { file: "apple-touch-icon.png", size: 180, html: iconPage(180, 0.7, "#fff4de") },
    { file: "icon-192.png", size: 192, html: iconPage(192, 0.92) },
    { file: "icon-512.png", size: 512, html: iconPage(512, 0.92) },
    // Android crops maskable icons to a circle inside the middle 80%, so the
    // mark sits well within it on a full-bleed background.
    { file: "icon-maskable-512.png", size: 512, html: iconPage(512, 0.58, "#fff4de") },
  ];
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.size, height: s.size } });
    await page.setContent(s.html);
    await page.screenshot({ path: `public/${s.file}`, omitBackground: true });
    await page.close();
    console.log(`public/${s.file}`);
  }

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(ogPage(), { waitUntil: "load" });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: "public/og.png" });
  console.log("public/og.png");
} finally {
  await browser.close();
}

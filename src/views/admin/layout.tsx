import type { FC, PropsWithChildren } from "hono/jsx";
import { LegalLinks } from "../legal/links";

/**
 * The admin app's whole design system, inlined into every page.
 *
 * One <style> block rather than a stylesheet request because the door and
 * the dashboard both get used on venue wifi, where a second round trip is the
 * difference between a page that paints and one that hangs. Not exported: a
 * page that needs a rule adds it here, so there is one place to look.
 */
const ADMIN_CSS = `
:root{
  --bg:#0F0E0B;--surface:#181510;--surface-2:#221E17;--line:#2F2921;--line-2:#443C31;--line-control:#6E6454;
  --text:#F4F0E8;--muted:#A69D8F;--dim:#8E8679;
  --accent:#E9963A;--accent-ink:#120D06;
  --ok:#5FBB88;--ok-bg:#12251A;--warn:#E0AC42;--warn-bg:#2A2110;--crit:#E2705F;--crit-bg:#2A1512;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
.wrap{max-width:980px;margin:0 auto;padding:0 18px 80px}

/* ---- chrome: two bars, two scopes ----
   The band bar leaves the event; the event bar acts on it. They used to be one
   flat row, which read as a single menu and wrapped to three lines on a phone. */
.chrome{border-bottom:1px solid var(--line);margin-bottom:22px}

nav.band{display:flex;align-items:center;gap:14px;padding:16px 0 0}
nav.band .brand{
  font-family:var(--mono);font-size:11px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--accent);white-space:nowrap;
}
.band-links{margin-left:auto;display:flex;align-items:center;gap:16px}
.band-links a{color:var(--dim);text-decoration:none;font-size:13.5px;font-weight:550;white-space:nowrap}
.band-links a:hover,.band-links a.on{color:var(--text)}

nav.event{padding:14px 0 0}
.ev-name{
  display:block;font-size:15px;font-weight:650;color:var(--text);
  letter-spacing:-.01em;margin-bottom:6px;
}
/* Scrolls rather than wraps. Five tabs do not fit a 375px screen, and a band
   checking numbers mid-gig is on exactly that screen. */
.ev-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ev-tabs::-webkit-scrollbar{display:none}
.ev-tabs a{
  flex:none;padding:7px 12px 9px;color:var(--muted);text-decoration:none;
  font-size:14px;font-weight:550;white-space:nowrap;border-bottom:2px solid transparent;
}
.ev-tabs a:hover{color:var(--text)}
.ev-tabs a.on{color:var(--text);border-bottom-color:var(--accent)}

@media (max-width:560px){
  /* The band links drop to their own scrollable row instead of squeezing the
     band name or wrapping mid-list. */
  nav.band{flex-wrap:wrap;gap:8px}
  .band-links{margin-left:0;width:100%;overflow-x:auto;scrollbar-width:none}
  .band-links::-webkit-scrollbar{display:none}
}

h1{font-size:1.75rem;font-weight:750;letter-spacing:-.022em;margin:0 0 4px;text-wrap:balance}
.sub{color:var(--muted);font-size:14px;margin:0 0 22px}
h2{font-size:1.05rem;font-weight:650;margin:30px 0 10px;letter-spacing:-.01em}
h2:first-of-type{margin-top:0}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:8px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:13px 15px}
.card b{display:block;font-size:1.65rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1;letter-spacing:-.02em}
.card span{font-size:10.5px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.card small{display:block;font-size:12px;color:var(--muted);margin-top:3px}
.card.warn{border-color:#4A3A16;background:var(--warn-bg)}
.card.warn b{color:var(--warn)}

.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:11px;background:var(--surface);margin-bottom:8px}
table{border-collapse:collapse;width:100%;font-size:14px}
th{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);text-align:left;padding:9px 13px;border-bottom:1px solid var(--line-2);white-space:nowrap}
td{padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--muted)}
td:first-child{color:var(--text)}
tr:last-child td{border-bottom:none}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono)}
tr.tot td{border-top:1px solid var(--line-2);font-weight:650;color:var(--text)}

.chip{display:inline-block;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:3px;white-space:nowrap}
.chip.ok{background:var(--ok-bg);color:var(--ok)}
.chip.warn{background:var(--warn-bg);color:var(--warn)}
.chip.crit{background:var(--crit-bg);color:var(--crit)}
.chip.info{background:var(--surface-2);color:var(--dim)}

form.inline{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}
label.fl{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px}
input[type=text],input[type=email],input[type=number],select{padding:10px 11px;border:1px solid var(--line-control);border-radius:8px;background:var(--surface);color:var(--text);font-size:15px;font-family:var(--sans);width:100%}
input:focus,select:focus{outline:2px solid var(--accent);outline-offset:-1px}
.btn{padding:10px 16px;border:none;border-radius:8px;background:var(--accent);color:var(--accent-ink);font:650 14px/1.2 var(--sans);cursor:pointer;white-space:nowrap}
.btn.ghost{background:var(--surface-2);color:var(--text);border:1px solid var(--line-control)}
.btn.danger{background:var(--crit-bg);color:var(--crit);border:1px solid #4A211B}
.btn:active{filter:brightness(.9)}
.btn.sm{padding:6px 11px;font-size:12.5px}

.note{background:var(--surface);border:1px solid var(--line);border-left:2px solid var(--line-2);border-radius:8px;padding:12px 15px;margin:0 0 16px;font-size:14px;color:var(--muted)}
.note.warn{border-left-color:var(--warn);background:var(--warn-bg);color:#F0D89C}
.note.ok{border-left-color:var(--ok);background:var(--ok-bg);color:#A8DDBF}
.note.crit{border-left-color:var(--crit);background:var(--crit-bg);color:#F0B5AC}

.proof{max-width:100%;border-radius:9px;border:1px solid var(--line-2);display:block}
.kv{display:grid;grid-template-columns:auto 1fr;gap:5px 16px;font-size:13.5px;margin:0}
.kv dt{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);padding-top:3px}
.kv dd{margin:0;color:var(--text)}
.muted{color:var(--muted)}
.right{text-align:right}
.copyline{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;
  padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);
}
.copyline code{
  flex:1;min-width:0;font-family:var(--mono);font-size:12.5px;
  word-break:break-all;color:var(--text);
}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--dim)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

/**
 * Copies a link, after asking first when the link carries authority.
 *
 * `navigator.clipboard` needs a secure context, which production is and
 * localhost counts as. Where it is missing the text is selected instead, so
 * the band can still copy it by hand rather than being left with a dead
 * button.
 */
const COPY_SCRIPT = `
document.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
  if (!btn) return;

  var warn = btn.getAttribute('data-warn');
  if (warn && !window.confirm(warn)) return;

  var text = btn.getAttribute('data-copy');
  var done = function () {
    var was = btn.textContent;
    btn.textContent = 'Copiado';
    setTimeout(function () { btn.textContent = was; }, 1600);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, select);
  } else {
    select();
  }

  function select() {
    var code = btn.parentNode && btn.parentNode.querySelector('code');
    if (!code) return;
    var range = document.createRange();
    range.selectNodeContents(code);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = 'Copialo a mano';
  }
});`;

export const AdminLayout: FC<
  PropsWithChildren<{
    title: string;
    bandName?: string;
    active?: string;
    eventSlug?: string;
    /** Named in the event bar so the scope of those tabs is never in doubt. */
    eventName?: string;
  }>
> = ({ title, bandName, active, eventSlug, eventName, children }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="theme-color" content="#0F0E0B" />
      <title>{title}</title>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
    </head>
    <body>
      <div class="wrap">
        {/* Two levels, because they are two scopes. Everything in the band bar
            leaves whatever event you are in; everything in the event bar acts
            on it. Flat, they read as one menu and it is not obvious which is
            which — which is exactly what happened during QA. */}
        {bandName ? (
          <header class="chrome">
            <nav class="band" aria-label="Banda">
              <span class="brand">{bandName}</span>
              <span class="band-links">
                <a href="/admin" class={active === "events" ? "on" : ""}>
                  Eventos
                </a>
                <a href="/admin/nuevo">+ Evento</a>
                <a href="/admin/banda" class={active === "band" ? "on" : ""}>
                  Banda
                </a>
                <a href="/admin/salir">Salir</a>
              </span>
            </nav>

            {eventSlug ? (
              <nav class="event" aria-label={eventName ? `Evento: ${eventName}` : "Evento"}>
                {eventName ? <span class="ev-name">{eventName}</span> : null}
                {/* Scrolls rather than wraps: five tabs on a phone used to
                    stack into three lines, which is where this read worst. */}
                <span class="ev-tabs">
                  <a href={`/admin/e/${eventSlug}`} class={active === "dash" ? "on" : ""}>
                    Resumen
                  </a>
                  <a href={`/admin/e/${eventSlug}/ordenes`} class={active === "orders" ? "on" : ""}>
                    Órdenes
                  </a>
                  <a href={`/admin/e/${eventSlug}/venta`} class={active === "manual" ? "on" : ""}>
                    Venta
                  </a>
                  <a href={`/admin/e/${eventSlug}/dinero`} class={active === "money" ? "on" : ""}>
                    Dinero
                  </a>
                  <a
                    href={`/admin/e/${eventSlug}/ajustes`}
                    class={active === "settings" ? "on" : ""}
                  >
                    Ajustes
                  </a>
                </span>
              </nav>
            ) : null}
          </header>
        ) : null}
        {children}
        <footer>
          <div>Coverr</div>
          <LegalLinks />
        </footer>
      </div>
      {/* One delegated handler for every CopyLink on the page. Inline because
          this surface ships no script files and a copy button is not worth
          starting. */}
      <script dangerouslySetInnerHTML={{ __html: COPY_SCRIPT }} />
    </body>
  </html>
);

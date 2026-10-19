import type { FC, PropsWithChildren } from "hono/jsx";

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

nav.top{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 0;border-bottom:1px solid var(--line);margin-bottom:22px}
nav.top .brand{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
nav.top a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:550}
nav.top a.on{color:var(--text)}
nav.top .sp{margin-left:auto}

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
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--dim)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export const AdminLayout: FC<
  PropsWithChildren<{ title: string; bandName?: string; active?: string; eventSlug?: string }>
> = ({ title, bandName, active, eventSlug, children }) => (
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
        {bandName ? (
          <nav class="top">
            <span class="brand">{bandName}</span>
            {eventSlug ? (
              <>
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
                <a href={`/admin/e/${eventSlug}/ajustes`} class={active === "settings" ? "on" : ""}>
                  Ajustes
                </a>
              </>
            ) : null}
            <span class="sp" />
            <a href="/admin">Eventos</a>
            <a href="/admin/nuevo">+ Evento</a>
            <a href="/admin/banda">Banda</a>
            <a href="/admin/salir">Salir</a>
          </nav>
        ) : null}
        {children}
        <footer>Coverr</footer>
      </div>
    </body>
  </html>
);

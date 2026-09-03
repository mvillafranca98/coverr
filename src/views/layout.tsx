import type { FC, PropsWithChildren } from "hono/jsx";

export const CSS = `
:root{
  --bg:#0C0B09;
  --surface:#16130F;
  --surface-2:#211C16;
  --line:#332B22;
  --line-2:#4A3F31;
  --text:#F6F2EB;
  --muted:#A79E90;
  --dim:#7A7367;
  --accent:#F0A03C;
  --accent-dim:#7A5220;
  --accent-ink:#100C06;
  --ok:#63C08C;
  --ok-bg:#12251A;
  --warn:#E8B54A;
  --warn-bg:#2A2110;
  --crit:#E8776A;
  --crit-bg:#2A1512;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
/* Author display rules outrank the UA's [hidden]{display:none}, so state it
   explicitly — otherwise .fee/.free show simultaneously. */
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--text);
  font-family:var(--sans);font-size:16px;line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:520px;margin:0 auto;padding:0 18px 96px}

/* ---- header ---- */
.hero{padding:34px 0 26px;border-bottom:1px solid var(--line)}
.band{
  font-family:var(--mono);font-size:11px;font-weight:600;
  letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;
}
h1{font-size:2.05rem;line-height:1.08;letter-spacing:-.025em;margin:0 0 14px;font-weight:750;text-wrap:balance}
.when{display:flex;flex-direction:column;gap:3px;font-size:15px;color:var(--muted)}
.when b{color:var(--text);font-weight:600}
.blurb{margin:16px 0 0;color:var(--muted);font-size:15px}

/* ---- steps ---- */
.step{padding:26px 0;border-bottom:1px solid var(--line)}
.step:last-of-type{border-bottom:none}
.step-h{display:flex;align-items:baseline;gap:9px;margin:0 0 4px}
.step-n{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--dim)}
h2{font-size:1.06rem;font-weight:650;margin:0;letter-spacing:-.012em}
.hint{color:var(--muted);font-size:14px;margin:4px 0 14px}
.hint:last-child{margin-bottom:0}

/* ---- quantity ---- */
.qty{display:flex;align-items:center;gap:14px;margin-top:14px}
.qty-btn{
  width:46px;height:46px;flex:none;border-radius:10px;border:1px solid var(--line-2);
  background:var(--surface-2);color:var(--text);font-size:22px;line-height:1;
  cursor:pointer;font-family:var(--sans);
}
.qty-btn:active{background:var(--line)}
.qty-btn:disabled{opacity:.35;cursor:not-allowed}
.qty-val{font-size:1.7rem;font-weight:700;min-width:2ch;text-align:center;font-variant-numeric:tabular-nums}
.qty-total{margin-left:auto;text-align:right}
.qty-total b{display:block;font-size:1.35rem;font-weight:700;font-variant-numeric:tabular-nums}
.qty-total span{font-size:12px;color:var(--muted);font-family:var(--mono)}

/* ---- bank grid ---- */
.banks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.bank{position:relative}
.bank input{position:absolute;opacity:0;width:0;height:0}
.bank span{
  display:flex;align-items:center;justify-content:center;text-align:center;
  min-height:52px;padding:8px 10px;border:1px solid var(--line-2);border-radius:10px;
  background:var(--surface);font-size:14px;font-weight:550;cursor:pointer;line-height:1.25;
}
.bank input:checked+span{border-color:var(--accent);background:var(--accent-dim);color:#fff}
.bank input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}

/* ---- account block ---- */
.acct{margin-top:18px;border:1px solid var(--line-2);border-radius:12px;overflow:hidden;background:var(--surface)}
.acct-top{padding:14px 16px 12px;border-bottom:1px dashed var(--line-2)}
.acct-label{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.acct-num{
  font-family:var(--mono);font-size:1.72rem;font-weight:600;letter-spacing:.04em;
  margin:5px 0 3px;word-break:break-all;
}
.acct-holder{font-size:13px;color:var(--muted)}
.acct-bank{font-size:13px;color:var(--muted);margin-top:2px}
.copy{
  display:block;width:100%;padding:14px;border:none;border-top:1px solid var(--line);
  background:var(--accent);color:var(--accent-ink);font-size:15px;font-weight:700;
  cursor:pointer;font-family:var(--sans);
}
.copy:active{filter:brightness(.9)}
.copy.done{background:var(--ok);color:#08150E}
.fee{
  display:flex;gap:9px;margin-top:12px;padding:11px 13px;border-radius:9px;
  background:var(--warn-bg);border:1px solid #4A3A16;font-size:13.5px;color:#F0D89C;
}
.fee b{color:var(--warn)}
.free{
  display:flex;gap:9px;margin-top:12px;padding:11px 13px;border-radius:9px;
  background:var(--ok-bg);border:1px solid #1F4231;font-size:13.5px;color:#A8DDBF;
}

/* ---- detail chip ---- */
.chipcopy{
  display:flex;align-items:center;gap:10px;margin-top:12px;padding:11px 13px;
  border:1px dashed var(--line-2);border-radius:9px;background:var(--surface);
  cursor:pointer;width:100%;text-align:left;font-family:var(--sans);color:var(--text);
}
.chipcopy code{font-family:var(--mono);font-size:15px;font-weight:600;color:var(--accent)}
.chipcopy small{color:var(--muted);font-size:12.5px;display:block;line-height:1.35}
.chipcopy.done{border-color:var(--ok);border-style:solid}

/* ---- fields ---- */
label.fl{display:block;font-size:13.5px;font-weight:600;margin:14px 0 5px;color:var(--text)}
label.fl span{font-weight:400;color:var(--dim)}
input[type=text],input[type=email],input[type=tel],textarea,select{
  width:100%;padding:12px 13px;border:1px solid var(--line-2);border-radius:9px;
  background:var(--surface);color:var(--text);font-size:16px;font-family:var(--sans);
}
input:focus,textarea:focus,select:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
input::placeholder,textarea::placeholder{color:#5E574C}
textarea{resize:vertical;min-height:44px}

.att{padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-top:10px}
.att-n{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--dim)}
.att label.fl:first-of-type{margin-top:7px}

/* ---- file ---- */
.drop{
  display:block;margin-top:14px;padding:24px 16px;border:1.5px dashed var(--line-2);
  border-radius:12px;background:var(--surface);text-align:center;cursor:pointer;
}
.drop.has{border-style:solid;border-color:var(--ok);background:var(--ok-bg)}
.drop input{position:absolute;opacity:0;width:0;height:0}
.drop-t{font-weight:650;font-size:15px}
.drop-s{font-size:13px;color:var(--muted);margin-top:4px}
.drop-s.name{color:var(--ok);font-family:var(--mono);font-size:12.5px;word-break:break-all}

/* ---- consent + submit ---- */
.consent{display:flex;gap:11px;align-items:flex-start;margin-top:16px;font-size:13.5px;color:var(--muted)}
.consent input{margin:2px 0 0;width:19px;height:19px;flex:none;accent-color:var(--accent)}
.submit{
  display:block;width:100%;margin-top:20px;padding:17px;border:none;border-radius:11px;
  background:var(--accent);color:var(--accent-ink);font-size:17px;font-weight:750;
  cursor:pointer;font-family:var(--sans);
}
.submit:active{filter:brightness(.9)}
.submit:disabled{opacity:.4;cursor:not-allowed}
.err{
  margin-top:14px;padding:12px 14px;border-radius:9px;background:var(--crit-bg);
  border:1px solid #4A211B;color:#F0B5AC;font-size:14px;
}
footer{padding:26px 0 0;text-align:center;font-size:12px;color:var(--dim);font-family:var(--mono)}
footer a{color:var(--dim)}

/* ---- ticket / confirmation ---- */
.done-hero{padding:36px 0 22px;text-align:center}
.done-mark{
  width:52px;height:52px;margin:0 auto 16px;border-radius:50%;
  background:var(--ok-bg);border:1.5px solid var(--ok);
  display:flex;align-items:center;justify-content:center;color:var(--ok);font-size:26px;line-height:1;
}
.done-hero h1{font-size:1.6rem;margin-bottom:8px}
.done-hero p{color:var(--muted);margin:0;font-size:15px}
.tk{margin-top:18px;background:var(--surface);border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
.tk-top{padding:18px 18px 14px}
.tk-name{font-size:1.18rem;font-weight:700;letter-spacing:-.01em}
.tk-meta{font-size:13px;color:var(--muted);margin-top:3px}
.tk-note{font-size:13px;color:var(--accent);margin-top:6px;font-style:italic}
.tk-perf{height:1px;background:repeating-linear-gradient(90deg,var(--line-2) 0 6px,transparent 6px 12px)}
.tk-qr{padding:20px;text-align:center;background:var(--surface)}
.tk-qr img{width:100%;max-width:260px;height:auto;border-radius:8px;display:block;margin:0 auto}
.tk-code{
  font-family:var(--mono);font-size:12px;letter-spacing:.1em;color:var(--dim);
  margin-top:12px;text-transform:uppercase;
}
.tk-save{
  display:block;margin:14px 18px 18px;padding:12px;border-radius:9px;text-align:center;
  border:1px solid var(--line-2);background:var(--surface-2);color:var(--text);
  font-size:14px;font-weight:600;text-decoration:none;
}
.summary{margin-top:22px;padding:16px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.summary h3{margin:0 0 10px;font-size:13px;font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:600}
.srow{display:flex;justify-content:space-between;gap:14px;font-size:14px;padding:4px 0}
.srow span{color:var(--muted)}
.srow b{font-variant-numeric:tabular-nums;font-weight:600}
.keep{margin-top:20px;padding:14px 16px;border-radius:10px;background:var(--warn-bg);border:1px solid #4A3A16;font-size:14px;color:#F0D89C}

@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export const Layout: FC<
  PropsWithChildren<{
    title: string;
    description?: string;
    ogUrl?: string;
  }>
> = ({ title, description, ogUrl, children }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      <meta name="theme-color" content="#0C0B09" />
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content="website" />
      {ogUrl ? <meta property="og:url" content={ogUrl} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </head>
    <body>
      <div class="wrap">{children}</div>
    </body>
  </html>
);

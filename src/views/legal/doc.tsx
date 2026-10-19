import type { FC, PropsWithChildren } from "hono/jsx";
import { Layout } from "../layout";
import { LegalLinks } from "./links";

/**
 * The shell both legal documents share: light surface, prose widths, the
 * updated date and the cross-link between them.
 *
 * Light rather than dark even though a band reads these too. DESIGN.md picks a
 * surface by audience, and the audience here is whoever is about to pay —
 * these pages are linked from the checkout consent, which is the only place in
 * the product where somebody is required to have the chance to read them.
 *
 * The buyer stylesheet is a purchase-flow stylesheet: it has no rules for a
 * page that is almost entirely prose. Rather than widen it for two pages, the
 * prose rules live here, next to the only views that use them.
 */
const PROSE_CSS = `
/* Wider than the purchase flow. 520px is right for a form and too narrow for
   a thousand words. */
.wrap{max-width:640px}

.legal-head{padding:34px 0 22px;border-bottom:1px solid var(--line)}
.legal-head h1{font-size:1.7rem;margin:10px 0 10px}
.legal-updated{margin:0;font-family:var(--mono);font-size:12px;color:var(--dim)}

.legal{padding-top:4px}
.legal h2{
  font-size:1.12rem;font-weight:700;letter-spacing:-.012em;
  margin:34px 0 10px;padding-top:18px;border-top:1px solid var(--line);
}
.legal h3{font-size:.98rem;font-weight:650;margin:20px 0 6px}
.legal p{margin:0 0 12px;color:var(--muted);font-size:15.5px}
.legal p:last-child{margin-bottom:0}
.legal b,.legal strong{color:var(--text);font-weight:650}
.legal a{color:var(--accent-text);text-decoration:underline}

.legal ul{margin:0 0 14px;padding-left:20px;color:var(--muted);font-size:15.5px}
.legal li{margin-bottom:7px}
.legal li:last-child{margin-bottom:0}

/* A two-part row — "who gets it" / "what they get" — stacked rather than
   tabled. A three-column table of six services is unreadable on a phone,
   which is the only screen most of these pages are opened on. */
.rows{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:8px}
.rows li{
  margin:0;padding:13px 15px;border:1px solid var(--line-2);border-radius:10px;
  background:var(--surface);
}
.rows strong{display:block;font-size:14.5px;margin-bottom:3px}
.rows span{display:block;font-size:14px;color:var(--muted);line-height:1.45}

.callout{
  margin:0 0 14px;padding:14px 16px;border-radius:10px;
  background:var(--warn-bg);border:1px solid #E3CE97;
  font-size:15px;color:var(--warn);
}
.callout b{color:var(--warn)}

footer{display:flex;flex-direction:column;gap:5px;padding-top:30px}
`;

export const LegalDoc: FC<
  PropsWithChildren<{
    title: string;
    description: string;
    heading: string;
    /** The document's own last-updated date, written out in Spanish. */
    updated: string;
    canonical: string;
  }>
> = ({ title, description, heading, updated, canonical, children }) => (
  <Layout title={title} description={description} ogUrl={canonical} indexable>
    <style dangerouslySetInnerHTML={{ __html: PROSE_CSS }} />
    <header class="legal-head">
      <div class="band">Coverr</div>
      <h1>{heading}</h1>
      <p class="legal-updated">Última actualización: {updated}</p>
    </header>
    <main class="legal">{children}</main>
    <footer>
      <LegalLinks />
      <div>Coverr · un producto de macawly.dev</div>
    </footer>
  </Layout>
);

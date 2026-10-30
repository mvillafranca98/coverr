import type { FC, PropsWithChildren } from "hono/jsx";
import PROSE_CSS from "../../styles/legal.css";
import { Wordmark } from "../brand";
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
 * prose rules live in styles/legal.css. That sheet is emitted in the body,
 * after the buyer sheet in the head, and the order is load-bearing: its .wrap
 * and footer rules win only because they come second.
 */
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
      {/* Somebody arrives here from a checkout or a footer and needs a way
          back that is not the browser's. */}
      <a class="home-mark" href="/" aria-label="Coverr, inicio">
        <Wordmark />
      </a>
      <h1>{heading}</h1>
      <p class="legal-updated">Última actualización: {updated}</p>
    </header>
    <article class="legal">{children}</article>
    <footer>
      <LegalLinks />
      <div>Coverr · un producto de macawly.dev</div>
    </footer>
  </Layout>
);

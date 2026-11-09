import type { FC, PropsWithChildren } from "hono/jsx";
import { withoutComments } from "../lib/css";
import BUYER_CSS from "../styles/buyer.css";
import TOKENS_CSS from "../styles/tokens.css";
import { BrandIcons } from "./brand";
import { ErrorReporter } from "./error-reporter";

/** Inlined in every buyer page, without the notes written for whoever edits it. */
const PAGE_CSS = withoutComments(TOKENS_CSS + BUYER_CSS);

/**
 * The card a shared link shows in WhatsApp, Instagram and the rest.
 *
 * Every page that names its own URL gets the buyer card, `og-event.png`
 * (made by scripts/brand.mjs). The event page is the link bands paste
 * everywhere, so the card speaks to the person buying, and the link's own
 * title and description name the actual gig. The landing page's `og.png`
 * pitches Coverr to bands and would read as somebody else's ad here.
 *
 * Built from the page's own URL so it is absolute on whatever origin served it.
 * The version in the query is bumped whenever the image is redrawn: apps
 * cache a preview image by its address, so a new picture needs a new one.
 */
const SHARE_CARD_PATH = "/og-event.png?v=2";

const ShareCard: FC<{ pageUrl: string }> = ({ pageUrl }) => (
  <>
    <meta property="og:image" content={new URL(SHARE_CARD_PATH, pageUrl).toString()} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
      property="og:image:alt"
      content="Coverr: comprá tu boleto. Pagás directo a la banda y tu QR llega al instante."
    />
  </>
);

export const Layout: FC<
  PropsWithChildren<{
    title: string;
    description?: string;
    ogUrl?: string;
    /** Opt out of the default noindex. Only for a page that belongs to nobody. */
    indexable?: boolean;
  }>
> = ({ title, description, ogUrl, indexable, children }) => (
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <ErrorReporter />
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      <meta name="theme-color" content="#FFF4DE" />
      {/* Almost every page on this layout shows something that belongs to one
          person: the band's bank account and holder name on the buy page, a
          buyer's name and live QR codes on the ticket page. None of that should
          turn up in a search result, so noindex is the default and a page has
          to ask for the opposite.

          The legal documents are the one exception: they belong to nobody, and
          a privacy notice that search engines are told to ignore is not really
          published. The landing page carries its own document. */}
      {indexable ? null : <meta name="robots" content="noindex,nofollow" />}
      {indexable && ogUrl ? <link rel="canonical" href={ogUrl} /> : null}
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content="website" />
      {ogUrl ? <meta property="og:url" content={ogUrl} /> : null}
      {ogUrl ? <ShareCard pageUrl={ogUrl} /> : null}
      {/* A large card with no image renders as an empty frame, so a page
          without one asks for the small card instead. */}
      <meta name="twitter:card" content={ogUrl ? "summary_large_image" : "summary"} />
      <BrandIcons />
      {/* The display face sets every heading here. Preloaded so it usually
          lands before first paint; when it does not, font-display:swap shows
          the system sans meanwhile — a buyer never waits on it. */}
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/vendor/fonts/archivo-black-latin-400-normal.woff2"
        crossorigin="anonymous"
      />
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
    </head>
    <body>
      <main class="wrap">{children}</main>
    </body>
  </html>
);

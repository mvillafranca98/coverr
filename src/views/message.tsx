import type { FC, PropsWithChildren } from "hono/jsx";
import { Wordmark } from "./brand";
import { Layout } from "./layout";
import { LegalLinks } from "./legal/links";

/**
 * A page that only has one thing to say: a link that goes nowhere, a crash, a
 * sale that is not taking orders. The person reading it is almost always a
 * buyer who followed a band's link, so it is the light surface like the rest
 * of the buyer flow, whatever went wrong.
 *
 * `label` is the sticker above the headline: the band's name when the page
 * knows which band the buyer came for, otherwise Coverr.
 */
export const MessagePage: FC<
  PropsWithChildren<{ title: string; label: string; headline: string }>
> = ({ title, label, headline, children }) => (
  <Layout title={title}>
    <header class="hero">
      <div class="band">{label}</div>
      <h1>{headline}</h1>
      {children}
    </header>
    <footer>
      <Wordmark size={20} />
      <LegalLinks />
    </footer>
  </Layout>
);

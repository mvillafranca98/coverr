import type { FC } from "hono/jsx";
import { Wordmark } from "./brand";
import { Layout } from "./layout";

/**
 * The page for a request nothing could answer: a missing page or a crash.
 *
 * Light, because DESIGN.md picks the surface by audience, and whoever lands
 * on a dead link here was most likely sent it by a band — a buyer. It always
 * offers a way out: a page with no link on it leaves a phone with nothing to
 * tap but the back button.
 */
export const StatusPage: FC<{ title: string; heading: string; body: string }> = ({
  title,
  heading,
  body,
}) => (
  <Layout title={title}>
    <div class="status">
      <a class="home-mark" href="/" aria-label="Coverr, inicio">
        <Wordmark />
      </a>
      <h1>{heading}</h1>
      <p>{body}</p>
      <a class="status__home" href="/">
        Ir al inicio
      </a>
    </div>
  </Layout>
);

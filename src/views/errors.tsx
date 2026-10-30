import type { FC } from "hono/jsx";
import { MessagePage } from "./message";

/**
 * The way out of a page that has nothing else on it. Only these two pages get
 * it: they belong to no band, so Coverr's front page is the honest place to
 * send someone. A buyer on a sold-out or paused buy link came for one band,
 * and a page pitching Coverr to bands is no help to them.
 */
const GoHome: FC = () => (
  <a class="go-home" href="/">
    Ir al inicio
  </a>
);

/** Every path no router claims. */
export const NotFoundPage: FC = () => (
  <MessagePage
    title="No encontramos esta página — Coverr"
    label="Coverr"
    headline="No encontramos esta página"
  >
    <p class="blurb">Revisá el enlace que te compartieron.</p>
    <GoHome />
  </MessagePage>
);

/**
 * The crash page. It names no cause, because the cause is a stack trace, and
 * it speaks to the buyer who may already have transferred: that is the person
 * a failed purchase leaves worried.
 */
export const ServerErrorPage: FC = () => (
  <MessagePage title="Algo salió mal — Coverr" label="Coverr" headline="Algo salió mal">
    <p class="blurb">Volvé a intentarlo. Si ya transferiste, escribinos y lo resolvemos.</p>
    <GoHome />
  </MessagePage>
);

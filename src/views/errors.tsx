import type { FC } from "hono/jsx";
import { MessagePage } from "./message";

/** Every path no router claims. */
export const NotFoundPage: FC = () => (
  <MessagePage
    title="No encontramos esta página — Coverr"
    label="Coverr"
    headline="No encontramos esta página"
  >
    <p class="blurb">Revisá el enlace que te compartieron.</p>
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
  </MessagePage>
);

import type { FC, PropsWithChildren } from "hono/jsx";
import { Wordmark } from "../brand";

/**
 * The frame around sign-up and sign-in: the brand on one side, the form on
 * the other. These are the first band pages anyone sees, one click from the
 * landing page, so they keep its line and its light instead of dropping the
 * visitor onto a bare form. The copy is the landing page's own, and the mark
 * links back to it: these pages have no nav, so it is the only way home.
 */
export const AuthShell: FC<PropsWithChildren> = ({ children }) => (
  <div class="auth">
    <div class="auth__brand">
      <a class="auth__home" href="/" aria-label="Coverr, inicio">
        <Wordmark size={30} />
      </a>
      <p class="auth__pitch">
        Vendé tus boletos sin que el dinero pase por <em>nadie más</em>.
      </p>
      <ul class="auth__facts">
        <li>El dinero va directo a tu cuenta</li>
        <li>QR al instante</li>
        <li>Entrada sin señal</li>
      </ul>
    </div>
    <div class="auth__card">{children}</div>
  </div>
);

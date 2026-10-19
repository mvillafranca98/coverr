import type { FC } from "hono/jsx";

/**
 * The pair of legal links, in one place because they belong in the footer of
 * every page on both surfaces and LEG-01 is failed by any page that omits them.
 *
 * Renders no element of its own so it drops into whatever footer already
 * exists, light or dark, without fighting its layout.
 */
export const LegalLinks: FC = () => (
  <div>
    <a href="/privacidad">Privacidad</a>
    {" · "}
    <a href="/terminos">Términos</a>
  </div>
);

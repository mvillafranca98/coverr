import { tryGetContext } from "hono/context-storage";
import type { FC } from "hono/jsx";
import type { SecureHeadersVariables } from "hono/secure-headers";

/**
 * One of our own inline scripts, carrying this response's CSP nonce.
 *
 * Every page inlines its scripts so a buyer on venue wifi waits on one request,
 * not two. The CSP used to allow that with `'unsafe-inline'`, which would also
 * have run any script an HTML-injection bug let in. Now only a script carrying
 * the nonce runs, and only a script written through here carries it, so an
 * injected one never does (security review S7).
 *
 * The nonce is per response, made by `secureHeaders` in `src/index.tsx` and
 * read from the request this page is being rendered for (`contextStorage`).
 * Rendered outside a request, there is no nonce and the browser would refuse
 * the script, which is the safe way to be wrong.
 */
export const InlineScript: FC<{ code: string }> = ({ code }) => {
  const nonce = tryGetContext<{ Variables: SecureHeadersVariables }>()?.get("secureHeadersNonce");
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
};

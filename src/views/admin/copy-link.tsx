import type { FC } from "hono/jsx";

/**
 * A link the band is meant to share, with a button that copies it.
 *
 * Both links in this product are pasted somewhere — a flyer, a bio, a staff
 * WhatsApp group — and both were plain text to be selected by hand on a phone.
 *
 * `warn` exists because the two are easy to confuse and the consequences are
 * not symmetric. The sale link is public by design. The scanner link is a
 * bearer token: anyone holding it can register entries. Posting that where the
 * sale link belonged hands door control to whoever reads it, so copying it
 * asks first. The warning is the point; the copy is the convenience.
 *
 * The click handler lives once in AdminLayout and finds these by `data-copy`,
 * so a page can show as many of these as it likes without repeating a script.
 */
export const CopyLink: FC<{ url: string; warn?: string }> = ({ url, warn }) => (
  <div class="copyline">
    <code>{url}</code>
    <button type="button" class="btn sm ghost" data-copy={url} data-warn={warn}>
      Copiar
    </button>
  </div>
);

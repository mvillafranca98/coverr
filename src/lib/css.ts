/**
 * A stylesheet as it ships inlined in a page: without its comments.
 *
 * The comments in `src/styles` are written for whoever edits them — why a
 * colour, which contrast it was measured at, which design note it follows —
 * and every page used to carry them, about a fifth of each stylesheet
 * (security review S10). They cost the buyer bytes on venue wifi and tell a
 * visitor how the site is built. Blank lines left behind go too.
 *
 * A plain pattern is safe here because no stylesheet in `src/styles` puts
 * `/*` inside a string or a `url()`; `tests/css.test.ts` checks every one of
 * them for that, so a sheet that ever does fails the tests instead of shipping
 * broken.
 */
export function withoutComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

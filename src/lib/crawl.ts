/**
 * What search engines are told: which hostname is the real site, what they
 * may fetch, and which pages exist to be found.
 *
 * The pages decide for themselves whether they are indexable —
 * `views/layout.tsx` defaults to noindex and only the landing and legal pages
 * opt out. This file has to agree with them: a sitemap entry for a page that
 * says noindex is a contradiction search consoles report as an error.
 */

/**
 * Every page meant to turn up in a search result. Keep in step with the pages
 * that opt out of noindex: `views/landing/page.tsx` and `views/legal/doc.tsx`.
 */
export const INDEXABLE_PATHS = ["/", "/privacidad", "/terminos"] as const;

/**
 * Only paths that cannot carry a noindex of their own: the scanner and admin
 * APIs answer JSON and `/t/` answers QR images. `/admin` is here because
 * nothing behind it is ever linked publicly.
 *
 * The buy, ticket and refund pages are deliberately *not* listed. They already
 * say noindex, and a crawler can only obey a noindex it was allowed to read —
 * blocking them here invites a bare-URL listing for a page somebody shared.
 */
export const DISALLOWED_PREFIXES = ["/admin", "/api/", "/t/"] as const;

/**
 * True when the request is for the production site rather than a version
 * preview URL, a local server, or a hostname that has since been replaced.
 *
 * A malformed `APP_ORIGIN` counts as production. De-indexing the real site by
 * accident is the worse of the two mistakes, and a broken origin is visible
 * everywhere else long before it matters here.
 */
export function isCanonicalHost(requestUrl: string, appOrigin: string): boolean {
  try {
    return new URL(requestUrl).host === new URL(appOrigin).host;
  } catch {
    return true;
  }
}

/**
 * The robots file for this hostname.
 *
 * Anywhere but production nothing is blocked, because the noindex that keeps
 * those hosts out of search travels as a response header, and a crawler that
 * is shut out never sees it. The sitemap is only announced on the real site.
 */
export function robotsTxt(input: { canonical: boolean; appOrigin: string }): string {
  if (!input.canonical) return "User-agent: *\nDisallow:\n";
  return [
    "User-agent: *",
    ...DISALLOWED_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    "",
    `Sitemap: ${new URL(input.appOrigin).origin}/sitemap.xml`,
    "",
  ].join("\n");
}

/** The sitemap: absolute production URLs for every indexable page. */
export function sitemapXml(appOrigin: string): string {
  const origin = new URL(appOrigin).origin;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...INDEXABLE_PATHS.map((path) => `  <url><loc>${origin}${path}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

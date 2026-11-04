import { describe, expect, it } from "vitest";
import { INDEXABLE_PATHS, isCanonicalHost, robotsTxt, sitemapXml } from "../src/lib/crawl";

/**
 * What search engines are allowed to see. Both failure directions are real:
 * a robots rule that blocks too much hides the landing page, and one that
 * blocks too little lets a preview copy of the site compete with the real one.
 */

const PRODUCTION = "https://coverr.live";

describe("which hostname is the real site", () => {
  it("is the one APP_ORIGIN names", () => {
    expect(isCanonicalHost(`${PRODUCTION}/e/noche-de-ruido`, PRODUCTION)).toBe(true);
  });

  it("is not a version preview URL, which serves the whole site too", () => {
    const preview = "https://4f2a91c0-coverr.a-mencias99.workers.dev/";
    expect(isCanonicalHost(preview, PRODUCTION)).toBe(false);
  });

  // The address Coverr lived on before coverr.live has to drop out of search
  // on its own.
  it("is not the old workers.dev address", () => {
    expect(isCanonicalHost("https://coverr.a-mencias99.workers.dev/", PRODUCTION)).toBe(false);
  });

  it("tells ports apart, so a local server is never production", () => {
    expect(isCanonicalHost("http://localhost:8788/", "http://localhost:8787")).toBe(false);
  });

  it("treats a malformed APP_ORIGIN as production rather than de-indexing the site", () => {
    expect(isCanonicalHost(`${PRODUCTION}/`, "not a url")).toBe(true);
  });
});

describe("robots.txt on production", () => {
  const robots = robotsTxt({ canonical: true, appOrigin: PRODUCTION });
  const disallowed = robots
    .split("\n")
    .filter((line) => line.startsWith("Disallow:"))
    .map((line) => line.slice("Disallow:".length).trim());

  it("points to the sitemap with an absolute URL", () => {
    expect(robots).toContain(`Sitemap: ${PRODUCTION}/sitemap.xml`);
  });

  it("keeps crawlers out of what cannot carry a noindex of its own", () => {
    expect(disallowed).toEqual(["/admin", "/operador", "/api/", "/t/"]);
  });

  it("never blocks the whole site", () => {
    expect(disallowed).not.toContain("/");
  });

  // These pages already say noindex. Blocking them would stop a crawler
  // reading that, and risk a bare-URL listing for a page somebody shared.
  it("leaves the noindex pages crawlable so their noindex is read", () => {
    for (const path of ["/e/", "/boletos/", "/reembolso/", "/scan/"]) {
      expect(disallowed.some((prefix) => path.startsWith(prefix))).toBe(false);
    }
  });

  it("blocks nothing an indexable page lives under", () => {
    for (const path of INDEXABLE_PATHS) {
      expect(disallowed.some((prefix) => prefix !== "/" && path.startsWith(prefix))).toBe(false);
    }
  });
});

describe("robots.txt anywhere else", () => {
  const robots = robotsTxt({ canonical: false, appOrigin: PRODUCTION });

  // The noindex for these hosts is a response header; a crawler shut out by
  // robots.txt would never see it.
  it("blocks nothing, so the noindex header can be read", () => {
    expect(robots).toBe("User-agent: *\nDisallow:\n");
  });

  it("does not announce production's sitemap", () => {
    expect(robots).not.toContain("Sitemap:");
  });
});

describe("the sitemap", () => {
  it("lists every indexable page as an absolute production URL", () => {
    const xml = sitemapXml(PRODUCTION);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual([
      `${PRODUCTION}/`,
      `${PRODUCTION}/privacidad`,
      `${PRODUCTION}/terminos`,
      `${PRODUCTION}/guia`,
    ]);
  });

  it("does not double the slash when APP_ORIGIN ends with one", () => {
    expect(sitemapXml(`${PRODUCTION}/`)).toContain(`<loc>${PRODUCTION}/privacidad</loc>`);
  });

  it("declares the sitemap namespace search engines expect", () => {
    expect(sitemapXml(PRODUCTION)).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
  });
});

import { Hono } from "hono";
import { isCanonicalHost, robotsTxt, sitemapXml } from "../../lib/crawl";
import type { PublicEnv } from "./context";

export const crawlRoutes = new Hono<PublicEnv>();

/**
 * Served by the worker rather than as a static file because both answers
 * depend on `APP_ORIGIN`: the sitemap needs absolute URLs, and a preview
 * hostname must not hand out production's rules.
 */
crawlRoutes.get("/robots.txt", (c) => {
  const canonical = isCanonicalHost(c.req.url, c.env.APP_ORIGIN);
  return c.text(robotsTxt({ canonical, appOrigin: c.env.APP_ORIGIN }), 200, {
    "Cache-Control": "public, max-age=3600",
  });
});

crawlRoutes.get("/sitemap.xml", (c) =>
  c.body(sitemapXml(c.env.APP_ORIGIN), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  }),
);

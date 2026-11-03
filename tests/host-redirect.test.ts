import { describe, expect, it } from "vitest";
import { hostRedirectTarget } from "../src/lib/host-redirect";

/**
 * Links sent before coverr.live existed point at the workers.dev address. They
 * have to land on the same page on the new domain, and the few requests that
 * cannot survive a move to another origin have to be served where they are.
 */

const APP_ORIGIN = "https://coverr.live";
const WORKERS_DEV = "coverr.a-mencias99.workers.dev";
const REDIRECT_HOSTS = ["www.coverr.live", WORKERS_DEV];

const targetOf = (requestUrl: string, method = "GET", appOrigin = APP_ORIGIN) =>
  hostRedirectTarget({ requestUrl, method, appOrigin, redirectHosts: REDIRECT_HOSTS });

describe("a link to an old address", () => {
  it("lands on the same page, query included, on coverr.live", () => {
    expect(targetOf(`https://${WORKERS_DEV}/admin/entrar?t=abc123`)).toBe(
      "https://coverr.live/admin/entrar?t=abc123",
    );
  });

  it("on www goes to the bare domain", () => {
    expect(targetOf("https://www.coverr.live/e/noche-de-ruido")).toBe(
      "https://coverr.live/e/noche-de-ruido",
    );
  });

  it("over plain http goes straight to https, one hop instead of two", () => {
    expect(targetOf("http://www.coverr.live/")).toBe("https://coverr.live/");
  });

  it("is redirected for HEAD as well as GET", () => {
    expect(targetOf(`https://${WORKERS_DEV}/`, "HEAD")).toBe("https://coverr.live/");
  });

  it("cannot be bent into a redirect to another site", () => {
    const target = targetOf(`https://${WORKERS_DEV}//elsewhere.example/x`);
    expect(new URL(target ?? "").host).toBe("coverr.live");
  });
});

describe("answered where it was requested", () => {
  it("is everything on coverr.live itself", () => {
    expect(targetOf("https://coverr.live/e/noche-de-ruido")).toBeNull();
  });

  it("is a version preview URL, so a release can be tried before it goes out", () => {
    expect(targetOf("https://4f2a91c0-coverr.a-mencias99.workers.dev/")).toBeNull();
  });

  it("is a local server", () => {
    expect(targetOf("http://localhost:8788/")).toBeNull();
  });

  it("is a form post, which a redirect would arrive without", () => {
    expect(targetOf(`https://${WORKERS_DEV}/e/noche-de-ruido/comprar`, "POST")).toBeNull();
  });

  it("is the door scanner's sync, which cannot follow a redirect to another origin", () => {
    expect(targetOf(`https://${WORKERS_DEV}/api/scan/STAFFTOKEN/manifest`)).toBeNull();
  });

  it("is a QR image inside an email already sent", () => {
    expect(targetOf(`https://${WORKERS_DEV}/t/0123456789ABCDEFGHJKMNPQRS.png`)).toBeNull();
  });

  it("is everything when APP_ORIGIN is malformed, rather than a crash", () => {
    expect(targetOf(`https://${WORKERS_DEV}/`, "GET", "not a url")).toBeNull();
  });

  it("is everything when APP_ORIGIN's own host is listed, rather than a loop", () => {
    expect(targetOf("https://www.coverr.live/", "GET", "https://www.coverr.live")).toBeNull();
  });
});

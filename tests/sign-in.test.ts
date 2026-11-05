import { describe, expect, it } from "vitest";
import { operatorFromToken, operatorTokenPayload } from "../src/lib/operator";
import {
  bandFromLoginLink,
  bandFromSession,
  bandLoginPayload,
  bandSessionPayload,
  linkToSpend,
} from "../src/lib/sign-in";

/**
 * A sign-in link opens one session and no more (SEC-05). These are the rules
 * that tell a link from a session and give each link an id to spend it by;
 * the spending itself is one insert against that id.
 */

const exp = 9_999_999_999;

describe("a band's sign-in link", () => {
  it("names the band and carries its own id", () => {
    const link = { ...bandLoginPayload("bnd_1"), exp };
    expect(bandFromLoginLink(link)).toBe("bnd_1");
    expect(linkToSpend(link)).toEqual({
      linkId: link.jti,
      expiresAt: new Date(exp * 1000).toISOString(),
    });
  });

  it("gets a different id every time, so one spent link spends no other", () => {
    expect(bandLoginPayload("bnd_1").jti).not.toBe(bandLoginPayload("bnd_1").jti);
  });

  it("is refused as a session, so it cannot be pasted in as a cookie", () => {
    expect(bandFromSession({ ...bandLoginPayload("bnd_1"), exp })).toBeNull();
  });

  it("refuses a link without an id, as every link sent before this change was", () => {
    expect(bandFromLoginLink({ b: "bnd_1", exp })).toBeNull();
    expect(bandFromLoginLink({ b: "bnd_1", use: "band-login", exp })).toBeNull();
  });
});

describe("a band's session", () => {
  it("names the band, and cannot be used as a sign-in link", () => {
    const session = { ...bandSessionPayload("bnd_1"), exp };
    expect(bandFromSession(session)).toBe("bnd_1");
    expect(bandFromLoginLink(session)).toBeNull();
  });

  it("keeps sessions signed before links became single-use", () => {
    expect(bandFromSession({ b: "bnd_1", exp })).toBe("bnd_1");
  });

  it("never accepts an operator's token", () => {
    expect(bandFromSession({ op: "a@b.co", use: "operator-session", exp })).toBeNull();
  });
});

describe("an operator's sign-in link", () => {
  it("carries an id to spend it by, and its session does not", () => {
    const login = { ...operatorTokenPayload("a@b.co", "operator-login"), exp };
    const session = { ...operatorTokenPayload("a@b.co", "operator-session"), exp };
    expect(operatorFromToken(login, "operator-login")).toBe("a@b.co");
    expect(linkToSpend(login)?.linkId).toBeTruthy();
    expect(linkToSpend(session)).toBeNull();
  });
});

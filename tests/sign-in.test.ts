import { describe, expect, it } from "vitest";
import { operatorFromToken, operatorTokenPayload } from "../src/lib/operator";
import {
  bandCreatePayload,
  bandFromSession,
  bandLoginPayload,
  bandSessionPayload,
  bandToCreate,
  emailFromLoginLink,
  emailFromSession,
  linkToSpend,
} from "../src/lib/sign-in";

/**
 * A sign-in or creation link opens one session and no more (SEC-05), and a
 * session names the band in use plus the email it proved. These are the rules
 * that tell the kinds apart and give each link an id to spend it by.
 */

const exp = 9_999_999_999;

describe("a band's sign-in link", () => {
  it("names the person and carries its own id", () => {
    const link = { ...bandLoginPayload("ana@ejemplo.com"), exp };
    expect(emailFromLoginLink(link)).toBe("ana@ejemplo.com");
    expect(linkToSpend(link)).toEqual({
      linkId: link.jti,
      expiresAt: new Date(exp * 1000).toISOString(),
    });
  });

  it("gets a different id every time, so one spent link spends no other", () => {
    expect(bandLoginPayload("a@b.co").jti).not.toBe(bandLoginPayload("a@b.co").jti);
  });

  it("is refused as a session and as a creation link", () => {
    const link = { ...bandLoginPayload("a@b.co"), exp };
    expect(bandFromSession(link)).toBeNull();
    expect(bandToCreate(link)).toBeNull();
  });

  it("refuses a link without an id, and the band-id links sent before this change", () => {
    expect(emailFromLoginLink({ e: "a@b.co", use: "band-login", exp })).toBeNull();
    expect(emailFromLoginLink({ b: "bnd_1", use: "band-login", jti: "x", exp })).toBeNull();
  });
});

describe("a link that creates a band", () => {
  it("carries the person and the band's name", () => {
    const link = { ...bandCreatePayload("a@b.co", "Los Pérez"), exp };
    expect(bandToCreate(link)).toEqual({ email: "a@b.co", name: "Los Pérez" });
    expect(linkToSpend(link)?.linkId).toBe(link.jti);
  });

  it("cannot sign into anything or stand in for a session", () => {
    const link = { ...bandCreatePayload("a@b.co", "Los Pérez"), exp };
    expect(emailFromLoginLink(link)).toBeNull();
    expect(bandFromSession(link)).toBeNull();
  });
});

describe("a band's session", () => {
  it("names the band and the email it proved", () => {
    const session = { ...bandSessionPayload("bnd_1", "a@b.co"), exp };
    expect(bandFromSession(session)).toBe("bnd_1");
    expect(emailFromSession(session)).toBe("a@b.co");
    expect(emailFromLoginLink(session)).toBeNull();
  });

  it("keeps sessions signed before this change, without letting them switch bands", () => {
    expect(bandFromSession({ b: "bnd_1", exp })).toBe("bnd_1");
    expect(emailFromSession({ b: "bnd_1", exp })).toBeNull();
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

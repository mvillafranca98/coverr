import { describe, expect, it } from "vitest";
import { clearOperatorCookie, operatorCookie, sessionCookie } from "../src/lib/auth";
import { isOperatorEmail, operatorFromToken, operatorTokenPayload } from "../src/lib/operator";

/**
 * The operator panel opens every band's buyers and settings, so what matters
 * most is who it refuses: anyone off the list, and anything that is not an
 * operator token — above all, a band's own sign-in link or cookie.
 */

const OPERATORS = ["mvillafranca98@gmail.com", "a.mencias99@gmail.com"];

describe("who is an operator", () => {
  it("is an address on the list, whatever its case or spacing", () => {
    expect(isOperatorEmail("A.Mencias99@Gmail.com ", OPERATORS)).toBe(true);
  });

  it("is nobody else", () => {
    expect(isOperatorEmail("band@ejemplo.com", OPERATORS)).toBe(false);
  });

  it("is nobody at all when the list is missing or empty", () => {
    expect(isOperatorEmail("mvillafranca98@gmail.com", undefined)).toBe(false);
    expect(isOperatorEmail("mvillafranca98@gmail.com", [])).toBe(false);
  });

  it("is not an empty address, even if the list has a blank entry", () => {
    expect(isOperatorEmail("", ["", ...OPERATORS])).toBe(false);
  });
});

describe("what an operator token carries", () => {
  const login = operatorTokenPayload("mvillafranca98@gmail.com", "operator-login");
  const session = operatorTokenPayload("mvillafranca98@gmail.com", "operator-session");

  it("names the operator when it is the kind asked for", () => {
    expect(operatorFromToken(session, "operator-session")).toBe("mvillafranca98@gmail.com");
    expect(operatorFromToken(login, "operator-login")).toBe("mvillafranca98@gmail.com");
  });

  it("does not let a 15-minute sign-in link stand in for a session, or the reverse", () => {
    expect(operatorFromToken(login, "operator-session")).toBeNull();
    expect(operatorFromToken(session, "operator-login")).toBeNull();
  });

  // A band's link and its cookie both carry { b: bandId } and nothing else.
  it("never accepts a band's token", () => {
    expect(operatorFromToken({ b: "bnd_123", exp: 9999999999 }, "operator-session")).toBeNull();
    expect(operatorFromToken({ b: "bnd_123", exp: 9999999999 }, "operator-login")).toBeNull();
  });

  it("refuses a token whose operator is not a plain address", () => {
    expect(operatorFromToken({ op: 42, use: "operator-session" }, "operator-session")).toBeNull();
    expect(operatorFromToken({ op: "", use: "operator-session" }, "operator-session")).toBeNull();
    expect(operatorFromToken(null, "operator-session")).toBeNull();
  });

  it("stores the address normalised, so the list check cannot be dodged by case", () => {
    expect(operatorTokenPayload(" MVillafranca98@Gmail.com", "operator-login").op).toBe(
      "mvillafranca98@gmail.com",
    );
  });
});

describe("the operator cookie", () => {
  it("is sent only to /operador, never readable by script, never sent by another site", () => {
    const cookie = operatorCookie("token", true);
    expect(cookie).toContain("coverr_operator=token");
    expect(cookie).toContain("Path=/operador");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("lasts twelve hours rather than the band session's month", () => {
    expect(operatorCookie("token", true)).toContain(`Max-Age=${12 * 60 * 60}`);
    expect(sessionCookie("token", true)).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it("is cleared on the same path it was set on, or the browser keeps it", () => {
    expect(clearOperatorCookie(true)).toContain("Path=/operador");
    expect(clearOperatorCookie(true)).toContain("Max-Age=0");
  });

  it("leaves the band's session cookie as it was", () => {
    expect(sessionCookie("token", false)).toBe(
      `coverr_session=token; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
    );
  });
});

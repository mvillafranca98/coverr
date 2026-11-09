import { describe, expect, it } from "vitest";
import { operatorFromToken, operatorTokenPayload } from "../src/lib/operator";
import {
  bandCreatePayload,
  bandEmailChangePayload,
  bandLoginPayload,
  bandSessionFrom,
  bandSessionPayload,
  bandToCreate,
  emailChangeFromLink,
  emailFromLoginLink,
  linkToSpend,
  sessionHoldsBand,
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
    expect(bandSessionFrom(link)).toBeNull();
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
    expect(bandSessionFrom(link)).toBeNull();
  });
});

describe("a link that moves a band to a new email", () => {
  it("names the band, the address it had when asked, and the new one", () => {
    const link = { ...bandEmailChangePayload("bnd_1", "viejo@b.co", "nuevo@b.co"), exp };
    expect(emailChangeFromLink(link)).toEqual({
      bandId: "bnd_1",
      from: "viejo@b.co",
      to: "nuevo@b.co",
    });
    expect(linkToSpend(link)?.linkId).toBe(link.jti);
  });

  // It is mailed to an address the band does not control yet; set as a
  // cookie or replayed as a sign-in link it must open nothing.
  it("cannot stand in for a session, a sign-in link or a creation link", () => {
    const link = { ...bandEmailChangePayload("bnd_1", "viejo@b.co", "nuevo@b.co"), exp };
    expect(bandSessionFrom(link)).toBeNull();
    expect(emailFromLoginLink(link)).toBeNull();
    expect(bandToCreate(link)).toBeNull();
  });

  it("is refused without an id, a band or either address", () => {
    const { jti: _jti, ...noId } = bandEmailChangePayload("bnd_1", "a@b.co", "c@d.co");
    expect(emailChangeFromLink({ ...noId, exp })).toBeNull();
    expect(
      emailChangeFromLink({ ...bandEmailChangePayload("", "a@b.co", "c@d.co"), exp }),
    ).toBeNull();
    expect(
      emailChangeFromLink({ ...bandEmailChangePayload("bnd_1", "", "c@d.co"), exp }),
    ).toBeNull();
    expect(
      emailChangeFromLink({ ...bandEmailChangePayload("bnd_1", "a@b.co", ""), exp }),
    ).toBeNull();
  });

  it("is not a sign-in link's kind of payload, so the sign-in page refuses it", () => {
    expect(emailChangeFromLink({ ...bandLoginPayload("a@b.co"), exp })).toBeNull();
  });
});

describe("a band's session", () => {
  it("names the band and the email it proved", () => {
    const session = { ...bandSessionPayload("bnd_1", "a@b.co"), exp };
    expect(bandSessionFrom(session)).toEqual({ bandId: "bnd_1", email: "a@b.co" });
    expect(emailFromLoginLink(session)).toBeNull();
  });

  // Signed before 2026-11-04, with neither a purpose nor an email. With no
  // email there is nothing to hold them to the band's address, so they end.
  it("refuses sessions signed before sessions carried their email", () => {
    expect(bandSessionFrom({ b: "bnd_1", exp })).toBeNull();
    expect(bandSessionFrom({ b: "bnd_1", use: "band-session", exp })).toBeNull();
  });

  it("never accepts an operator's token", () => {
    expect(bandSessionFrom({ op: "a@b.co", use: "operator-session", exp })).toBeNull();
  });
});

describe("whether a session still belongs to its band", () => {
  it("holds while the band keeps the address the session proved", () => {
    expect(
      sessionHoldsBand({ email: "ana@ejemplo.com" }, { contactEmail: "ana@ejemplo.com" }),
    ).toBe(true);
  });

  // The usual reason to move is losing the old inbox; whoever has it now
  // must not keep the panel for the rest of the cookie's 30 days.
  it("ends once the band has moved to another address", () => {
    expect(
      sessionHoldsBand({ email: "vieja@ejemplo.com" }, { contactEmail: "nueva@ejemplo.com" }),
    ).toBe(false);
  });

  it("ignores case and stray spaces, as every stored address is normalised", () => {
    expect(
      sessionHoldsBand({ email: "Ana@Ejemplo.com " }, { contactEmail: "ana@ejemplo.com" }),
    ).toBe(true);
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

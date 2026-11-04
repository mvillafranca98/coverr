import { describe, expect, it } from "vitest";
import {
  bankLabel,
  formatLps,
  formatLpsShort,
  formatMoment,
  formatShortDate,
  isReadableProof,
  isRenderableImage,
  jsonForScript,
  lpsToCentavos,
  normalizeEmail,
  normalizePhone,
  PROOF_RETENTION_DAYS,
  proofsExpired,
  purgeAfter,
  slugify,
} from "../src/lib/core";

/**
 * Money, identity and the small conversions everything else sits on.
 *
 * Money is centavos as integers everywhere. A float anywhere in here would
 * eventually hand somebody the wrong change.
 */

describe("formatLps", () => {
  it("renders centavos as lempiras", () => {
    expect(formatLps(20000)).toBe("L200.00");
    expect(formatLps(1)).toBe("L0.01");
    expect(formatLps(0)).toBe("L0.00");
  });

  it("groups thousands", () => {
    expect(formatLps(5265200)).toBe("L52,652.00");
  });

  it("keeps the minus sign outside the symbol, for refund lines", () => {
    expect(formatLps(-20000)).toBe("-L200.00");
  });

  it("always shows two decimal places", () => {
    expect(formatLps(20050)).toBe("L200.50");
    expect(formatLps(20005)).toBe("L200.05");
  });
});

describe("formatLpsShort", () => {
  it("drops the decimals when there are none", () => {
    expect(formatLpsShort(20000)).toBe("L200");
    expect(formatLpsShort(5265200)).toBe("L52,652");
  });

  it("keeps them when they matter", () => {
    expect(formatLpsShort(20050)).toBe("L200.50");
  });
});

describe("lpsToCentavos", () => {
  it("converts lempiras to integer centavos", () => {
    expect(lpsToCentavos("200")).toBe(20000);
    expect(lpsToCentavos("200.50")).toBe(20050);
    expect(lpsToCentavos(1)).toBe(100);
  });

  // A blank price field must not silently become a free ticket. This was a
  // real bug: an empty cell read as L0.
  it("returns null for blank rather than zero", () => {
    expect(lpsToCentavos("")).toBeNull();
    expect(lpsToCentavos("   ")).toBeNull();
    expect(lpsToCentavos(null)).toBeNull();
    expect(lpsToCentavos(undefined)).toBeNull();
  });

  // But a deliberate zero is how a comp gets issued, so it has to survive.
  it("keeps a deliberate zero", () => {
    expect(lpsToCentavos("0")).toBe(0);
    expect(lpsToCentavos(0)).toBe(0);
  });

  it("rejects negatives and nonsense", () => {
    expect(lpsToCentavos("-5")).toBeNull();
    expect(lpsToCentavos("abc")).toBeNull();
    expect(lpsToCentavos(Number.NaN)).toBeNull();
    expect(lpsToCentavos(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("never returns a fractional centavo", () => {
    expect(Number.isInteger(lpsToCentavos("200.005") as number)).toBe(true);
  });
});

describe("slugify", () => {
  it("strips accents, which Honduran event names are full of", () => {
    expect(slugify("Última Noche")).toBe("ultima-noche");
    expect(slugify("Jungla en vivo")).toBe("jungla-en-vivo");
  });

  it("collapses punctuation and trims the edges", () => {
    expect(slugify("  ¡Rock & Roll!  ")).toBe("rock-roll");
  });

  // A slug is part of a public URL, so it can never be empty.
  it("falls back rather than producing an empty slug", () => {
    expect(slugify("¡!¿?")).toBe("evento");
    expect(slugify("")).toBe("evento");
  });

  it("caps the length", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(48);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims, so one address is one person", () => {
    expect(normalizeEmail("  Vos@Ejemplo.COM ")).toBe("vos@ejemplo.com");
  });
});

describe("normalizePhone", () => {
  it("keeps digits only", () => {
    expect(normalizePhone("9999-8888")).toBe("99998888");
    expect(normalizePhone("+504 9999 8888")).toBe("99998888");
  });

  // Honduran numbers are eight digits; the 504 country code is noise that
  // would otherwise make one person look like two.
  it("drops the Honduran country code", () => {
    expect(normalizePhone("50499998888")).toBe("99998888");
  });

  it("returns null for nothing", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

// Band-controlled text — band, event, venue, account holder — is written into
// inline scripts on buyer pages. A value must never be able to end the script
// it sits in, and must still arrive unchanged.
describe("jsonForScript", () => {
  const LINE_SEPARATOR = String.fromCharCode(0x2028);
  const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

  it("cannot close the script it is written into", () => {
    const out = jsonForScript("</script><script>alert(document.cookie)</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out.toLowerCase()).not.toContain("</script");
  });

  it("cannot open an HTML comment", () => {
    expect(jsonForScript("<!-- Noche de Ruido")).not.toContain("<!--");
  });

  it("escapes as the \\u form JavaScript reads back", () => {
    expect(jsonForScript("a<b&c>d")).toBe('"a\\u003cb\\u0026c\\u003ed"');
  });

  it("escapes the line separators older engines treat as line breaks", () => {
    const out = jsonForScript(`uno${LINE_SEPARATOR}dos${PARAGRAPH_SEPARATOR}tres`);
    expect(out).not.toContain(LINE_SEPARATOR);
    expect(out).not.toContain(PARAGRAPH_SEPARATOR);
    expect(out).toBe('"uno\\u2028dos\\u2029tres"');
  });

  // The page's script reads these values as JavaScript, so that is the test:
  // evaluate the output and compare.
  it("arrives unchanged when the page evaluates it", () => {
    const value = {
      band: "Los </script> Últimos & Cía",
      venue: `Casa${LINE_SEPARATOR}Quinchón`,
      accounts: { BAC: { n: "730-123456-7", h: "José <Pérez>", b: "BAC Credomatic" } },
    };
    const evaluated = new Function(`return ${jsonForScript(value)};`)();
    expect(evaluated).toEqual(value);
  });

  it("leaves ordinary text alone", () => {
    expect(jsonForScript("Noche de Ruido")).toBe('"Noche de Ruido"');
    expect(jsonForScript(25000)).toBe("25000");
  });
});

describe("purgeAfter", () => {
  it("is the retention window past the event", () => {
    const due = new Date(purgeAfter("2026-12-05T21:00:00Z"));
    const event = new Date("2026-12-05T21:00:00Z");
    const days = (due.getTime() - event.getTime()) / 86400000;
    expect(days).toBe(PROOF_RETENTION_DAYS);
  });

  // The privacy notice states this number to the people whose data it is.
  it("is the 30 days the privacy notice promises", () => {
    expect(PROOF_RETENTION_DAYS).toBe(30);
  });
});

// The nightly file sweep decides from this, so it has to agree with the
// instant stamped on every proof row by purgeAfter.
describe("proofsExpired", () => {
  const event = "2026-10-24T21:00:00-06:00";
  const due = new Date(purgeAfter(event));

  it("is false the moment before the stamped deletion time", () => {
    expect(proofsExpired(event, new Date(due.getTime() - 1))).toBe(false);
  });

  it("is true from the stamped deletion time on", () => {
    expect(proofsExpired(event, due)).toBe(true);
    expect(proofsExpired(event, new Date(due.getTime() + 86400000))).toBe(true);
  });

  it("is false for an event that has not happened yet", () => {
    expect(proofsExpired(event, new Date("2026-10-20T00:00:00Z"))).toBe(false);
  });

  // Deleting a band's proofs early is not a guess worth making.
  it("never treats an unreadable date as expired", () => {
    expect(proofsExpired("pronto", new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("accepted file types", () => {
  it("reads the formats a bank actually produces", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(isReadableProof(t)).toBe(true);
    }
  });

  // iPhone photos default to HEIC and the vision API cannot read it, so it is
  // excluded on purpose rather than by oversight.
  it("rejects HEIC", () => {
    expect(isReadableProof("image/heic")).toBe(false);
  });

  it("separates what can be rendered for a human from what can be read", () => {
    expect(isRenderableImage("application/pdf")).toBe(false);
    expect(isRenderableImage("image/png")).toBe(true);
  });
});

describe("bankLabel", () => {
  it("names the six banks the product supports", () => {
    expect(bankLabel("BAC")).toBeTruthy();
    expect(bankLabel("BAC")).not.toBe("BAC");
  });

  it("falls back to the code rather than rendering nothing", () => {
    expect(bankLabel("NOPE")).toBe("NOPE");
  });
});

describe("formatMoment", () => {
  it("says when something happened in Honduras time, not the server's UTC", () => {
    // 19:17 UTC is 1:17pm in Tegucigalpa: the order page used to show 7:17pm.
    expect(formatMoment("2026-11-04T19:17:04.000Z")).toBe("4 de noviembre, 1:17pm");
  });

  it("moves to the right day across midnight", () => {
    expect(formatMoment("2026-11-05T03:30:00.000Z")).toBe("4 de noviembre, 9:30pm");
  });
});

describe("formatLpsShort with a loss", () => {
  it("puts the sign before the L", () => {
    expect(formatLpsShort(-200000)).toBe("-L2,000");
    expect(formatLpsShort(-150)).toBe("-L1.50");
    expect(formatLpsShort(0)).toBe("L0");
  });
});

describe("formatShortDate", () => {
  it("gives day and short month in Honduras", () => {
    expect(formatShortDate("2026-11-05T03:30:00.000Z")).toBe("4 nov");
    expect(formatShortDate("2027-02-07T02:00:00.000Z")).toBe("6 feb");
  });
});

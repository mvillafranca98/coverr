import { describe, expect, it } from "vitest";
import { recoveryEmailHtml, recoveryEmailText } from "../src/views/email";

/**
 * `/recuperar` answers with one email for every order on the address, each a
 * link to its ticket page. It used to send the full ticket email once per
 * order, which let one request become a pile of mail (security review S5).
 */

const order = (over: Partial<Parameters<typeof recoveryEmailHtml>[0]["orders"][number]> = {}) => ({
  orderId: "ord_1",
  shortCode: "JGL-4827",
  bandName: "Jungla",
  eventName: "Noche de prueba",
  venue: "Local",
  startsAt: "2026-12-05T21:00:00-06:00",
  tickets: 2,
  ...over,
});

describe("the recovery email", () => {
  it("links every order to its own ticket page, in both versions", () => {
    const input = {
      orders: [order(), order({ orderId: "ord_2", shortCode: "JGL-9999", tickets: 1 })],
      origin: "https://coverr.live",
    };
    for (const body of [recoveryEmailHtml(input), recoveryEmailText(input)]) {
      expect(body).toContain("https://coverr.live/boletos/ord_1");
      expect(body).toContain("https://coverr.live/boletos/ord_2");
      expect(body).toContain("2 boletos · Código JGL-4827");
      expect(body).toContain("1 boleto · Código JGL-9999");
    }
  });

  it("escapes what a band or a buyer typed", () => {
    const html = recoveryEmailHtml({
      orders: [order({ eventName: "<script>x</script>", bandName: "A & B" })],
      origin: "https://coverr.live",
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});

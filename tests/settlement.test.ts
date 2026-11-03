import { describe, expect, it } from "vitest";
import {
  type ChannelTotals,
  computeSettlement,
  freeFirstEventLastDay,
  freeFirstEventOfferOpen,
  freePassCovers,
  isFreeFirstEvent,
  type MemberInput,
  perHead,
  priceBracket,
  unlockPrice,
} from "../src/lib/settlement";

/**
 * The split a band actually gets paid from.
 *
 * Money is centavos throughout: L200.00 is 20000. Every figure here is written
 * in centavos for that reason, and the comments give the lempira equivalent
 * where it helps.
 */

const NO_SALES: ChannelTotals = {
  presale: 0,
  doorTransfer: 0,
  doorCash: 0,
  manual: 0,
  comp: 0,
};

function members(...pcts: number[]): MemberInput[] {
  return pcts.map((splitPct, i) => ({
    id: `m${i}`,
    name: `Integrante ${i + 1}`,
    splitPct,
    advances: 0,
  }));
}

describe("gross", () => {
  it("sums every paying channel", () => {
    const s = computeSettlement({
      channels: { presale: 10000, doorTransfer: 5000, doorCash: 3000, manual: 2000, comp: 0 },
      costs: 0,
      members: [],
      headcount: 0,
    });
    expect(s.gross).toBe(20000);
  });

  // Comps check in and count toward attendance, but a free ticket is not
  // revenue and must never reach a pricing bracket.
  it("excludes comps, however many there are", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 10000, comp: 999999 },
      costs: 0,
      members: [],
      headcount: 0,
    });
    expect(s.gross).toBe(10000);
  });
});

describe("net", () => {
  it("is gross minus costs", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 50000 },
      costs: 20000,
      members: [],
      headcount: 0,
    });
    expect(s.net).toBe(30000);
  });

  // A band that spent more than it took has to be told, not shielded from it.
  it("goes negative when the night lost money", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 10000 },
      costs: 25000,
      members: [],
      headcount: 0,
    });
    expect(s.net).toBe(-15000);
  });
});

describe("member shares", () => {
  it("splits evenly across four equal members", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 40000 },
      costs: 0,
      members: members(25, 25, 25, 25),
      headcount: 0,
    });
    expect(s.members.map((m) => m.share)).toEqual([10000, 10000, 10000, 10000]);
    expect(s.unallocated).toBe(0);
  });

  it("splits unevenly when the percentages differ", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 100000 },
      costs: 0,
      members: members(40, 30, 20, 10),
      headcount: 0,
    });
    expect(s.members.map((m) => m.share)).toEqual([40000, 30000, 20000, 10000]);
  });

  it("subtracts a member's advances from their payout but not their share", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 40000 },
      costs: 0,
      members: [
        { id: "a", name: "Keyla", splitPct: 50, advances: 5000 },
        { id: "b", name: "Marvin", splitPct: 50, advances: 0 },
      ],
      headcount: 0,
    });
    expect(s.members[0].share).toBe(20000);
    expect(s.members[0].payout).toBe(15000);
    expect(s.members[1].payout).toBe(20000);
  });

  it("lets a payout go negative when advances exceed the share", () => {
    // Somebody who already took more than the night earned owes it back. The
    // figure is shown rather than floored at zero.
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 10000 },
      costs: 0,
      members: [{ id: "a", name: "Keyla", splitPct: 100, advances: 15000 }],
      headcount: 0,
    });
    expect(s.members[0].payout).toBe(-5000);
  });
});

describe("percentages that do not total 100", () => {
  // Warn, never block: bands deliberately hold back a remainder for the fund.
  it("reports the total so the caller can warn", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 40000 },
      costs: 0,
      members: members(25, 25, 25),
      headcount: 0,
    });
    expect(s.pctTotal).toBe(75);
  });

  it("leaves the remainder visible as unallocated rather than hiding it", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 40000 },
      costs: 0,
      members: members(25, 25, 25),
      headcount: 0,
    });
    expect(s.unallocated).toBe(10000);
  });

  it("still computes when percentages exceed 100", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 10000 },
      costs: 0,
      members: members(60, 60),
      headcount: 0,
    });
    expect(s.pctTotal).toBe(120);
    expect(s.unallocated).toBe(-2000);
  });
});

describe("rounding", () => {
  // Three equal shares of an amount that does not divide by three. The
  // leftover centavo has to surface somewhere rather than vanish.
  it("never loses a centavo — shares plus unallocated equal net", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 10000 },
      costs: 0,
      members: members(33.33, 33.33, 33.34),
      headcount: 0,
    });
    const allocated = s.members.reduce((n, m) => n + m.share, 0);
    expect(allocated + s.unallocated).toBe(s.net);
  });

  it("keeps every share an integer number of centavos", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 10001 },
      costs: 0,
      members: members(33.33, 33.33, 33.34),
      headcount: 0,
    });
    for (const m of s.members) expect(Number.isInteger(m.share)).toBe(true);
  });
});

describe("perHead", () => {
  it("divides by headcount", () => {
    const s = computeSettlement({
      channels: { ...NO_SALES, presale: 100000 },
      costs: 40000,
      members: [],
      headcount: 100,
    });
    expect(perHead(s)).toEqual({ gross: 1000, net: 600, cost: 400 });
  });

  // Dividing by nobody is not zero, it is unanswerable.
  it("returns null rather than dividing by zero", () => {
    const s = computeSettlement({ channels: NO_SALES, costs: 0, members: [], headcount: 0 });
    expect(perHead(s)).toBeNull();
  });
});

describe("priceBracket", () => {
  it("charges by tickets sold", () => {
    expect(priceBracket(1).amount).toBe(50000);
    expect(priceBracket(60).amount).toBe(50000);
    expect(priceBracket(61).amount).toBe(100000);
    expect(priceBracket(150).amount).toBe(100000);
    expect(priceBracket(151).amount).toBe(150000);
    expect(priceBracket(300).amount).toBe(150000);
    expect(priceBracket(301).amount).toBe(200000);
    expect(priceBracket(5000).amount).toBe(200000);
  });

  it("names each bracket distinctly", () => {
    const names = [1, 61, 151, 301].map((n) => priceBracket(n).bracket);
    expect(new Set(names).size).toBe(4);
  });

  // The landing page and the terms both derive their tables from this, so
  // these are the published prices. Changing one is a pricing decision, and
  // the spec's pricing table (coverr-spec.html, section 11) moves with it.
  it("charges the published L500 to L2,000", () => {
    expect([60, 150, 300, 301].map((n) => priceBracket(n).amount)).toEqual([
      50000, 100000, 150000, 200000,
    ]);
  });
});

// "Primer toque gratis" is a launch offer that ends with January 2027, judged
// by when the show is held. Times are Honduras time, which is UTC-6 all year.
describe("the free first event", () => {
  const first = (eventStartsAt: string) =>
    isFreeFirstEvent({ bandsFirstUnlock: true, eventStartsAt });

  it("is free when the band's first event is held by 31 January", () => {
    expect(first("2026-12-12T21:00:00-06:00")).toBe(true);
    expect(first("2027-01-31T23:59:00-06:00")).toBe(true);
  });

  it("is charged when it is held from 1 February on, even though it is the first", () => {
    expect(first("2027-02-01T00:00:00-06:00")).toBe(false);
    expect(first("2027-03-20T21:00:00-06:00")).toBe(false);
  });

  // A late show on the 31st in Honduras is already 1 February in UTC.
  it("reads the deadline in Honduras time, not UTC", () => {
    expect(first("2027-02-01T05:30:00Z")).toBe(true);
    expect(first("2027-02-01T06:00:00Z")).toBe(false);
  });

  it("is never free once the band has unlocked an event before", () => {
    expect(
      isFreeFirstEvent({ bandsFirstUnlock: false, eventStartsAt: "2026-12-12T21:00:00-06:00" }),
    ).toBe(false);
  });

  it("gives no discount for an unreadable start date", () => {
    expect(first("not a date")).toBe(false);
  });

  it("is offered on the landing page until the last day ends", () => {
    expect(freeFirstEventOfferOpen(new Date("2027-01-31T23:59:59-06:00"))).toBe(true);
    expect(freeFirstEventOfferOpen(new Date("2027-02-01T00:00:00-06:00"))).toBe(false);
  });

  // The landing page and the terms quote these; the spec's section 11 says the same.
  it("names its last day the way the copy quotes it", () => {
    expect(freeFirstEventLastDay()).toBe("31 de enero");
    expect(freeFirstEventLastDay({ year: true })).toBe("31 de enero de 2027");
  });
});

// A free pass is the operator's to give, permanently or until a day. Like the
// first-event offer it is judged by when the show is held.
describe("a free pass", () => {
  it("covers every event when it has no end", () => {
    expect(freePassCovers({ until: null }, "2031-06-01T21:00:00-06:00")).toBe(true);
  });

  it("covers an event held on its last day, Honduras time, and not the day after", () => {
    expect(freePassCovers({ until: "2026-12-31" }, "2026-12-31T23:30:00-06:00")).toBe(true);
    expect(freePassCovers({ until: "2026-12-31" }, "2027-01-01T00:00:00-06:00")).toBe(false);
  });

  it("covers nothing when the band holds no pass, or a date cannot be read", () => {
    expect(freePassCovers(null, "2026-12-12T21:00:00-06:00")).toBe(false);
    expect(freePassCovers({ until: "2026-12-31" }, "not a date")).toBe(false);
    expect(freePassCovers({ until: "someday" }, "2026-12-12T21:00:00-06:00")).toBe(false);
  });
});

describe("what unlocking a report costs", () => {
  const LATER_GIG = "2027-03-20T21:00:00-06:00";

  it("is the bracket price for an ordinary report", () => {
    const price = unlockPrice({
      paidTickets: 152,
      bandsFirstUnlock: false,
      eventStartsAt: LATER_GIG,
      freePass: null,
    });
    expect(price).toEqual({
      bracket: { bracket: "t300", amount: 150000 },
      amount: 150000,
      waiver: null,
    });
  });

  it("is nothing under a free pass, which wins over the first-event offer", () => {
    const price = unlockPrice({
      paidTickets: 152,
      bandsFirstUnlock: true,
      eventStartsAt: "2026-12-12T21:00:00-06:00",
      freePass: { until: null },
    });
    expect(price.amount).toBe(0);
    expect(price.waiver).toBe("free_pass");
  });

  it("is nothing for a first event inside the offer when there is no pass", () => {
    const price = unlockPrice({
      paidTickets: 40,
      bandsFirstUnlock: true,
      eventStartsAt: "2026-12-12T21:00:00-06:00",
      freePass: null,
    });
    expect(price).toEqual({
      bracket: { bracket: "t60", amount: 50000 },
      amount: 0,
      waiver: "free_first",
    });
  });

  it("is charged once a pass has ended before the show", () => {
    const price = unlockPrice({
      paidTickets: 40,
      bandsFirstUnlock: false,
      eventStartsAt: LATER_GIG,
      freePass: { until: "2026-12-31" },
    });
    expect(price.amount).toBe(50000);
    expect(price.waiver).toBeNull();
  });
});

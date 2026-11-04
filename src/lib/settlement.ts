import { formatDayMonth, HN_OFFSET } from "./core";

/**
 * Settlement, restructured from the original spreadsheet.
 *
 * The sheet subtracted every cost from the presale bucket and then added the
 * door take. That reaches the right total, but only while every split is equal —
 * add one session musician at 10% and "which bucket did the sound bill come
 * from" becomes something you have to explain to the people you're paying.
 *
 *   Gross     = presale + door transfer + door cash   (comps contribute 0)
 *   Costs     = sum of expenses
 *   Net       = Gross - Costs
 *   Share[i]  = Net * pct[i]
 *   Payout[i] = Share[i] - advances[i]
 *
 * Everything is centavos. Rounding happens once, at the share, and the
 * remainder is surfaced rather than silently absorbed.
 */

export type ChannelTotals = {
  presale: number;
  doorTransfer: number;
  doorCash: number;
  /** Sold by the band away from the link and the door — cash in hand, or a
   *  trade. Separate from doorCash so the cash drawer still reconciles. */
  manual: number;
  comp: number;
};

export type MemberInput = {
  id: string;
  name: string;
  splitPct: number;
  advances: number;
};

export type MemberPayout = MemberInput & {
  share: number;
  payout: number;
};

export type Settlement = {
  gross: number;
  costs: number;
  net: number;
  members: MemberPayout[];
  /** Sum of split percentages. Warn when not 100 — never block: bands
   *  sometimes hold back a deliberate remainder for the fund. */
  pctTotal: number;
  /** Net minus the sum of all shares. Non-zero when pctTotal != 100, or by a
   *  centavo or two from rounding. Shown, never hidden. */
  unallocated: number;
  headcount: number;
};

export function computeSettlement(input: {
  channels: ChannelTotals;
  costs: number;
  members: MemberInput[];
  headcount: number;
}): Settlement {
  const { channels, costs, members, headcount } = input;
  const gross = channels.presale + channels.doorTransfer + channels.doorCash + channels.manual;
  const net = gross - costs;

  const pctTotal = members.reduce((n, m) => n + m.splitPct, 0);
  const withShares: MemberPayout[] = members.map((m) => {
    const share = Math.round((net * m.splitPct) / 100);
    return { ...m, share, payout: share - m.advances };
  });

  const allocated = withShares.reduce((n, m) => n + m.share, 0);

  return {
    gross,
    costs,
    net,
    members: withShares,
    pctTotal,
    unallocated: net - allocated,
    headcount,
  };
}

/** Per-head figures are the only honest way to compare events of different sizes. */
export function perHead(s: Settlement): { gross: number; net: number; cost: number } | null {
  if (s.headcount <= 0) return null;
  return {
    gross: Math.round(s.gross / s.headcount),
    net: Math.round(s.net / s.headcount),
    cost: Math.round(s.costs / s.headcount),
  };
}

/**
 * Where the flat brackets stop. Coverr is built for independent bands, for
 * whom 300 to 500 people is a big night; past this, a show is priced by its
 * size instead of capped, so a 2,000-person event does not pay what a 400 one
 * does.
 */
export const LARGE_SHOW_FROM = 500;

/**
 * What each ticket past LARGE_SHOW_FROM adds, in centavos (L4). Set on
 * 2026-11-04 against what a ticket costs Coverr to process — one receipt read
 * per order, about L0.50 to L1, plus an email — so it pays for itself several
 * times over and still stays near 2% of a large show's gross.
 */
export const LARGE_SHOW_PER_TICKET = 400;

/**
 * Pricing bracket, resolved from tickets actually sold. Comps never count —
 * they are free tickets and charging for them would be indefensible.
 * A band's first event can be free regardless of size; see `isFreeFirstEvent`.
 *
 * Reports unlocked before 2026-11-04 may carry the old top bracket,
 * `t301plus` (L2,000 flat for any size); it stays readable in history.
 */
export function priceBracket(ticketsSold: number): { bracket: string; amount: number } {
  if (ticketsSold <= 60) return { bracket: "t60", amount: 50000 };
  if (ticketsSold <= 150) return { bracket: "t150", amount: 100000 };
  if (ticketsSold <= 300) return { bracket: "t300", amount: 150000 };
  if (ticketsSold <= LARGE_SHOW_FROM) return { bracket: "t500", amount: 200000 };
  const extraTickets = ticketsSold - LARGE_SHOW_FROM;
  return { bracket: "t501plus", amount: 200000 + extraTickets * LARGE_SHOW_PER_TICKET };
}

/**
 * "Primer toque gratis" is a launch offer, not a permanent tier: a band's first
 * event is free only if it is held on or before this day, Honduras time.
 * Extending the offer is this one line — the landing page and the terms quote
 * the date from here.
 */
const FREE_FIRST_EVENT_LAST_DAY = "2027-01-31";

const DAY_MS = 24 * 3600 * 1000;

/** Midnight at the end of a YYYY-MM-DD day in Honduras (no DST), or NaN for a bad date. */
function endOfHondurasDay(day: string): number {
  return Date.parse(`${day}T00:00:00${HN_OFFSET}`) + DAY_MS;
}

/** Midnight at the end of the offer's last day. */
const FREE_FIRST_EVENT_ENDS_AT = endOfHondurasDay(FREE_FIRST_EVENT_LAST_DAY);

/** The offer's last day as copy quotes it: "31 de enero", or with the year. */
export function freeFirstEventLastDay(options: { year?: boolean } = {}): string {
  return formatDayMonth(`${FREE_FIRST_EVENT_LAST_DAY}T12:00:00${HN_OFFSET}`, options);
}

/** True while a band could still hold a free first event — the landing page offers it. */
export function freeFirstEventOfferOpen(now: Date): boolean {
  return now.getTime() < FREE_FIRST_EVENT_ENDS_AT;
}

/**
 * True when unlocking this event's report costs nothing: it is the first event
 * the band has ever unlocked, and it is held by the offer's last day.
 *
 * Judged by when the show happens, not when it was created or unlocked. A band
 * setting up a March gig in December would otherwise stretch the offer months
 * past its end, while a January gig unlocked in February is still inside it.
 * An unreadable start date gets no discount rather than one by accident.
 */
export function isFreeFirstEvent(input: {
  bandsFirstUnlock: boolean;
  eventStartsAt: string;
}): boolean {
  if (!input.bandsFirstUnlock) return false;
  const startsAt = Date.parse(input.eventStartsAt);
  return !Number.isNaN(startsAt) && startsAt < FREE_FIRST_EVENT_ENDS_AT;
}

/** A band's free pass: the last day it covers (YYYY-MM-DD), or null if it never ends. */
export type FreePass = { until: string | null };

/**
 * True when the band's free pass covers this event. Judged by when the show is
 * held, like the first-event offer, so a pass "until December" covers a
 * December gig unlocked in January and not a January gig. An unreadable date
 * on either side is not covered.
 */
export function freePassCovers(pass: FreePass | null, eventStartsAt: string): boolean {
  if (!pass) return false;
  if (pass.until === null) return true;
  const startsAt = Date.parse(eventStartsAt);
  const passEndsAt = endOfHondurasDay(pass.until);
  return !Number.isNaN(startsAt) && !Number.isNaN(passEndsAt) && startsAt < passEndsAt;
}

/**
 * A discount the operator granted one band: a percentage off its next charged
 * reports, for shows held by `until` (YYYY-MM-DD) when there is one.
 */
export type Promo = { percent: number; reportsLeft: number; until: string | null };

/**
 * True when the promo can price this event: it has a report left, a sane
 * percentage, and the show is held by its last day. Judged by the show's
 * date, like every other offer here.
 */
export function promoApplies(promo: Promo | null, eventStartsAt: string): promo is Promo {
  if (!promo || promo.reportsLeft < 1 || promo.percent < 1 || promo.percent > 100) return false;
  if (promo.until === null) return true;
  const startsAt = Date.parse(eventStartsAt);
  const promoEndsAt = endOfHondurasDay(promo.until);
  return !Number.isNaN(startsAt) && !Number.isNaN(promoEndsAt) && startsAt < promoEndsAt;
}

/**
 * The bracket price less the promo, to the nearest whole lempira: the band
 * types this into its banking app, and L333.33 is a number nobody gets right.
 */
export function discountedAmount(amount: number, percent: number): number {
  return Math.round((amount * (100 - percent)) / 100 / 100) * 100;
}

/** Why a report costs nothing, or null when something is charged. */
export type UnlockWaiver = "free_pass" | "free_first" | "promo";

export type UnlockPrice = {
  /** The bracket the paid tickets fall in, shown even when nothing is charged. */
  bracket: { bracket: string; amount: number };
  /** What the band pays: zero when waived. */
  amount: number;
  waiver: UnlockWaiver | null;
  /** The promo's percentage when one priced this report, so the page and the unlock can say so. */
  discountPercent: number | null;
};

/**
 * What unlocking this event's report costs the band.
 *
 * A free pass comes first, because the operator granted it on purpose; then
 * the first-event offer; then a promo; otherwise the bracket for the paid
 * tickets. Nothing stacks — a report already free leaves the promo unused for
 * the next one. A promo of 100% makes the report free outright. Comps never
 * count: the caller passes tickets sold minus comps.
 */
export function unlockPrice(input: {
  paidTickets: number;
  bandsFirstUnlock: boolean;
  eventStartsAt: string;
  freePass: FreePass | null;
  promo: Promo | null;
}): UnlockPrice {
  const bracket = priceBracket(input.paidTickets);
  if (freePassCovers(input.freePass, input.eventStartsAt)) {
    return { bracket, amount: 0, waiver: "free_pass", discountPercent: null };
  }
  if (isFreeFirstEvent(input)) {
    return { bracket, amount: 0, waiver: "free_first", discountPercent: null };
  }
  if (promoApplies(input.promo, input.eventStartsAt)) {
    const amount = discountedAmount(bracket.amount, input.promo.percent);
    return {
      bracket,
      amount,
      waiver: amount === 0 ? "promo" : null,
      discountPercent: input.promo.percent,
    };
  }
  return { bracket, amount: bracket.amount, waiver: null, discountPercent: null };
}

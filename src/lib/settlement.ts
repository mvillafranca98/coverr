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
 * Pricing bracket, resolved from tickets actually sold. Comps never count —
 * they are free tickets and charging for them would be indefensible.
 * A band's first event can be free regardless of size; see `isFreeFirstEvent`.
 */
export function priceBracket(ticketsSold: number): { bracket: string; amount: number } {
  if (ticketsSold <= 60) return { bracket: "t60", amount: 50000 };
  if (ticketsSold <= 150) return { bracket: "t150", amount: 100000 };
  if (ticketsSold <= 300) return { bracket: "t300", amount: 150000 };
  return { bracket: "t301plus", amount: 200000 };
}

/**
 * "Primer toque gratis" is a launch offer, not a permanent tier: a band's first
 * event is free only if it is held on or before this day, Honduras time.
 * Extending the offer is this one line — the landing page and the terms quote
 * the date from here.
 */
const FREE_FIRST_EVENT_LAST_DAY = "2027-01-31";

/** Midnight at the end of the offer's last day, Honduras time (no DST). */
const FREE_FIRST_EVENT_ENDS_AT =
  Date.parse(`${FREE_FIRST_EVENT_LAST_DAY}T00:00:00${HN_OFFSET}`) + 24 * 3600 * 1000;

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

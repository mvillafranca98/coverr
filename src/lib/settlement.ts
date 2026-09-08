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
  const gross =
    channels.presale + channels.doorTransfer + channels.doorCash + channels.manual;
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
 * Billing is off while the product is earning its reputation in the scene.
 * Every band sees the whole thing, settlement included, for as long as this
 * stays false.
 *
 * The machinery below and the event_unlocks table are deliberately kept: when
 * this flips to true, charging resumes as a config change rather than a
 * rebuild, and any event already unlocked stays unlocked.
 */
export const BILLING_ENABLED = false;

/**
 * Pricing bracket, resolved from tickets actually sold. Comps never count —
 * they are free tickets and charging for them would be indefensible.
 * The band's first event is free regardless of size.
 */
export function priceBracket(ticketsSold: number): { bracket: string; amount: number } {
  if (ticketsSold <= 60) return { bracket: "t60", amount: 40000 };
  if (ticketsSold <= 150) return { bracket: "t150", amount: 80000 };
  if (ticketsSold <= 300) return { bracket: "t300", amount: 120000 };
  return { bracket: "t301plus", amount: 180000 };
}

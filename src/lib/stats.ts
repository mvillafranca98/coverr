/**
 * Cross-event statistics for the band home.
 *
 * Written as raw D1 aggregates rather than ORM calls: these are read-only
 * roll-ups over every event a band has run, and one grouped query per metric
 * beats N queries per event as the history grows.
 *
 * Money is centavos throughout. Ratios are returned as 0-1 floats and
 * formatted at the edge.
 */

export type EventMetrics = {
  id: string;
  slug: string;
  name: string;
  venue: string;
  startsAt: string;
  status: string;
  attendance: number;
  presalePeople: number;
  doorOnlinePeople: number;
  doorCashPeople: number;
  compPeople: number;
  gross: number;
  costs: number;
  net: number;
  inside: number;
  presaleInside: number;
  /** Money banked before doors — the best single measure of how de-risked a show was. */
  presaleShare: number | null;
  costRatio: number | null;
  netPerHead: number | null;
  avgTicket: number | null;
  cashShareOfDoor: number | null;
  /** Presale sold vs presale scanned. Nothing in the old process could measure this. */
  noShowRate: number | null;
};

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export async function eventMetrics(db: D1Database, bandId: string): Promise<EventMetrics[]> {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.slug, e.name, e.venue, e.starts_at, e.status,
              COALESCE(SUM(CASE WHEN o.channel='online'      THEN o.quantity END),0) AS presale_people,
              COALESCE(SUM(CASE WHEN o.channel='door_online' THEN o.quantity END),0) AS door_online_people,
              COALESCE(SUM(CASE WHEN o.channel='door_cash'   THEN o.quantity END),0) AS door_cash_people,
              COALESCE(SUM(CASE WHEN o.channel='comp'        THEN o.quantity END),0) AS comp_people,
              COALESCE(SUM(o.expected_amount),0) AS gross
         FROM events e
         LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'confirmed'
        WHERE e.band_id = ?1
        GROUP BY e.id
        ORDER BY e.starts_at DESC`,
    )
    .bind(bandId)
    .all<{
      id: string; slug: string; name: string; venue: string; starts_at: string; status: string;
      presale_people: number; door_online_people: number; door_cash_people: number;
      comp_people: number; gross: number;
    }>();

  const costs = await db
    .prepare(
      `SELECT x.event_id, COALESCE(SUM(x.amount),0) AS costs
         FROM expenses x JOIN events e ON e.id = x.event_id
        WHERE e.band_id = ?1 GROUP BY x.event_id`,
    )
    .bind(bandId)
    .all<{ event_id: string; costs: number }>();
  const costBy = new Map(costs.results.map((r) => [r.event_id, Number(r.costs)]));

  const attend = await db
    .prepare(
      `SELECT o.event_id,
              COUNT(*) AS total,
              SUM(CASE WHEN a.checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS inside,
              SUM(CASE WHEN o.channel='online' THEN 1 ELSE 0 END) AS presale_tickets,
              SUM(CASE WHEN o.channel='online' AND a.checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS presale_inside
         FROM attendees a
         JOIN orders o ON o.id = a.order_id AND o.status='confirmed'
         JOIN events e ON e.id = o.event_id
        WHERE e.band_id = ?1
        GROUP BY o.event_id`,
    )
    .bind(bandId)
    .all<{ event_id: string; total: number; inside: number; presale_tickets: number; presale_inside: number }>();
  const attBy = new Map(attend.results.map((r) => [r.event_id, r]));

  return results.map((r) => {
    const presale = Number(r.presale_people);
    const doorOnline = Number(r.door_online_people);
    const doorCash = Number(r.door_cash_people);
    const comp = Number(r.comp_people);
    const attendance = presale + doorOnline + doorCash + comp;
    const gross = Number(r.gross);
    const cost = costBy.get(r.id) ?? 0;
    const a = attBy.get(r.id);
    const presaleTickets = Number(a?.presale_tickets ?? 0);
    const presaleInside = Number(a?.presale_inside ?? 0);

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      venue: r.venue,
      startsAt: r.starts_at,
      status: r.status,
      attendance,
      presalePeople: presale,
      doorOnlinePeople: doorOnline,
      doorCashPeople: doorCash,
      compPeople: comp,
      gross,
      costs: cost,
      net: gross - cost,
      inside: Number(a?.inside ?? 0),
      presaleInside,
      presaleShare: div(presale, attendance),
      costRatio: div(cost, gross),
      netPerHead: attendance > 0 ? Math.round((gross - cost) / attendance) : null,
      avgTicket: attendance > 0 ? Math.round(gross / attendance) : null,
      cashShareOfDoor: div(doorCash, doorOnline + doorCash),
      // Only meaningful once the doors have actually opened.
      noShowRate: presaleInside > 0 ? div(presaleTickets - presaleInside, presaleTickets) : null,
    };
  });
}

export type CategoryRow = { category: string; total: number; perEvent: Record<string, number> };

/**
 * Cost trend by normalised category. Free-text labels alone can't be compared —
 * one "sonido y luces" and the series breaks — which is why category exists.
 */
export async function costsByCategory(db: D1Database, bandId: string): Promise<CategoryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT x.category, x.event_id, COALESCE(SUM(x.amount),0) AS amount
         FROM expenses x JOIN events e ON e.id = x.event_id
        WHERE e.band_id = ?1
        GROUP BY x.category, x.event_id`,
    )
    .bind(bandId)
    .all<{ category: string; event_id: string; amount: number }>();

  const by = new Map<string, CategoryRow>();
  for (const r of results) {
    const row = by.get(r.category) ?? { category: r.category, total: 0, perEvent: {} };
    row.perEvent[r.event_id] = Number(r.amount);
    row.total += Number(r.amount);
    by.set(r.category, row);
  }
  return [...by.values()].sort((a, b) => b.total - a.total);
}

export type FanStats = {
  uniquePeople: number;
  repeatPeople: number;
  regulars: { name: string; email: string; events: number; tickets: number }[];
  returningShareLatest: number | null;
};

/**
 * The band's actual audience, matched across events on normalised payer email.
 * No spreadsheet can produce this, and no buyer ever had to sign up for it.
 *
 * Door cash and comps are excluded: those orders carry synthetic addresses
 * because nobody collects an email at the door, and counting them would
 * invent people who never gave you their details.
 */
export async function fanStats(
  db: D1Database,
  bandId: string,
  latestEventId: string | null,
): Promise<FanStats> {
  const { results } = await db
    .prepare(
      `SELECT o.payer_email AS email,
              MIN(o.payer_name) AS name,
              COUNT(DISTINCT o.event_id) AS events,
              SUM(o.quantity) AS tickets
         FROM orders o JOIN events e ON e.id = o.event_id
        WHERE e.band_id = ?1
          AND o.status = 'confirmed'
          AND o.channel IN ('online','door_online')
        GROUP BY o.payer_email
        ORDER BY events DESC, tickets DESC`,
    )
    .bind(bandId)
    .all<{ email: string; name: string; events: number; tickets: number }>();

  const uniquePeople = results.length;
  const repeatPeople = results.filter((r) => Number(r.events) > 1).length;
  const regulars = results
    .filter((r) => Number(r.events) >= 3)
    .slice(0, 25)
    .map((r) => ({
      name: r.name,
      email: r.email,
      events: Number(r.events),
      tickets: Number(r.tickets),
    }));

  let returningShareLatest: number | null = null;
  if (latestEventId) {
    const seen = new Map(results.map((r) => [r.email, Number(r.events)]));
    const latest = await db
      .prepare(
        `SELECT DISTINCT o.payer_email AS email
           FROM orders o
          WHERE o.event_id = ?1 AND o.status='confirmed'
            AND o.channel IN ('online','door_online')`,
      )
      .bind(latestEventId)
      .all<{ email: string }>();
    const n = latest.results.length;
    if (n > 0) {
      const returning = latest.results.filter((r) => (seen.get(r.email) ?? 0) > 1).length;
      returningShareLatest = returning / n;
    }
  }

  return { uniquePeople, repeatPeople, regulars, returningShareLatest };
}

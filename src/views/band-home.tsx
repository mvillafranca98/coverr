import type { FC } from "hono/jsx";
import type { CategoryRow, EventMetrics, FanStats } from "../db/queries/stats";
import { formatEventDate, formatLpsShort, formatShortDate } from "../lib/core";
import { costCategoryLabel } from "./admin/cost-category";
import { AdminLayout } from "./admin/layout";
import { TrendChart, type TrendPoint } from "./admin/trend-chart";
import { OnboardingChecklist } from "./signup";

/**
 * Every event a band has ever run. Never gated — history, cost trends and the
 * fan list stay open whether or not the next gig has been paid for, and this
 * is the only screen a band opens on a Tuesday with no show booked.
 */
/** How many of the most recent events the charts show: a year of monthly gigs. */
const TREND_EVENTS = 12;

const pct = (v: number | null, digits = 0): string =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

export const BandHomePage: FC<{
  bandName: string;
  events: EventMetrics[];
  categories: CategoryRow[];
  fans: FanStats;
  setup: { hasAccount: boolean; hasMembers: boolean };
}> = ({ bandName, events, categories, fans, setup }) => {
  const played = events.filter((e) => e.attendance > 0);
  const totals = played.reduce(
    (t, e) => ({
      attendance: t.attendance + e.attendance,
      gross: t.gross + e.gross,
      costs: t.costs + e.costs,
      net: t.net + e.net,
    }),
    { attendance: 0, gross: 0, costs: 0, net: 0 },
  );

  // The charts read left to right, oldest first, over the last dozen nights.
  const recent = played.slice(0, TREND_EVENTS).reverse();
  const trend = (measure: (event: EventMetrics) => number): TrendPoint[] =>
    recent.map((event) => ({
      name: event.name,
      date: formatShortDate(event.startsAt),
      value: measure(event),
    }));

  // Newest first, so "previous" is the next one along.
  const latest = played[0];
  const previous = played[1];
  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null || b === 0 ? null : (a - b) / b;

  return (
    <AdminLayout title={`${bandName} — Coverr`} bandName={bandName} active="events">
      <h1>{bandName}</h1>
      <p class="sub">
        {played.length} {played.length === 1 ? "evento" : "eventos"} · {totals.attendance} personas
        en total
      </p>

      <OnboardingChecklist
        hasAccount={setup.hasAccount}
        hasMembers={setup.hasMembers}
        hasEvent={events.length > 0}
      />

      <h2>Acumulado</h2>
      <div class="cards">
        <div class="card">
          <span>Personas</span>
          <b>{totals.attendance}</b>
          <small>
            en {played.length} {played.length === 1 ? "evento" : "eventos"}
          </small>
        </div>
        <div class="card">
          <span>Bruto</span>
          <b>{formatLpsShort(totals.gross)}</b>
        </div>
        <div class="card">
          <span>Costos</span>
          <b>{formatLpsShort(totals.costs)}</b>
          <small>{pct(totals.gross > 0 ? totals.costs / totals.gross : null)} del bruto</small>
        </div>
        <div class="card">
          <span>Neto</span>
          <b>{formatLpsShort(totals.net)}</b>
          <small>
            {totals.attendance > 0
              ? `${formatLpsShort(Math.round(totals.net / totals.attendance))} por persona`
              : "—"}
          </small>
        </div>
      </div>

      {recent.length >= 2 ? (
        <>
          <h2>Cómo vienen tus eventos</h2>
          <p class="sub" style="margin-bottom:12px">
            Los últimos {recent.length} eventos, del más viejo al más nuevo. Los números exactos
            están en la tabla de abajo.
          </p>
          <div class="trends">
            <TrendChart
              title="Personas"
              tone="yellow"
              points={trend((event) => event.attendance)}
              format={String}
            />
            <TrendChart
              title="Bruto"
              tone="pink"
              points={trend((event) => event.gross)}
              format={formatLpsShort}
            />
            <TrendChart
              title="Costos"
              tone="lime"
              points={trend((event) => event.costs)}
              format={formatLpsShort}
            />
            <TrendChart
              title="Neto"
              tone="blue"
              points={trend((event) => event.net)}
              format={formatLpsShort}
            />
          </div>
        </>
      ) : null}

      {latest && previous ? (
        <>
          <h2>Último evento vs. el anterior</h2>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th class="n">{formatEventDate(previous.startsAt)}</th>
                  <th class="n">{formatEventDate(latest.startsAt)}</th>
                  <th class="n">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Personas", previous.attendance, latest.attendance, (v: number) => String(v)],
                    ["Bruto", previous.gross, latest.gross, formatLpsShort],
                    ["Costos", previous.costs, latest.costs, formatLpsShort],
                    ["Neto", previous.net, latest.net, formatLpsShort],
                    [
                      "Neto por persona",
                      previous.netPerHead ?? 0,
                      latest.netPerHead ?? 0,
                      formatLpsShort,
                    ],
                  ] as const
                ).map(([label, a, b, fmt]) => {
                  const d = delta(b, a);
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td class="n">{fmt(a)}</td>
                      <td class="n">{fmt(b)}</td>
                      <td class="n">
                        {d == null ? (
                          "—"
                        ) : (
                          <span class={`chip ${d >= 0 ? "ok" : "crit"}`}>
                            {d >= 0 ? "+" : ""}
                            {(d * 100).toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2>Cada evento</h2>
      <p class="sub" style="margin-bottom:10px">
        Todo sale de los registros, nada se escribe a mano.
      </p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th class="n">Personas</th>
              <th class="n">Preventa</th>
              <th class="n">Bruto</th>
              <th class="n">Costos</th>
              <th class="n">Neto</th>
              <th class="n">Neto/persona</th>
              <th class="n">Boleto prom.</th>
              <th class="n">Efectivo</th>
              <th class="n">No-show</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <a href={`/admin/e/${e.slug}`}>{e.name}</a>
                  <div class="muted" style="font-size:12px">
                    {formatEventDate(e.startsAt)}
                  </div>
                </td>
                <td class="n">{e.attendance}</td>
                <td class="n">{pct(e.presaleShare)}</td>
                <td class="n">{formatLpsShort(e.gross)}</td>
                <td class="n">{formatLpsShort(e.costs)}</td>
                <td class="n">{formatLpsShort(e.net)}</td>
                <td class="n">{e.netPerHead == null ? "—" : formatLpsShort(e.netPerHead)}</td>
                <td class="n">{e.avgTicket == null ? "—" : formatLpsShort(e.avgTicket)}</td>
                <td class="n">{pct(e.cashShareOfDoor)}</td>
                <td class="n">{pct(e.noShowRate, 1)}</td>
              </tr>
            ))}
            {played.length > 1 ? (
              <tr class="tot">
                <td>Total</td>
                <td class="n">{totals.attendance}</td>
                <td class="n" />
                <td class="n">{formatLpsShort(totals.gross)}</td>
                <td class="n">{formatLpsShort(totals.costs)}</td>
                <td class="n">{formatLpsShort(totals.net)}</td>
                <td class="n" />
                <td class="n" />
                <td class="n" />
                <td class="n" />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p class="sub" style="margin-top:8px">
        <b>No-show</b> es cuánta gente pagó preventa y no llegó. Es un número que antes no se podía
        medir — la lista impresa se marcaba y se botaba.
      </p>

      {categories.length > 0 ? (
        <>
          <h2>Costos por categoría</h2>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  {played.map((e) => (
                    <th class="n" key={e.id}>
                      {formatEventDate(e.startsAt).replace(/^\w+ /, "")}
                    </th>
                  ))}
                  <th class="n">Total</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.category}>
                    <td>{costCategoryLabel(cat.category)}</td>
                    {played.map((e) => (
                      <td class="n" key={e.id}>
                        {cat.perEvent[e.id] ? formatLpsShort(cat.perEvent[e.id]!) : "—"}
                      </td>
                    ))}
                    <td class="n">{formatLpsShort(cat.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2>Tu gente</h2>
      <div class="cards">
        <div class="card">
          <span>Personas únicas</span>
          <b>{fans.uniquePeople}</b>
          <small>en todos los eventos</small>
        </div>
        <div class="card">
          <span>Repitieron</span>
          <b>{fans.repeatPeople}</b>
          <small>vinieron a más de uno</small>
        </div>
        <div class="card">
          <span>Del último</span>
          <b>{pct(fans.returningShareLatest)}</b>
          <small>ya habían venido</small>
        </div>
        <div class="card">
          <span>Fieles</span>
          <b>{fans.regularPeople}</b>
          <small>3 eventos o más</small>
        </div>
      </div>
      <p class="sub" style="margin-top:10px">
        Se agrupa por el correo de quien pagó. No incluye ventas en efectivo ni cortesías — ahí
        nadie deja su correo.
      </p>

      {fans.regulars.length > 0 ? (
        <div class="scroll" style="margin-top:12px">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th class="n">Eventos</th>
                <th class="n">Boletos</th>
              </tr>
            </thead>
            <tbody>
              {fans.regulars.map((r) => (
                <tr key={r.email}>
                  <td>{r.name}</td>
                  <td>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </td>
                  <td class="n">{r.events}</td>
                  <td class="n">{r.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="sub">
          Todavía nadie ha venido a tres eventos. Esta lista se llena sola con el tiempo.
        </p>
      )}
    </AdminLayout>
  );
};

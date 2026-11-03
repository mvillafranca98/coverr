import type { FC } from "hono/jsx";
import type { OperatorBandRow } from "../../db/queries/operator";
import { formatDayMonth, formatLpsShort } from "../../lib/core";
import { OperatorLayout } from "./layout";
import { StandingChips } from "./standing";

/** The link to another page of the same list, keeping the search. */
function pageHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/operador?${query}` : "/operador";
}

/** Every band, newest first: who they are, how much they use Coverr, and where they stand. */
export const BandListPage: FC<{
  rows: OperatorBandRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
}> = ({ rows, total, page, pageSize, search }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <OperatorLayout title="Bandas — Coverr operación" signedIn active="bands">
      <h1>Bandas</h1>
      <p class="sub">
        {total} {total === 1 ? "banda" : "bandas"}
        {search ? ` que ${total === 1 ? "coincide" : "coinciden"} con «${search}»` : ""}
      </p>

      <form class="inline" method="get" action="/operador">
        <div style="flex:1;min-width:200px">
          <label class="fl" for="q">
            Buscar por nombre o correo
          </label>
          <input type="search" name="q" id="q" value={search} />
        </div>
        <button class="btn" type="submit">
          Buscar
        </button>
      </form>

      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Banda</th>
              <th>Alta</th>
              <th class="n">Eventos</th>
              <th class="n">Boletos pagados</th>
              <th>Última actividad</th>
              <th class="n">Reportes</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colspan={7} class="muted">
                  {total > 0
                    ? "No hay bandas en esta página."
                    : search
                      ? "Ninguna banda coincide con esa búsqueda."
                      : "Todavía no hay bandas."}
                </td>
              </tr>
            ) : (
              rows.map((band) => (
                <tr key={band.id}>
                  <td>
                    <a class="cell-link" href={`/operador/bandas/${band.id}`}>
                      <b>{band.name}</b>
                      <br />
                      <span class="muted">{band.contactEmail}</span>
                    </a>
                  </td>
                  <td>{formatDayMonth(band.createdAt, { year: true })}</td>
                  <td class="n">{band.events}</td>
                  <td class="n">{band.paidTickets}</td>
                  <td>{formatDayMonth(band.lastActivity, { year: true })}</td>
                  <td class="n">
                    {band.reportsUnlocked}
                    {band.feesCharged > 0 ? ` · ${formatLpsShort(band.feesCharged)}` : ""}
                  </td>
                  <td>
                    <StandingChips
                      bannedAt={band.bannedAt}
                      freePassGrantedAt={band.freePassGrantedAt}
                      freePassUntil={band.freePassUntil}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav class="toolbar" aria-label="Páginas" style="margin-top:16px">
          {page > 1 ? (
            <a class="btn sm ghost" href={pageHref(search, page - 1)}>
              Anteriores
            </a>
          ) : null}
          <span class="muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <a class="btn sm ghost" href={pageHref(search, page + 1)}>
              Siguientes
            </a>
          ) : null}
        </nav>
      ) : null}
    </OperatorLayout>
  );
};

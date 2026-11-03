import type { FC } from "hono/jsx";
import type { LedgerRow, LedgerTotals } from "../../db/queries/fees";
import { formatDayMonth, formatLpsShort, formatMonthYear } from "../../lib/core";
import { FeeStatusChip } from "./fee-status";
import { OperatorLayout } from "./layout";

/** One month of reports unlocked, what each was charged and where its payment stands. */
export const LedgerPage: FC<{
  month: string;
  previousMonth: string;
  nextMonth: string | null;
  rows: LedgerRow[];
  totals: LedgerTotals;
  page: number;
  pageSize: number;
}> = ({ month, previousMonth, nextMonth, rows, totals, page, pageSize }) => {
  const pages = Math.max(1, Math.ceil(totals.rows / pageSize));
  const pageHref = (n: number) => `/operador/cobros?mes=${month}${n > 1 ? `&pagina=${n}` : ""}`;
  return (
    <OperatorLayout title={`Cobros — ${formatMonthYear(month)}`} signedIn active="fees">
      <h1>Cobros</h1>
      <nav class="toolbar" aria-label="Mes">
        <a class="btn sm ghost" href={`/operador/cobros?mes=${previousMonth}`}>
          ← Anterior
        </a>
        <b>{formatMonthYear(month)}</b>
        {nextMonth ? (
          <a class="btn sm ghost" href={`/operador/cobros?mes=${nextMonth}`}>
            Siguiente →
          </a>
        ) : null}
        <a class="btn sm ghost" href={`/operador/cobros.csv?mes=${month}`}>
          Descargar CSV
        </a>
      </nav>

      <div class="cards">
        <div class="card">
          <span>Cobrado</span>
          <b>{formatLpsShort(totals.charged)}</b>
        </div>
        <div class="card">
          <span>Recibido</span>
          <b>{formatLpsShort(totals.received)}</b>
        </div>
        <div class="card">
          <span>Por revisar</span>
          <b>{formatLpsShort(totals.inReview)}</b>
        </div>
        <div class="card">
          <span>No pagado</span>
          <b>{formatLpsShort(totals.unpaid)}</b>
        </div>
        <div class="card">
          <span>Gratis</span>
          <b>{totals.waived}</b>
        </div>
      </div>

      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Banda</th>
              <th>Evento</th>
              <th class="n">Monto</th>
              <th>Estado</th>
              <th>Factura</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colspan={6} class="muted">
                  {totals.rows > 0
                    ? "No hay más en esta página."
                    : `Ningún reporte desbloqueado en ${formatMonthYear(month)}.`}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.unlockId}>
                  <td>{formatDayMonth(row.paidAt)}</td>
                  <td>
                    <a href={`/operador/bandas/${row.bandId}`}>{row.bandName}</a>
                  </td>
                  <td>{row.eventName}</td>
                  <td class="n">
                    {row.feePaymentId ? formatLpsShort(row.amount) : "—"}
                    {row.discountPercent ? (
                      <span class="muted"> (−{row.discountPercent}%)</span>
                    ) : null}
                  </td>
                  <td>
                    {row.feePaymentId ? (
                      <a href={`/operador/pagos/${row.feePaymentId}`}>
                        <FeeStatusChip status={row.status} bracket={row.bracket} />
                      </a>
                    ) : (
                      <FeeStatusChip status={null} bracket={row.bracket} />
                    )}
                  </td>
                  <td>
                    {row.feePaymentId
                      ? (row.invoiceNumber ?? <span class="muted">Falta</span>)
                      : "—"}
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
            <a class="btn sm ghost" href={pageHref(page - 1)}>
              Anteriores
            </a>
          ) : null}
          <span class="muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <a class="btn sm ghost" href={pageHref(page + 1)}>
              Siguientes
            </a>
          ) : null}
        </nav>
      ) : null}
    </OperatorLayout>
  );
};

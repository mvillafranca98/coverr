import type { FC } from "hono/jsx";
import { formatPct, type MemberFormRow, memberField } from "../../lib/member-split";
import { TEXT_LIMITS } from "../../lib/text-limits";

/** Empty rows a band starts with: enough for a usual band without touching "+ Otra fila". */
const STARTING_ROWS = 4;

/**
 * Keeps the total in the footer live and adds rows. The server checks
 * everything again; without this script the form still works, with the rows
 * it was drawn with.
 */
const MEMBER_TABLE_SCRIPT = `(function(){
  var form = document.getElementById('member-table');
  if (!form) return;
  var body = form.querySelector('tbody');
  var count = form.querySelector('[name="${memberField.count}"]');
  var total = form.querySelector('[data-member-total]');
  var template = document.getElementById('member-row');
  var add = form.querySelector('[data-add-member]');

  function hundredths(v) { var n = Number(v); return isFinite(n) ? Math.round(n * 100) : 0; }
  function refresh() {
    var sum = 0;
    body.querySelectorAll('tr').forEach(function (row) {
      var removed = row.querySelector('[data-field="remove"]');
      if (removed && removed.checked) return;
      var pct = row.querySelector('[data-field="pct"]');
      if (pct) sum += hundredths(pct.value);
    });
    var gap = 10000 - sum;
    total.textContent = (sum / 100) + '%' +
      (gap > 0 ? ' · falta ' + (gap / 100) + '%' : gap < 0 ? ' · sobra ' + (-gap / 100) + '%' : '');
  }

  add.hidden = false;
  add.addEventListener('click', function () {
    var index = Number(count.value);
    var row = template.content.firstElementChild.cloneNode(true);
    row.querySelectorAll('[data-field]').forEach(function (input) {
      input.name = 'member_' + input.getAttribute('data-field') + '_' + index;
      input.setAttribute('aria-label', input.getAttribute('aria-label').replace('#', String(index + 1)));
    });
    body.appendChild(row);
    count.value = String(index + 1);
    row.querySelector('[data-field="name"]').focus();
  });
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
})();`;

/** The footer's words for a total, the same ones the script writes. */
function totalLabel(rows: MemberFormRow[]): string {
  const sum = rows
    .filter((row) => !row.remove)
    .reduce((n, row) => n + Math.round((Number(row.pct) || 0) * 100), 0);
  const gap = 10_000 - sum;
  const shortOrOver =
    gap > 0
      ? ` · falta ${formatPct(gap / 100)}%`
      : gap < 0
        ? ` · sobra ${formatPct(-gap / 100)}%`
        : "";
  return `${formatPct(sum / 100)}%${shortOrOver}`;
}

/** One row. `index` null draws the template the script copies, named on insert. */
const MemberRowView: FC<{ row: MemberFormRow; index: number | null }> = ({ row, index }) => {
  const label = index === null ? "#" : String(index + 1);
  const name = (field: (i: number) => string) => (index === null ? undefined : field(index));
  return (
    <tr>
      <td>
        {row.id ? (
          <input type="hidden" name={name(memberField.id)} value={row.id} data-field="id" />
        ) : null}
        <input
          type="text"
          name={name(memberField.name)}
          value={row.name}
          maxlength={TEXT_LIMITS.name}
          aria-label={`Nombre, fila ${label}`}
          data-field="name"
        />
      </td>
      <td class="n">
        <input
          type="number"
          name={name(memberField.pct)}
          value={row.pct}
          min="0"
          max="100"
          step="0.01"
          inputmode="decimal"
          aria-label={`Porcentaje, fila ${label}`}
          data-field="pct"
          style="width:84px"
        />
      </td>
      <td>
        {/* The label is the tap target: a bare checkbox is too small to hit on a phone. */}
        {row.id ? (
          <label style="display:flex;align-items:center;min-height:46px;cursor:pointer">
            <input
              type="checkbox"
              name={name(memberField.remove)}
              value="1"
              checked={row.remove}
              aria-label={`Quitar a ${row.name || `la fila ${label}`}`}
              data-field="remove"
              style="width:20px;height:20px"
            />
          </label>
        ) : null}
      </td>
    </tr>
  );
};

/** The rows to draw when nothing was just refused: everyone on record, then empty rows. */
export function savedMemberRows(members: { id: string; name: string; splitPct: number }[]) {
  const saved: MemberFormRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    pct: formatPct(m.splitPct),
    remove: false,
  }));
  const blanks = Math.max(1, STARTING_ROWS - saved.length);
  const empty: MemberFormRow = { id: null, name: "", pct: "", remove: false };
  return [...saved, ...Array.from({ length: blanks }, () => ({ ...empty }))];
}

/** Every member and their percentage, edited and saved as one table that totals 100%. */
export const MemberTable: FC<{ rows: MemberFormRow[] }> = ({ rows }) => (
  <>
    <p class="sub" style="margin-bottom:10px">
      Cómo se reparte el neto de cada evento. Tiene que sumar 100%: si una parte queda para la
      banda, agregá una fila "Fondo de la banda".
    </p>
    <form method="post" action="/admin/banda/reparto" id="member-table">
      <input type="hidden" name={memberField.count} value={String(rows.length)} />
      <div class="scroll">
        <table class="member-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th class="n">%</th>
              <th>Quitar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <MemberRowView row={row} index={index} key={row.id ?? `new-${index}`} />
            ))}
          </tbody>
          <tfoot>
            <tr class="tot">
              <td>Total</td>
              <td class="n" data-member-total aria-live="polite">
                {totalLabel(rows)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="toolbar" style="margin-top:12px">
        <button type="button" class="btn sm ghost" data-add-member hidden>
          + Otra fila
        </button>
        <button class="btn" type="submit">
          Guardar reparto
        </button>
      </div>
    </form>
    <template id="member-row">
      <MemberRowView row={{ id: null, name: "", pct: "", remove: false }} index={null} />
    </template>
    <script dangerouslySetInnerHTML={{ __html: MEMBER_TABLE_SCRIPT }} />
  </>
);

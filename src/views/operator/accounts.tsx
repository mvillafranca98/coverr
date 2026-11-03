import type { FC } from "hono/jsx";
import { BANKS, bankLabel } from "../../lib/core";
import { TEXT_LIMITS } from "../../lib/text-limits";
import { OperatorLayout } from "./layout";

type Account = {
  id: string;
  bank: string;
  holderName: string;
  accountNumber: string;
  isMain: number;
  active: number;
};

const DONE: Record<string, string> = {
  agregada: "Cuenta agregada.",
  principal: "Cuenta principal cambiada.",
  retirada: "Cuenta retirada. Ya no se le muestra a ninguna banda.",
};

/**
 * Where bands pay Coverr. Entered here and nowhere else, so no account number
 * ever sits in the code. A retired account stays listed: a fee paid into it
 * before it was retired must still pass the destination check.
 */
export const AccountsPage: FC<{ accounts: Account[]; done?: string; error?: string }> = ({
  accounts,
  done,
  error,
}) => (
  <OperatorLayout title="Cuentas — Coverr operación" signedIn active="accounts">
    <h1>Cuentas de cobro</h1>
    <p class="sub">
      Donde las bandas transfieren el pago de su reporte. A cada banda se le muestra la cuenta de su
      mismo banco si hay una, para que no pague comisión; si no, la principal.
    </p>
    {done && DONE[done] ? <div class="note ok">{DONE[done]}</div> : null}
    {error ? <div class="note crit">{error}</div> : null}

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Banco</th>
            <th>A nombre de</th>
            <th>Cuenta</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td colspan={5} class="muted">
                Todavía no hay cuentas. Mientras no haya una activa, ningún reporte se puede cobrar.
              </td>
            </tr>
          ) : (
            accounts.map((account) => (
              <tr key={account.id}>
                <td>{bankLabel(account.bank)}</td>
                <td>{account.holderName}</td>
                <td>
                  <code>{account.accountNumber}</code>
                </td>
                <td>
                  {account.active === 0 ? (
                    <span class="chip info">Retirada</span>
                  ) : account.isMain === 1 ? (
                    <span class="chip ok">Principal</span>
                  ) : (
                    <span class="chip info">Activa</span>
                  )}
                </td>
                <td class="right">
                  {account.active === 1 && account.isMain === 0 ? (
                    <form method="post" action={`/operador/cuentas/${account.id}/principal`}>
                      <button class="btn sm ghost" type="submit">
                        Hacer principal
                      </button>
                    </form>
                  ) : null}
                  {account.active === 1 ? (
                    <form method="post" action={`/operador/cuentas/${account.id}/retirar`}>
                      <button class="btn sm ghost" type="submit">
                        Retirar
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <h2>Agregar una cuenta</h2>
    <form method="post" action="/operador/cuentas" style="max-width:620px">
      <div class="field-pair">
        <div>
          <label class="fl" for="bank">
            Banco
          </label>
          <select name="bank" id="bank" required>
            {BANKS.filter((bank) => bank.code !== "OTHER").map((bank) => (
              <option value={bank.code} key={bank.code}>
                {bank.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label class="fl" for="account_number">
            Número de cuenta
          </label>
          <input
            type="text"
            name="account_number"
            id="account_number"
            required
            inputmode="numeric"
            maxlength={TEXT_LIMITS.accountNumber}
          />
        </div>
      </div>
      <label class="fl" for="holder" style="margin-top:14px">
        A nombre de (como aparece en el banco)
      </label>
      <input type="text" name="holder" id="holder" required maxlength={TEXT_LIMITS.accountHolder} />
      <label class="pick" style="display:flex;gap:8px;align-items:center;min-height:44px">
        <input type="checkbox" name="main" value="1" />
        <span>Que sea la principal</span>
      </label>
      <button class="btn" type="submit" style="margin-top:14px">
        Agregar cuenta
      </button>
    </form>
  </OperatorLayout>
);

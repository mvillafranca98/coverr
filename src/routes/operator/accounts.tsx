import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import {
  addPlatformAccount,
  deactivatePlatformAccount,
  listPlatformAccounts,
  setMainPlatformAccount,
} from "../../db/queries/fees";
import * as s from "../../db/schema";
import { BANKS, nowIso } from "../../lib/core";
import { TEXT_LIMITS } from "../../lib/text-limits";
import { AccountsPage } from "../../views/operator/accounts";
import type { OperatorEnv } from "./context";

export const operatorAccountRoutes = new Hono<OperatorEnv>();

const back = (query: string) => `/operador/cuentas?${query}`;

/** An account number as banks print it: digits, with the spaces and dashes people type. */
const ACCOUNT_NUMBER = /^[0-9][0-9 -]{3,}$/;

operatorAccountRoutes.get("/cuentas", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  return c.html(
    <AccountsPage
      accounts={await listPlatformAccounts(db)}
      done={c.req.query("listo")}
      error={c.req.query("error")}
    />,
  );
});

operatorAccountRoutes.post("/cuentas", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const body = await c.req.parseBody();
  const bank = String(body["bank"] ?? "");
  const holderName = String(body["holder"] ?? "").trim();
  const accountNumber = String(body["account_number"] ?? "").trim();
  const fail = (message: string) => c.redirect(back(`error=${encodeURIComponent(message)}`), 303);

  if (!BANKS.some((known) => known.code === bank && known.code !== "OTHER")) {
    return fail("Elegí el banco de la cuenta.");
  }
  if (!holderName || holderName.length > TEXT_LIMITS.accountHolder) {
    return fail("Escribí a nombre de quién está la cuenta.");
  }
  if (accountNumber.length > TEXT_LIMITS.accountNumber || !ACCOUNT_NUMBER.test(accountNumber)) {
    return fail("Revisá el número de cuenta: sólo números, espacios o guiones.");
  }

  await addPlatformAccount(db, {
    bank,
    holderName,
    accountNumber,
    makeMain: body["main"] === "1",
    at: nowIso(),
  });
  return c.redirect(back("listo=agregada"), 303);
});

operatorAccountRoutes.post("/cuentas/:id/principal", async (c) => {
  await setMainPlatformAccount(drizzle(c.env.DB, { schema: s }), c.req.param("id"));
  return c.redirect(back("listo=principal"), 303);
});

operatorAccountRoutes.post("/cuentas/:id/retirar", async (c) => {
  await deactivatePlatformAccount(drizzle(c.env.DB, { schema: s }), c.req.param("id"));
  return c.redirect(back("listo=retirada"), 303);
});

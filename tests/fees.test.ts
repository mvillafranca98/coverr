import { describe, expect, it } from "vitest";
import {
  FEE_PROOF_RETENTION_DAYS,
  feeAccountFor,
  feeCheckOutcome,
  feeProofPurgeAfter,
  feeProofPurgeable,
  isMonth,
  monthBounds,
  monthOf,
  owedFeeMessage,
  readFeeProofFile,
  shiftMonth,
} from "../src/lib/fees";

/**
 * Paying Coverr's fee. A band is never held waiting on any of this — the
 * report opens on the upload — so what these hold is where the money is
 * asked to go, when a person is pulled in, and what evidence is kept.
 */

const account = (bank: string, isMain: number, active = 1) => ({ bank, isMain, active });

describe("the account a band is told to pay into", () => {
  const company = account("BAC", 1);
  const fallback = account("FICOHSA", 0);

  it("is one at the band's own bank when there is one, so it pays no interbank fee", () => {
    expect(feeAccountFor([company, fallback], "FICOHSA")).toBe(fallback);
  });

  it("is the main account otherwise", () => {
    expect(feeAccountFor([fallback, company], "ATLANTIDA")).toBe(company);
    expect(feeAccountFor([fallback, company], null)).toBe(company);
  });

  it("is never a retired account, even at the band's own bank", () => {
    expect(feeAccountFor([company, account("FICOHSA", 0, 0)], "FICOHSA")).toBe(company);
  });

  it("is any active one when none is marked main", () => {
    expect(feeAccountFor([fallback], "BAC")).toBe(fallback);
  });

  it("is none at all when Coverr has no active account, and then nothing is charged", () => {
    expect(feeAccountFor([account("BAC", 1, 0)], "BAC")).toBeNull();
    expect(feeAccountFor([], "BAC")).toBeNull();
  });
});

describe("what the checks on a fee screenshot mean", () => {
  const flag = (code: string, severity: "critical" | "warning" | "info") => ({
    code: code as never,
    severity,
    detail: code,
  });

  it("is a payment received when nothing was raised", () => {
    expect(feeCheckOutcome([])).toEqual({ status: "ok", flags: [] });
  });

  // Whoever in the band pays, pays from their own account.
  it("ignores a sender name that is not the band's", () => {
    expect(feeCheckOutcome([flag("NAME_MISMATCH", "warning")]).status).toBe("ok");
  });

  it("sends anything else to a person, even a screenshot that only could not be read", () => {
    expect(feeCheckOutcome([flag("AMOUNT_SHORT", "critical")]).status).toBe("flagged");
    expect(feeCheckOutcome([flag("UNREADABLE", "info")]).status).toBe("flagged");
  });

  it("keeps the flags the operator needs, without the one it dropped", () => {
    const outcome = feeCheckOutcome([
      flag("NAME_MISMATCH", "warning"),
      flag("DEST_MISMATCH", "critical"),
    ]);
    expect(outcome.flags.map((f) => f.code)).toEqual(["DEST_MISMATCH"]);
  });
});

describe("keeping a fee screenshot", () => {
  it("lasts 90 days from the upload", () => {
    expect(FEE_PROOF_RETENTION_DAYS).toBe(90);
    expect(feeProofPurgeAfter(new Date("2026-11-03T12:00:00Z"))).toBe("2027-02-01T12:00:00.000Z");
  });

  it("goes once the payment stands", () => {
    expect(feeProofPurgeable("ok")).toBe(true);
    expect(feeProofPurgeable("resolved")).toBe(true);
  });

  it("stays while the payment is in question, because it is the evidence", () => {
    expect(feeProofPurgeable("checking")).toBe(false);
    expect(feeProofPurgeable("flagged")).toBe(false);
    expect(feeProofPurgeable("unpaid")).toBe(false);
  });
});

describe("the screenshot a band sends", () => {
  it("is required", () => {
    expect(readFeeProofFile(undefined)).toEqual({
      ok: false,
      message: "Subí la captura de tu transferencia.",
    });
    expect(readFeeProofFile(new File([], "vacia.png"))).toMatchObject({ ok: false });
  });

  it("is refused over 10 MB", () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.png");
    expect(readFeeProofFile(big)).toMatchObject({
      ok: false,
      message: "El archivo es muy grande (máximo 10 MB).",
    });
  });

  it("is accepted otherwise; what it is gets checked from its bytes", () => {
    expect(readFeeProofFile(new File([new Uint8Array([1, 2, 3])], "captura.png")).ok).toBe(true);
  });
});

describe("the ledger's months", () => {
  it("are Honduras's, so 11pm on the 31st belongs to that month", () => {
    expect(monthOf(new Date("2026-11-01T04:30:00Z"))).toBe("2026-10");
    expect(monthOf(new Date("2026-11-01T06:00:00Z"))).toBe("2026-11");
  });

  it("run from midnight to midnight in Honduras", () => {
    expect(monthBounds("2026-11")).toEqual({
      from: "2026-11-01T06:00:00.000Z",
      to: "2026-12-01T06:00:00.000Z",
    });
  });

  it("step across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });

  it("are only ever YYYY-MM", () => {
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);
    expect(isMonth("'; DROP TABLE")).toBe(false);
  });
});

describe("owedFeeMessage", () => {
  const owed = { eventName: "Evento 2", amount: 500 };

  it("names the report owed, what is blocked, and that open sales keep selling", () => {
    const message = owedFeeMessage(owed, "publicar eventos", "hola@coverr.live");
    expect(message).toBe(
      "Tenés un pago pendiente: el reporte de Evento 2 (L5) todavía no está pagado, así que por ahora no podés publicar eventos. Los eventos que ya están a la venta siguen vendiendo. Escribinos a hola@coverr.live y lo resolvemos.",
    );
  });
});

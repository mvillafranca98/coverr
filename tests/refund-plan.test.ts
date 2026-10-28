import { describe, expect, it } from "vitest";
import { planTicketRefund } from "../src/lib/refund-plan";

/**
 * Which tickets a refund covers, and whether that closes the order.
 *
 * The boundary matters in both directions: closing an order that still has
 * people coming stops their QR codes at the door, and leaving one open when
 * every ticket is gone keeps a dead order in the band's live list.
 */

function tickets(...states: ("live" | "void")[]) {
  return states.map((state, i) => ({
    id: `att${i + 1}`,
    voidedAt: state === "void" ? "2026-10-28T10:00:00Z" : null,
  }));
}

describe("a partial refund", () => {
  it("voids only what was chosen and leaves the order open", () => {
    const plan = planTicketRefund({
      attendees: tickets("live", "live", "live", "live"),
      selectedIds: ["att1", "att2"],
    });
    expect(plan).toEqual({ ok: true, voidIds: ["att1", "att2"], voidsWholeOrder: false });
  });

  it("is still partial when earlier tickets were already refunded", () => {
    // Two went back last week, one goes back now, one person is still coming.
    const plan = planTicketRefund({
      attendees: tickets("void", "void", "live", "live"),
      selectedIds: ["att3"],
    });
    expect(plan.ok && plan.voidsWholeOrder).toBe(false);
  });
});

describe("a full refund", () => {
  it("closes the order when every ticket is chosen", () => {
    const plan = planTicketRefund({
      attendees: tickets("live", "live"),
      selectedIds: ["att1", "att2"],
    });
    expect(plan.ok && plan.voidsWholeOrder).toBe(true);
  });

  // The second of two partial refunds has to close the order, or a dead order
  // sits in the live list forever.
  it("closes the order when the chosen tickets are the last ones live", () => {
    const plan = planTicketRefund({
      attendees: tickets("void", "void", "live"),
      selectedIds: ["att3"],
    });
    expect(plan).toEqual({ ok: true, voidIds: ["att3"], voidsWholeOrder: true });
  });

  it("closes a single-ticket order", () => {
    const plan = planTicketRefund({ attendees: tickets("live"), selectedIds: ["att1"] });
    expect(plan.ok && plan.voidsWholeOrder).toBe(true);
  });
});

describe("the refusals", () => {
  // The expensive mistake: reading "nothing ticked" as "refund everything"
  // would turn an unticked form into a full refund.
  it("refuses an empty selection rather than assuming the whole order", () => {
    const plan = planTicketRefund({ attendees: tickets("live", "live"), selectedIds: [] });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.message).toContain("al menos un boleto");
  });

  it("refuses when every ticket is already refunded", () => {
    const plan = planTicketRefund({ attendees: tickets("void", "void"), selectedIds: ["att1"] });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.message).toContain("ya no tiene boletos activos");
  });

  it("refuses an order with no tickets at all", () => {
    expect(planTicketRefund({ attendees: [], selectedIds: ["att1"] }).ok).toBe(false);
  });
});

describe("selections that must not break anything", () => {
  // A stale page, or a second submit after the first went through.
  it("ignores a ticket that is already refunded", () => {
    const plan = planTicketRefund({
      attendees: tickets("void", "live"),
      selectedIds: ["att1", "att2"],
    });
    expect(plan).toEqual({ ok: true, voidIds: ["att2"], voidsWholeOrder: true });
  });

  it("refuses when the only chosen ticket was already refunded", () => {
    const plan = planTicketRefund({
      attendees: tickets("void", "live"),
      selectedIds: ["att1"],
    });
    expect(plan.ok).toBe(false);
  });

  // Nothing stops a hand-crafted form post naming somebody else's ticket.
  it("ignores an id that is not on this order", () => {
    const plan = planTicketRefund({
      attendees: tickets("live", "live"),
      selectedIds: ["att1", "att_from_another_order"],
    });
    expect(plan).toEqual({ ok: true, voidIds: ["att1"], voidsWholeOrder: false });
  });

  it("does not let a repeated id look like two tickets", () => {
    // Otherwise two copies of one id would match a two-ticket order and close
    // it while one person was still coming.
    const plan = planTicketRefund({
      attendees: tickets("live", "live"),
      selectedIds: ["att1", "att1"],
    });
    expect(plan).toEqual({ ok: true, voidIds: ["att1"], voidsWholeOrder: false });
  });
});

import { describe, expect, it } from "vitest";
import {
  addressTakesBand,
  type BandOfEmail,
  decideNewBand,
  decideSignIn,
  sameBandName,
  signInTitle,
} from "../src/lib/band-identity";

/**
 * One email, several bands (F20–F22). What signing up and signing in decide
 * from the bands an address already runs, including that a suspension follows
 * the person.
 */

const band = (id: string, name: string, bannedAt: string | null = null): BandOfEmail => ({
  id,
  name,
  bannedAt,
});

describe("sameBandName", () => {
  it("ignores case, accents and spacing", () => {
    expect(sameBandName("Los Pérez", "  los   PEREZ ")).toBe(true);
    expect(sameBandName("Los Pérez", "Los Pérez Trío")).toBe(false);
  });
});

describe("starting a band", () => {
  it("creates one for an address that runs none, or none by that name", () => {
    expect(decideNewBand([], "Prueba A").kind).toBe("create");
    expect(decideNewBand([band("bnd_1", "Prueba A")], "Prueba B").kind).toBe("create");
  });

  it("opens the band the person already runs under that name instead of a twin", () => {
    expect(decideNewBand([band("bnd_1", "Prueba A")], "prueba a")).toEqual({
      kind: "existing",
      band: band("bnd_1", "Prueba A"),
    });
  });

  it("refuses any new band to an address with a suspended band: it follows the person", () => {
    const bands = [band("bnd_1", "Prueba A"), band("bnd_2", "Otra", "2026-11-04T00:00:00Z")];
    expect(decideNewBand(bands, "Una nueva").kind).toBe("suspended");
    expect(decideNewBand(bands, "Prueba A").kind).toBe("suspended");
  });
});

describe("moving a band to another address", () => {
  it("is allowed onto an address with no band, or only bands in good standing", () => {
    expect(addressTakesBand([], "bnd_9")).toBe(true);
    expect(addressTakesBand([band("bnd_1", "Prueba A")], "bnd_9")).toBe(true);
  });

  // The suspended person would otherwise end up with a working band.
  it("is refused onto an address with a suspended band", () => {
    expect(addressTakesBand([band("bnd_1", "Otra", "2026-11-04T00:00:00Z")], "bnd_9")).toBe(false);
  });

  it("does not count the band being moved against itself", () => {
    expect(addressTakesBand([band("bnd_9", "Esta", "2026-11-04T00:00:00Z")], "bnd_9")).toBe(true);
  });
});

describe("signing in", () => {
  it("sends nothing to an address that runs no band", () => {
    expect(decideSignIn([])).toEqual({ kind: "none" });
  });

  it("opens every band in good standing, oldest first, and never a suspended one", () => {
    const bands = [
      band("bnd_1", "Prueba A"),
      band("bnd_2", "Otra", "2026-11-04T00:00:00Z"),
      band("bnd_3", "Prueba C"),
    ];
    const decision = decideSignIn(bands);
    expect(decision.kind).toBe("open");
    if (decision.kind === "open")
      expect(decision.bands.map((b) => b.id)).toEqual(["bnd_1", "bnd_3"]);
  });

  it("sends the notice when every band of the address is suspended", () => {
    expect(decideSignIn([band("bnd_1", "Prueba A", "2026-11-04T00:00:00Z")]).kind).toBe(
      "suspended",
    );
  });

  it("names the band when there is one, and 'tus bandas' when there are more", () => {
    expect(signInTitle([band("bnd_1", "Prueba A")])).toBe("Prueba A");
    expect(signInTitle([band("bnd_1", "Prueba A"), band("bnd_2", "Prueba B")])).toBe("tus bandas");
  });
});

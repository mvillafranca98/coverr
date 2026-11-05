/**
 * One email, several bands: what signing up and signing in decide, from the
 * bands an address already runs.
 *
 * A person is an email. Each band keeps its own everything — events,
 * accounts, members, money — and its contact email is how it is reached and
 * signed into; several bands may share one. Decided on 2026-11-04 (docs/SPEC.md,
 * F20–F22), including that a suspension follows the person: an address with a
 * suspended band starts no new band, though its other bands keep working.
 */

export type BandOfEmail = { id: string; name: string; bannedAt: string | null };

/** "Los Pérez", "los perez" and " LOS  PEREZ " are the same band to the person typing them. */
export function sameBandName(a: string, b: string): boolean {
  const normal = (name: string) =>
    name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return normal(a) === normal(b);
}

export type CreateDecision =
  /** The address has a suspended band: it starts no new one, and is told why. */
  | { kind: "suspended"; band: BandOfEmail }
  /** A band of that name already runs under the address: sign into it instead. */
  | { kind: "existing"; band: BandOfEmail }
  | { kind: "create" };

/** Whether `email`'s person may start a band called `name`, given the bands it runs. */
export function decideNewBand(bands: readonly BandOfEmail[], name: string): CreateDecision {
  const suspended = bands.find((band) => band.bannedAt);
  if (suspended) return { kind: "suspended", band: suspended };
  const existing = bands.find((band) => sameBandName(band.name, name));
  return existing ? { kind: "existing", band: existing } : { kind: "create" };
}

export type SignInDecision =
  /** No band under the address: nothing is sent, and the page says the same as always. */
  | { kind: "none" }
  /** Every band under the address is suspended: the notice goes instead of a link. */
  | { kind: "suspended"; band: BandOfEmail }
  /** The bands a link may open, oldest first. One goes straight in; more are chosen from. */
  | { kind: "open"; bands: BandOfEmail[] };

/** What a sign-in request opens. A suspended band is never one of them. */
export function decideSignIn(bands: readonly BandOfEmail[]): SignInDecision {
  if (bands.length === 0) return { kind: "none" };
  const open = bands.filter((band) => !band.bannedAt);
  const first = bands[0] as BandOfEmail;
  return open.length > 0 ? { kind: "open", bands: open } : { kind: "suspended", band: first };
}

/**
 * Whether a band may move under this address. Not while the address has a
 * suspended band (other than this one): moving there would hand the suspended
 * person a working band, which is what a suspension following the person
 * rules out.
 */
export function addressTakesBand(bandsOfAddress: readonly BandOfEmail[], bandId: string): boolean {
  return !bandsOfAddress.some((band) => band.bannedAt && band.id !== bandId);
}

/** What a sign-in mail and its landing page call what it opens: the band, or all of them. */
export function signInTitle(bands: readonly BandOfEmail[]): string {
  return bands.length === 1 ? (bands[0] as BandOfEmail).name : "tus bandas";
}

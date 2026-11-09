/**
 * The switches that can be thrown without a deploy, and what they mean when
 * nobody has thrown them.
 *
 * Pure on purpose: the defaults and the merge are the part worth reasoning
 * about, and they are decided here rather than in the query that reads the
 * table. `src/db/queries/flags.ts` does the reading.
 */

export type FlagKey = "sales" | "proof_extraction" | "billing";

/**
 * What each switch does, and which way it points when the table is empty.
 *
 *  - **sales** — off refuses *new purchases* across the whole platform. It
 *    does not touch QR delivery, check-in, the scanner or the live dashboard:
 *    taking the door offline mid-gig would be a worse failure than whatever
 *    was being stopped. This is the switch for money going somewhere wrong.
 *
 *  - **proof_extraction** — off skips the vision call. Orders still sell and
 *    QR codes still issue; proofs still land in the bucket for a human to
 *    read, and those orders are amber at the door until a read completes.
 *    Turned back on, the hourly retry reads them. This is the switch for a
 *    runaway bill.
 *
 *  - **billing** — on charges for the settlement report. Off while the product
 *    earns its place in the scene, which is why it is the one default that is
 *    false. Events already unlocked stay unlocked either way.
 *
 * Both kill switches default **on**. A flag store that cannot be read must
 * never be able to stop a gig by itself — the failure has to be deliberate.
 */
export const FLAG_DEFAULTS: Record<FlagKey, boolean> = {
  sales: true,
  proof_extraction: true,
  billing: false,
};

export type Flags = Record<FlagKey, boolean>;

/**
 * Folds stored rows onto the defaults.
 *
 * Unknown keys are ignored rather than rejected, so a row left behind by a
 * removed switch cannot break a request. Anything other than 0 counts as on,
 * because a hand-typed `UPDATE` is how these get set.
 *
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so a row keyed
 * `constructor` passed the test and hung a junk property off the result.
 */
export function resolveFlags(rows: { key: string; enabled: number }[]): Flags {
  const flags = { ...FLAG_DEFAULTS };
  for (const row of rows) {
    if (Object.hasOwn(FLAG_DEFAULTS, row.key)) flags[row.key as FlagKey] = row.enabled !== 0;
  }
  return flags;
}

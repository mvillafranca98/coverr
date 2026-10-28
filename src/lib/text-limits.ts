/**
 * How long each kind of free text may be, and how to say so when it is not.
 *
 * Every one of these ends up somewhere that carries it on: the event name and
 * venue on every buyer's page and ticket, a buyer's name in the door's offline
 * list and the band's emails. Without a ceiling, one paste into an event name
 * would ship with every page view. The limits are generous for anything a
 * person would really type.
 *
 * Over-long text is refused with a message, never silently cut: a band that
 * types 130 characters should see why, not find its event name trimmed.
 */
export const TEXT_LIMITS = {
  /** A person or a band: payer, attendee, member, band name. */
  name: 80,
  /** The longest address the email standard allows. */
  email: 254,
  phone: 30,
  ticketNote: 200,
  eventName: 120,
  venue: 120,
  description: 2000,
  musicType: 60,
  thankYouNote: 500,
  accountHolder: 120,
  /** The longest account number format in use anywhere (IBAN). */
  accountNumber: 34,
  expenseLabel: 120,
} as const;

/**
 * The message for text over its limit, or null when it fits.
 *
 * `label` is the field as the person filling it in would name it, article
 * included: "El nombre del evento", "Tu correo".
 */
export function tooLong(value: string, max: number, label: string): string | null {
  return value.length > max ? `${label} puede tener hasta ${max} caracteres.` : null;
}

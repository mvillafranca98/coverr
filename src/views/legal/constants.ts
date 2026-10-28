import { PROOF_RETENTION_DAYS } from "../../lib/core";

/**
 * The few values both legal documents quote. They live here so the two pages
 * cannot disagree with each other, and the retention window is re-exported
 * from `lib/core` rather than typed again so neither page can disagree with
 * the job that actually does the deleting.
 */
export { PROOF_RETENTION_DAYS };

/**
 * Where a reader writes to exercise habeas data, report a leak, or ask about
 * the terms. This is the address Coverr already sends from, so it is the one a
 * reader would reply to anyway — it has to be able to *receive* mail, which is
 * a setting on the sending domain, not something the code can guarantee.
 */
export const CONTACT_EMAIL = "coverr@macawly.dev";

/** Both documents were written at once; they share a date until one changes. */
export const UPDATED = "28 de octubre de 2026";

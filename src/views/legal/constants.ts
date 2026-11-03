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
 * the terms. This is the address Coverr sends from (EMAIL_FROM), so it is the
 * one a reader would reply to anyway. It receives mail only because Cloudflare
 * Email Routing forwards it to the operator's inbox — a setting on the domain,
 * not something the code can guarantee. See docs/EMAIL-SETUP.md.
 */
export const CONTACT_EMAIL = "hola@coverr.live";

/**
 * Each document's own last change. They shared one date until the report
 * prices moved, which changed the terms and not the privacy notice.
 */
export const PRIVACY_UPDATED = "3 de noviembre de 2026";
export const TERMS_UPDATED = "3 de noviembre de 2026";

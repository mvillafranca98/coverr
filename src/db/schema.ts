import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Conventions
 * - ids are ULID-ish strings generated in the Worker (sortable, no autoincrement races)
 * - money is stored in CENTAVOS (integer). L200.00 -> 20000. Never floats.
 * - timestamps are ISO-8601 UTC strings. SQLite has no date type.
 * - booleans are integers, 0/1.
 */

export const bands = sqliteTable(
  "bands",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /**
     * How the band is reached and signed into. Not unique since 2026-11-04: one
     * person may run several bands under one address (lib/band-identity.ts).
     */
    contactEmail: text("contact_email").notNull(),
    createdAt: text("created_at").notNull(),
    /** Set when the operator bans the band; null while it is in good standing. */
    bannedAt: text("banned_at"),
    banReason: text("ban_reason"),
    /** Set while the band holds a free pass: the reports it unlocks are free. */
    freePassGrantedAt: text("free_pass_granted_at"),
    /** The pass's last day, YYYY-MM-DD in Honduras. Null means it never ends. */
    freePassUntil: text("free_pass_until"),
    freePassNote: text("free_pass_note"),
    /**
     * A discount the operator granted this band, set while it has reports left
     * to use it on: a percentage off its next `promoReportsLeft` charged
     * reports, for shows held by `promoUntil` (YYYY-MM-DD) when there is one.
     */
    promoGrantedAt: text("promo_granted_at"),
    promoPercent: integer("promo_percent"),
    promoReportsLeft: integer("promo_reports_left"),
    promoUntil: text("promo_until"),
    promoNote: text("promo_note"),
  },
  (t) => [
    // Sign-in and sign-up look a person's bands up by their address.
    index("idx_bands_contact_email").on(t.contactEmail),
    // The operator's list of every band, newest first.
    index("idx_bands_created").on(t.createdAt),
  ],
);

/**
 * Every change the operator makes to a band's standing, so a ban or a free
 * pass can always be traced to who did it and when. It goes with the band if
 * the band deletes its account, like everything else of theirs.
 */
export const operatorActions = sqliteTable(
  "operator_actions",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    operatorEmail: text("operator_email").notNull(),
    /** ban | unban | free_pass | free_pass_end | promo | promo_end | fee_resolved | fee_unpaid */
    action: text("action").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_operator_actions_band").on(t.bandId, t.createdAt)],
);

export const bandMembers = sqliteTable(
  "band_members",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /**
     * Percent, 0-100, to the hundredth. A band's members total exactly 100: the
     * members table refuses to save otherwise (lib/member-split.ts). A fund the
     * band keeps is a row of its own.
     */
    splitPct: real("split_pct").notNull().default(0),
    isCore: integer("is_core").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_members_band").on(t.bandId)],
);

/**
 * Bands list several accounts so buyers can pay same-bank and dodge the ~L40
 * ACH Pronto fee their own bank charges to send cross-bank.
 */
export const bankAccounts = sqliteTable(
  "bank_accounts",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    /** BAC | FICOHSA | ATLANTIDA | OCCIDENTE | BANPAIS | OTHER */
    bank: text("bank").notNull(),
    accountNumber: text("account_number").notNull(),
    holderName: text("holder_name").notNull(),
    /** Shown to buyers who pick "Otro" — the widest-reach account. */
    isDefault: integer("is_default").notNull().default(0),
    active: integer("active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_accounts_band").on(t.bandId)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    venue: text("venue").notNull(),
    /** ISO-8601 with offset, e.g. 2026-08-01T21:00:00-06:00 */
    startsAt: text("starts_at").notNull(),
    doorsAt: text("doors_at"),
    description: text("description"),
    musicType: text("music_type"),
    flyerUrl: text("flyer_url"),
    thankYouNote: text("thank_you_note"),
    capacityCap: integer("capacity_cap"),
    /** none | 24h */
    refundPolicy: text("refund_policy").notNull().default("none"),
    refundPolicyText: text("refund_policy_text"),
    wristbandsStart: integer("wristbands_start"),
    /** Door-staff access. A shared URL beats magic links at a venue with no
     *  signal: staff open one link, no inbox, no account, no round-trip. */
    staffToken: text("staff_token"),
    /** draft | live | closed | settled */
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_events_band").on(t.bandId),
    uniqueIndex("idx_events_staff_token").on(t.staffToken),
  ],
);

/**
 * Presale and box office are two rows, not an enum. "Presale until it sells out
 * or until Friday, then box office" is already two rules with trigger conditions —
 * modelling it this way means tiers later are configuration, not a rewrite.
 */
export const priceRules = sqliteTable(
  "price_rules",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** centavos */
    amount: integer("amount").notNull(),
    maxQty: integer("max_qty"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    /** This rule activates when the referenced rule sells out. */
    activatesOnSelloffOf: text("activates_on_selloff_of"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_price_rules_event").on(t.eventId)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Buyer-facing, e.g. JGL-4827. Also the optional "Detalle" code. */
    shortCode: text("short_code").notNull().unique(),
    payerName: text("payer_name").notNull(),
    payerEmail: text("payer_email").notNull(),
    payerPhone: text("payer_phone"),
    quantity: integer("quantity").notNull(),
    priceRuleId: text("price_rule_id").references(() => priceRules.id),
    /**
     * centavos per ticket, frozen at the sale.
     *
     * Today this equals `expectedAmount / quantity` on every row, because both
     * write paths multiply. It is stored anyway: a partial refund changes the
     * total without changing what a ticket cost, and the moment that lands the
     * division stops being true. Storing it now means the figure a band reads
     * is the one it was sold at, not an arithmetic guess that used to work.
     */
    unitAmount: integer("unit_amount").notNull(),
    /** centavos; the order total as quoted. Never recomputed from the rule. */
    expectedAmount: integer("expected_amount").notNull(),
    /** online | door_online | door_cash | manual | comp */
    channel: text("channel").notNull(),
    /** confirmed | refunded | void */
    status: text("status").notNull().default("confirmed"),
    /** matched | unmatched | flagged | manual_ok — INTERNAL ONLY, never shown to the buyer */
    verificationStatus: text("verification_status").notNull().default("unmatched"),
    /** Which bank the buyer said they'd pay from. Narrows reconciliation later. */
    bankSelected: text("bank_selected"),
    soldBy: text("sold_by"),
    /** Why this order exists, for manual sales: cash to the admin, tickets
     *  traded against a bill, a favour. Meaningless for online orders. */
    note: text("note"),
    /**
     * The refund policy as it stood when this order was placed, copied off the
     * event. Frozen here rather than read live so that editing the event never
     * retroactively closes a window the buyer was shown and consented to —
     * the same reason `expectedAmount` is stored rather than recomputed.
     */
    refundPolicy: text("refund_policy").notNull().default("none"),
    refundPolicyText: text("refund_policy_text"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_orders_event").on(t.eventId),
    index("idx_orders_email").on(t.payerEmail),
    index("idx_orders_status").on(t.eventId, t.status),
  ],
);

/** One row per ticket. A group of four arrives separately; each needs its own code. */
export const attendees = sqliteTable(
  "attendees",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    note: text("note"),
    /** 128-bit random, base32. This is the QR payload. */
    qrToken: text("qr_token").notNull().unique(),
    checkedInAt: text("checked_in_at"),
    checkedInBy: text("checked_in_by"),
    checkedInDevice: text("checked_in_device"),
    /**
     * Set when this one ticket is refunded, leaving the rest of the order
     * alone. Null is the ordinary state, so nothing needed backfilling.
     *
     * Four bought and two friends drop out is the common case, and before this
     * the band had to refund all four and have them buy two again at whatever
     * the price is now. A voided ticket stops scanning, leaves the counts and
     * drops its own unit_amount out of the takings — the other tickets on the
     * order are untouched.
     */
    voidedAt: text("voided_at"),
  },
  (t) => [index("idx_attendees_order").on(t.orderId)],
);

export const paymentProofs = sqliteTable(
  "payment_proofs",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** R2 object key. Binary never goes in D1. */
    fileKey: text("file_key").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    /** Exact-duplicate detection. */
    sha256: text("sha256").notNull(),
    /** Re-crop / re-screenshot detection. */
    phash: text("phash"),
    /** app_notification | web_result | alert_email | pdf_export | unknown */
    docType: text("doc_type").notNull().default("unknown"),
    ocrRaw: text("ocr_raw"),
    ocrConfidence: real("ocr_confidence"),
    xSenderName: text("x_sender_name"),
    xSenderAccount: text("x_sender_account"),
    xDestAccount: text("x_dest_account"),
    xDestName: text("x_dest_name"),
    /** centavos */
    xAmount: integer("x_amount"),
    xCurrency: text("x_currency"),
    xDatetime: text("x_datetime"),
    xReference: text("x_reference"),
    xDetail: text("x_detail"),
    xBank: text("x_bank"),
    uploadedAt: text("uploaded_at").notNull(),
    /** Proofs auto-delete 30 days after the event — this is third-party PII. */
    purgeAfter: text("purge_after").notNull(),
    /**
     * When the purge actually ran. The spec requires the deletion to be
     * logged, and this doubles as the marker that stops the job reprocessing
     * a row it has already cleared.
     */
    purgedAt: text("purged_at"),
  },
  (t) => [
    index("idx_proofs_order").on(t.orderId),
    index("idx_proofs_sha").on(t.sha256),
    index("idx_proofs_ref").on(t.xReference),
  ],
);

export const verificationFlags = sqliteTable(
  "verification_flags",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    proofId: text("proof_id").references(() => paymentProofs.id, { onDelete: "cascade" }),
    /** REF_DUPLICATE | DEST_MISMATCH | HASH_DUPLICATE | AMOUNT_SHORT | AMOUNT_OVER
     *  | DATE_STALE | UNREADABLE | MISSING_FIELDS | NOT_A_RECEIPT | NAME_MISMATCH */
    code: text("code").notNull(),
    /** critical | warning | info */
    severity: text("severity").notNull(),
    /** Shown to door staff on an amber scan so they can resolve it in five seconds. */
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [index("idx_flags_order").on(t.orderId), index("idx_flags_open").on(t.resolvedAt)],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Stays human: "Cristy — decoración tarima" */
    label: text("label").notNull(),
    /** What actually trends across events. Free-text labels alone can't be compared. */
    category: text("category").notNull().default("other"),
    /** centavos */
    amount: integer("amount").notNull(),
    note: text("note"),
    paid: integer("paid").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_expenses_event").on(t.eventId)],
);

export const advances = sqliteTable(
  "advances",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => bandMembers.id, { onDelete: "cascade" }),
    /** Null means it carries across events until settled. */
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    note: text("note"),
  },
  (t) => [index("idx_advances_member").on(t.memberId)],
);

export const refundRequests = sqliteTable(
  "refund_requests",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    requestedAt: text("requested_at").notNull(),
    reason: text("reason"),
    /** open | approved | denied */
    status: text("status").notNull().default("open"),
    /**
     * How many tickets this refund covered. Null means all of them, which is
     * what every buyer-initiated request is and what every row written before
     * partial refunds existed was.
     *
     * Not derivable: two partial refunds on one order leave three voided
     * tickets and no way to tell whether that was 2+1 or 1+2.
     */
    ticketCount: integer("ticket_count"),
    handledBy: text("handled_by"),
    handledAt: text("handled_at"),
  },
  (t) => [index("idx_refunds_order").on(t.orderId)],
);

/**
 * Derived, never entered. Built by normalising payer email and phone across
 * orders so a band can see someone has been to five shows without ever asking
 * them to sign up.
 */
export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    emailNormalized: text("email_normalized").notNull(),
    phoneNormalized: text("phone_normalized"),
    displayName: text("display_name").notNull(),
    firstSeenEventId: text("first_seen_event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    eventsCount: integer("events_count").notNull().default(0),
    ticketsCount: integer("tickets_count").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("idx_contacts_band_email").on(t.bandId, t.emailNormalized)],
);

/** Billing. The settlement report is the paywall; history stays free forever. */
export const eventUnlocks = sqliteTable(
  "event_unlocks",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" })
      .unique(),
    /** free_first | free_pass | promo | t60 | t150 | t300 | t500 | t501plus (t301plus before 2026-11-04) */
    bracket: text("bracket").notNull(),
    amount: integer("amount").notNull(),
    /** The promo's percentage when one priced this unlock; null when none did. */
    discountPercent: integer("discount_percent"),
    paidAt: text("paid_at"),
    /** free_first_event | free_pass | transfer (a fee_payments row holds the proof) */
    method: text("method"),
    reference: text("reference"),
  },
  // The fees ledger reads one month of unlocks at a time.
  (t) => [index("idx_unlocks_paid").on(t.paidAt)],
);

/**
 * The accounts Coverr collects its settlement fee into. The operator enters
 * them in the panel and nothing else ever writes them, so no account number
 * lives in the code. A band sees one only on the fee page.
 */
export const platformAccounts = sqliteTable("platform_accounts", {
  id: text("id").primaryKey(),
  /** One of the codes in lib/core.ts BANKS. */
  bank: text("bank").notNull(),
  holderName: text("holder_name").notNull(),
  accountNumber: text("account_number").notNull(),
  /** Shown to a band whose own bank has no Coverr account. Exactly one should be. */
  isMain: integer("is_main").notNull().default(0),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

/**
 * A band's transfer for one report: the screenshot it uploaded, what was read
 * from it, and where the operator's review stands. The report unlocked when
 * this row was written — nothing here holds a band waiting.
 */
export const feePayments = sqliteTable(
  "fee_payments",
  {
    id: text("id").primaryKey(),
    unlockId: text("unlock_id")
      .notNull()
      .unique()
      .references(() => eventUnlocks.id, { onDelete: "cascade" }),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    /** Centavos the band was asked to transfer. */
    amount: integer("amount").notNull(),
    /** R2 key under fees/. Null once the image has been purged. */
    fileKey: text("file_key"),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    sha256: text("sha256").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
    /** 90 days after upload. The image goes then unless the payment is still in question. */
    purgeAfter: text("purge_after").notNull(),
    purgedAt: text("purged_at"),
    /** checking | ok | flagged | resolved | unpaid */
    status: text("status").notNull().default("checking"),
    /** JSON array of { code, severity, detail }: what the checks raised. */
    flags: text("flags"),
    /** What was read off the screenshot. Kept for good; the image is not. */
    xAmount: integer("x_amount"),
    xDestAccount: text("x_dest_account"),
    xReference: text("x_reference"),
    xDatetime: text("x_datetime"),
    xSenderName: text("x_sender_name"),
    xBank: text("x_bank"),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    /** The invoice sent by hand for this payment, so the ledger shows which still need one. */
    invoiceNumber: text("invoice_number"),
  },
  (t) => [
    index("idx_fee_payments_band").on(t.bandId, t.status),
    index("idx_fee_payments_uploaded").on(t.uploadedAt),
    index("idx_fee_payments_sha").on(t.sha256),
    index("idx_fee_payments_ref").on(t.xReference),
  ],
);

/**
 * The switches that can be thrown without a deploy.
 *
 * Everything here used to be a source constant, which meant turning something
 * off was a rebuild — no use at all at nine on a gig night. A row in this
 * table takes effect on the next request.
 *
 * An absent row means the default in `lib/flags.ts`, so an empty table is the
 * normal, healthy state and nothing has to be seeded. `note` is for whoever
 * reads this at 2am wondering why sales are off.
 *
 * Belongs to the platform, not a band: no band_id, and nothing in /admin
 * writes here. It is flipped by hand — see docs/RUNBOOK.md.
 */
export const platformFlags = sqliteTable("platform_flags", {
  key: text("key").primaryKey(),
  enabled: integer("enabled").notNull(),
  note: text("note"),
  changedAt: text("changed_at").notNull(),
});

/**
 * Sign-in links already used, band and operator alike, so each opens one
 * session and no more. A row is only needed until its link would have expired
 * anyway; the nightly sweep deletes it after that. Belongs to no band.
 */
export const usedSignInLinks = sqliteTable(
  "used_sign_in_links",
  {
    id: text("id").primaryKey(),
    usedAt: text("used_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_used_sign_in_links_expires").on(t.expiresAt)],
);

/**
 * Unhandled failures, kept so they can be counted and chased.
 *
 * Cloudflare already retains the console output, but a dashboard is somewhere
 * you have to go and look. This table is what makes an alert possible: it
 * gives something to rate-limit against, so one failing request cannot send a
 * hundred emails, and it outlives the log retention window.
 *
 * Belongs to nobody — it is the platform's own record, not a band's. No
 * request body is ever stored: a crash in the buy flow would otherwise carry
 * a name, an email and a bank screenshot into a table that nothing purges.
 */
export const errorLog = sqliteTable(
  "error_log",
  {
    id: text("id").primaryKey(),
    at: text("at").notNull(),
    /** request | scheduled | scanner | page — see `ErrorKind` */
    kind: text("kind").notNull(),
    /**
     * The same bug seen twice produces the same value here, so a crash loop
     * collapses into one alert instead of one per request. Built by
     * `errorFingerprint` in jobs/report-error.ts.
     */
    fingerprint: text("fingerprint").notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    /**
     * The matched route pattern — `/t/:token`, never `/t/abc123.png`. A real
     * pathname would put a live QR token, which is all it takes to walk in,
     * into a row that also goes out by email. The pattern already says which
     * handler broke, which is the part worth knowing.
     */
    path: text("path"),
    method: text("method"),
    /**
     * The lock that makes "one email per bug per hour" exact rather than
     * hopeful: `<hour>|<fingerprint>`, unique, null on every row that did not
     * try to alert.
     *
     * A crash loop is concurrent by nature. Counting rows and then deciding
     * would let fifty simultaneous requests all read zero and all send, which
     * is the worst moment to spend the day's email quota — it is shared with
     * ticket delivery. Claiming the window with a unique insert cannot race:
     * exactly one request wins, the rest are refused by the database.
     */
    alertClaim: text("alert_claim"),
    /** 1 only once the alert was actually accepted for delivery. */
    notified: integer("notified").notNull().default(0),
  },
  (t) => [
    index("idx_error_log_at").on(t.at),
    uniqueIndex("idx_error_log_alert_claim").on(t.alertClaim),
    // The hourly cap counts claims inside a time window.
    index("idx_error_log_fingerprint_at").on(t.fingerprint, t.at),
  ],
);

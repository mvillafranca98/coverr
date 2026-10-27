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
    /** The login identity — unique, or a band becomes unreachable. */
    contactEmail: text("contact_email").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("idx_bands_contact_email").on(t.contactEmail)],
);

export const bandMembers = sqliteTable(
  "band_members",
  {
    id: text("id").primaryKey(),
    bandId: text("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Whole percent, 0-100. Validated as summing to 100 at settlement (warn, never block). */
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
    /** centavos; quantity * rule amount at time of purchase */
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
    /** REF_DUPLICATE | DEST_MISMATCH | HASH_DUPLICATE | AMOUNT_SHORT
     *  | AMOUNT_OVER | DATE_STALE | UNREADABLE | NAME_MISMATCH */
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
export const eventUnlocks = sqliteTable("event_unlocks", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" })
    .unique(),
  /** free_first | t60 | t150 | t300 | t301plus */
  bracket: text("bracket").notNull(),
  amount: integer("amount").notNull(),
  paidAt: text("paid_at"),
  method: text("method"),
  reference: text("reference"),
});

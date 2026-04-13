import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  uuid,
  date,
  timestamp,
  boolean,
  doublePrecision,
  serial,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  check,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
);

// ---------------------------------------------------------------------------
// userProfiles
// ---------------------------------------------------------------------------

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),
    slugId: serial("slug_id").notNull().unique(),

    // Personal info
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    phoneSecondary: varchar("phone_secondary", { length: 50 }),
    roadAddress: text("road_address"),
    city: varchar("city", { length: 255 }),
    cityCode: varchar("city_code", { length: 50 }),
    country: varchar("country", { length: 255 }),
    countryCode: varchar("country_code", { length: 10 }),
    birthdate: varchar("birthdate", { length: 20 }),
    nationality: varchar("nationality", { length: 255 }),
    profession: varchar("profession", { length: 255 }),

    // External IDs
    digiformaId: varchar("digiforma_id", { length: 255 }),
    bexioContactId: varchar("bexio_contact_id", { length: 50 }),

    // Practice / directory info
    practiceName: varchar("practice_name", { length: 255 }),
    specialties: text("specialties").array(),
    bio: text("bio"),
    website: varchar("website", { length: 500 }),
    profileImageUrl: text("profile_image_url"),

    // Directory visibility — three-tier model (section 6.2)
    // "hidden"   = nowhere
    // "internal" = member directory only (default for new credentials)
    // "public"   = public + member directory
    directoryVisibility: varchar("directory_visibility", { length: 20 })
      .default("hidden")
      .notNull(),

    // Contact visibility toggles (section 6.3)
    showPhone: boolean("show_phone").default(false).notNull(),
    showEmail: boolean("show_email").default(false).notNull(),
    showAddress: boolean("show_address").default(false).notNull(),
    showOnMap: boolean("show_on_map").default(true).notNull(),

    // Future paid listing support (section 6.6)
    publicListingStatus: varchar("public_listing_status", { length: 20 })
      .default("active")
      .notNull(),
    publicListingExpiresAt: date("public_listing_expires_at"),

    // Geocoding
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_user_profiles_user_id").on(table.userId),
    index("idx_user_profiles_directory_visibility").on(table.directoryVisibility),
    index("idx_user_profiles_country").on(table.country),
    index("idx_user_profiles_city").on(table.city),
    check(
      "chk_directory_visibility",
      sql`${table.directoryVisibility} IN ('hidden', 'internal', 'public')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// authTokens — set-password and reset-password flows
// ---------------------------------------------------------------------------

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: varchar("token", { length: 255 }).unique().notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_auth_tokens_user_id").on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// digiformaSessions — local cache of DigiForma training sessions
// ---------------------------------------------------------------------------

export const digiformaSessions = pgTable(
  "digiforma_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    digiformaId: varchar("digiforma_id", { length: 100 }).unique().notNull(),
    name: varchar("name", { length: 500 }),
    code: varchar("code", { length: 100 }),
    programCode: varchar("program_code", { length: 100 }),
    programName: varchar("program_name", { length: 500 }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    place: varchar("place", { length: 500 }),
    placeName: varchar("place_name", { length: 500 }),
    remote: boolean("remote").default(false),
    inter: boolean("inter").default(false),
    imageUrl: text("image_url"),
    dates: jsonb("dates"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_digiforma_sessions_program_code_start_date").on(table.programCode, table.startDate),
  ]
);

// ---------------------------------------------------------------------------
// programOverrides — admin catalogue layer on top of DigiForma (section 4.1)
// ---------------------------------------------------------------------------

export const programOverrides = pgTable("program_overrides", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  programCode: varchar("program_code", { length: 100 }).unique().notNull(),
  published: boolean("published").default(false).notNull(),
  displayName: varchar("display_name", { length: 500 }),
  description: text("description"),
  imageUrl: text("image_url"),
  tags: text("tags").array(),
  category: varchar("category", { length: 255 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  highlightLabel: varchar("highlight_label", { length: 100 }),
  hybridEnabled: boolean("hybrid_enabled").default(false).notNull(),
  instructors: jsonb("instructors"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

// ---------------------------------------------------------------------------
// programPricing — pricing tiers per program (section 4.1 Tab 2)
// ---------------------------------------------------------------------------

export const programPricing = pgTable(
  "program_pricing",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programCode: varchar("program_code", { length: 100 }).notNull(),
    pricingType: varchar("pricing_type", { length: 50 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
    conditions: jsonb("conditions"),
    validFrom: date("valid_from"),
    validUntil: date("valid_until"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_program_pricing_active_program_code").on(table.active, table.programCode),
  ]
);

// ---------------------------------------------------------------------------
// programFeatureGrants — feature access driven by program completion (section 3.3)
// ---------------------------------------------------------------------------

export const programFeatureGrants = pgTable(
  "program_feature_grants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programCode: varchar("program_code", { length: 100 }).notNull(),
    featureKey: varchar("feature_key", { length: 100 }).notNull(),
    credentialRequired: boolean("credential_required").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_program_feature_grants_program_code").on(table.programCode),
    index("idx_program_feature_grants_created_by").on(table.createdBy),
  ]
);

// ---------------------------------------------------------------------------
// programEnrollments — financial and contractual entity (section 5.2)
// ---------------------------------------------------------------------------

export const programEnrollments = pgTable(
  "program_enrollments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    programCode: varchar("program_code", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    pricingTierUsed: uuid("pricing_tier_used").references(() => programPricing.id, {
      onDelete: "set null",
    }),
    bexioInvoiceId: varchar("bexio_invoice_id", { length: 50 }),
    bexioDocumentNr: varchar("bexio_document_nr", { length: 100 }),
    bexioTotal: numeric("bexio_total", { precision: 10, scale: 2 }),
    bexioNetworkLink: text("bexio_network_link"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).default(sql`now()`).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_enrollments_user_program").on(table.userId, table.programCode),
    index("idx_enrollments_pricing_tier").on(table.pricingTierUsed),
    check(
      "chk_enrollment_status",
      sql`${table.status} IN ('active', 'completed', 'refunded')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// sessionAssignments — operational token detail, can change freely (section 5.2)
// ---------------------------------------------------------------------------

export const sessionAssignments = pgTable(
  "session_assignments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    enrollmentId: uuid("enrollment_id")
      .references(() => programEnrollments.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).default("assigned").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).default(sql`now()`).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rescheduledFrom: varchar("rescheduled_from", { length: 100 }),
    participationMode: varchar("participation_mode", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_session_assignments_enrollment_id").on(table.enrollmentId),
    check(
      "chk_assignment_status",
      sql`${table.status} IN ('assigned', 'cancelled', 'attended', 'noshow')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// refundRequests — separate from session management (section 5.6)
// ---------------------------------------------------------------------------

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    enrollmentId: uuid("enrollment_id")
      .references(() => programEnrollments.id, { onDelete: "cascade" })
      .notNull(),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    adminNote: text("admin_note"),
    processedBy: uuid("processed_by").references(() => users.id, { onDelete: "set null" }),
    bexioCreditNoteId: varchar("bexio_credit_note_id", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_refund_requests_enrollment_id").on(table.enrollmentId),
    index("idx_refund_requests_processed_by").on(table.processedBy),
  ]
);

// ---------------------------------------------------------------------------
// bexioInvoices — dedicated Bexio invoice store (all invoices, user-linked)
// ---------------------------------------------------------------------------

export const bexioInvoices = pgTable(
  "bexio_invoices",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    bexioId: integer("bexio_id").unique().notNull(),
    documentNr: varchar("document_nr", { length: 100 }).notNull(),
    title: text("title"),
    invoiceDate: date("invoice_date"),
    contactId: integer("contact_id").notNull(),
    contactName: text("contact_name"),
    totalInclVat: numeric("total_incl_vat", { precision: 12, scale: 2 }),
    totalRemainingPayments: numeric("total_remaining_payments", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 30 }).notNull(),
    networkLink: text("network_link"),
    apiReference: varchar("api_reference", { length: 255 }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_bexio_invoices_user_id").on(table.userId),
    index("idx_bexio_invoices_contact_id").on(table.contactId),
    index("idx_bexio_invoices_document_nr").on(table.documentNr),
    index("idx_bexio_invoices_status").on(table.status),
  ]
);

// ---------------------------------------------------------------------------
// notificationTemplates — admin-managed email templates (section 8.4)
// ---------------------------------------------------------------------------

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    eventType: varchar("event_type", { length: 100 }).unique().notNull(),
    subject: text("subject"),
    body: text("body"),
    active: boolean("active").default(true).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_notification_templates_updated_by").on(table.updatedBy),
  ]
);

// ---------------------------------------------------------------------------
// notifications — queued notifications (section 8.4)
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    recipientId: uuid("recipient_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    templateId: uuid("template_id").references(() => notificationTemplates.id, {
      onDelete: "set null",
    }),
    channel: varchar("channel", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    mergeData: jsonb("merge_data"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    retryCount: integer("retry_count").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_notifications_recipient_status").on(table.recipientId, table.status),
    index("idx_notifications_template_id").on(table.templateId),
  ]
);

// ---------------------------------------------------------------------------
// syncState — DigiForma incremental sync tracking (section 9.1)
// ---------------------------------------------------------------------------

export const syncState = pgTable("sync_state", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  service: varchar("service", { length: 50 }).notNull(), // "digiforma"
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: varchar("last_sync_status", { length: 20 }), // success | partial | error
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  errorLog: text("error_log"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

// ---------------------------------------------------------------------------
// accredibleCredentials — inbound webhook data (section 10)
// ---------------------------------------------------------------------------

export const accredibleCredentials = pgTable(
  "accredible_credentials",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    accredibleCredentialId: varchar("accredible_credential_id", { length: 255 }).unique(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 500 }),
    groupName: varchar("group_name", { length: 500 }),
    credentialName: varchar("credential_name", { length: 500 }).notNull(),
    description: text("description"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    badgeUrl: text("badge_url"),
    certificateUrl: text("certificate_url"),
    url: text("url"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_accredible_credentials_user_id").on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// certifications — local certification records
// ---------------------------------------------------------------------------

export const certifications = pgTable(
  "certifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    certificationName: varchar("certification_name", { length: 255 }).notNull(),
    issuingBody: varchar("issuing_body", { length: 255 }),
    issuedAt: date("issued_at").notNull(),
    expiresAt: date("expires_at"),
    status: varchar("status", { length: 50 }).default("active"),
    verificationUrl: text("verification_url"),
    certificateImageUrl: text("certificate_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_certifications_user_id").on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// syncPushLog — outbound push attempts to DigiForma / Bexio
// ---------------------------------------------------------------------------

export const syncPushLog = pgTable(
  "sync_push_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    targetService: varchar("target_service", { length: 20 }).notNull(),
    entityType: varchar("entity_type", { length: 20 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    fieldsPushed: jsonb("fields_pushed"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_sync_push_log_created_at").on(table.createdAt),
    index("idx_sync_push_log_entity").on(table.entityType, table.entityId),
  ]
);

// ---------------------------------------------------------------------------
// workerConfig — configurable background worker settings
// ---------------------------------------------------------------------------

export const workerConfig = pgTable("worker_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).unique().notNull(),
  intervalMs: integer("interval_ms").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  label: varchar("label", { length: 255 }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

// ---------------------------------------------------------------------------
// activityLogs — searchable audit log (section 11.6)
// ---------------------------------------------------------------------------

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    adminEmail: varchar("admin_email", { length: 255 }),
    action: varchar("action", { length: 100 }).notNull(),
    detail: text("detail"),
    targetType: varchar("target_type", { length: 50 }),
    targetId: varchar("target_id", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [index("idx_activity_logs_user").on(table.userId)]
);

// ---------------------------------------------------------------------------
// Community forum — Phase 2 (section 7.4)
// ---------------------------------------------------------------------------

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    programCode: varchar("program_code", { length: 100 }),
    sessionId: varchar("session_id", { length: 100 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_channels_program_code").on(table.programCode),
    index("idx_channels_session_id").on(table.sessionId),
    uniqueIndex("idx_channels_program_session_unique")
      .on(table.programCode, table.sessionId)
      .where(sql`program_code IS NOT NULL`),
  ]
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    channelId: uuid("channel_id")
      .references(() => channels.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_posts_channel").on(table.channelId),
    index("idx_posts_author_id").on(table.authorId),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_comments_post").on(table.postId),
    index("idx_comments_author_id").on(table.authorId),
  ]
);

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_reactions_post").on(table.postId),
    index("idx_reactions_comment").on(table.commentId),
    index("idx_reactions_user_id").on(table.userId),
    uniqueIndex("uq_reactions_user_post_type").on(table.userId, table.postId, table.type),
    uniqueIndex("uq_reactions_user_comment_type").on(table.userId, table.commentId, table.type),
    check(
      "chk_reactions_xor_target",
      sql`(${table.postId} IS NOT NULL AND ${table.commentId} IS NULL) OR (${table.postId} IS NULL AND ${table.commentId} IS NOT NULL)`
    ),
  ]
);

// ---------------------------------------------------------------------------
// offers — admin-managed partner deals (section 13)
// ---------------------------------------------------------------------------

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    partnerName: varchar("partner_name", { length: 255 }).notNull(),
    partnerLogoUrl: text("partner_logo_url"),
    discountText: varchar("discount_text", { length: 255 }),
    category: varchar("category", { length: 100 }),
    redemptionUrl: text("redemption_url"),
    redemptionCode: varchar("redemption_code", { length: 255 }),
    visibility: varchar("visibility", { length: 20 }).default("all").notNull(),
    requiredFeature: varchar("required_feature", { length: 100 }),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    published: boolean("published").default(false).notNull(),
    clickCount: integer("click_count").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_offers_published").on(table.published),
    index("idx_offers_category").on(table.category),
    index("idx_offers_valid_until").on(table.validUntil),
    check(
      "chk_offers_visibility",
      sql`${table.visibility} IN ('all', 'feature_gated')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Private & group messaging
// ---------------------------------------------------------------------------

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 255 }),
    isGroup: boolean("is_group").default(false).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_conversations_last_message_at").on(table.lastMessageAt),
    index("idx_conversations_created_by").on(table.createdBy),
  ]
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).default(sql`now()`),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_conv_participants_conversation").on(table.conversationId),
    index("idx_conv_participants_user").on(table.userId),
    uniqueIndex("uq_conv_participant").on(table.conversationId, table.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_messages_conversation").on(table.conversationId),
    index("idx_messages_sender").on(table.senderId),
    index("idx_messages_created_at").on(table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// User contacts — contact request system for private messaging
// ---------------------------------------------------------------------------

export const userContacts = pgTable(
  "user_contacts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    requesterId: uuid("requester_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    recipientId: uuid("recipient_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_user_contacts_requester").on(table.requesterId),
    index("idx_user_contacts_recipient").on(table.recipientId),
    uniqueIndex("uq_user_contacts_pair").on(table.requesterId, table.recipientId),
    uniqueIndex("uq_user_contacts_canonical_pair").using(
      "btree",
      sql`LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id)`
    ),
    check(
      "chk_user_contacts_status",
      sql`${table.status} IN ('pending', 'accepted', 'rejected')`
    ),
    check(
      "chk_user_contacts_no_self",
      sql`${table.requesterId} != ${table.recipientId}`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Community events — meetups, webinars, networking, workshops
// ---------------------------------------------------------------------------

export const communityEvents = pgTable(
  "community_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    location: varchar("location", { length: 500 }),
    locationAddress: text("location_address"),
    isRemote: boolean("is_remote").default(false).notNull(),
    meetingUrl: text("meeting_url"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    maxAttendees: integer("max_attendees"),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),
    programCode: varchar("program_code", { length: 100 }),
    published: boolean("published").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_community_events_start_at").on(table.startAt),
    index("idx_community_events_program_code").on(table.programCode),
    index("idx_community_events_created_by").on(table.createdBy),
    check(
      "chk_community_event_type",
      sql`${table.eventType} IN ('meetup', 'webinar', 'networking', 'workshop', 'other')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Event RSVPs
// ---------------------------------------------------------------------------

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    eventId: uuid("event_id")
      .references(() => communityEvents.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    uniqueIndex("uq_event_rsvps_event_user").on(table.eventId, table.userId),
    index("idx_event_rsvps_event_id").on(table.eventId),
    index("idx_event_rsvps_user_id").on(table.userId),
    check(
      "chk_rsvp_status",
      sql`${table.status} IN ('attending', 'maybe', 'not_attending')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// files — admin-managed digital distribution (section 11)
// ---------------------------------------------------------------------------

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 255 }),
    programCode: varchar("program_code", { length: 100 }),
    visibility: varchar("visibility", { length: 20 }).default("members").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    downloadCount: integer("download_count").default(0).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_files_category").on(table.category),
    index("idx_files_program_code").on(table.programCode),
    index("idx_files_visibility").on(table.visibility),
    index("idx_files_uploaded_by").on(table.uploadedBy),
    check(
      "chk_files_visibility",
      sql`${table.visibility} IN ('public', 'members', 'program', 'paid')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// fileDownloads — download audit trail
// ---------------------------------------------------------------------------

export const fileDownloads = pgTable(
  "file_downloads",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fileId: uuid("file_id")
      .references(() => files.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_file_downloads_file").on(table.fileId),
    index("idx_file_downloads_user").on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// filePurchases — Stripe purchase records for paid files
// ---------------------------------------------------------------------------

export const filePurchases = pgTable(
  "file_purchases",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fileId: uuid("file_id")
      .references(() => files.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    stripeSessionId: varchar("stripe_session_id", { length: 255 }),
    amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_file_purchases_file").on(table.fileId),
    index("idx_file_purchases_user").on(table.userId),
    uniqueIndex("uq_file_purchases_user_file").on(table.userId, table.fileId),
  ]
);

// ---------------------------------------------------------------------------
// adminUsers — separate admin authentication (decoupled from member users)
// ---------------------------------------------------------------------------

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: text("password_hash"),
    displayName: varchar("display_name", { length: 255 }),
    isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_admin_users_email").on(table.email),
  ]
);

// ---------------------------------------------------------------------------
// instructors — formateurs / équipe pédagogique (synced from Digiforma)
// ---------------------------------------------------------------------------

export const instructors = pgTable(
  "instructors",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    digiformaId: varchar("digiforma_id", { length: 100 }).unique(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    specialties: jsonb("specialties").$type<string[]>().default([]),
    role: varchar("role", { length: 255 }).default("Formateur"),
    active: boolean("active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_instructors_digiforma_id").on(table.digiformaId),
    index("idx_instructors_email").on(table.email),
    index("idx_instructors_active").on(table.active),
  ]
);

// ---------------------------------------------------------------------------
// userWishlist — saved favorite programs (catalogue wishlist)
// ---------------------------------------------------------------------------

export const userWishlist = pgTable(
  "user_wishlist",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    programCode: varchar("program_code", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    uniqueIndex("idx_user_wishlist_user_program").on(table.userId, table.programCode),
    index("idx_user_wishlist_user_id").on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// pgSessions — express-session store (connect-pg-simple)
// ---------------------------------------------------------------------------

export const pgSessions = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { withTimezone: false }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// ---------------------------------------------------------------------------
// Zod insert schemas
// ---------------------------------------------------------------------------

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  slugId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigiformaSessionSchema = createInsertSchema(digiformaSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgramOverrideSchema = createInsertSchema(programOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgramPricingSchema = createInsertSchema(programPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgramFeatureGrantSchema = createInsertSchema(programFeatureGrants).omit({
  id: true,
  createdAt: true,
});

export const insertProgramEnrollmentSchema = createInsertSchema(programEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionAssignmentSchema = createInsertSchema(sessionAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertRefundRequestSchema = createInsertSchema(refundRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates).omit({
  id: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertSyncStateSchema = createInsertSchema(syncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccredibleCredentialSchema = createInsertSchema(accredibleCredentials).omit({
  id: true,
  createdAt: true,
});

export const insertCertificationSchema = createInsertSchema(certifications).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertReactionSchema = createInsertSchema(reactions).omit({
  id: true,
  createdAt: true,
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserContactSchema = createInsertSchema(userContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityEventSchema = createInsertSchema(communityEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileDownloadSchema = createInsertSchema(fileDownloads).omit({
  id: true,
});

export const insertFilePurchaseSchema = createInsertSchema(filePurchases).omit({
  id: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInstructorSchema = createInsertSchema(instructors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserWishlistSchema = createInsertSchema(userWishlist).omit({
  id: true,
  createdAt: true,
});

// ---------------------------------------------------------------------------
// Auth / validation schemas (shared client + server)
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
});

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export const setPasswordSchema = z.object({
  token: z.string().min(1, "Token requis"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  phoneSecondary: z.string().optional(),
  roadAddress: z.string().optional(),
  city: z.string().optional(),
  cityCode: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  birthdate: z.string().optional(),
  nationality: z.string().optional(),
  profession: z.string().optional(),
  practiceName: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
  profileImageUrl: z.string().optional(),
  directoryVisibility: z.enum(["hidden", "internal", "public"]).optional(),
  showPhone: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  showAddress: z.boolean().optional(),
  showOnMap: z.boolean().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Admin / API validation schemas
// ---------------------------------------------------------------------------


export const accredibleWebhookSchema = z.object({
  event: z.string().min(1),
  data: z.object({
    credential: z.object({
      id: z.number(),
      recipient: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      group: z.object({ name: z.string() }).nullable().optional(),
      name: z.string(),
      description: z.string().nullable().optional(),
      issued_at: z.string().nullable().optional(),
      expires_at: z.string().nullable().optional(),
      badge: z.object({ url: z.string() }).nullable().optional(),
      certificate: z.object({ url: z.string() }).nullable().optional(),
      url: z.string().nullable().optional(),
    }),
  }),
});

export const programOverrideBodySchema = z.object({
  published: z.boolean().optional(),
  displayName: z.string().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  category: z.string().max(255).nullable().optional(),
  sortOrder: z.number().int().optional(),
  highlightLabel: z.string().max(100).nullable().optional(),
  hybridEnabled: z.boolean().optional(),
  instructors: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    photoUrl: z.string().optional(),
    profileUrl: z.string().optional(),
  })).nullable().optional(),
});

export const communityEventBodySchema = z.object({
  title: z.string().min(1, "Titre requis").max(500),
  description: z.string().nullable().optional(),
  eventType: z.enum(["meetup", "webinar", "networking", "workshop", "other"]),
  location: z.string().max(500).nullable().optional(),
  locationAddress: z.string().nullable().optional(),
  isRemote: z.boolean().optional(),
  meetingUrl: z.string().url().nullable().optional(),
  startAt: z.string().min(1, "Date de début requise"),
  endAt: z.string().min(1, "Date de fin requise"),
  maxAttendees: z.number().int().positive().nullable().optional(),
  programCode: z.string().max(100).nullable().optional(),
  published: z.boolean().optional(),
});

export const rsvpBodySchema = z.object({
  status: z.enum(["attending", "maybe", "not_attending"]),
});

export type CommunityEventType = "meetup" | "webinar" | "networking" | "workshop" | "other";
export type RsvpStatus = "attending" | "maybe" | "not_attending";

export const fileUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  category: z.string().max(255).nullable().optional(),
  programCode: z.string().max(100).nullable().optional(),
  visibility: z.enum(["public", "members", "program", "paid"]).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  currency: z.string().length(3).optional(),
});


export const enrollmentBodySchema = z.object({
  programCode: z.string().min(1, "`programCode` requis."),
  sessionId: z.string().min(1, "`sessionId` requis."),
  pricingTierId: z.string().min(1, "`pricingTierId` requis."),
  finalAmount: z.number().finite().nonnegative().optional(),
  participationMode: z.enum(["in_person", "remote"]).nullable().optional(),
});

export const offerBodySchema = z.object({
  title: z.string().min(1, "Titre requis").max(500),
  description: z.string().nullable().optional(),
  partnerName: z.string().min(1, "Nom du partenaire requis").max(255),
  partnerLogoUrl: z.string().url().nullable().optional(),
  discountText: z.string().max(255).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  redemptionUrl: z.string().url().nullable().optional(),
  redemptionCode: z.string().max(255).nullable().optional(),
  visibility: z.enum(["all", "feature_gated"]).optional(),
  requiredFeature: z.string().max(100).nullable().optional(),
  validFrom: z.string().refine((v) => !v || !isNaN(Date.parse(v)), { message: "Date invalide" }).nullable().optional(),
  validUntil: z.string().refine((v) => !v || !isNaN(Date.parse(v)), { message: "Date invalide" }).nullable().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
}).refine(
  (data) => !!(data.redemptionUrl || data.redemptionCode),
  { message: "Un lien ou un code promo est requis.", path: ["redemptionUrl"] }
);

export type OfferVisibility = "all" | "feature_gated";

export type DirectoryVisibility = "hidden" | "internal" | "public";
export type EnrollmentStatus = "active" | "completed" | "refunded";
export type SessionAssignmentStatus = "assigned" | "cancelled" | "attended" | "noshow";
export type RefundRequestStatus = "pending" | "approved" | "denied";
export type NotificationChannel = "email" | "internal" | "push" | "sms";
export type NotificationStatus = "pending" | "sent" | "failed" | "read";
export type SyncStatus = "success" | "partial" | "error";
export type PricingType = "standard" | "retake" | "earlybird" | "group" | "custom";
export type PricingUnit = "total" | "per_day" | "per_session";
export type FeatureKey = "community" | "directory" | "supervision" | "offers";

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export type AuthToken = typeof authTokens.$inferSelect;

export type DigiformaSession = typeof digiformaSessions.$inferSelect;
export type InsertDigiformaSession = z.infer<typeof insertDigiformaSessionSchema>;

export type ProgramOverride = typeof programOverrides.$inferSelect;
export type InsertProgramOverride = z.infer<typeof insertProgramOverrideSchema>;

export type ProgramPricing = typeof programPricing.$inferSelect;
export type InsertProgramPricing = z.infer<typeof insertProgramPricingSchema>;

export type ProgramFeatureGrant = typeof programFeatureGrants.$inferSelect;
export type InsertProgramFeatureGrant = z.infer<typeof insertProgramFeatureGrantSchema>;

export type ProgramEnrollment = typeof programEnrollments.$inferSelect;
export type InsertProgramEnrollment = z.infer<typeof insertProgramEnrollmentSchema>;

export type SessionAssignment = typeof sessionAssignments.$inferSelect;
export type InsertSessionAssignment = z.infer<typeof insertSessionAssignmentSchema>;

export type RefundRequest = typeof refundRequests.$inferSelect;
export type InsertRefundRequest = z.infer<typeof insertRefundRequestSchema>;

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type SyncState = typeof syncState.$inferSelect;
export type InsertSyncState = z.infer<typeof insertSyncStateSchema>;

export type AccredibleCredential = typeof accredibleCredentials.$inferSelect;
export type InsertAccredibleCredential = z.infer<typeof insertAccredibleCredentialSchema>;

export type Certification = typeof certifications.$inferSelect;
export type InsertCertification = z.infer<typeof insertCertificationSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = z.infer<typeof insertReactionSchema>;

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type UserContact = typeof userContacts.$inferSelect;
export type InsertUserContact = z.infer<typeof insertUserContactSchema>;
export type ContactStatus = "pending" | "accepted" | "rejected";

export type CommunityEvent = typeof communityEvents.$inferSelect;
export type InsertCommunityEvent = z.infer<typeof insertCommunityEventSchema>;

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type FileDownload = typeof fileDownloads.$inferSelect;
export type InsertFileDownload = z.infer<typeof insertFileDownloadSchema>;

export type FilePurchase = typeof filePurchases.$inferSelect;
export type InsertFilePurchase = z.infer<typeof insertFilePurchaseSchema>;

export type FileVisibility = "public" | "members" | "program" | "paid";

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export type Instructor = typeof instructors.$inferSelect;
export type InsertInstructor = z.infer<typeof insertInstructorSchema>;

export type UserWishlist = typeof userWishlist.$inferSelect;
export type InsertUserWishlist = z.infer<typeof insertUserWishlistSchema>;

export type SyncPushLog = typeof syncPushLog.$inferSelect;
export type InsertSyncPushLog = typeof syncPushLog.$inferInsert;

export type WorkerConfig = typeof workerConfig.$inferSelect;
export type InsertWorkerConfig = typeof workerConfig.$inferInsert;

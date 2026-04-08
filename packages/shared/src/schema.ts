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
    role: varchar("role", { length: 20 }).default("member").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    check("chk_users_role", sql`${table.role} IN ('member', 'admin')`),
  ]
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
  highlightLabel: varchar("highlight_label", { length: 100 }), // "Nouveau" | "Prochainement" | "Complet"
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
// activityLogs — searchable audit log (section 11.6)
// ---------------------------------------------------------------------------

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
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
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => [
    index("idx_channels_program_code").on(table.programCode),
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

export const updateUserRoleSchema = z.object({
  role: z.enum(["member", "admin"]),
});

export const updateUserRoleParamsSchema = z.object({
  id: z.string().uuid("Identifiant utilisateur invalide."),
});

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
});

export const enrollmentBodySchema = z.object({
  programCode: z.string().min(1, "`programCode` requis."),
  sessionId: z.string().min(1, "`sessionId` requis."),
  pricingTierId: z.string().min(1, "`pricingTierId` requis."),
  finalAmount: z.number().finite().nonnegative().optional(),
});

export type UserRole = "member" | "admin";
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

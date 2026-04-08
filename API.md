# mhp | connect 2.0 — API Surface

**Base URL:** `/api`  
**Auth mechanism:** HTTP-only signed session cookie (`connect.sid`)  
**Error format:** `{ error: string, code?: string }` — HTTP status reflects the error class  
**Feature-locked 403:** `{ error: string, featureKey: string, locked: true }`

---

## Auth key

| Symbol | Meaning |
|--------|---------|
| — | No authentication required |
| session | Any valid session (logged in, any role) |
| member | Valid session, any role |
| admin | `role === "admin"` in session |
| member + `[feature]` | Valid session + feature grant resolved via `resolveUserFeatures()` |
| HMAC-SHA256 | `X-Signature` header verified against `ACCREDIBLE_WEBHOOK_SECRET` — no session required |

---

## POST /api/auth/register

**Auth:** —  
**Body:** `{ email, password, firstName, lastName }`  
Creates user + profile. Regenerates session to prevent session fixation. Sets `userId` and `role` on the new session.  
**201** `{ user }` | **400** validation error | **409** email already registered

## POST /api/auth/login

**Auth:** —  
**Rate limit:** 10 requests / 15 min per IP  
**Body:** `{ email, password }`  
bcrypt verify. Regenerates session on success.  
**200** `{ user }` | **400** validation | **401** invalid credentials

## POST /api/auth/logout

**Auth:** —  
Destroys session and clears `connect.sid` cookie.  
**200** `{ success: true }`

## GET /api/auth/me

**Auth:** session  
Returns the authenticated user and their resolved feature grants. Admins receive the full hardcoded set without DB queries. Frontend uses `features` to drive sidebar show/lock state.  
**200** `{ user, features: string[] }` — e.g. `features: ["directory", "community"]`  
**401** not authenticated | **401** session references deleted user (session destroyed)

## POST /api/auth/forgot-password

**Auth:** —  
**Body:** `{ email }`  
Generates a 1-hour reset token and sends a password reset email. Always returns 200 regardless of whether the email is registered (no enumeration).  
**200** `{ success: true }`

## POST /api/auth/reset-password

**Auth:** —  
**Body:** `{ token, password }`  
Validates token type (`reset_password`), expiry, and `usedAt`. Sets new bcrypt hash and marks token used.  
**200** `{ success: true }` | **400** invalid/expired token

## POST /api/auth/set-password

**Auth:** —  
**Body:** `{ token, password }`  
Admin-invite flow. Validates 24-hour `set_password` token. Sets password and marks `emailVerified = true`.  
**200** `{ success: true }` | **400** invalid/expired token

---

## GET /api/programs

**Auth:** —  
Returns the published programme catalogue grouped by category, ordered by `sortOrder`. Each programme includes DigiForma sessions, active pricing tiers, and editorial override fields. Feature grants are not loaded at list level.  
**200** `CatalogueByCategory[]`

## GET /api/programs/:code

**Auth:** —  
Full programme detail for a single programme code. Includes all sessions, pricing tiers, and feature grants configured for this programme.  
**200** `CatalogueProgram` | **404** not found

## GET /api/programs/admin/digiforma

**Auth:** admin  
Raw DigiForma programme list (cached 5 min). Used by the admin override setup UI to select which DigiForma programme a `programOverride` corresponds to.  
**200** `DigiformaProgram[]`

## GET /api/programs/admin/bexio-articles

**Auth:** admin  
Raw Bexio article list (cached 5 min). Used to verify article codes before setting up pricing tiers.  
**200** `BexioArticle[]`

## POST /api/programs/admin/sync

**Auth:** admin  
Invalidates the in-memory DigiForma and Bexio caches. Next request to any programme or directory endpoint fetches fresh data from the external APIs.  
**200** `{ ok: true }`

## PUT /api/programs/admin/:code/override

**Auth:** admin  
**Body:** `Partial<ProgramOverride>` (excluding `id`, `programCode`, timestamps)  
Upserts the editorial override for `code`. Creates if not exists, updates if exists.  
**200** `ProgramOverride`

## PATCH /api/programs/admin/:code/published

**Auth:** admin  
**Body:** `{ published: boolean }`  
Toggles the `published` flag on the override. Unpublishing hides the programme from the public catalogue immediately.  
**200** `ProgramOverride` | **404** override not found

## POST /api/programs/admin/:code/pricing

**Auth:** admin  
**Body:** `{ pricingType, label, amount, unit, currency?, conditions?, validFrom?, validUntil?, active? }`  
Creates a new pricing tier for this programme.  
**201** `ProgramPricing`

## PATCH /api/programs/admin/pricing/:tierId

**Auth:** admin  
**Body:** `Partial<ProgramPricing>` (excluding `id`, `programCode`, timestamps)  
Updates an existing pricing tier.  
**200** `ProgramPricing` | **404** not found

## DELETE /api/programs/admin/pricing/:tierId

**Auth:** admin  
Deletes a pricing tier.  
**204** | **404** not found

## POST /api/programs/admin/:code/grants

**Auth:** admin  
**Body:** `{ featureKey: string, credentialRequired: boolean }`  
Creates a feature grant linking this programme to a portal feature. Duplicate `(programCode, featureKey)` pairs are rejected.  
**201** `ProgramFeatureGrant` | **409** duplicate

## DELETE /api/programs/admin/grants/:grantId

**Auth:** admin  
Deletes a feature grant.  
**204** | **404** not found

---

## POST /api/enrollments

**Auth:** member  
**Body:** `{ programCode, sessionId, pricingTierId, finalAmount? }`  
Full enrollment pipeline:

1. Load user + profile from DB
2. DigiForma: find-or-create trainee by email **(fatal)**
3. DigiForma: add trainee to session **(fatal)**
4. Backfill `digiformaId` on profile if not set (best-effort)
5. DB: create `programEnrollment` + `sessionAssignment` in a transaction
6. Bexio: find-or-create contact, find-or-create article, create + issue + send invoice **(non-fatal — enrollment is created regardless)**
7. Patch enrollment with `bexioInvoiceId`, `bexioDocumentNr`, `bexioTotal` if Bexio succeeded
8. Queue `enrollment_confirmation` notification

**201** `ProgramEnrollment` | **400** bad input | **404** user/pricing tier not found

## GET /api/enrollments/me

**Auth:** member  
Returns all of the authenticated user's enrollments, each including their `sessionAssignments` array. Ordered by `enrolledAt` descending.  
**200** `EnrollmentWithAssignments[]`

## POST /api/enrollments/:id/reschedule

**Auth:** member (own enrollment) or admin  
**Body:** `{ newSessionId: string }`  
Removes trainee from old DigiForma session **(fatal)**, adds to new session **(fatal)**, updates `sessionAssignment` with new `sessionId` and `rescheduledFrom` for audit trail. Queues `session_rescheduled` notification.  
**200** `SessionAssignment` | **403** not owner | **404** enrollment/assignment not found

## POST /api/enrollments/:id/cancel-session

**Auth:** member (own enrollment) or admin  
DigiForma removal is attempted but **non-fatal** — local cancellation proceeds regardless. Marks active `sessionAssignment` as `cancelled` with `cancelledAt` timestamp.  
**200** `SessionAssignment` | **403** not owner | **404** no active session found

## POST /api/enrollments/:id/refund-request

**Auth:** member (own enrollment)  
**Body:** `{ reason?: string }`  
Creates a `refundRequest` with status `"pending"`. Guards against duplicate pending requests for the same enrollment.  
**201** `RefundRequest` | **403** not owner | **409** duplicate pending request | **409** already refunded

## GET /api/enrollments/admin/refunds

**Auth:** admin  
All pending refund requests ordered by `createdAt` descending.  
**200** `RefundRequest[]`

## POST /api/enrollments/admin/refunds/:id/process

**Auth:** admin  
**Body:** `{ approved: boolean, adminNote?: string }`  
If approved: creates Bexio credit note **(non-fatal)**, marks enrollment `"refunded"`, records `bexioCreditNoteId`.  
If denied: records decision with admin note.  
In both cases: updates `refundRequest` with `status`, `processedBy`, `adminNote`, queues `refund_update` notification.  
**200** `RefundRequest` | **404** not found | **409** already processed

---

## GET /api/directory

**Auth:** optional (resolveCallerContext)  
**Query:** `?search=&country=&specialty=`  
Returns practitioner listings. Caller context is resolved per session:

- **No session / no `directory` feature grant** → `"public"` context: only `directoryVisibility = "public"` entries, no contact fields
- **Admin or member with `directory` grant** → `"member"` context: `"public"` + `"internal"` entries, contact fields included per each practitioner's toggle settings (`showPhone`, `showEmail`, `showAddress`)
- Map coordinates included only when `showOnMap = true`

**200** `DirectoryEntry[]`

## GET /api/directory/filters

**Auth:** optional (same context resolution as above)  
Returns filter options derived from the visible practitioner set: distinct countries, distinct specialties (unnested), distinct Accredible credential names.  
**200** `{ countries: string[], specialties: string[], credentialNames: string[] }`

## GET /api/directory/:userId

**Auth:** optional  
Single practitioner entry with full credential badge list. Same visibility and serialization rules as the list endpoint.  
**200** `DirectoryEntry` | **404** not found or not visible to caller

## PATCH /api/directory/me/visibility

**Auth:** member + `directory` feature  
**Body:** `{ visibility: "hidden" | "internal" | "public" }`  
Sets the authenticated user's own `directoryVisibility`. Only practitioners with an active directory feature grant can manage their listing.  
**200** `UserProfile` | **403** feature locked | **404** profile not found

## PATCH /api/directory/me/contact-toggles

**Auth:** member + `directory` feature  
**Body:** `{ showPhone?, showEmail?, showAddress?, showOnMap? }` (all boolean, at least one required)  
Updates which contact fields are shown when the practitioner appears in directory listings.  
**200** `UserProfile` | **400** no toggles provided | **403** feature locked

---

## GET /api/notifications

**Auth:** member  
Returns internal bell notifications (`channel = "internal"`) for the authenticated user, ordered by `createdAt` descending, limit 50. These are created by `queueBoth()` for events like credential issuance and refund decisions.  
**200** `Notification[]`

## PATCH /api/notifications/:id/read

**Auth:** member  
Marks a notification as `"read"`. Ownership enforced — only the recipient can mark their own notifications.  
**204** | **404** not found or wrong owner

## GET /api/notifications/admin/templates

**Auth:** admin  
All notification templates (one per event type). Event types: `enrollment_confirmation`, `session_rescheduled`, `credential_issued`, `refund_update`, etc.  
**200** `NotificationTemplate[]`

## PUT /api/notifications/admin/templates/:id

**Auth:** admin  
**Body:** `{ subject: string | null, body: string | null, active: boolean }`  
Updates a notification template's subject, body, and active state. Subject and body support `{{merge-tag}}` substitution (e.g. `{{firstName}}`, `{{programName}}`).  
**200** `NotificationTemplate` | **404** not found

---

## POST /api/admin/webhook/accredible

**Auth:** HMAC-SHA256 (`X-Signature` header, no session required)  
Inbound Accredible credential webhook. Cascade on `credential.issued`:

1. Upsert credential record in `accredibleCredentials`
2. Resolve portal user by recipient email
3. Derive `programCode` via fuzzy match against `programOverrides` (displayName / programCode)
4. If user's `directoryVisibility = "hidden"` and a `directory` feature grant exists for the matched programme → upgrade to `"internal"`
5. Mark matching `programEnrollment` `active → "completed"`
6. Queue `credential_issued` notification (email + internal bell)

On `credential.revoked`: delete credential record; downgrade `"internal" → "hidden"` if no remaining credentials.  
**200** `{ ok: true, stored: boolean, userId: string | null }` | **401** invalid signature | **400** missing body

## GET /api/admin/sync

**Auth:** admin  
Current DigiForma sync state: last run timestamp, status (`success` / `partial` / `error`), record counts (created / updated / skipped), error log.  
**200** `SyncState | { service: "digiforma", lastSyncAt: null, lastSyncStatus: null }`

## POST /api/admin/sync/incremental

**Auth:** admin  
Triggers an incremental DigiForma trainee sync. Fetches all trainees, diffs against local `userProfiles` by email, upserts `digiformaId`, backfills empty profile fields on first link. Persists results to `syncState`.  
**200** `SyncState`

## POST /api/admin/sync/full

**Auth:** admin  
Triggers a full DigiForma trainee sync. Identical to incremental in current implementation — designed as the override for edge cases and initial setup.  
**200** `SyncState`

## GET /api/admin/users

**Auth:** admin  
**Query:** `?search=&role=`  
User list with embedded profile (firstName, lastName, city, directoryVisibility). Filtered in application layer. Ordered by `createdAt` descending.  
**200** `Array<User & { profile: Partial<UserProfile> | null }>`

## GET /api/admin/users/:id

**Auth:** admin  
Single user with full profile.  
**200** `User & { profile: UserProfile | null }` | **404** not found

## PATCH /api/admin/users/:id/role

**Auth:** admin  
**Body:** `{ role: "member" | "admin" }`  
Updates user role.  
**200** `{ id, email, role }` | **400** invalid role | **404** not found

## GET /api/admin/activity-logs

**Auth:** admin  
**Query:** `?userId=&limit=` (limit max 500, default 100)  
Searchable audit log. Filter by userId for per-user activity view.  
**200** `ActivityLog[]`

---

## GET /healthz

**Auth:** —  
Application alive check.  
**200** `{ status: "ok" }`

## GET /readyz

**Auth:** —  
Database connectivity check (`SELECT 1`).  
**200** `{ status: "ok" }` | **503** database unavailable

---

## Background workers

These run in-process — no external job scheduler required.

| Worker | Interval | Description |
|--------|----------|-------------|
| Notification processor | 30 seconds | Fetches `pending` notifications, renders `{{merge-tag}}` substitution from stored `mergeData`, sends email via SMTP or flips internal to `"sent"` |
| DigiForma incremental sync | 1 hour | Upserts `digiformaId` on matching user profiles, backfills empty fields on first link, logs to `syncState` |

---

## Feature grant resolution

`GET /api/auth/me` returns `features: string[]`. The frontend uses this array to show or lock sidebar items.

| Feature key | Unlocked when |
|-------------|---------------|
| `community` | Active/completed enrollment in a programme with `featureKey="community"` and `credentialRequired=false` |
| `directory` | Completed enrollment (Accredible credential received) in a programme with `featureKey="directory"` and `credentialRequired=true` |
| `supervision` | Completed enrollment in a programme with `featureKey="supervision"` and `credentialRequired=true` |
| `offers` | Completed enrollment in a programme with `featureKey="offers"` and `credentialRequired=true` |

Admins always receive all four feature keys without database queries.  
`credentialRequired=false` grants unlock on any active or completed enrollment.  
`credentialRequired=true` grants unlock only when `enrollment.status = "completed"` — set automatically by the Accredible webhook handler.

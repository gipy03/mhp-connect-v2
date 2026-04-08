# mhp | connect — Version 2.0 Specification

**MHP & Partners Sàrl / OMNI Hypnose® Suisse romande**
**April 2026 — CONFIDENTIAL**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture](#2-architecture)
3. [Authentication & Access Model](#3-authentication--access-model)
4. [Program Management](#4-program-management)
5. [Enrollment & Session Management](#5-enrollment--session-management)
6. [Practitioner Directory](#6-practitioner-directory)
7. [Community Forum](#7-community-forum)
8. [Notification System](#8-notification-system)
9. [DigiForma Synchronization](#9-digiforma-synchronization)
10. [Accredible Webhook Integration](#10-accredible-webhook-integration)
11. [Admin Dashboard](#11-admin-dashboard)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Migration Plan](#13-migration-plan)
14. [SEO & Public Pages](#14-seo--public-pages)
15. [Future Considerations](#15-future-considerations)

---

## 1. Executive Summary

mhp | connect 2.0 is a complete rebuild of the MHP Hypnose student portal, replacing the current v1 application with a modular, platform-independent architecture. The 2.0 launches on Replit for development velocity and operational simplicity, but is built with zero platform dependencies — enabling future migration to Infomaniak, Railway, or any Node.js hosting provider without code changes. The application serves as the central hub for MHP's hypnotherapy training business: public course catalogue, student enrollment, training management, practitioner directory, and professional community.

### 1.1 Why rebuild

The v1 codebase (11,147 lines of application code across 218 commits, approximately 33% AI-agent generated) has served as a successful proof of concept but carries structural limitations that make incremental refactoring impractical:

- A single 1,480-line route file handling all 36 API endpoints with no service layer separation
- Authentication welded to Replit OIDC, blocking migration to independent hosting
- Zero test coverage, making safe refactoring impossible
- Directory sanitization logic duplicated four times across public and private endpoints
- A registration pipeline spanning four external services with no error recovery

### 1.2 What changes

- PepperShop e-commerce is eliminated — enrollment handled natively with Bexio invoicing
- Role-based access replaced by credential-driven feature grants
- Program management with admin-controlled catalogue, pricing, and feature configuration
- Program token model enabling self-service session rescheduling
- Three-tier practitioner directory with credential-verified listings
- Native community forum replacing Circle.so
- Notification system with customizable email templates
- Swiss-hosted infrastructure ready — launches on Replit, portable to Infomaniak or any provider

### 1.3 What stays

- Tech stack: React 18, Vite, Tailwind CSS, shadcn/ui, Express 5, TypeScript, Drizzle ORM, PostgreSQL, Zod
- Integration libraries: DigiForma (GraphQL), Bexio (REST), Accredible (webhook), Google Geocoding, Gmail SMTP — all ported verbatim
- Database schema foundation: users, profiles, certifications, activity logs — extended but not replaced
- Design system: Apple-inspired, minimalistic, greyscale, French-language

---

## 2. Architecture

### 2.1 Application structure

Single application with three access layers (public, member, admin) sharing one database, one set of integration libraries, and one deployment. No microservices, no separate enrollment app.

| Layer | Audience | Features |
|-------|----------|----------|
| Public | Anonymous visitors | Course catalogue, training calendar, practitioner directory, program detail pages, registration form |
| Member | Authenticated users | Dashboard, training timeline, session management, community forum, profile, certificates — features gated by credentials and enrollment status |
| Admin | Administrators | Program management (catalogue + pricing + feature grants), user management, notification templates, sync tools, refund processing, activity logs |

### 2.2 Tech stack

| Layer | Technology | Change from v1 |
|-------|-----------|----------------|
| Runtime | Node.js 20 | No change |
| Backend | Express 5 + TypeScript | No change, add service layer |
| Frontend | React 18 + Vite | No change |
| Routing | TanStack Router | Replaces Wouter — typed routes, layout guards |
| UI | shadcn/ui + Tailwind CSS | No change |
| Database | PostgreSQL + Drizzle ORM | No change, add proper migrations |
| Validation | Zod (shared client/server) | No change |
| Auth | Native email/password (ported from v1) | Replaces Replit OIDC |
| Monorepo | pnpm workspaces | New — shared packages |
| Hosting | Replit (launch) → portable to any provider | Replaces Replit OIDC lock-in; platform is now a choice, not a dependency |

### 2.3 Monorepo structure

```
mhp-connect-v2/
├── apps/
│   ├── web/          # React frontend (Vite)
│   └── api/          # Express 5 backend
├── packages/
│   ├── shared/       # Drizzle schema, Zod types, shared utilities
│   └── integrations/ # DigiForma, Bexio, Accredible, geocoding, email
├── pnpm-workspace.yaml
└── package.json
```

### 2.4 External integrations

| Service | Protocol | Purpose | Direction |
|---------|----------|---------|-----------|
| DigiForma | GraphQL API | Training programs, sessions, trainee management | Bidirectional |
| Bexio | REST API | Contacts, articles, invoices, credit notes | Bidirectional |
| Accredible | Webhook (inbound) | Credential issuance and verification | Inbound |
| Google Geocoding | REST API | Address-to-coordinates for directory map | Outbound |
| Gmail SMTP | SMTP | Transactional email delivery | Outbound |

### 2.5 Systems eliminated

| System | Reason for removal | Replaced by |
|--------|-------------------|-------------|
| PepperShop | Manual GUI maintenance of products mirroring DigiForma sessions; Bexio invoices already handle payment | Native enrollment module with auto-generated catalogue |
| Replit Auth (OIDC) | Platform lock-in; couples auth to hosting provider | Native email/password auth — app remains on Replit but without platform dependency |
| Circle.so | Creator-oriented platform; expensive (CHF 89–199/mo); duplicates directory and events features | Native community forum within the portal |

---

## 3. Authentication & Access Model

### 3.1 Authentication

Native email/password authentication, ported from v1's existing implementation:

- bcrypt password hashing
- HTTP-only signed session cookies via express-session with connect-pg-simple (PostgreSQL session store)
- Zod-validated login/register/forgot-password/reset-password flows
- Rate limiting on login endpoint via express-rate-limit

Social login (Google, Apple) can be added later via the `arctic` OAuth library without architectural changes. The auth layer is isolated in its own service module.

### 3.2 Roles

Two roles only. All feature-level access is driven by credentials and enrollment status, not roles.

| Role | Assigned by | Purpose |
|------|------------|---------|
| `member` | Auto on registration | Authenticated user. Feature access determined by credentials and enrollment data. |
| `admin` | Manual assignment | Full platform access including program management, user management, sync tools, notification templates, refund processing. |

### 3.3 Feature grants (credential-driven access)

Portal features (community, directory, supervision, offers) are unlocked by completing specific training programs, verified by Accredible credentials. Admins configure the mapping between programs and features.

**Data model — `programFeatureGrants`:**

| Field | Type | Description |
|-------|------|-------------|
| `programCode` | varchar | Matches DigiForma program code |
| `featureKey` | varchar | e.g. `"community"`, `"directory"`, `"supervision"`, `"offers"` |
| `credentialRequired` | boolean | `true` = needs Accredible credential; `false` = paid enrollment suffices |
| `createdBy` | uuid | Admin who configured this grant |

**Access resolution:** For a given user, fetch their Accredible credentials (completed programs) and paid training registrations (active enrollments). Cross-reference against `programFeatureGrants`. The union of all granted features determines what the user can see.

### 3.4 Feature access matrix

| Feature | No enrollment | Enrolled + paid | Certified (Accredible) | Admin |
|---------|--------------|----------------|----------------------|-------|
| Dashboard | Yes (empty) | Yes | Yes | Yes |
| Profile | Yes | Yes | Yes | Yes |
| Catalogue | Yes | Yes | Yes | Yes |
| Calendar | Yes | Yes | Yes | Yes |
| My registrations | Yes (empty) | Yes | Yes | Yes |
| Community | Locked | If configured | If configured | Yes |
| Directory | Locked | Locked | If configured | Yes |
| Supervision | Locked | Locked | If configured | Yes |
| Offers | Locked | Locked | If configured | Yes |
| Admin tools | No | No | No | Yes |

---

## 4. Program Management

Programs are the central entity in the 2.0 data model. A program represents a training offering (e.g. OMNI Praticien, Enfants & Hypnose). DigiForma remains the source of truth for structural data (sessions, dates, trainee enrollment). Bexio remains the source of truth for base article pricing. The 2.0 adds an editorial and configuration layer on top of both.

### 4.1 Admin program screen — three tabs

#### Tab 1: Présentation — catalogue overrides

**Data model — `programOverrides`:**

| Field | Type | Description |
|-------|------|-------------|
| `programCode` | varchar | DigiForma program code (foreign key) |
| `published` | boolean | Controls visibility in public catalogue (default: `false`) |
| `displayName` | varchar | Marketing name (overrides DigiForma program name) |
| `description` | text | Rich marketing description |
| `imageUrl` | text | Hero image for catalogue card |
| `tags` | text[] | e.g. `"praticien"`, `"avancé"`, `"spécialisation"`, `"nouveau"` |
| `category` | varchar | e.g. `"Formations certifiantes"`, `"Spécialisations"`, `"Workshops"` |
| `sortOrder` | integer | Manual ordering within category |
| `highlightLabel` | varchar | Optional badge: `"Nouveau"`, `"Prochainement"`, `"Complet"` |

#### Tab 2: Tarifs — pricing tiers

**Data model — `programPricing`:**

| Field | Type | Description |
|-------|------|-------------|
| `programCode` | varchar | Program reference |
| `pricingType` | varchar | `"standard"`, `"retake"`, `"earlybird"`, `"group"`, `"custom"` |
| `label` | varchar | Display name: `"Tarif standard"`, `"Tarif reprise (100.-/jour)"` |
| `amount` | decimal | Price amount |
| `unit` | varchar | `"total"`, `"per_day"`, `"per_session"` |
| `currency` | varchar | Default: `"CHF"` |
| `conditions` | jsonb | Flexible rules (e.g. `{ "requiresCredential": true, "programCodes": ["OMNI-PRACT"] }`) |
| `validFrom` / `validUntil` | date | Optional validity window |
| `active` | boolean | Toggle availability |

#### Tab 3: Accès — feature grants

Configures which portal features are unlocked upon completion of this program. See section 3.3 for the data model.

### 4.2 Public catalogue generation

The catalogue is auto-generated by merging three sources:

- **DigiForma:** programs with their sessions, dates, locations
- **Bexio:** base article pricing
- **programOverrides:** editorial content, images, tags, categories, published flag

Only programs with a `programOverrides` record where `published = true` appear in the public catalogue. Programs are grouped by category and ordered by `sortOrder` within each category.

---

## 5. Enrollment & Session Management

### 5.1 Program token model

Enrollment is program-centric, not session-centric. A student purchases access to a program (e.g. "OMNI Praticien") and receives a program token — a right to attend one session of that program. The token is bound to the program and cannot be transferred to a different program.

### 5.2 Data model

**`programEnrollments`** — the financial and contractual entity:

| Field | Type | Description |
|-------|------|-------------|
| `userId` | uuid | Enrolled member |
| `programCode` | varchar | Program purchased |
| `status` | varchar | `"active"` \| `"completed"` \| `"refunded"` |
| `pricingTierUsed` | uuid | Reference to `programPricing` tier applied |
| `bexioInvoiceId` | varchar | Bexio invoice reference |
| `bexioDocumentNr` | varchar | Invoice number for display |
| `bexioTotal` | varchar | Invoice total for display |
| `enrolledAt` | timestamp | Enrollment date |
| `cancelledAt` | timestamp | Nullable — set on refund |

**`sessionAssignments`** — the operational detail (can change freely):

| Field | Type | Description |
|-------|------|-------------|
| `enrollmentId` | uuid | Links to `programEnrollments` |
| `sessionId` | varchar | DigiForma session ID |
| `status` | varchar | `"assigned"` \| `"cancelled"` \| `"attended"` \| `"noshow"` |
| `assignedAt` | timestamp | When the session was selected |
| `cancelledAt` | timestamp | When the session was released |
| `rescheduledFrom` | varchar | Previous sessionId (nullable, for audit trail) |

### 5.3 Enrollment flow

1. Visitor browses public catalogue, selects a program and session.
2. Visitor fills registration form (name, email, session selection, applicable pricing tier).
3. Pipeline executes: create/find DigiForma trainee → add to DigiForma session → create/find Bexio contact → generate Bexio invoice at selected pricing → create `programEnrollment` and `sessionAssignment` records → send confirmation notification.
4. Student receives Bexio invoice with built-in payment options. Payment is handled by Bexio.
5. Upon payment, enrollment status is confirmed and portal features unlock based on `programFeatureGrants`.

### 5.4 Self-service session rescheduling

A student can change their session assignment at any time without financial consequences:

- View current session assignment on training timeline
- Click "Changer de session" — see available sessions for the same program
- Select new session — system updates DigiForma (remove from old, add to new) and updates `sessionAssignment`
- No Bexio interaction required — the invoice is for the program, not the session

### 5.5 Session cancellation and token recovery

Cancelling a session assignment frees the program token without any financial transaction:

- Student clicks "Annuler la session" — `sessionAssignment` status set to `"cancelled"`
- DigiForma enrollment for that session is removed
- Token becomes available — student sees "Aucune session sélectionnée" with option to choose a new session
- Token remains valid for future sessions, including sessions not yet published

### 5.6 Refund requests (separate process)

Refunds are financial decisions handled independently from session management.

**Data model — `refundRequests`:**

| Field | Type | Description |
|-------|------|-------------|
| `enrollmentId` | uuid | Links to `programEnrollments` |
| `reason` | text | Student's explanation |
| `status` | varchar | `"pending"` \| `"approved"` \| `"denied"` |
| `adminNote` | text | Admin's response |
| `processedBy` | uuid | Admin who processed |
| `bexioCreditNoteId` | varchar | Set on approval |

On approval: enrollment status set to `"refunded"`, token consumed, Bexio credit note issued via API.

---

## 6. Practitioner Directory

### 6.1 Overview

The directory is the public-facing showcase of MHP-certified practitioners. In 2.0, directory listing is an earned privilege tied to Accredible credentials, not a self-service toggle. Certification levels displayed are derived from actual credentials, not self-declared text fields.

### 6.2 Visibility model — three tiers

| Visibility | Where visible | Default for new credential | Use case |
|-----------|--------------|---------------------------|----------|
| `hidden` | Nowhere | No | Completed training but doesn't practice or prefers full privacy |
| `internal` | Member directory only (`/user/annuaire`) | Yes | Peer networking, colleague referrals, supervision groups |
| `public` | Public directory + member directory | No | Practitioners actively building their practice and seeking clients |

Replaces v1's binary `isListed` boolean. Default for newly credentialed practitioners is `internal` — visible to peers immediately, not publicly exposed until they consciously opt in.

### 6.3 Contact visibility toggles

Within visible tiers, practitioners control what contact information is shown:

- `showPhone` — boolean (default: `false`)
- `showEmail` — boolean (default: `false`)
- `showAddress` — boolean (default: `false`)
- `showOnMap` — boolean (default: `true`)

Visibility controls *where* you appear. Contact toggles control *what* people see when they find you.

### 6.4 Credential-verified badges

Directory cards display certification badges derived from Accredible credentials, not self-declared fields. Examples: "OMNI Praticien Certifié", "Spécialisation Enfants & Hypnose", "Ultra-Depth® Certifié". This provides a trust signal for anyone searching for a hypnotherapist through the public directory.

### 6.5 Single endpoint architecture

One `/api/directory` endpoint with a serialization layer that adapts based on caller context:

- **Public visitor:** listed practitioners with name, practice, city, specialties, verified credentials, bio, website, photo, map pin. No contact details.
- **Authenticated member with directory feature:** everything public sees plus contact details (per toggle settings). Also sees fellow members with `internal` visibility.
- **Not eligible for directory feature:** feature locked in sidebar.

This eliminates the four-way route duplication from v1.

### 6.6 Future: paid public listing

The data model includes fields to support monetizing public directory listings in the future:

- `publicListingStatus`: `"none"` | `"active"` | `"expired"`
- `publicListingExpiresAt`: nullable date

At launch, `publicListingStatus` defaults to `"active"` for all credentialed practitioners. When MHP decides to monetize, a configuration change downgrades unpaid practitioners from `public` to `internal`. The Bexio invoice infrastructure handles billing.

---

## 7. Community Forum

### 7.1 Rationale

Replaces Circle.so (CHF 89–199/month) with a native discussion forum integrated into the portal. MHP's community is a professional network of certified hypnotherapists, not a creator audience — it belongs inside the professional portal.

### 7.2 Launch strategy

**Phase 1 (2.0 launch):** Simplified Circle SSO redirect link — "Accéder à la communauté" opens Circle in a new tab. This avoids blocking the release on forum development.

**Phase 2 (fast follow):** Native community forum within the portal. Circle archived and terminated.

### 7.3 Native forum scope (Phase 2)

- Channels organized by topic (by training program, by region, general)
- Posts with markdown support, comments, reactions
- Notification integration — new posts in followed channels trigger notifications
- Access gated by `programFeatureGrants` (same system as all other features)
- Member profiles link to directory entries where applicable

### 7.4 Data model (Phase 2)

- `channels`: id, name, description, programCode (nullable — for program-specific channels), sortOrder
- `posts`: id, channelId, authorId, title, body (markdown), pinned, createdAt, updatedAt
- `comments`: id, postId, authorId, body, createdAt
- `reactions`: id, postId/commentId, userId, type (emoji)

---

## 8. Notification System

### 8.1 Architecture

A unified notification service with customizable templates managed via the admin dashboard. Notifications are stored in a queue table and processed by a background worker. The same table supports email (launch), internal bell notifications (launch), and push/SMS (future).

### 8.2 Event types at launch

| Event | Trigger | Channel |
|-------|---------|---------|
| Registration confirmation | Enrollment created | Email |
| Invoice sent | Bexio invoice generated | Email |
| Session reminder | 7 days before session start | Email |
| Session rescheduled | Session assignment changed | Email |
| Credential issued | Accredible webhook received | Email + Internal |
| Refund request update | Admin approves/denies refund | Email + Internal |
| Community mention | Tagged in a forum post (Phase 2) | Internal |

### 8.3 Template system

Admin dashboard provides a template editor per event type with:

- Subject line with merge tags (`{{firstName}}`, `{{programName}}`, `{{sessionDates}}`, etc.)
- Body with merge tags and basic HTML formatting
- Active/inactive toggle per event type
- Test send functionality

### 8.4 Data model

- `notificationTemplates`: id, eventType, subject, body, active, updatedBy, updatedAt
- `notifications`: id, recipientId, templateId, channel (`"email"` | `"internal"` | `"push"` | `"sms"`), status (`"pending"` | `"sent"` | `"failed"` | `"read"`), mergeData (jsonb), sentAt, createdAt

---

## 9. DigiForma Synchronization

### 9.1 Incremental sync (hourly cron)

Replaces v1's manual full-sync with an automated incremental approach:

- Hourly cron job queries DigiForma GraphQL with `updatedSince` filter
- Timestamp of last successful sync stored in a `syncState` table
- Pulls only changed trainees and sessions since last run
- Updates local records, triggers enrollment status changes
- Logs sync results (created/updated/skipped/errors) for admin dashboard

### 9.2 Full sync (admin-triggered)

Manual full sync remains available as an admin action for edge cases (initial setup, data reconciliation). Operates identically to v1 but with progress reporting.

### 9.3 Admin sync dashboard

Admin dashboard displays:

- Last sync timestamp and status (success/partial/error)
- Records created/updated/skipped in last run
- Error log with details
- Manual sync trigger button

---

## 10. Accredible Webhook Integration

In v1, the Accredible webhook stores credentials but triggers no downstream effects. In 2.0, an incoming credential is a critical event that cascades through the system:

1. **Store credential** (as today)
2. **Resolve user by email**
3. **Compute updated feature grants** (cross-reference `programFeatureGrants`)
4. **Update directory visibility:** if practitioner was `hidden` and now qualifies for directory feature, set to `internal`
5. **Update `programEnrollment` status** to `"completed"` if matching enrollment exists
6. **Fire "credential issued" notification** (congratulation email + internal notification)

Credential revocation (if Accredible supports it) triggers the reverse: feature grants recalculated, directory visibility potentially downgraded.

---

## 11. Admin Dashboard

The admin dashboard consolidates all management functions.

### 11.1 Program management

Three-tab editor per program: Présentation (catalogue overrides), Tarifs (pricing tiers), Accès (feature grants). See section 4 for details.

### 11.2 User management

- User list with search, filter by role/enrollment status
- User detail view: profile, enrollments, credentials, feature grants, activity log
- Role assignment (member/admin)
- Impersonation (carried from v1)

### 11.3 Enrollment & refund management

- Active enrollments overview with session assignment status
- Refund request queue with approve/deny workflow
- Enrollment statistics: registrations this month, unpaid invoices, upcoming sessions with seat counts

### 11.4 Notification templates

Template editor per event type with merge tags, HTML formatting, active/inactive toggle, and test send. See section 8 for details.

### 11.5 Sync & system status

- DigiForma sync status: last run, results, error log, manual trigger
- Geocoding backfill status and trigger
- Accredible webhook log: recent credentials received
- System health: database connectivity, external API status

### 11.6 Activity logs

Searchable, filterable activity log (carried from v1 with enhanced detail).

---

## 12. Infrastructure & Deployment

### 12.1 Hosting strategy

**Launch platform: Replit.** Chosen for development velocity, integrated PostgreSQL, zero-config deployment, and familiarity. The `.replit` configuration file and Nix modules are convenience layers only — no application code depends on Replit APIs or services.

**Portability principle:** The 2.0 is built with zero platform dependencies. The entire application is standard Node.js + Express + PostgreSQL. Migration to any hosting provider (Infomaniak Jelastic, Railway, Fly.io, bare VPS with Docker) requires only setting environment variables — no code changes.

**Portability constraints (enforced during development):**

- No Replit OIDC or Replit-specific auth — native email/password only
- No Replit-specific database APIs — standard PostgreSQL via `DATABASE_URL` connection string
- No Replit secrets API — all config via standard environment variables
- No Replit-specific file storage paths — uploads use relative paths configurable via env var
- Session store uses `connect-pg-simple` (PostgreSQL) — works on any platform with a database
- `.replit` and `replit.nix` files are gitignored convenience configs, not dependencies

**Future migration trigger:** Swiss data residency becomes a requirement (client request, certification body mandate, or business decision). At that point, deploy the identical codebase to Infomaniak Jelastic or VPS with only environment variable changes.

### 12.2 Deployment pipeline

- GitHub repository (`gipy03/mhp-connect-v2`) — canonical source
- Replit syncs from GitHub; push to main triggers rebuild
- Production build: Vite compiles frontend, esbuild bundles backend
- Database migrations via `drizzle-kit generate` + `drizzle-kit migrate` (replaces v1's risky `db:push`)

### 12.3 Environment configuration

All secrets managed via environment variables (Replit Secrets for launch, transferable to any provider's env var system). No `.env` files in production.

Required variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing key (min 32 chars) |
| `DIGIFORMA_API_KEY` | DigiForma GraphQL Bearer token |
| `BEXIO_API_TOKEN` | Bexio invoicing API token |
| `ACCREDIBLE_WEBHOOK_SECRET` | Validates inbound Accredible webhooks |
| `SMTP_USER` | Gmail address for transactional emails |
| `SMTP_APP_PASSWORD` | Gmail App Password |
| `GOOGLE_GEOCODING_API_KEY` | Google Geocoding API |
| `NODE_ENV` | `development` or `production` |
| `PORT` | HTTP port (default: `5000`) |
| `UPLOAD_DIR` | File upload directory (default: `./public/uploads`) |

### 12.4 Monitoring & logging

- Structured logging via Pino with request IDs (replaces v1's `console.log`)
- Health check endpoints: `/healthz` (app), `/readyz` (database)
- Admin dashboard sync status panel for external API health
- Replit built-in monitoring for launch; replaceable with any APM on migration

---

## 13. Migration Plan

### 13.1 Data migration

- Export existing users and profiles from v1 PostgreSQL
- Map v1 role field to 2.0 model: `"student"`/`"instructor"` → `"member"`, `"admin"` → `"admin"`, `"user"` → `"member"`
- Import Accredible credentials from v1 `accredible_credentials` table
- Run feature grants calculation for all existing users based on their credentials
- Verify DigiForma links (`digiformaId`) are intact
- Verify directory entries and map `isListed` boolean to new three-tier visibility (`true` → `"internal"`, `false` → `"hidden"`)

### 13.2 Cutover sequence

1. Deploy 2.0 as a new Replit project with production database
2. Run migration scripts against production data
3. Verify: user login, DigiForma data, Accredible credentials, directory listings
4. Update DNS: point mhp-hypnose.com to new Replit deployment
5. Redirect PepperShop enrollment links to 2.0 catalogue
6. Monitor for 48 hours, then decommission v1 Replit project
7. Cancel PepperShop subscription

### 13.3 Rollback plan

v1 Replit project remains live and unchanged until cutover is confirmed successful. DNS can be reverted to v1 within minutes if critical issues are discovered.

### 13.4 Future platform migration

When Swiss hosting or other requirements trigger a platform move:

1. Provision target infrastructure (e.g. Infomaniak Jelastic: Node.js + PostgreSQL nodes)
2. Set environment variables on target (identical to Replit Secrets)
3. `pg_dump` production database from Replit PostgreSQL → `pg_restore` on target
4. Push repo to target's Git deployment or build and deploy manually
5. Verify all endpoints and integrations
6. Update DNS
7. No code changes required

---

## 14. SEO & Public Pages

The public catalogue, calendar, and directory are acquisition tools. v1 is a client-side SPA with weak SEO. For 2.0:

- Server-side rendering or pre-rendering for public catalogue pages and directory detail pages
- Proper meta tags (title, description, og:image) per program and practitioner
- JSON-LD structured data: `Course` schema for catalogue, `LocalBusiness` schema for directory listings
- Clean, human-readable URLs: `/catalogue/omni-praticien`, `/annuaire/geneve/jean-dupont`
- `sitemap.xml` auto-generated from published programs and public directory entries

---

## 15. Future Considerations (out of scope for 2.0)

- Social login (Google, Apple) via `arctic` OAuth library
- Push notifications and SMS via notification service adapters
- Paid public directory listings with annual Bexio invoicing
- Native community forum (Phase 2 fast-follow after Circle SSO launch)
- i18n infrastructure for German-speaking Switzerland expansion
- Direct payment integration (Stripe or wallee) if Bexio invoice payments prove insufficient
- Docker containerization for platform migration (Infomaniak, Railway, Fly.io, bare VPS)
- Swiss data residency migration to Infomaniak when business requires it (zero code changes — env vars + database transfer only)
- Integration with TMS (training-management-system) for shared program/enrollment packages
- Mobile app (PWA enhancement or React Native wrapper)
- API versioning (`/api/v1/`) for external consumers

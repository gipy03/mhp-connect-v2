# mhp | connect v2

Student portal & training management platform for MHP Hypnose / OMNI Hypnose® Suisse romande.

## Architecture

pnpm monorepo with four workspace packages:

| Package | Role |
|---------|------|
| `apps/web` | React 18 + Vite frontend (port 5000) |
| `apps/api` | Express 5 backend (port 3001) |
| `packages/shared` | Drizzle ORM schema (1200+ lines, 28 tables), Zod validation schemas, seed script |
| `packages/integrations` | DigiForma, Bexio, email, geocoding, retry utilities, env validation |

## Tech Stack

- **Frontend**: React 18, Vite, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui, Leaflet maps, react-hook-form
- **Backend**: Express 5, TypeScript, Drizzle ORM, PostgreSQL, bcryptjs, express-session (connect-pg-simple), Pino structured logging
- **Testing**: Vitest 2.x workspace (109 tests, 9 test files)
- **Language**: French (UI and API error messages)

## Development

- Vite dev server on port 5000 proxies `/api` to Express on port 3001
- API env validation via `validateEnv()` at startup — requires `DATABASE_URL` and `SESSION_SECRET`
- Workflow: `PORT=3001 pnpm --filter '@mhp/api' dev & sleep 2 && pnpm --filter '@mhp/web' dev`
- Build order: shared → integrations → api → web (or `bash build.sh`)
- Post-merge setup script: `scripts/post-merge.sh` (pnpm install + bash build.sh)

## Database

- PostgreSQL via Replit's built-in database
- Schema defined in `packages/shared/src/schema.ts` (30 tables including files, file_downloads, file_purchases)
- 12 migrations in `packages/shared/drizzle/`
- Migrations: `pnpm db:generate` then `pnpm db:migrate`
- Seed: `pnpm db:seed` (creates admin user + notification templates)
- Admin email configurable via `SEED_ADMIN_EMAIL` env var (default: admin@mhp-hypnose.com)
- Admin password configurable via `SEED_ADMIN_PASSWORD` env var
- Indexes on all FK columns, composite query indexes, CHECK constraints on enum columns
- `bexio_total` stored as `numeric(10,2)`

## Key Tables

users, user_profiles, auth_tokens, digiforma_sessions, program_overrides, program_pricing, program_feature_grants, program_enrollments, session_assignments, refund_requests, notification_templates, notifications, sync_state, accredible_credentials, certifications, activity_logs, channels, posts, comments, reactions, offers, conversations, conversation_participants, messages, community_events, event_rsvps, files, file_downloads, file_purchases, bexio_invoices, admin_users, trainers, session (express-session store)

## API Routes

| File | Endpoints |
|------|-----------|
| `routes/auth.ts` | login, register, logout, me, forgot-password, reset-password, set-password, change-password |
| `routes/enrollment.ts` | enrollments CRUD, cancel-session, reschedule, refund-request, extranet-url, extranet-sessions |
| `routes/programs.ts` | catalogue, program detail, sessions, sitemap.xml, JSON-LD |
| `routes/profile.ts` | profile CRUD, photo upload |
| `routes/directory.ts` | directory listings, detail pages |
| `routes/notifications.ts` | notification list, mark-read |
| `routes/admin.ts` | user management, program overrides, pricing, feature grants, sync triggers, refund processing, impersonation |
| `routes/forum.ts` | community forum: channels CRUD, posts CRUD, comments CRUD, reactions toggle, admin channel management, program channel auto-creation |
| `routes/messaging.ts` | private & group messaging: conversation list, create, messages, send, read, participants, leave, user search |
| `routes/events.ts` | community events CRUD, RSVP endpoints, iCal export/subscription, admin event management, attendance reports |
| `routes/files.ts` | file sharing & digital distribution: admin upload/CRUD, member resource listing, signed download URLs, public file access, Stripe paid file checkout & webhook |
| `routes/invoices.ts` | Bexio invoice management: admin list/search/filter/sort/paginate, sync import, assign/unassign user, PDF download; member invoice list & PDF download |
| `routes/admin-auth.ts` | Separate admin auth: login/me/logout, admin user CRUD (create/update/delete), superadmin-only user management |
| `routes/trainers.ts` | Trainer management: public listing, admin CRUD, Digiforma sync trigger |

## Services

| File | Purpose |
|------|---------|
| `services/auth.ts` | register, login, password flows, token generation |
| `services/enrollment.ts` | enrollment pipeline (DigiForma + Bexio + DB), reschedule, cancel, refund |
| `services/sync.ts` | DigiForma incremental/full sync, bulk import, enrollment remapping |
| `services/bexio-sync.ts` | Bexio contact/invoice sync, keyword+api_reference+article-based invoice matching |
| `services/notification.ts` | notification queue, background processor with retry, session reminders, event reminders (24h + 1h) |
| `services/accredible.ts` | webhook handler, credential cascade (enrollment complete → directory upgrade → notification) |
| `services/directory.ts` | directory listings with SQL-level filtering and ILIKE escape |
| `services/forum.ts` | forum CRUD for channels, posts, comments, reactions; archived channel enforcement; program channel auto-creation; session-level channels with auto-creation on DigiForma sync |
| `services/messaging.ts` | private & group messaging: conversation CRUD, message sending, unread tracking, participant management |
| `services/events.ts` | community event CRUD, RSVP management, iCal generation, full calendar feed, attendance reporting |
| `services/storage.ts` | Local filesystem storage (`.data/uploads/`): upload via multer memory buffer, direct binary download, file deletion |
| `services/program.ts` | catalogue assembly from DigiForma + overrides + pricing |
| `services/trainer-sync.ts` | Digiforma trainer sync: fetch all trainers, upsert into DB, preserve local edits (bio, photo, specialties, role), 6h cron |

## Frontend Pages (26 total, all lazy-loaded)

**Member pages**: Dashboard, Trainings, Profile, Notifications, Catalogue, ProgramDetail, AgendaPage, DirectoryPage, DirectoryDetailPage, Community (forum), Supervision, Offers

**Auth pages**: Login, Register, ForgotPassword, ResetPassword, SetPassword, AdminLogin

**Admin pages**: AdminUsers, AdminPrograms, AdminEnrollments, AdminRefunds, AdminNotifications, AdminSync, AdminActivity, AdminChannels, AdminEvents, AdminFiles, AdminInvoices, AdminAdmins, AdminTrainers

**Member pages (continued)**: Resources (file sharing & digital distribution)

**Other**: NotFound (404)

## Security

- Rate limiting: login (5/min), register (5/hr), forgot-password (5/15min)
- Zod validation on all API inputs including admin routes, enrollment, and webhook payloads
- `enrollmentBodySchema`: `.finite().nonnegative()` on `finalAmount` to prevent billing manipulation
- HMAC signature verification on Accredible webhooks (`timingSafeEqual`)
- Session regeneration on login and impersonation privilege transitions
- Impersonation hardening: verifies admin role on stop-impersonation, returns 400 for inactive sessions
- SQL-safe directory filtering with `escapeLike` helper for ILIKE patterns
- Database CHECK constraints on role, visibility, enrollment status, and session assignment status enums

## Hybrid Participation Mode

- Programs can be marked as `hybridEnabled` in admin overrides, allowing students to choose between "Présentiel" (in-person) and "En ligne" (remote) during enrollment
- `participationMode` column on `session_assignments` stores the choice ("in_person" | "remote" | null)
- EnrollmentDialog in ProgramDetail shows mode selector only when program has `hybridEnabled = true`
- Trainings page displays the chosen participation mode badge on each enrollment card

## DigiForma Sync

- Full sync imports **programs** → `program_overrides`, **sessions** → `digiforma_sessions`, **users** → links `user_profiles.digiformaId`
- Triggered via `POST /api/admin/sync/full` or `POST /api/admin/sync/incremental`
- Hourly incremental sync runs automatically as a background worker
- Concurrency guard prevents overlapping sync runs
- Batch operations wrapped in DB transactions for atomicity
- **Program hierarchy**: `getAllProgramsWithParents()` + `buildChildToRootMap()` resolves child→root mapping

## DigiForma Bulk Import

- One-time import: `POST /api/admin/sync/import` creates user accounts from all DigiForma trainees
- Creates `users` (no password, member role) + `user_profiles` with full profile data
- Creates `program_enrollments` and `session_assignments` from trainee session data
- Fully idempotent with DB transaction per trainee
- `POST /api/admin/sync/remap-enrollments` — remaps enrollment program codes from child→root codes

## Bexio Sync

- `POST /api/admin/sync/bexio` — full sync: contacts then invoices
- `POST /api/admin/sync/bexio/contacts` — matches by email, stores `bexio_contact_id`
- `POST /api/admin/sync/bexio/invoices` — links invoices via contact→user mapping + api_reference + title keyword matching + document_nr matching
- `POST /api/admin/sync/channels` — auto-create forum channels for all programs (from `program_overrides`) + all DigiForma sessions; `ensureChannelsForAllPrograms()` + `ensureChannelsForAllSessions()`
- Bexio article cache used during invoice sync for intern_code→programCode mapping
- Pagination capped at 100 pages with 100ms inter-page delay

## Database Population (Production Data)

All tables populated with real data from external sources:
- **1,195 users** + profiles from DigiForma bulk import
- **3,266 enrollments** (1,832 completed, 1,434 active) — completions derived from Accredible credentials
- **3,730 session assignments** across 499 DigiForma sessions
- **2,520 Accredible credentials** → 2,495 certifications
- **768 forum channels** (42 program-level from overrides + 265 from session programs + 461 session-level)
- **1,131 Bexio contacts** linked to user profiles
- **1,120 geocoded addresses** for directory map
- **740 users** with directory visibility = "internal" (qualified by credential + feature grant)
- **83 pricing tiers** across all 42 programs (standard, member, pack, etc.)
- **153 feature grants** across all programs (community, messaging, forum, files, directory, offers, supervision)

## Production Deployment

- **Target**: VM (persistent process for background workers)
- **Build**: `pnpm build` — compiles shared → integrations → API → web
- **Run**: `node apps/api/dist/index.js` — Express serves API routes + built frontend on port 5000
- **Static serving**: In production, Express serves the Vite build output from `apps/web/dist/`
- **Background workers**: Notification processor (30s interval, retries failed up to 3× with exponential backoff), DigiForma sync (hourly, with concurrency lock), Session reminders (hourly — queues reminders for sessions starting in 6-8 days with deduplication)
- **Logging**: Pino structured JSON logging with request IDs via pino-http (all console.log migrated to Pino)
- **Environment**: `NODE_ENV=production`, `PORT=5000` set for production environment
- **Required secrets**: `DATABASE_URL`, `SESSION_SECRET` (both already configured)
- **Optional secrets**: `DIGIFORMA_API_KEY`, `BEXIO_API_TOKEN`, `ACCREDIBLE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `GOOGLE_GEOCODING_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`
- **Security middleware**: Helmet (HSTS, X-Frame-Options, X-Content-Type-Options, etc.), CORS (same-origin in production), rate limiting on auth/upload/messaging endpoints
- **Input validation**: Zod schemas on all POST/PATCH bodies, UUID param validation middleware, message length limits
- **Build config**: `skipLibCheck: true` in root tsconfig; `esModuleInterop: true`; Express 5 wildcard: `"/{*splat}"`

## External Integrations

All external integrations have 15-second timeouts. GET/read requests have automatic retry with exponential backoff for transient errors (network failures, 5xx, 429). Retry utility: `packages/integrations/src/retry.ts`.

- **DigiForma**: GraphQL API for training programs/sessions; `costs` field provides default program pricing; `getExtranetUrl()` fetches student portal link by email match (fetchWithRetry, sync concurrency guard, batch ops in DB transaction)
- **Bexio**: REST API for contacts, invoices, credit notes (fetchWithRetry, pagination capped at 100 pages with 100ms inter-page delay)
- **Accredible**: Webhook for credential issuance with HMAC signature verification
- **Google Geocoding**: Address-to-coordinates for directory map (fetchWithRetry, 15s timeout)
- **Gmail SMTP**: Transactional email (withRetry for transient errors, 15s connection/socket timeout)

## Enrollment Data Enrichment

- `getUserEnrollments()` joins session assignments with `digiforma_sessions` table to return `startDate`, `endDate`, `place`, `placeName`, `remote` for each assigned session
- `GET /api/enrollments/extranet-url` returns the DigiForma student portal URL for the authenticated user (identity-verified via email match)
- `GET /api/enrollments/me/extranet-sessions` returns per-session DigiForma learner portal URLs via `getTraineeWithSessions`
- `bexioNetworkLink` stored on enrollment at invoice creation (Bexio `network_link` field = invoice public URL)
- "Mes formations" page: grouped by "À venir" (upcoming, chronological) vs "Terminées" (past/completed, reverse chrono); program images shown; prominent invoice/payment status; cancel/reschedule in DropdownMenu (secondary actions); DigiForma cost displayed; per-session extranet links; credential/certificate buttons for completed trainings
- Programme detail page: upcoming sessions only (no past); pricing sidebar uses DigiForma `costs[0].cost` formatted as "CHF X.– incl. 0% TVA" with retake calc (CHF 100.–/jour × days); "Équipe pédagogique" section using `trainers` JSONB from program_overrides; empty sections hidden; inter/intra badges removed; hero image with gradient overlay
- Catalogue page: DigiForma cost in card footer; next upcoming session date shown; no past sessions; cleaner card layout without inter/intra badges; category grouping with count

## Mobile & PWA

- **Responsive sidebar**: Desktop sidebar hidden on mobile (< md breakpoint), replaced by Sheet drawer triggered via hamburger menu in Header
- **Mobile sidebar provider**: `useMobileSidebar` context manages drawer open/close state across MemberLayout and AdminLayout
- **Sheet component**: `apps/web/src/components/ui/sheet.tsx` — slide-in drawer built on Radix Dialog
- **PWA manifest**: `apps/web/public/manifest.json` — French app name, standalone display, 192x192 and 512x512 icons
- **Service worker**: `apps/web/public/sw.js` — app shell caching with stale-while-revalidate strategy; excludes Vite dev paths (`/src/`, `/node_modules/`, `/@*/`, `?v=`) from caching to prevent duplicate React instances
- **Dashboard hero photo**: Training session photo as hero banner with gradient overlay and welcome text
- **Responsive layouts**: Main content area uses `p-4 sm:p-6`, `min-w-0` on flex container, calendar grid scrollable on mobile

## Frontend Architecture

- **Error boundary**: Root-level error boundary catches render errors, displays French fallback UI with reload button
- **Code splitting**: All 24 page components lazy-loaded via `React.lazy()` with shared `SuspenseWrapper` spinner
- **Profile forms**: react-hook-form + Zod schemas for PersonalInfoSection, AddressSection, PracticeSection
- **Notifications page**: Real notification history with read/unread status, filter tabs, mark-as-read, relative timestamps

## Design System & UI/UX

- **Color system**: Brand palette with deep teal `#2F4858` (primary), terracotta `#B07868` (accent), sand/olive/mauve/dark-plum secondary tones
- **Animations**: `animate-page-enter` (fade + slide up), `animate-fade-in`, stagger classes `stagger-1` through `stagger-5` (50ms increments); `tailwindcss-animate` plugin
- **Skeleton loading**: Custom `Skeleton` component (`apps/web/src/components/ui/skeleton.tsx`) used across Dashboard, Catalogue, Trainings, Agenda, Profile, and admin pages
- **Shared admin components**: `AdminPageShell`, `AdminTableSkeleton`, `AdminEmptyState` in `apps/web/src/components/AdminPageShell.tsx`
- **ScrollArea**: Radix-based scroll area component for sidebar navigation
- **Focus states**: Subtle ring focus on inputs, textareas, selects, password inputs (`focus-visible:ring-ring/20 focus-visible:border-primary/50`)
- **Card interactions**: Hover lift (`hover:-translate-y-0.5 hover:shadow-md`) on training cards, catalogue cards
- **Login layout**: Split-screen with dark gradient panel (left) and form (right) on desktop
- **Sidebar**: Section group labels, active-pill indicator with left border, ScrollArea for nav overflow
- **Consistent spinners**: All loading spinners use `border-primary/20 border-t-primary` pattern

## Testing

- **Framework**: Vitest 2.x with workspace config (`vitest.workspace.ts`)
- **Run all tests**: `pnpm test` (109 tests across 9 test files)
- **Watch mode**: `pnpm test:watch`
- **Per-package**: `pnpm --filter @mhp/shared test`, etc.
- **Test locations**: `src/__tests__/*.test.ts` in each package
- **Coverage areas**:
  - `@mhp/shared`: All Zod schemas (register, login, profile, enrollment, webhook, overrides) — 48 tests
  - `@mhp/integrations`: Retry logic (fetchWithRetry/withRetry), buildChildToRootMap, geocoding, email deriveBaseUrl — 29 tests
  - `@mhp/api`: AppError, AuthError — 5 tests
  - `@mhp/web`: formatPrice, formatSessionDateRange, cheapestTier, upcomingSessions, activeAssignment, invoiceLabel — 27 tests

## SEO & Server-Side Rendering

### SSR Pages (apps/api/src/ssr/)
Public-facing pages are server-side rendered for search engine crawlers. Authenticated users bypass SSR and get the SPA.

- `ssr/html-shell.ts` — HTML shell generator with consistent header/footer, Google Fonts, inline CSS, SEO meta utilities
- `ssr/directory.ts` — SSR routes for `/annuaire` (listing) and `/annuaire/:slug` (detail)
- `ssr/catalogue.ts` — SSR routes for `/catalogue` (listing) and `/catalogue/:code` (detail)

### Practitioner URL Slugs
- Human-readable slugs: `/annuaire/jean-dupont-geneve-42` (firstName-lastName-city-slugId)
- `generatePractitionerSlug()` normalizes Unicode, strips accents, creates URL-safe slugs
- `parseSlugId()` extracts the numeric slugId from the end of the slug
- 301 redirect if slug doesn't match canonical form

### Structured Data
- `LocalBusiness` JSON-LD on practitioner detail pages
- `Course` JSON-LD on program detail pages
- `BreadcrumbList` JSON-LD on all SSR pages
- `FAQPage` JSON-LD on program detail pages (auto-generated from description/objectives/target audience)

### SEO Infrastructure
- `/sitemap.xml` — dynamic sitemap with `<lastmod>` timestamps, human-readable practitioner slugs
- `/robots.txt` — blocks `/user/`, `/admin/`, `/api/` paths; references sitemap
- Canonical URLs on all SSR pages
- OG tags (title, description, image, type, locale, site_name) on all SSR pages
- Auto-generated meta descriptions unique per practitioner (name, practice, specialties, location) and program (description or templated)

### Internal Cross-Linking
- Practitioner detail pages link to their completed training programs in the catalogue
- Program detail pages link to certified practitioners who completed the program in the directory

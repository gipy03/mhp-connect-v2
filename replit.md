# mhp | connect v2

Student portal & training management platform for MHP Hypnose / OMNI Hypnose® Suisse romande.

## Architecture

pnpm monorepo with four workspace packages:

| Package | Role |
|---------|------|
| `apps/web` | React 18 + Vite frontend (port 5000) |
| `apps/api` | Express 5 backend (port 3001) |
| `packages/shared` | Drizzle ORM schema (849 lines, 21 tables), Zod validation schemas, seed script |
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
- Schema defined in `packages/shared/src/schema.ts` (21 tables)
- 6 migrations in `packages/shared/drizzle/`
- Migrations: `pnpm db:generate` then `pnpm db:migrate`
- Seed: `pnpm db:seed` (creates admin user + notification templates)
- Admin email configurable via `SEED_ADMIN_EMAIL` env var (default: admin@mhp-hypnose.com)
- Admin password configurable via `SEED_ADMIN_PASSWORD` env var
- Indexes on all FK columns, composite query indexes, CHECK constraints on enum columns
- `bexio_total` stored as `numeric(10,2)`

## Key Tables

users, user_profiles, auth_tokens, digiforma_sessions, program_overrides, program_pricing, program_feature_grants, program_enrollments, session_assignments, refund_requests, notification_templates, notifications, sync_state, accredible_credentials, certifications, activity_logs, channels, posts, comments, reactions, session (express-session store)

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

## Services

| File | Purpose |
|------|---------|
| `services/auth.ts` | register, login, password flows, token generation |
| `services/enrollment.ts` | enrollment pipeline (DigiForma + Bexio + DB), reschedule, cancel, refund |
| `services/sync.ts` | DigiForma incremental/full sync, bulk import, enrollment remapping |
| `services/bexio-sync.ts` | Bexio contact/invoice sync, keyword-based invoice matching |
| `services/notification.ts` | notification queue, background processor with retry, session reminders |
| `services/accredible.ts` | webhook handler, credential cascade (enrollment complete → directory upgrade → notification) |
| `services/directory.ts` | directory listings with SQL-level filtering and ILIKE escape |
| `services/program.ts` | catalogue assembly from DigiForma + overrides + pricing |

## Frontend Pages (24 total, all lazy-loaded)

**Member pages**: Dashboard, Trainings, Profile, Notifications, Catalogue, ProgramDetail, AgendaPage, DirectoryPage, DirectoryDetailPage, Community, Supervision, Offers

**Auth pages**: Login, Register, ForgotPassword, ResetPassword, SetPassword

**Admin pages**: AdminUsers, AdminPrograms, AdminEnrollments, AdminRefunds, AdminNotifications, AdminSync, AdminActivity

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
- `POST /api/admin/sync/bexio/invoices` — links invoices via contact→user mapping + title keyword matching
- Pagination capped at 100 pages with 100ms inter-page delay

## Production Deployment

- **Target**: VM (persistent process for background workers)
- **Build**: `pnpm build` — compiles shared → integrations → API → web
- **Run**: `node apps/api/dist/index.js` — Express serves API routes + built frontend on port 5000
- **Static serving**: In production, Express serves the Vite build output from `apps/web/dist/`
- **Background workers**: Notification processor (30s interval, retries failed up to 3× with exponential backoff), DigiForma sync (hourly, with concurrency lock), Session reminders (hourly — queues reminders for sessions starting in 6-8 days with deduplication)
- **Logging**: Pino structured JSON logging with request IDs via pino-http (all console.log migrated to Pino)
- **Environment**: `NODE_ENV=production`, `PORT=5000` set for production environment
- **Required secrets**: `DATABASE_URL`, `SESSION_SECRET` (both already configured)
- **Optional secrets**: `DIGIFORMA_API_KEY`, `BEXIO_API_TOKEN`, `ACCREDIBLE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `GOOGLE_GEOCODING_API_KEY`
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
- **Service worker**: `apps/web/public/sw.js` — app shell caching with stale-while-revalidate strategy
- **Dashboard hero photo**: Training session photo as hero banner with gradient overlay and welcome text
- **Responsive layouts**: Main content area uses `p-4 sm:p-6`, `min-w-0` on flex container, calendar grid scrollable on mobile

## Frontend Architecture

- **Error boundary**: Root-level error boundary catches render errors, displays French fallback UI with reload button
- **Code splitting**: All 24 page components lazy-loaded via `React.lazy()` with shared `SuspenseWrapper` spinner
- **Profile forms**: react-hook-form + Zod schemas for PersonalInfoSection, AddressSection, PracticeSection
- **Notifications page**: Real notification history with read/unread status, filter tabs, mark-as-read, relative timestamps

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

## SEO & Structured Data

- `/sitemap.xml` — dynamic sitemap with catalogue, directory, agenda, and per-program pages
- JSON-LD Course schema on ProgramDetail pages
- JSON-LD LocalBusiness schema on DirectoryDetail pages
- Meta & OpenGraph tags on Catalogue, ProgramDetail, and DirectoryDetail pages

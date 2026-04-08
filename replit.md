# mhp | connect v2

Student portal & training management platform for MHP Hypnose / OMNI Hypnose® Suisse romande.

## Architecture

pnpm monorepo with four workspace packages:

| Package | Role |
|---------|------|
| `apps/web` | React 18 + Vite frontend (port 5000) |
| `apps/api` | Express 5 backend (port 3001) |
| `packages/shared` | Drizzle ORM schema, Zod types, seed script |
| `packages/integrations` | DigiForma, Bexio, email, geocoding, env validation |

## Tech Stack

- **Frontend**: React 18, Vite, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui, Leaflet maps
- **Backend**: Express 5, TypeScript, Drizzle ORM, PostgreSQL, bcryptjs, express-session (connect-pg-simple)
- **Language**: French (UI and API error messages)

## Development

- Vite dev server on port 5000 proxies `/api` to Express on port 3001
- API env validation via `validateEnv()` at startup — requires `DATABASE_URL` and `SESSION_SECRET`
- Workflow: `PORT=3001 pnpm --filter '@mhp/api' dev & sleep 2 && pnpm --filter '@mhp/web' dev`

## Database

- PostgreSQL via Replit's built-in database
- Schema defined in `packages/shared/src/schema.ts` (21 tables)
- Migrations: `pnpm db:generate` then `pnpm db:migrate`
- Seed: `pnpm db:seed` (creates admin user + notification templates)
- Admin email configurable via `SEED_ADMIN_EMAIL` env var (default: admin@mhp-hypnose.com)
- Admin password configurable via `SEED_ADMIN_PASSWORD` env var

## Key Tables

users, user_profiles, auth_tokens, digiforma_sessions, program_overrides, program_pricing, program_feature_grants, program_enrollments, session_assignments, refund_requests, notification_templates, notifications, sync_state, accredible_credentials, certifications, activity_logs, channels, posts, comments, reactions, session (express-session store)

## DigiForma Sync

- Full sync imports **programs** → `program_overrides`, **sessions** → `digiforma_sessions`, **users** → links `user_profiles.digiformaId`
- Triggered via `POST /api/admin/sync/full` or `POST /api/admin/sync/incremental`
- Hourly incremental sync runs automatically as a background worker
- Returns detailed breakdown: `{ syncState, programs: {created,updated,skipped}, sessions: {...}, users: {...} }`
- **Program hierarchy**: DigiForma uses child programs (e.g. `FCAHCH0620`) under root programs (`FAAH`). `getAllProgramsWithParents()` + `buildChildToRootMap()` resolves child→root mapping for sessions and enrollments.

## DigiForma Bulk Import

- One-time import: `POST /api/admin/sync/import` creates user accounts from all DigiForma trainees
- Creates `users` (no password, member role) + `user_profiles` with full profile data (name, phone, address, birthdate, nationality, profession)
- Creates `program_enrollments` and `session_assignments` from trainee session data
- Fully idempotent: re-running creates zero duplicates; uses backfill-only logic for existing profiles
- Each trainee processed in a DB transaction for atomicity
- Email validated before import; trainees without valid emails are skipped
- 1,194 users imported with 3,651 enrollments and 3,730 session assignments
- `POST /api/admin/sync/remap-enrollments` — remaps enrollment program codes from child→root codes (3,007 remapped, 385 merged)

## Bexio Sync

- `POST /api/admin/sync/bexio` — full sync: contacts then invoices
- `POST /api/admin/sync/bexio/contacts` — matches Bexio contacts to users by email, stores `bexio_contact_id` on `user_profiles`
- `POST /api/admin/sync/bexio/invoices` — links invoices to enrollments via contact→user mapping + title keyword matching
- Service: `apps/api/src/services/bexio-sync.ts`
- Results: 1,342 contacts matched, 580 invoices linked to enrollments

## Production Deployment

- **Target**: VM (persistent process for background workers)
- **Build**: `pnpm build` — compiles shared → integrations → API → web
- **Run**: `node apps/api/dist/index.js` — Express serves API routes + built frontend on port 5000
- **Static serving**: In production, Express serves the Vite build output from `apps/web/dist/`
- **Background workers**: Notification processor (30s interval), DigiForma sync (hourly), Session reminders (hourly — queues reminders for sessions starting in 7 days)
- **Logging**: Pino structured JSON logging with request IDs via pino-http
- **Environment**: `NODE_ENV=production`, `PORT=5000` set for production environment
- **Required secrets**: `DATABASE_URL`, `SESSION_SECRET` (both already configured)
- **Optional secrets**: `DIGIFORMA_API_KEY`, `BEXIO_API_TOKEN`, `ACCREDIBLE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `GOOGLE_GEOCODING_API_KEY`

## External Integrations

- **DigiForma**: GraphQL API for training programs/sessions
- **Bexio**: REST API for contacts, invoices, credit notes
- **Accredible**: Webhook for credential issuance
- **Google Geocoding**: Address-to-coordinates for directory map
- **Gmail SMTP**: Transactional email

## SEO & Structured Data

- `/sitemap.xml` — dynamic sitemap with catalogue, directory, agenda, and per-program pages
- JSON-LD Course schema on ProgramDetail pages
- JSON-LD LocalBusiness schema on DirectoryDetail pages
- Meta & OpenGraph tags on Catalogue, ProgramDetail, and DirectoryDetail pages

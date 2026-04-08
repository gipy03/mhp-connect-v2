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
- Schema defined in `packages/shared/src/schema.ts` (20 tables)
- Migrations: `pnpm db:generate` then `pnpm db:migrate`
- Seed: `pnpm db:seed` (creates admin user + notification templates)
- Admin email configurable via `SEED_ADMIN_EMAIL` env var (default: admin@mhp-hypnose.com)
- Admin password configurable via `SEED_ADMIN_PASSWORD` env var

## Key Tables

users, user_profiles, auth_tokens, program_overrides, program_pricing, program_feature_grants, program_enrollments, session_assignments, refund_requests, notification_templates, notifications, sync_state, accredible_credentials, certifications, activity_logs, channels, posts, comments, reactions, session (express-session store)

## External Integrations

- **DigiForma**: GraphQL API for training programs/sessions
- **Bexio**: REST API for contacts, invoices, credit notes
- **Accredible**: Webhook for credential issuance
- **Google Geocoding**: Address-to-coordinates for directory map
- **Gmail SMTP**: Transactional email

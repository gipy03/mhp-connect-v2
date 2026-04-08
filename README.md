# mhp | connect v2

Student portal & training management platform for **MHP Hypnose / OMNI Hypnose® Suisse romande**.

## Overview

Complete rebuild of the MHP student portal — a central hub for hypnotherapy training: public course catalogue, student enrollment, training management, practitioner directory, and professional community. French-language UI with Apple-inspired minimalist design.

## Architecture

pnpm monorepo with four workspace packages:

```
mhp-connect-v2/
├── apps/
│   ├── web/             # React 18 + Vite frontend
│   └── api/             # Express 5 backend
├── packages/
│   ├── shared/          # Drizzle ORM schema, Zod types, seed script
│   └── integrations/    # DigiForma, Bexio, email, geocoding
├── vitest.workspace.ts  # Test configuration
├── pnpm-workspace.yaml
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20, TypeScript |
| Frontend | React 18, Vite, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui, Leaflet |
| Backend | Express 5, Drizzle ORM, Pino structured logging |
| Database | PostgreSQL (21 tables, Drizzle migrations) |
| Validation | Zod (shared client/server schemas) |
| Auth | Native email/password, bcrypt, express-session (PostgreSQL store) |
| Testing | Vitest 2.x (109 tests across 9 test files) |

## External Integrations

| Service | Protocol | Purpose |
|---------|----------|---------|
| DigiForma | GraphQL API | Training programs, sessions, trainee management |
| Bexio | REST API | Contacts, invoices, credit notes |
| Accredible | Webhook (inbound) | Credential issuance and verification |
| Google Geocoding | REST API | Address-to-coordinates for directory map |
| Gmail SMTP | SMTP | Transactional email delivery |

All integrations have 15-second timeouts and automatic retry with exponential backoff for transient errors.

## Development

```bash
# Install dependencies
pnpm install

# Start dev servers (API on :3001, web on :5000)
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Database migrations
pnpm db:generate
pnpm db:migrate

# Seed database (admin user + notification templates)
pnpm db:seed

# Production build
pnpm build
```

## Key Features

- **Public catalogue** — auto-generated from DigiForma programs with admin-controlled overrides, pricing tiers, and category grouping
- **Enrollment pipeline** — DigiForma trainee creation → session assignment → Bexio invoicing → notification, with session rescheduling and refund workflows
- **Practitioner directory** — three-tier visibility (hidden/internal/public), credential-verified badges, interactive map with geocoded addresses
- **Notification system** — customizable templates, background worker with retry logic, email + internal channels
- **Admin dashboard** — program management, user management, sync tools, notification templates, refund processing, activity logs
- **Mobile/PWA** — responsive layouts, installable PWA with service worker caching
- **SEO** — dynamic sitemap, JSON-LD structured data (Course, LocalBusiness), OpenGraph meta tags

## Security

- Rate limiting on registration and password reset endpoints
- Zod validation on all API inputs (auth, admin, enrollment, webhook)
- HMAC signature verification on Accredible webhooks
- Session regeneration on privilege transitions (login, impersonation)
- SQL-safe directory filtering with ILIKE escape
- Database CHECK constraints and foreign key indexes

## Production Deployment

- **Target**: Replit VM (persistent process for background workers)
- **Build**: `pnpm build` — compiles shared → integrations → API → web
- **Run**: `node apps/api/dist/index.js` — Express serves API + static frontend on port 5000
- **Background workers**: notification processor (30s), DigiForma sync (hourly), session reminders (hourly)

## Documentation

- **[SPEC.md](./SPEC.md)** — Full 2.0 specification document
- **[replit.md](./replit.md)** — Development reference and architecture notes

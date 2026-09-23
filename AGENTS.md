# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LaunchStack is a full-stack TypeScript monorepo (pnpm workspaces) with a NestJS backend, React frontend, and shared packages.

## Commands

### Development
```bash
pnpm dev                    # Run frontend (Vite :5173) + backend (NestJS :3000) + Temporal worker in parallel
pnpm dev:frontend           # Frontend only
pnpm dev:backend            # Backend only
pnpm dev:worker             # Temporal worker only (needs Temporal: docker compose up -d)
```

### Build
```bash
pnpm build                  # Build packages first, then apps
pnpm build:packages         # Build shared packages only
```

### Database (requires Docker postgres running)
```bash
docker compose up -d        # Start PostgreSQL (11753), Temporal (7233) + Temporal UI (8080)
pnpm db:generate <name>     # Create a new (empty) Kysely migration file
pnpm db:up                  # Apply migrations
pnpm db:down                # Rollback last migration
pnpm db:status              # Show migration status
pnpm db:fresh               # Roll back everything and re-apply (destructive)
```

### Testing (backend)
```bash
cd apps/backend
pnpm test                   # Run unit tests (Jest)
pnpm test:watch             # Watch mode
pnpm test:e2e               # E2E tests (Vitest + Testcontainers; needs Docker)
pnpm exec jest --testPathPatterns=<pattern>  # Run a single test file
```

### Linting
```bash
pnpm lint                   # Lint all workspaces
```

### Deployment
Production runs on Dokploy as two Compose apps (`temporal`, `launchstack`) built from `infra/docker/`. See `infra/dokploy/README.md` for topology and first-deploy steps, and `infra/dokploy/AGENTS.md` before editing any file there.

## Timezones

Read this before writing anything that touches a date. `main.ts` and `worker.ts` pin `process.env.TZ ??= 'UTC'` because Better Auth's naive `timestamp` columns only round-trip while every process shares one zone. Do not rely on that pin for anything else.

The model: **an instant and a calendar date are different types.** A `timestamptz` column, a JS `Date`, and an ISO string with an offset are instants. A billing period, a chart bucket, and anything a user picks in a date input are calendar dates in a specific zone. Converting between them requires naming the zone: the zone the data belongs to (an org's or a schedule's), the viewer's (for something the viewer just picked), or UTC (for a calendar date that is already resolved and only needs printing).

1. **Never build a wall clock with `new Date(y, m, d, h, …)`.** That constructor resolves in the *server's* zone, and V8 silently rewrites the fields when they land in that zone's DST gap. Resolve a zoned wall clock through a string (`` `${dateKey}T${time}` `` + an explicit zone).
2. **Do calendar arithmetic on `YYYY-MM-DD` keys, not on instants.** A local day is 23, 24 or 25 hours, so `+ 86400000` skips or repeats a day twice a year. Parse to `{y, m, d}` and step with UTC-field `Date`s used purely as containers.
3. **A `YYYY-MM-DD` key is already resolved — never convert it into a zone.** To print one, anchor `T00:00:00Z` and format with `timeZone: "UTC"`. Anchoring at noon (`T12:00:00Z`) to "be safe" is off by one for every zone at +12 or beyond.
4. **Periods and windows are half-open — `start <= t < end`.** An inclusive `23:59:59.999` end does not tile: on a 25-hour fall-back day the repeated hour belongs to neither window. Derive the exclusive end from the *next calendar date's* midnight, never by adding 24h or 1ms. A label formats `end - 1ms` to name the last day covered.
5. **Tiling is not the test — "a window is exactly the set of instants whose local date is that day" is.** Windows can tile with zero gaps and still be shifted an hour. When a wall clock does not exist, resolve to the transition instant itself (the first instant that exists at or after it); rounding up to the next whole hour overshoots in zones with 30- and 45-minute shifts. Resolve it in **one** place.
6. **Never send a zone *name* to Postgres.** Resolve the boundaries in app code and pass instants. `AT TIME ZONE` rejects legacy aliases (`Asia/Calcutta`) on a Postgres without `tzdata-legacy`, and silently inverts the sign of offset strings (`+05:30`).
7. **Validate a timezone as an IANA id, not as "something `Intl` accepts".** `Intl` accepts `'+05:30'`. Check `Intl.supportedValuesOf('timeZone')` membership.
8. **Test on a transition date under a non-UTC process zone**, or the test proves nothing. Setting `process.env.TZ` inside a spec is a no-op under Jest 30 (the sandbox never reaches V8's zone cache); set it in a custom Jest environment or run the suite with `TZ=… pnpm exec jest`. Zones worth reaching for: `America/New_York` (gap at 02:00), `America/Santiago` (gap at 00:00), `Asia/Kathmandu` (+05:45), `Pacific/Chatham` (+12:45).

## Architecture

### Monorepo Layout
- **`apps/backend`** — NestJS 11 API server (port 3000)
- **`apps/frontend`** — React 19 + Vite + Tailwind v4 + shadcn/ui (port 5173)
- **`packages/api-interfaces`** — Shared TypeScript types (User, ApiResponse, ApiError)
- **`packages/core`** — Shared utilities (formatDate, generateId, sleep, isValidEmail, isEmpty, constants)

Packages are built with tsup (CJS + ESM) and must be built before apps (`pnpm build` handles ordering).

### Backend (NestJS)

**Entry:** `apps/backend/src/main.ts` — Body parser is disabled (Better Auth handles its own parsing).

**Module graph:** `AppModule` imports `ConfigModule` (global), `KyselyModule` (global), `TemporalModule` (global), and `AppAuthModule`.

**Background jobs:** Temporal. The API starts workflows; a separate worker process (`src/worker.ts`) runs activities. See `apps/backend/AGENTS.md` → "Background jobs (Temporal)".

**Database:** Kysely with the `pg` (node-postgres) driver and `CamelCasePlugin`. The `KyselyModule` (`src/databases/kysely/kysely.module.ts`) is a global provider injected via `KYSELY_DB` token. Table types live in `src/databases/kysely/database.types.ts` — app tables in `public`, Better Auth tables (user, session, account, verification) as `auth.*`. Types are hand-written: update them alongside every migration.

Migrations live in `apps/backend/migrations/` and run via `kysely-ctl` (`kysely.config.ts`).

**Auth:** Better Auth v1.6.2 integrated via `@thallesp/nestjs-better-auth`. Auth config is in `src/auth/auth.config.ts` — creates the Better Auth instance over its own `pg` Pool (`search_path=auth`, snake_case `fields` mappings), email+password, Google OAuth (optional, via `socialProviders`), email OTP (Resend), token encryption (AES-256-GCM via `databaseHooks`), and openAPI plugin (non-prod). The `AppAuthModule` wires it up with env-based config. Auth routes are served at `/api/auth/*` by the NestJS wrapper. Auth decorators available: `@AllowAnonymous()`, `@OptionalAuth()`, `@Session()`.

**Testing:** Jest with module mocks for `@thallesp/nestjs-better-auth`, `better-auth`, `better-auth/plugins`, and `resend` (see `moduleNameMapper` in package.json).

### Frontend (React + Vite)

**Entry:** `apps/frontend/src/main.tsx` → `App.tsx`

**Path alias:** `@` maps to `src/` (configured in vite.config.ts and tsconfig).

**UI:** shadcn/ui components live in `src/components/ui/`. Config in `components.json` (Radix Nova style, neutral base color). Add components via `pnpm dlx shadcn@latest add <component>`.

### Environment Variables

Backend requires these in `apps/backend/.env`:
```
DATABASE_URL=postgresql://launchstack:launchstack@localhost:11753/launchstack
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=<resend api key>
EMAIL_FROM=onboarding@resend.dev
```

Optional (omit to disable Google sign-in):
```
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
```

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
pnpm test:e2e               # E2E tests (uses test/jest-e2e.json)
pnpm test -- --testPathPattern=<pattern>  # Run a single test file
```

### Linting
```bash
pnpm lint                   # Lint all workspaces
```

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

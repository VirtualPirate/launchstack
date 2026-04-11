# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LaunchStack is a full-stack TypeScript monorepo (pnpm workspaces) with a NestJS backend, React frontend, and shared packages.

## Commands

### Development
```bash
pnpm dev                    # Run frontend (Vite :5173) + backend (NestJS :3000) in parallel
pnpm dev:frontend           # Frontend only
pnpm dev:backend            # Backend only
```

### Build
```bash
pnpm build                  # Build packages first, then apps
pnpm build:packages         # Build shared packages only
```

### Database (requires Docker postgres running)
```bash
docker compose up -d        # Start PostgreSQL on port 11753
pnpm db:generate            # Create a new Drizzle migration
pnpm db:up                  # Apply migrations
pnpm db:down                # Rollback last migration
pnpm db:push                # Push schema directly (no migration file)
pnpm db:studio              # Open Drizzle Studio UI
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

**Module graph:** `AppModule` imports `ConfigModule` (global), `DrizzleModule` (global), and `AppAuthModule`.

**Database:** Drizzle ORM with `postgres` driver. The `DrizzleModule` (`src/databases/pg-drizzle/drizzle.module.ts`) is a global provider injected via `DRIZZLE_DB` token. Schema files:
- `src/databases/pg-drizzle/schema.ts` — App tables
- `src/databases/pg-drizzle/auth-schema.ts` — Better Auth tables (user, session, account, verification) in `auth` PostgreSQL schema

Migrations live in `apps/backend/drizzle/` and use `@drepkovsky/drizzle-migrations`. The `drizzle.config.ts` configures both drizzle-kit (for push/studio) and drizzle-migrations (for generate/up/down).

**Auth:** Better Auth v1.6.2 integrated via `@thallesp/nestjs-better-auth`. Auth config is in `src/auth/auth.config.ts` — creates the Better Auth instance with drizzle adapter, email+password, email OTP (Resend), and openAPI plugin (non-prod). The `AppAuthModule` wires it up with env-based config. Auth routes are served at `/api/auth/*` by the NestJS wrapper. Auth decorators available: `@AllowAnonymous()`, `@OptionalAuth()`, `@Session()`.

**Testing:** Jest with module mocks for `@thallesp/nestjs-better-auth`, `better-auth/plugins`, and `resend` (see `moduleNameMapper` in package.json).

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

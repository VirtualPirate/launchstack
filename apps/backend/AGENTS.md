# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Also see the root [CLAUDE.md](../../CLAUDE.md) for monorepo-wide commands and architecture.

## Commands

All commands run from `apps/backend/`:

```bash
pnpm start:dev              # Watch mode (port 3000)
pnpm start:debug            # Debug + watch mode
pnpm test                   # Unit tests (Jest)
pnpm test -- --testPathPattern=<pattern>  # Single test file
pnpm test:watch             # Watch mode
pnpm test:e2e               # E2E tests (test/jest-e2e.json)
pnpm test:cov               # Coverage report
pnpm lint                   # Lint + autofix
pnpm format                 # Prettier on src/ and test/
```

### Database (requires `docker compose up -d` from repo root)

```bash
pnpm db:generate            # Create Drizzle migration
pnpm db:up                  # Apply migrations
pnpm db:down                # Rollback last migration
pnpm db:status              # Show migration status
pnpm db:fresh               # Reset DB (destructive)
pnpm db:push                # Push schema directly (no migration file)
pnpm db:studio              # Drizzle Studio UI
```

## Architecture

### Module Graph

```
AppModule
├── ConfigModule (global)
├── DrizzleModule (global) ─── provides DRIZZLE_DB token
└── AppAuthModule
    └── BetterAuthModule.forRootAsync()
        └── injects DRIZZLE_DB + ConfigService
```

### Key Entry Points

- **`src/main.ts`** — NestJS bootstrap. Body parser disabled (`bodyParser: false`) because Better Auth handles its own request parsing.
- **`src/app.module.ts`** — Root module importing all feature modules.

### Database (Drizzle ORM)

The `DrizzleModule` (`src/databases/pg-drizzle/drizzle.module.ts`) is a **global** module. Inject the database anywhere via the `DRIZZLE_DB` token:

```typescript
constructor(@Inject(DRIZZLE_DB) private db: DrizzleDB) {}
```

Schema is split across two files:

- `src/databases/pg-drizzle/schema.ts` — Application tables
- `src/databases/pg-drizzle/auth-schema.ts` — Better Auth tables (`user`, `session`, `account`, `verification`) in the `auth` PostgreSQL schema namespace

Both are registered in `DrizzleModule` and in `drizzle.config.ts`. Migrations live in `drizzle/` and use `@drepkovsky/drizzle-migrations` (not drizzle-kit) for generate/up/down.

### Auth (Better Auth)

Auth uses [Better Auth](https://www.better-auth.com/) v1.6.2 via the `@thallesp/nestjs-better-auth` NestJS wrapper. For Better Auth documentation, use the `better-auth` MCP server: call `search_docs` to find relevant pages, then `get_doc` to read full content. Better Auth skills are also available in `.agents/skills/`.

**Config:** `src/auth/auth.config.ts` — factory function `createAuth()` that builds the Better Auth instance with:

- Drizzle adapter (PostgreSQL)
- Email + password authentication
- Email OTP plugin (6-digit codes, 5-minute expiry, auto-sends on signup via Resend)
- OpenAPI plugin (non-production only)

**Routes:** All auth endpoints are served at `/api/auth/*` by the NestJS wrapper.

**Decorators** (from `@thallesp/nestjs-better-auth`):

- `@AllowAnonymous()` — Public route, no auth required
- `@OptionalAuth()` — Auth optional, session may or may not exist
- `@Session()` — Parameter decorator to inject the current session

**Auth flow documentation:** See `docs/auth-signup-flow.md` for the sign-up + email OTP verification flow with cURL examples.

### Testing

**Unit tests** (`*.spec.ts` in `src/`): Better Auth and Resend are ESM-only packages that don't work directly with Jest (CJS). Manual mocks in `src/__mocks__/` handle this via `moduleNameMapper` in package.json:

- `src/__mocks__/@thallesp/nestjs-better-auth.ts`
- `src/__mocks__/better-auth/plugins.ts`
- `src/__mocks__/resend.ts`

When adding new ESM-only dependencies used in tests, you'll need to add corresponding mocks and `moduleNameMapper` entries.

**E2E tests** (`test/`): Use `@nestjs/testing` + `supertest`. Configured separately via `test/jest-e2e.json`.

### Response Format

All API responses use the shared `ApiResponse<T>` type from `@launchstack/api-interfaces`:

```typescript
{ data: T, message: string, success: boolean }
```

## Environment Variables

See `.env.example` for the full template. Required:

- `DATABASE_URL` — PostgreSQL connection string (default port 11753 via Docker)
- `BETTER_AUTH_SECRET` — Auth signing secret (generate with `openssl rand -base64 32`)
- `BETTER_AUTH_URL` — Backend base URL (e.g., `http://localhost:3000`)
- `FRONTEND_URL` — Frontend origin for CORS trusted origins
- `RESEND_API_KEY` — Resend email service API key
- `EMAIL_FROM` — Sender email address

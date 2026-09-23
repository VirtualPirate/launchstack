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
pnpm db:generate <name>     # Create an empty Kysely migration (migrations/YYYYMMDDHHmmss_<name>.ts)
pnpm db:up                  # Apply migrations
pnpm db:down                # Rollback last migration
pnpm db:status              # Show migration status
pnpm db:fresh               # Roll back all migrations and re-apply (destructive)
```

## Architecture

### Module Graph

```
AppModule
├── ConfigModule (global)
├── KyselyModule (global) ─── provides KYSELY_DB token
└── AppAuthModule
    └── BetterAuthModule.forRootAsync()
        └── injects KYSELY_DB + ConfigService
```

### Key Entry Points

- **`src/main.ts`** — NestJS bootstrap. Body parser disabled (`bodyParser: false`) because Better Auth handles its own request parsing.
- **`src/app.module.ts`** — Root module importing all feature modules.

### Database (Kysely)

The `KyselyModule` (`src/databases/kysely/kysely.module.ts`) is a **global** module. Inject the database anywhere via the `KYSELY_DB` token:

```typescript
constructor(@Inject(KYSELY_DB) private db: AppDatabase) {}
```

The instance runs on `pg` (node-postgres) with `CamelCasePlugin`: table and column names are camelCase in TypeScript and snake_case in SQL. Table types are hand-written in `src/databases/kysely/database.types.ts` — application tables (`organizations`, …) plus Better Auth tables as `auth.user`, `auth.session`, `auth.account`, `auth.verification`. Update them in the same change as the migration.

- **Transactions:** `this.db.transaction().execute(async (tx) => …)`. Repositories take an optional `tx?: DbExecutor` and fall back to `this.db`.
- **`updatedAt`:** Kysely has no `$onUpdate` — set `updatedAt: new Date()` explicitly in every `updateTable(...).set(...)`.

Migrations live in `migrations/` and run via `kysely-ctl` (`kysely.config.ts`). They are plain `up(db: Kysely<any>)` / `down` functions using literal snake_case identifiers — never import app code, and the CamelCasePlugin is not installed on the migration connection. File names use a `YYYYMMDDHHmmss_` prefix because Kysely applies migrations in lexical order.

### Auth (Better Auth)

Auth uses [Better Auth](https://www.better-auth.com/) v1.6.2 via the `@thallesp/nestjs-better-auth` NestJS wrapper. For Better Auth documentation, use the `better-auth` MCP server: call `search_docs` to find relevant pages, then `get_doc` to read full content. Better Auth skills are also available in `.agents/skills/`.

**Config:** `src/auth/auth.config.ts` — factory function `createAuth()` that builds the Better Auth instance with:

- Its own `pg` Pool (Better Auth's built-in Kysely adapter) with `search_path=auth`, plus per-model `fields` mappings to the snake_case columns
- Email + password authentication
- Google OAuth social provider (optional, enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set). Account linking is enabled with Google as a trusted provider, meaning Google sign-in auto-links to existing email+password accounts with the same email.
- Token encryption via `databaseHooks` — OAuth access tokens and refresh tokens are encrypted at rest using AES-256-GCM. Encryption key is derived from `BETTER_AUTH_SECRET` via scrypt. **Note:** Changing `BETTER_AUTH_SECRET` after OAuth tokens are stored will make existing encrypted tokens unreadable.
- Email OTP plugin (6-digit codes, 5-minute expiry, auto-sends on signup via Resend)
- OpenAPI plugin (non-production only)

**Crypto:** `src/auth/crypto.ts` — AES-256-GCM encrypt/decrypt utility. Key derived from `BETTER_AUTH_SECRET` via `scryptSync`. Use `decrypt()` when reading OAuth tokens from the `account` table for external API calls.

**Routes:** All auth endpoints are served at `/api/auth/*` by the NestJS wrapper.

**Decorators** (from `@thallesp/nestjs-better-auth`):

- `@AllowAnonymous()` — Public route, no auth required
- `@OptionalAuth()` — Auth optional, session may or may not exist
- `@Session()` — Parameter decorator to inject the current session

**Auth flow documentation:**
- `docs/auth-signup-flow.md` — Email + password sign-up with OTP verification (cURL examples)
- `docs/google-oauth-flow.md` — Google OAuth sign-in/sign-up, account linking, token encryption, frontend integration

### Background jobs (pg-boss)

Background jobs run on [pg-boss](https://github.com/timgit/pg-boss) v12 via a thin in-house NestJS integration in `src/queue/`.

**Module graph:** `PgBossModule.forRoot()` is global; it constructs and starts a single `PGBoss` instance and (when `WORKER_ROLE` is `worker` or `both`) discovers `@Handler(JobDef)` methods via `DiscoveryService` and registers them through `boss.work()`. `QueueModule` registers job-specific handlers and the smoke-test controller.

**Producer API (`PgBossService`):** Inject anywhere and call `send(JobDef, data)`, `sendAfter(JobDef, data, delaySeconds)`, or `sendOnce(JobDef, data, key)`. Payloads are validated with `JobDef.schema.parse()` before the INSERT. Use `getJob(id)` to inspect status; `raw()` returns the underlying PGBoss instance as an escape hatch.

**Defining a job:**

```ts
// queue/jobs/send-welcome-email.job.ts
import { z } from 'zod';
import { defineJob } from '../define-job';

export const SendWelcomeEmailJob = defineJob({
  name: 'send-welcome-email',
  schema: z.object({ userId: z.string() }),
  workOptions: { localConcurrency: 5 },
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
});
```

Add a handler class with `@Handler(JobDef)` and register it in a feature module's `providers`. The handler is auto-discovered on boot.

**Run modes (`WORKER_ROLE`):**

| Value | Boots `boss.start()` | Producers (`send`) | Handlers (`work`) |
| --- | --- | --- | --- |
| `api` | yes | yes | no |
| `worker` | yes | yes | yes |
| `both` (default, dev) | yes | yes | yes |

In production, run API replicas with `WORKER_ROLE=api` and worker replicas with `WORKER_ROLE=worker`. Worker capacity scales with replica count x per-job `localConcurrency` (and/or `groupConcurrency` where used).

**Smoke test:**

```bash
curl -X POST http://localhost:3000/api/_internal/queue/noop \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  -d '{"message":"hello"}'
```

Watch the backend logs for `[noop <jobId>] received: hello`.

**Operational risks:**

- **First-run permissions.** pg-boss creates and migrates its own `pgboss` schema on `boss.start()`. The `DATABASE_URL` user must have `CREATE` on the database the first time the app starts. Local Docker Postgres satisfies this; locked-down production users may need a one-time admin run of `boss.start()` or manual schema bootstrap.
- **DB connection growth.** pg-boss, the app's Kysely instance, and Better Auth each own a separate `pg` pool (default max 10 each). Total connections per worker replica ~= `kysely_pool + better_auth_pool + PG_BOSS_POOL_MAX`. Cap with `PG_BOSS_POOL_MAX` (default 10) and check Postgres `max_connections` headroom before scaling worker replicas.
- **Schema is owned by pg-boss.** Never reference the `pgboss` schema in `migrations/`.

**Dashboard (local dev):**

A web UI for inspecting queues and jobs. Local-dev only — binds to 127.0.0.1, no auth.

In a separate terminal:

```bash
pnpm dev:dashboard
```

Open http://localhost:3210. Reads from the same `DATABASE_URL` / `pgboss` schema as the backend (`PGBOSS_SCHEMA` in `.env`, mirroring `PG_BOSS_SCHEMA`). Port `3210` is hard-coded in the `dev:dashboard` script; edit the script to change it. Warning history populates because the queue config sets `persistWarnings: true`.

**Production deployment** is intentionally not wired up. When the time comes, the dashboard ships as a standalone process (Node or Docker) fronted by a reverse proxy with auth (`PGBOSS_DASHBOARD_AUTH_USERNAME` / `PGBOSS_DASHBOARD_AUTH_PASSWORD`). See https://github.com/timgit/pg-boss/blob/master/packages/dashboard/README.md.

### Testing

**Unit tests** (`*.spec.ts` in `src/`): Better Auth and Resend are ESM-only packages that don't work directly with Jest (CJS). Manual mocks in `src/__mocks__/` handle this via `moduleNameMapper` in package.json:

- `src/__mocks__/@thallesp/nestjs-better-auth.ts`
- `src/__mocks__/better-auth.ts`
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
- `BETTER_AUTH_SECRET` — Auth signing secret (generate with `openssl rand -base64 32`). Also used to derive the token encryption key.
- `BETTER_AUTH_URL` — Backend base URL (e.g., `http://localhost:3000`)
- `FRONTEND_URL` — Frontend origin for CORS trusted origins
- `RESEND_API_KEY` — Resend email service API key
- `EMAIL_FROM` — Sender email address

Optional:

- `GOOGLE_CLIENT_ID` — Google OAuth client ID (omit to disable Google sign-in)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (omit to disable Google sign-in)

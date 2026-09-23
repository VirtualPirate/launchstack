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
pnpm test:e2e               # E2E tests (Vitest; needs Docker — see test/e2e/README.md)
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
├── TemporalModule (global) ─── provides TemporalProducerService, TEMPORAL_CLIENT
└── AppAuthModule
    └── BetterAuthModule.forRootAsync()
        └── injects KYSELY_DB + ConfigService
```

### Key Entry Points

- **`src/main.ts`** — NestJS bootstrap. Body parser disabled (`bodyParser: false`) because Better Auth handles its own request parsing.
- **`src/worker.ts`** — Temporal worker process. Boots the same `AppModule` without HTTP and runs `@Activity` methods (see "Background jobs (Temporal)").
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

### Background jobs (Temporal)

Background jobs run on [Temporal](https://temporal.io/) via a thin in-house bridge in `src/temporal/`. `src/queue/` holds only the `noop` smoke-test activity and controller.

**Topology.** `docker compose up -d` (repo root) starts a Temporal server (`temporalio/auto-setup`) on `localhost:7233` next to the app's Postgres, plus the Temporal Web UI on **http://localhost:8080** (override with `TEMPORAL_UI_PORT`). The server creates its own `temporal` and `temporal_visibility` databases on the same Postgres instance on first boot; only the Temporal server talks to them.

**Two processes.**

- **API** (`src/main.ts`) — Temporal client only. Starts workflows, runs no activities.
- **Worker** (`src/worker.ts`) — boots `AppModule` with `NestFactory.createApplicationContext()` (DI, no HTTP), collects every `@Activity` method, and polls the task queue. Activities run here, against the app DB.

Run the worker with `pnpm start:worker:dev` (or `pnpm dev:worker` from the repo root; `pnpm dev` runs it too). Production: `pnpm start:worker` (`node dist/worker.js`) or the root `pnpm start:prod:worker`. If the worker is not running, workflows start but never execute.

`tsconfig.build.json` pins `rootDir` to `./src`, so `nest build` emits a flat `dist/` (`dist/main.js`, `dist/worker.js`). The worker bundles `dist/temporal/workflows` at boot.

**Producer API (`TemporalProducerService`).** Inject anywhere:

- `start(workflowType, opts)` — starts a new execution. Generates `${type}:<uuid>` unless `opts.workflowId` is set. Resolves to the `workflowId` (the `{ jobId }` async endpoints return).
- `startDeduped(workflowType, opts)` — requires `opts.workflowId`; sets `workflowIdConflictPolicy: 'USE_EXISTING'`, so a second start with a live id returns the existing run.
- `opts` also takes `args`, `searchAttributes`, and `startDelay` (e.g. `'30s'`).

Inject `TEMPORAL_CLIENT` for anything else (signals, queries, schedules).

**Adding a job** — three pieces:

1. **Activity** — a method on a provider, tagged `@Activity('feature.action')`, registered in a feature module's `providers`. Business logic goes here (DB, network, Nest DI).

   ```ts
   @Injectable()
   export class WelcomeEmailActivities {
     @Activity('email.sendWelcome')
     async sendWelcome(input: { userId: string }): Promise<void> {
       // runs in the worker process
     }
   }
   ```

2. **Signature** — add the method to `Activities` in `src/temporal/activities.interface.ts`.

3. **Workflow** — a plain async function in `src/temporal/workflows/<name>.workflow.ts`, exported from `workflows/index.ts`, with its type name added to `WORKFLOW` in `src/temporal/workflow-types.ts`. Call activities through a retry profile from `workflows/activity-proxies.ts` (add a profile there when none fits).

   ```ts
   export async function SendWelcomeEmailWorkflow(userId: string): Promise<void> {
     await once['email.sendWelcome']({ userId });
   }
   ```

Then start it: `await temporal.start(WORKFLOW.sendWelcomeEmail, { args: [userId] })`.

**Workflow code is sandboxed.** Files under `src/temporal/workflows/` must be deterministic: no NestJS, no DB, no network, no `Date.now()`/`Math.random()` outside what the SDK patches. Import only `@temporalio/workflow` and type-only imports. Use `sleep()`, `startChild()`, `continueAsNew()` from `@temporalio/workflow` for timers and fan-out.

**Retry mapping** (from the old pg-boss job options):

| pg-boss | Temporal |
| --- | --- |
| `retryLimit N` | `retry.maximumAttempts = N + 1` |
| `retryDelay` | `retry.initialInterval` |
| `retryBackoff: true` | `retry.backoffCoefficient: 2` |
| `expireInSeconds` | `startToCloseTimeout` |
| `sendOnce(key)` | `startDeduped(type, { workflowId: key })` |
| `sendAfter(delay)` | `start(type, { startDelay })` |
| `localConcurrency` | `TEMPORAL_MAX_CONCURRENT_ACTIVITIES` (per worker process) |

**Config** (all optional):

| Var | Default |
| --- | --- |
| `TEMPORAL_ADDRESS` | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | `default` |
| `TEMPORAL_TASK_QUEUE` | `launchstack` |
| `TEMPORAL_MAX_CONCURRENT_ACTIVITIES` | `20` |
| `TEMPORAL_MAX_CONCURRENT_WORKFLOW_TASKS` | `20` |

Concurrency caps are per worker process: the effective ceiling is replicas × these values. A single task queue serves every workflow; move an activity type to its own queue and worker only when it needs a hard cap of its own.

**Smoke test:**

```bash
curl -X POST http://localhost:3000/api/_internal/queue/noop \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  -d '{"message":"hello"}'
```

Returns `{ data: { jobId: "NoopWorkflow:..." }, message: "enqueued", success: true }`. The worker logs `[noop] received: hello`, and the run shows as Completed in the Temporal UI.

**Operational notes:**

- **API boot needs Temporal.** `TemporalModule` connects eagerly, so the API fails to boot when the server at `TEMPORAL_ADDRESS` is unreachable. (The e2e suite starts its own Temporal dev server.)
- **Legacy cleanup.** The `pgboss` Postgres schema from the old queue is orphaned. Drop it manually (`DROP SCHEMA pgboss CASCADE;`) once no in-flight jobs matter.

### Testing

**Unit tests** (`*.spec.ts` in `src/`): Better Auth and Resend are ESM-only packages that don't work directly with Jest (CJS). Manual mocks in `src/__mocks__/` handle this via `moduleNameMapper` in package.json:

- `src/__mocks__/@thallesp/nestjs-better-auth.ts`
- `src/__mocks__/better-auth.ts`
- `src/__mocks__/better-auth/plugins.ts`
- `src/__mocks__/resend.ts`

When adding new ESM-only dependencies used in tests, you'll need to add corresponding mocks and `moduleNameMapper` entries.

**E2E tests** (`test/e2e/`): Vitest (`vitest.e2e.config.ts`, swc for decorator metadata) against a Testcontainers Postgres cloned from a migrated template per file, a Temporal CLI dev server, and the real Better Auth — only `resend` is mocked. Specs boot `AppModule` through `test/e2e/harness/create-test-app.ts`, which applies the same `configureApp()` (`src/bootstrap/configure-app.ts`) as `main.ts`. `queue.e2e.spec.ts` runs a real Temporal worker end to end. Env comes from `.env.test`. Docker must be running. Full harness notes: `test/e2e/README.md`.

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
- `TEMPORAL_*` — Temporal connection and worker caps; defaults work with the Docker setup (see "Background jobs (Temporal)")

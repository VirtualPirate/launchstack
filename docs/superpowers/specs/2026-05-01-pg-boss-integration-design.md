# pg-boss Integration — Design

**Date:** 2026-05-01
**Status:** Approved (brainstorming)
**Scope:** `apps/backend`

## 1. Summary

Add a Postgres-backed background job queue to the NestJS backend using
[pg-boss](https://github.com/timgit/pg-boss) v12. We write our own thin NestJS
integration (module, decorators, service) instead of using `@apricote/nest-pg-boss`
(archived) or `@loctax/nest-pg-boss` (maintained but pinned to pg-boss v9). This
gives us the latest pg-boss with a small, owned wrapper layer (~200 LoC).

The same image runs as either `api`, `worker`, or `both` based on a `WORKER_ROLE`
env var, so worker capacity scales horizontally with replica count, independent
of API capacity.

This PR is infrastructure only: module + decorators + producer service +
deployment role flag + one trivial smoke-test job. No production code is
migrated onto the queue.

## 2. Goals & non-goals

### Goals

- Type-safe job definitions with zod-validated payloads.
- Producer API that works in any role: `pgBoss.send(JobDef, data)`.
- Handler API that auto-registers via discovery: `@Handler(JobDef)`.
- Run-mode flag (`WORKER_ROLE`) so API replicas never execute jobs and worker
  replicas can be scaled independently.
- Per-queue concurrency knobs (`teamSize`, `teamConcurrency`) on the job def.
- Graceful shutdown — in-flight jobs finish before the process exits.
- One smoke-test job + permanent internal endpoint to verify wiring in any env.

### Non-goals (explicit)

- Scheduled / cron jobs (`boss.schedule()`). Easy to add later via a `schedule`
  field on `defineJob`.
- Queue policies beyond pg-boss default `standard` (singleton, stately).
- Per-queue runtime overrides via env (e.g.
  `PG_BOSS_OVERRIDE_<QUEUE>_TEAM_CONCURRENCY`).
- Migrating any real production concern (OTP/welcome email, etc.) onto pg-boss.
- Dashboard / pg-boss-ui.
- E2E test against a real Postgres in CI.

## 3. Library & version pins

- `pg-boss@^12` — latest. Multi-master safe (multiple workers against one DB
  via `SKIP LOCKED`). Auto-creates and migrates its own `pgboss` schema.
- `pg@^8` — peer dep of pg-boss (it uses `node-postgres`, not `postgres-js`).
- Bump root `package.json` `engines.node` from `>=18.0.0` to `>=22.12.0`
  (pg-boss 12 requirement).

## 4. Architecture

### 4.1 Module structure

`PgBossModule` is a global module living in `apps/backend/src/queue/`.

```ts
// app.module.ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  DrizzleModule,
  PgBossModule.forRoot(),       // global; provides PgBossService
  AppAuthModule,
  OrganizationsModule,
  QueueModule,                  // feature module: NoopJob handler + controller
];
```

- `PgBossModule.forRoot()` — global. Constructs and starts a single `PGBoss`
  instance, exports `PgBossService`.
- `PgBossModule.forJobs([jobDef, ...])` — feature-local. Registers job
  definitions for type-safe access and triggers handler discovery within that
  module.

### 4.2 Lifecycle

`onModuleInit`:
1. Read config: `DATABASE_URL`, `WORKER_ROLE`, `PG_BOSS_SCHEMA`, `PG_BOSS_POOL_MAX`,
   `PG_BOSS_APPLICATION_NAME`.
2. Construct `new PGBoss({ connectionString, schema, max, application_name })`.
3. Wire `boss.on('error', ...)` to NestJS Logger.
4. `await boss.start()` — boss's own schema is created/migrated here.
5. If `WORKER_ROLE` is `worker` or `both`, walk all providers via
   `DiscoveryService` + `MetadataScanner`, find `@Handler(JobDef)` methods, and
   call `boss.work(jobDef.name, jobDef.workOptions, wrappedHandler)` once per
   handler.

`onApplicationShutdown` (hooked by `app.enableShutdownHooks()` in `main.ts`):
- `await boss.stop({ graceful: true, wait: true })` — stops accepting new
  jobs, waits for in-flight handlers to finish.

### 4.3 Run-mode (`WORKER_ROLE`)

| Value          | `boss.start()` | producers (`send`) | handlers (`work`) |
| -------------- | -------------- | ------------------ | ----------------- |
| `api`          | yes            | yes                | **no**            |
| `worker`       | yes            | yes                | yes               |
| `both` (dev)   | yes            | yes                | yes               |

Boss starts in all roles because producers need it. Only handler registration
is gated. `api` replicas can never accidentally execute a job because they
never call `boss.work()`.

`both` is the default, used in local dev. Production deploys API and worker
replicas with explicit `api` / `worker` flags.

### 4.4 Connection separation

pg-boss requires `node-postgres` (`pg`); the existing `DrizzleModule` uses
`postgres-js`. They cannot share a pool — different driver protocols. They use
the same `DATABASE_URL` and run two independent connection pools against the
same database. This is intentional and documented in the module comment.

DB connection count therefore grows as
`(api_replicas × drizzle_pool) + (worker_replicas × (drizzle_pool + pg_boss_pool))`.
`PG_BOSS_POOL_MAX` (default 10) lets ops cap the boss pool per replica.

## 5. Public API

All from `apps/backend/src/queue` (re-exported via barrel).

### 5.1 `defineJob`

```ts
// queue/define-job.ts
export interface JobDefinition<TSchema extends z.ZodTypeAny> {
  name: string;
  schema: TSchema;
  workOptions?: WorkOptions;       // pg-boss WorkOptions: teamSize, teamConcurrency, ...
  retryLimit?: number;
  retryDelay?: number;             // seconds
  retryBackoff?: boolean;
  expireInSeconds?: number;
  __payload?: z.infer<TSchema>;    // phantom for inference
}

export const defineJob = <T extends z.ZodTypeAny>(
  cfg: Omit<JobDefinition<T>, '__payload'>,
): JobDefinition<T> => cfg;

export interface JobContext<J extends JobDefinition<z.ZodTypeAny>> {
  id: string;
  data: z.infer<J['schema']>;
  attempts: number;                // 1-indexed attempt counter (1 on first try)
  raw: PGBoss.Job<z.infer<J['schema']>>;
}
```

### 5.2 `@Handler(JobDef)`

Method decorator. Stamps metadata that `PgBossModule.onModuleInit` reads via
`DiscoveryService` + `MetadataScanner`. The decorated method receives a
`JobContext<TJob>`.

```ts
@Injectable()
export class NoopHandler {
  private readonly logger = new Logger(NoopHandler.name);

  @Handler(NoopJob)
  async handle({ data }: JobContext<typeof NoopJob>) {
    this.logger.log(`[noop] received: ${data.message}`);
  }
}
```

The wrapper around the user method:
1. Validates payload via `jobDef.schema.safeParse(job.data)`. On `ZodError`,
   log a structured error including `jobDef.name`, `job.id`, and the issues
   list, then return successfully without invoking the user method. This
   short-circuits the retry policy for permanently-bad payloads — they would
   fail every attempt anyway. The job ends in pg-boss's `completed` state with
   a logged validation error; ops can find it in logs.
2. On valid payload, build `JobContext` and invoke the user method.
3. Let exceptions from the user method bubble to pg-boss, which retries per
   the job def's retry policy.

The producer-side `schema.parse` in `PgBossService.send()` is the primary
gate; the handler-side `safeParse` is defense-in-depth for cases where the
producer was bypassed (e.g., a job written before a schema change).

### 5.3 `PgBossService`

```ts
@Injectable()
export class PgBossService {
  send<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    opts?: SendOptions,
  ): Promise<string>;

  sendAfter<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    delaySeconds: number,
    opts?: SendOptions,
  ): Promise<string>;

  sendOnce<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    singletonKey: string,
    opts?: SendOptions,
  ): Promise<string | null>;       // null if duplicate

  getJob(id: string): Promise<PGBoss.JobWithMetadata | null>;

  raw(): PGBoss;                   // escape hatch
}
```

`send()` and friends call `jobDef.schema.parse(data)` *before* the INSERT, so
malformed payloads never reach the queue.

### 5.4 No producer-side decorators

Unlike `nest-pg-boss`'s `@Job.Inject()`, producers inject `PgBossService` once
and pass the job def at the call site:

```ts
constructor(private readonly pgBoss: PgBossService) {}

await this.pgBoss.send(SendWelcomeEmailJob, { userId });
```

One service, one decorator (`@Handler`), full type inference end-to-end.

## 6. Concurrency model

Per-process throughput per queue ≈ `teamConcurrency`. Cluster-wide ≈
`teamConcurrency × N(worker replicas)`.

Scaling playbook:

1. Bump `teamConcurrency` on the job def — cheap, in-process.
2. Add more `WORKER_ROLE=worker` replicas — adds CPU and isolates failure
   domains. Each replica gets its own boss pool.

`batchSize` (alternative to team-mode) is **not** exposed in `defineJob` for
v1. Add it when a real job needs it (yagni).

## 7. Configuration

### 7.1 Env vars

Added to `apps/backend/.env.example`:

```
WORKER_ROLE=both                      # api | worker | both (default: both)
PG_BOSS_SCHEMA=pgboss                 # postgres schema name (default: pgboss)
PG_BOSS_POOL_MAX=10                   # node-pg pool max for boss
PG_BOSS_APPLICATION_NAME=launchstack-boss
INTERNAL_API_TOKEN=<openssl rand -hex 32>   # required for the smoke-test endpoint
```

`DATABASE_URL` is reused — no separate connection string.

### 7.2 Postgres schema

pg-boss creates and migrates its `pgboss` schema on `boss.start()`. Idempotent
across restarts. Versioned by pg-boss itself; on internal schema bumps, it
migrates on the next start. **Nothing in `drizzle/` migrations references it.**

First-run requires the `DATABASE_URL` user to have `CREATE` on the database
(to create the schema) and DDL on the schema. After that, no elevated
permissions are needed.

## 8. Smoke-test job

A trivial `noop` job that exercises the wiring end-to-end.

### 8.1 Job

```ts
// queue/jobs/noop.job.ts
import { z } from 'zod';
import { defineJob } from '../define-job';

export const NoopJob = defineJob({
  name: 'noop',
  schema: z.object({ message: z.string() }),
  retryLimit: 0,
});
```

### 8.2 Handler

```ts
// queue/noop.handler.ts
@Injectable()
export class NoopHandler {
  private readonly logger = new Logger(NoopHandler.name);

  @Handler(NoopJob)
  async handle({ data, id }: JobContext<typeof NoopJob>) {
    this.logger.log(`[noop ${id}] received: ${data.message}`);
  }
}
```

### 8.3 Internal trigger endpoint

`POST /api/_internal/queue/noop` — guarded by `X-Internal-Token` header
matched against `INTERNAL_API_TOKEN`. Body: `{ message: string }`. Returns
`{ jobId: string }`. Stays in the codebase as a permanent ops sanity-check.

```ts
@Controller('_internal/queue')
@AllowAnonymous()
export class NoopController {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly config: ConfigService,
  ) {}

  @Post('noop')
  async trigger(
    @Headers('x-internal-token') token: string,
    @Body() body: { message: string },
  ) {
    if (token !== this.config.getOrThrow<string>('INTERNAL_API_TOKEN')) {
      throw new UnauthorizedException();
    }
    const jobId = await this.pgBoss.send(NoopJob, { message: body.message });
    return { data: { jobId }, message: 'enqueued', success: true };
  }
}
```

## 9. File layout

```
apps/backend/src/queue/
  index.ts                          # barrel
  pg-boss.module.ts                 # forRoot() + forJobs(); discovery; lifecycle
  pg-boss.service.ts                # PgBossService
  pg-boss.config.ts                 # env -> PGBoss constructor opts
  define-job.ts                     # defineJob, JobDefinition, JobContext
  handler.decorator.ts              # @Handler, metadata key
  pg-boss.tokens.ts                 # PG_BOSS_INSTANCE token
  jobs/
    noop.job.ts
  noop.handler.ts
  noop.controller.ts
  queue.module.ts                   # PgBossModule.forJobs([NoopJob]) + handler/controller
  pg-boss.module.spec.ts
  define-job.spec.ts

apps/backend/src/app.module.ts      # +PgBossModule.forRoot(), +QueueModule
apps/backend/.env.example           # +WORKER_ROLE, +PG_BOSS_*, +INTERNAL_API_TOKEN
apps/backend/package.json           # +pg-boss@^12, +pg@^8
package.json                        # engines.node ">=22.12.0"
```

## 10. Tests

Unit tests only. Both mock `PGBoss`.

1. **`pg-boss.module.spec.ts`**
   - `WORKER_ROLE=worker` (or `both`): every `@Handler`-decorated method
     produces exactly one `boss.work(name, opts, fn)` call with the correct
     name and `WorkOptions`.
   - `WORKER_ROLE=api`: `boss.work` is never called. `boss.start` is still
     called and `PgBossService.send` still works.
   - `onApplicationShutdown` calls `boss.stop({ graceful: true, wait: true })`.

2. **`define-job.spec.ts`** (covers `PgBossService`)
   - `send(job, validData)` calls `boss.send(job.name, parsedData, opts)`.
   - `send(job, invalidData)` throws `ZodError` and never calls `boss.send`.
   - `sendAfter` passes `startAfter: <delay>` to pg-boss.
   - The handler wrapper validates `job.data` against the job's schema before
     invoking the user method. On valid data, the user method runs with the
     parsed payload. On `ZodError`, the wrapper logs the error and returns
     without invoking the user method (no throw, no retry storm).

No e2e test. The internal endpoint is the manual integration check against a
real Postgres.

## 11. Open risks

- **First-run permissions.** Auto-schema-creation requires the
  `DATABASE_URL` user to have `CREATE` on the database. The local docker setup
  satisfies this; production environments that lock down the app user will
  need a one-time admin run of `boss.start()` or manual schema bootstrap.
  Document this in `apps/backend/AGENTS.md` as part of the implementation.
- **Engines bump** to Node `>=22.12.0` may affect contributors on older Node
  versions. Acceptable — the project already runs on 22.21.1 locally.
- **DB connection growth** with worker replicas — call out in
  `apps/backend/AGENTS.md` so anyone scaling out checks Postgres
  `max_connections` headroom.

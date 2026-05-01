# pg-boss Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Postgres-backed background job queue to the NestJS backend with a thin (~200 LoC) custom integration over `pg-boss@12`, run-mode flag for horizontal worker scaling, type-safe job definitions, and a smoke-test job/endpoint.

**Architecture:** A global `PgBossModule.forRoot()` constructs a single `PGBoss` instance, starts it in `onModuleInit`, and (when `WORKER_ROLE` is `worker` or `both`) walks all providers via `DiscoveryService` to register `@Handler(JobDef)` methods through `boss.work()`. A `PgBossService` provides the producer API. Validation is enforced producer-side via `schema.parse()` and re-validated handler-side via `safeParse()` (logged-and-skipped on failure to avoid retry storms).

**Tech Stack:** NestJS 11, pg-boss 12 (uses `node-postgres`), zod 4, TypeScript 5.9, Jest 30. Same `DATABASE_URL` as Drizzle but a separate connection pool (different drivers).

**Spec:** `docs/superpowers/specs/2026-05-01-pg-boss-integration-design.md`

---

## File Structure

**Create:**

```
apps/backend/src/queue/
  index.ts                       # barrel
  pg-boss.tokens.ts              # PG_BOSS_INSTANCE token, HANDLER_METADATA_KEY
  define-job.ts                  # defineJob, JobDefinition, JobContext
  handler.decorator.ts           # @Handler decorator
  pg-boss.config.ts              # env -> PGBoss constructor options
  pg-boss.service.ts             # PgBossService (producer API)
  pg-boss.module.ts              # forRoot() + discovery + lifecycle
  define-job.spec.ts             # PgBossService unit tests + wrapper validation
  pg-boss.module.spec.ts         # module init / role gating / shutdown
  jobs/
    noop.job.ts                  # NoopJob definition (smoke test)
  noop.handler.ts                # NoopHandler with @Handler
  noop.controller.ts             # POST /api/_internal/queue/noop
  queue.module.ts                # registers NoopHandler + NoopController
```

**Modify:**

```
apps/backend/package.json        # +pg-boss@^12, +pg@^8, +@types/pg
apps/backend/.env.example        # +WORKER_ROLE, +PG_BOSS_*, +INTERNAL_API_TOKEN
apps/backend/src/app.module.ts   # +PgBossModule.forRoot(), +QueueModule
apps/backend/AGENTS.md           # +ops notes for pg-boss
package.json                     # engines.node ">=22.12.0"
```

---

## Task 1: Install dependencies and bump Node engines

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Bump root `engines.node`**

Edit `package.json` (root) — change:

```json
  "engines": {
    "node": ">=18.0.0"
  }
```

to:

```json
  "engines": {
    "node": ">=22.12.0"
  }
```

- [ ] **Step 2: Verify local Node satisfies the new constraint**

Run: `node --version`
Expected: `v22.12.0` or newer (project already runs on 22.21.1).

- [ ] **Step 3: Install pg-boss + pg + types**

Run from repo root:

```bash
pnpm --filter backend add pg-boss@^12 pg@^8
pnpm --filter backend add -D @types/pg
```

Expected: dependencies appear in `apps/backend/package.json` under `dependencies` (`pg-boss`, `pg`) and `devDependencies` (`@types/pg`).

- [ ] **Step 4: Verify the install resolves**

Run: `pnpm install --frozen-lockfile=false`
Expected: no errors. `pg-boss` resolves to a `12.x` version.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(backend): add pg-boss@12 and pg@8, bump engines.node to >=22.12.0"
```

---

## Task 2: Tokens and core types (no test — pure declarations)

**Files:**
- Create: `apps/backend/src/queue/pg-boss.tokens.ts`
- Create: `apps/backend/src/queue/define-job.ts`

- [ ] **Step 1: Write tokens file**

Create `apps/backend/src/queue/pg-boss.tokens.ts`:

```ts
export const PG_BOSS_INSTANCE = Symbol('PG_BOSS_INSTANCE');
export const HANDLER_METADATA_KEY = 'pgboss:handler:jobdef';
```

- [ ] **Step 2: Write `define-job.ts`**

Create `apps/backend/src/queue/define-job.ts`:

```ts
import type PGBoss from 'pg-boss';
import type { z } from 'zod';

export interface JobDefinition<TSchema extends z.ZodTypeAny> {
  name: string;
  schema: TSchema;
  workOptions?: PGBoss.WorkOptions;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  __payload?: z.infer<TSchema>;
}

export const defineJob = <T extends z.ZodTypeAny>(
  cfg: Omit<JobDefinition<T>, '__payload'>,
): JobDefinition<T> => cfg;

export interface JobContext<J extends JobDefinition<z.ZodTypeAny>> {
  id: string;
  data: z.infer<J['schema']>;
  attempts: number;
  raw: PGBoss.Job<z.infer<J['schema']>>;
}
```

- [ ] **Step 3: Typecheck**

Run from repo root:

```bash
pnpm --filter backend exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/queue/pg-boss.tokens.ts apps/backend/src/queue/define-job.ts
git commit -m "feat(queue): add PG_BOSS_INSTANCE token and defineJob types"
```

---

## Task 3: `@Handler` decorator (TDD)

**Files:**
- Create: `apps/backend/src/queue/handler.decorator.ts`
- Create: `apps/backend/src/queue/handler.decorator.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/queue/handler.decorator.spec.ts`:

```ts
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import { defineJob } from './define-job';
import { Handler } from './handler.decorator';
import { HANDLER_METADATA_KEY } from './pg-boss.tokens';

const TestJob = defineJob({
  name: 'test-job',
  schema: z.object({ x: z.string() }),
});

class TestHandler {
  @Handler(TestJob)
  doWork() {}
  noDecorator() {}
}

describe('@Handler decorator', () => {
  const reflector = new Reflector();

  it('stamps the JobDefinition on the decorated method', () => {
    const instance = new TestHandler();
    const meta = reflector.get(HANDLER_METADATA_KEY, instance.doWork);
    expect(meta).toBe(TestJob);
  });

  it('leaves undecorated methods untouched', () => {
    const instance = new TestHandler();
    const meta = reflector.get(HANDLER_METADATA_KEY, instance.noDecorator);
    expect(meta).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter backend test -- --testPathPattern=handler.decorator`
Expected: FAIL — module `./handler.decorator` not found.

- [ ] **Step 3: Implement the decorator**

Create `apps/backend/src/queue/handler.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { z } from 'zod';
import type { JobDefinition } from './define-job';
import { HANDLER_METADATA_KEY } from './pg-boss.tokens';

export const Handler = <T extends z.ZodTypeAny>(
  jobDef: JobDefinition<T>,
): MethodDecorator => SetMetadata(HANDLER_METADATA_KEY, jobDef);
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter backend test -- --testPathPattern=handler.decorator`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/queue/handler.decorator.ts apps/backend/src/queue/handler.decorator.spec.ts
git commit -m "feat(queue): add @Handler decorator for job handler discovery"
```

---

## Task 4: pg-boss config builder (TDD)

**Files:**
- Create: `apps/backend/src/queue/pg-boss.config.ts`
- Create: `apps/backend/src/queue/pg-boss.config.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/queue/pg-boss.config.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { buildBossOptions } from './pg-boss.config';

const cs = (env: Record<string, string | undefined>): ConfigService =>
  new ConfigService(env);

describe('buildBossOptions', () => {
  it('reads connection string and applies defaults', () => {
    const opts = buildBossOptions(
      cs({ DATABASE_URL: 'postgres://u:p@h:5432/db' }),
    );
    expect(opts.connectionString).toBe('postgres://u:p@h:5432/db');
    expect(opts.schema).toBe('pgboss');
    expect(opts.max).toBe(10);
    expect(opts.application_name).toBe('launchstack-boss');
  });

  it('overrides defaults from env', () => {
    const opts = buildBossOptions(
      cs({
        DATABASE_URL: 'postgres://x',
        PG_BOSS_SCHEMA: 'jobs',
        PG_BOSS_POOL_MAX: '25',
        PG_BOSS_APPLICATION_NAME: 'custom-app',
      }),
    );
    expect(opts.schema).toBe('jobs');
    expect(opts.max).toBe(25);
    expect(opts.application_name).toBe('custom-app');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => buildBossOptions(cs({}))).toThrow(/DATABASE_URL/);
  });

  it('throws when PG_BOSS_POOL_MAX is not a positive integer', () => {
    expect(() =>
      buildBossOptions(
        cs({ DATABASE_URL: 'postgres://x', PG_BOSS_POOL_MAX: 'banana' }),
      ),
    ).toThrow(/PG_BOSS_POOL_MAX/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter backend test -- --testPathPattern=pg-boss.config`
Expected: FAIL — module `./pg-boss.config` not found.

- [ ] **Step 3: Implement the config builder**

Create `apps/backend/src/queue/pg-boss.config.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import type PGBoss from 'pg-boss';

export type BossConstructorOptions = NonNullable<
  ConstructorParameters<typeof PGBoss>[0]
> &
  Record<string, unknown>;

export function buildBossOptions(
  config: ConfigService,
): BossConstructorOptions {
  const connectionString = config.getOrThrow<string>('DATABASE_URL');
  const schema = config.get<string>('PG_BOSS_SCHEMA') ?? 'pgboss';
  const application_name =
    config.get<string>('PG_BOSS_APPLICATION_NAME') ?? 'launchstack-boss';

  const rawMax = config.get<string>('PG_BOSS_POOL_MAX');
  const max = rawMax === undefined ? 10 : Number(rawMax);
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(
      `PG_BOSS_POOL_MAX must be a positive integer; got "${rawMax}"`,
    );
  }

  return { connectionString, schema, max, application_name };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter backend test -- --testPathPattern=pg-boss.config`
Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/queue/pg-boss.config.ts apps/backend/src/queue/pg-boss.config.spec.ts
git commit -m "feat(queue): add pg-boss config builder from env"
```

---

## Task 5: `PgBossService` producer API (TDD)

**Files:**
- Create: `apps/backend/src/queue/pg-boss.service.ts`
- Create: `apps/backend/src/queue/define-job.spec.ts`

This task covers tests for `defineJob` + `PgBossService` together (per spec section 10.2 — `define-job.spec.ts` covers the producer-side service).

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/queue/define-job.spec.ts`:

```ts
import { z } from 'zod';
import { defineJob } from './define-job';
import { PgBossService } from './pg-boss.service';

const Job = defineJob({
  name: 'demo',
  schema: z.object({ msg: z.string() }),
});

describe('defineJob', () => {
  it('returns config unchanged with full type inference', () => {
    expect(Job.name).toBe('demo');
    expect(Job.schema).toBeDefined();
  });
});

describe('PgBossService', () => {
  let mockBoss: {
    send: jest.Mock;
    getJobById: jest.Mock;
  };
  let service: PgBossService;

  beforeEach(() => {
    mockBoss = {
      send: jest.fn().mockResolvedValue('job-id-1'),
      getJobById: jest.fn().mockResolvedValue(null),
    };
    service = new PgBossService(mockBoss as never);
  });

  it('send validates payload and calls boss.send with parsed data', async () => {
    const id = await service.send(Job, { msg: 'hi' });
    expect(id).toBe('job-id-1');
    expect(mockBoss.send).toHaveBeenCalledWith('demo', { msg: 'hi' }, {});
  });

  it('send merges retry options from the job def', async () => {
    const J = defineJob({
      name: 'with-retry',
      schema: z.object({ a: z.string() }),
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 600,
    });
    await service.send(J, { a: 'x' });
    expect(mockBoss.send).toHaveBeenCalledWith(
      'with-retry',
      { a: 'x' },
      {
        retryLimit: 5,
        retryDelay: 30,
        retryBackoff: true,
        expireInSeconds: 600,
      },
    );
  });

  it('send throws ZodError on invalid payload and never calls boss.send', async () => {
    await expect(service.send(Job, { msg: 123 } as never)).rejects.toThrow();
    expect(mockBoss.send).not.toHaveBeenCalled();
  });

  it('send forwards caller-supplied options', async () => {
    await service.send(Job, { msg: 'hi' }, { priority: 9 });
    expect(mockBoss.send).toHaveBeenCalledWith(
      'demo',
      { msg: 'hi' },
      { priority: 9 },
    );
  });

  it('sendAfter passes startAfter as the delay in seconds', async () => {
    await service.sendAfter(Job, { msg: 'later' }, 60);
    expect(mockBoss.send).toHaveBeenCalledWith(
      'demo',
      { msg: 'later' },
      { startAfter: 60 },
    );
  });

  it('sendOnce passes singletonKey and returns null on duplicate', async () => {
    mockBoss.send.mockResolvedValueOnce(null);
    const result = await service.sendOnce(Job, { msg: 'once' }, 'key-abc');
    expect(result).toBeNull();
    expect(mockBoss.send).toHaveBeenCalledWith(
      'demo',
      { msg: 'once' },
      { singletonKey: 'key-abc' },
    );
  });

  it('getJob delegates to boss.getJobById', async () => {
    mockBoss.getJobById.mockResolvedValueOnce({ id: 'x' });
    const job = await service.getJob('x');
    expect(job).toEqual({ id: 'x' });
    expect(mockBoss.getJobById).toHaveBeenCalledWith('x');
  });

  it('raw exposes the underlying PGBoss instance', () => {
    expect(service.raw()).toBe(mockBoss);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter backend test -- --testPathPattern=define-job.spec`
Expected: FAIL — module `./pg-boss.service` not found.

- [ ] **Step 3: Implement `PgBossService`**

Create `apps/backend/src/queue/pg-boss.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type PGBoss from 'pg-boss';
import type { z } from 'zod';
import type { JobDefinition } from './define-job';
import { PG_BOSS_INSTANCE } from './pg-boss.tokens';

type SendOptions = PGBoss.SendOptions;

@Injectable()
export class PgBossService {
  constructor(@Inject(PG_BOSS_INSTANCE) private readonly boss: PGBoss) {}

  async send<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    opts: SendOptions = {},
  ): Promise<string> {
    const parsed = job.schema.parse(data) as z.infer<T>;
    const merged = { ...this.retryOptionsFromJob(job), ...opts };
    const id = await this.boss.send(job.name, parsed as object, merged);
    return id as string;
  }

  async sendAfter<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    delaySeconds: number,
    opts: SendOptions = {},
  ): Promise<string> {
    return this.send(job, data, { ...opts, startAfter: delaySeconds });
  }

  async sendOnce<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    singletonKey: string,
    opts: SendOptions = {},
  ): Promise<string | null> {
    const parsed = job.schema.parse(data) as z.infer<T>;
    const merged = {
      ...this.retryOptionsFromJob(job),
      ...opts,
      singletonKey,
    };
    return this.boss.send(job.name, parsed as object, merged);
  }

  getJob(id: string): Promise<PGBoss.JobWithMetadata | null> {
    return this.boss.getJobById(id) as Promise<PGBoss.JobWithMetadata | null>;
  }

  raw(): PGBoss {
    return this.boss;
  }

  private retryOptionsFromJob<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
  ): SendOptions {
    const out: SendOptions = {};
    if (job.retryLimit !== undefined) out.retryLimit = job.retryLimit;
    if (job.retryDelay !== undefined) out.retryDelay = job.retryDelay;
    if (job.retryBackoff !== undefined) out.retryBackoff = job.retryBackoff;
    if (job.expireInSeconds !== undefined)
      out.expireInSeconds = job.expireInSeconds;
    return out;
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter backend test -- --testPathPattern=define-job.spec`
Expected: PASS — all eight `PgBossService` tests + `defineJob` test green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/queue/pg-boss.service.ts apps/backend/src/queue/define-job.spec.ts
git commit -m "feat(queue): add PgBossService producer API with zod-validated payloads"
```

---

## Task 6: `PgBossModule` with discovery and lifecycle (TDD)

**Files:**
- Create: `apps/backend/src/queue/pg-boss.module.ts`
- Create: `apps/backend/src/queue/pg-boss.module.spec.ts`

This task covers spec section 10.1 — handler discovery, role gating, and graceful shutdown. The module mocks `pg-boss` so unit tests never touch a real Postgres.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/queue/pg-boss.module.spec.ts`:

```ts
const mockBossInstance = {
  start: jest.fn(),
  stop: jest.fn(),
  work: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  getJobById: jest.fn(),
};

jest.mock('pg-boss', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockBossInstance),
}));

import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { z } from 'zod';
import { defineJob } from './define-job';
import { Handler } from './handler.decorator';
import { PgBossModule } from './pg-boss.module';

const TestJob = defineJob({
  name: 'test-job',
  schema: z.object({ x: z.string() }),
  workOptions: { teamSize: 2, teamConcurrency: 1 },
});

@Injectable()
class TestRecordingHandler {
  calls: Array<{ id: string; data: { x: string }; attempts: number }> = [];

  @Handler(TestJob)
  async handle(ctx: {
    id: string;
    data: { x: string };
    attempts: number;
  }): Promise<void> {
    this.calls.push({ id: ctx.id, data: ctx.data, attempts: ctx.attempts });
  }
}

async function buildApp(role: 'api' | 'worker' | 'both'): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
}> {
  process.env.DATABASE_URL = 'postgres://test/test';
  process.env.WORKER_ROLE = role;
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PgBossModule.forRoot(),
    ],
    providers: [TestRecordingHandler],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.enableShutdownHooks();
  await app.init();
  return { app, moduleRef };
}

beforeEach(() => {
  mockBossInstance.start.mockResolvedValue(undefined);
  mockBossInstance.stop.mockResolvedValue(undefined);
  mockBossInstance.work.mockResolvedValue('test-job');
  mockBossInstance.send.mockResolvedValue('job-id');
  mockBossInstance.getJobById.mockResolvedValue(null);
  mockBossInstance.start.mockClear();
  mockBossInstance.stop.mockClear();
  mockBossInstance.work.mockClear();
  mockBossInstance.send.mockClear();
  mockBossInstance.on.mockClear();
});

afterEach(() => {
  delete process.env.WORKER_ROLE;
});

describe('PgBossModule', () => {
  it('starts boss in any role (api still needs to produce)', async () => {
    const { app } = await buildApp('api');
    expect(mockBossInstance.start).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('worker role registers handlers via boss.work with the job WorkOptions', async () => {
    const { app } = await buildApp('worker');
    expect(mockBossInstance.work).toHaveBeenCalledTimes(1);
    expect(mockBossInstance.work).toHaveBeenCalledWith(
      'test-job',
      { teamSize: 2, teamConcurrency: 1 },
      expect.any(Function),
    );
    await app.close();
  });

  it('both role registers handlers', async () => {
    const { app } = await buildApp('both');
    expect(mockBossInstance.work).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('api role never calls boss.work', async () => {
    const { app } = await buildApp('api');
    expect(mockBossInstance.work).not.toHaveBeenCalled();
    await app.close();
  });

  it('graceful shutdown stops boss with { graceful: true, wait: true }', async () => {
    const { app } = await buildApp('worker');
    await app.close();
    expect(mockBossInstance.stop).toHaveBeenCalledWith({
      graceful: true,
      wait: true,
    });
  });

  it('handler wrapper calls user method with parsed JobContext on valid payload', async () => {
    const { app, moduleRef } = await buildApp('worker');
    const handler = moduleRef.get(TestRecordingHandler);
    const wrapper = mockBossInstance.work.mock.calls[0][2] as (
      jobs: Array<{ id: string; data: unknown; retrycount?: number }>,
    ) => Promise<void>;

    await wrapper([{ id: 'job-1', data: { x: 'hello' }, retrycount: 0 }]);

    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0]).toEqual({
      id: 'job-1',
      data: { x: 'hello' },
      attempts: 1,
    });
    await app.close();
  });

  it('handler wrapper logs and skips invalid payloads without throwing', async () => {
    const { app, moduleRef } = await buildApp('worker');
    const handler = moduleRef.get(TestRecordingHandler);
    const wrapper = mockBossInstance.work.mock.calls[0][2] as (
      jobs: Array<{ id: string; data: unknown }>,
    ) => Promise<void>;

    await expect(
      wrapper([{ id: 'bad-1', data: { x: 123 } }]),
    ).resolves.toBeUndefined();
    expect(handler.calls).toEqual([]);
    await app.close();
  });

  it('handler wrapper sets attempts = retrycount + 1', async () => {
    const { app, moduleRef } = await buildApp('worker');
    const handler = moduleRef.get(TestRecordingHandler);
    const wrapper = mockBossInstance.work.mock.calls[0][2] as (
      jobs: Array<{ id: string; data: unknown; retrycount?: number }>,
    ) => Promise<void>;

    await wrapper([{ id: 'job-2', data: { x: 'retry' }, retrycount: 3 }]);
    expect(handler.calls[0].attempts).toBe(4);
    await app.close();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter backend test -- --testPathPattern=pg-boss.module.spec`
Expected: FAIL — module `./pg-boss.module` not found.

- [ ] **Step 3: Implement `PgBossModule`**

Create `apps/backend/src/queue/pg-boss.module.ts`:

```ts
import {
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  type DynamicModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import PGBoss from 'pg-boss';
import { buildBossOptions } from './pg-boss.config';
import type { JobDefinition } from './define-job';
import { PgBossService } from './pg-boss.service';
import { HANDLER_METADATA_KEY, PG_BOSS_INSTANCE } from './pg-boss.tokens';

type WorkerRole = 'api' | 'worker' | 'both';

@Injectable()
class PgBossLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('PgBoss');

  constructor(
    @Inject(PG_BOSS_INSTANCE) private readonly boss: PGBoss,
    private readonly config: ConfigService,
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  async onModuleInit(): Promise<void> {
    this.boss.on('error', (err: Error) =>
      this.logger.error('pg-boss error', err.stack ?? err.message),
    );
    await this.boss.start();
    this.logger.log('pg-boss started');

    const role = (this.config.get<string>('WORKER_ROLE') ?? 'both') as WorkerRole;
    if (role === 'api') {
      this.logger.log('WORKER_ROLE=api — skipping handler registration');
      return;
    }

    const providers = this.discovery.getProviders();
    let registered = 0;
    for (const wrapper of providers) {
      const instance = wrapper.instance as Record<string, unknown> | null;
      if (!instance || typeof instance !== 'object') continue;
      const proto = Object.getPrototypeOf(instance) as object;
      if (!proto) continue;
      for (const methodName of this.metadataScanner.getAllMethodNames(proto)) {
        const method = (instance as Record<string, unknown>)[methodName] as
          | ((...args: unknown[]) => unknown)
          | undefined;
        if (typeof method !== 'function') continue;
        const jobDef = this.reflector.get<JobDefinition<never> | undefined>(
          HANDLER_METADATA_KEY,
          method,
        );
        if (!jobDef) continue;
        await this.registerHandler(jobDef, instance, method);
        registered += 1;
      }
    }
    this.logger.log(
      `WORKER_ROLE=${role} — registered ${registered} job handler(s)`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true, wait: true });
    this.logger.log('pg-boss stopped');
  }

  private async registerHandler(
    jobDef: JobDefinition<never>,
    instance: Record<string, unknown>,
    method: (...args: unknown[]) => unknown,
  ): Promise<void> {
    const logger = this.logger;
    await this.boss.work(
      jobDef.name,
      jobDef.workOptions ?? {},
      async (jobs: Array<PGBoss.Job<unknown>>) => {
        for (const job of jobs) {
          const parsed = jobDef.schema.safeParse(job.data);
          if (!parsed.success) {
            logger.error(
              `[${jobDef.name}] invalid payload — skipping job ${job.id}`,
              JSON.stringify({
                jobId: job.id,
                issues: parsed.error.issues,
              }),
            );
            continue;
          }
          const ctx = {
            id: job.id,
            data: parsed.data,
            attempts:
              ((job as unknown as { retrycount?: number }).retrycount ?? 0) +
              1,
            raw: job,
          };
          await (method as (c: unknown) => Promise<void>).call(instance, ctx);
        }
      },
    );
  }
}

@Module({})
export class PgBossModule {
  static forRoot(): DynamicModule {
    return {
      module: PgBossModule,
      global: true,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: PG_BOSS_INSTANCE,
          inject: [ConfigService],
          useFactory: (config: ConfigService): PGBoss => {
            const opts = buildBossOptions(config);
            return new PGBoss(opts);
          },
        },
        PgBossService,
        PgBossLifecycle,
      ],
      exports: [PgBossService],
    };
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter backend test -- --testPathPattern=pg-boss.module.spec`
Expected: PASS — all eight tests green.

- [ ] **Step 5: Run the full backend test suite to catch regressions**

Run: `pnpm --filter backend test`
Expected: PASS — every existing test plus the new queue tests.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/queue/pg-boss.module.ts apps/backend/src/queue/pg-boss.module.spec.ts
git commit -m "feat(queue): add PgBossModule with discovery, role gating, and graceful shutdown"
```

---

## Task 7: Barrel export

**Files:**
- Create: `apps/backend/src/queue/index.ts`

- [ ] **Step 1: Write the barrel**

Create `apps/backend/src/queue/index.ts`:

```ts
export { defineJob, type JobDefinition, type JobContext } from './define-job';
export { Handler } from './handler.decorator';
export { PgBossModule } from './pg-boss.module';
export { PgBossService } from './pg-boss.service';
export { PG_BOSS_INSTANCE, HANDLER_METADATA_KEY } from './pg-boss.tokens';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/queue/index.ts
git commit -m "feat(queue): add barrel export"
```

---

## Task 8: NoopJob, NoopHandler, NoopController (smoke-test wiring)

**Files:**
- Create: `apps/backend/src/queue/jobs/noop.job.ts`
- Create: `apps/backend/src/queue/noop.handler.ts`
- Create: `apps/backend/src/queue/noop.controller.ts`

No new tests — the queue tests already cover discovery and validation. The smoke-test endpoint is exercised manually in Task 12 against a real Postgres.

- [ ] **Step 1: Write the job definition**

Create `apps/backend/src/queue/jobs/noop.job.ts`:

```ts
import { z } from 'zod';
import { defineJob } from '../define-job';

export const NoopJob = defineJob({
  name: 'noop',
  schema: z.object({ message: z.string() }),
  retryLimit: 0,
});
```

- [ ] **Step 2: Write the handler**

Create `apps/backend/src/queue/noop.handler.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Handler } from './handler.decorator';
import { NoopJob } from './jobs/noop.job';
import type { JobContext } from './define-job';

@Injectable()
export class NoopHandler {
  private readonly logger = new Logger(NoopHandler.name);

  @Handler(NoopJob)
  async handle({ id, data }: JobContext<typeof NoopJob>): Promise<void> {
    this.logger.log(`[noop ${id}] received: ${data.message}`);
  }
}
```

- [ ] **Step 3: Write the controller**

Create `apps/backend/src/queue/noop.controller.ts`:

```ts
import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';
import { PgBossService } from './pg-boss.service';
import { NoopJob } from './jobs/noop.job';

const Body$ = z.object({ message: z.string().min(1) });

@Controller('api/_internal/queue')
@AllowAnonymous()
export class NoopController {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly config: ConfigService,
  ) {}

  @Post('noop')
  async trigger(
    @Headers('x-internal-token') token: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<{ data: { jobId: string }; message: string; success: true }> {
    const expected = this.config.getOrThrow<string>('INTERNAL_API_TOKEN');
    if (!token || token !== expected) {
      throw new UnauthorizedException();
    }
    const body = Body$.parse(rawBody);
    const jobId = await this.pgBoss.send(NoopJob, { message: body.message });
    return { data: { jobId }, message: 'enqueued', success: true };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/queue/jobs/noop.job.ts apps/backend/src/queue/noop.handler.ts apps/backend/src/queue/noop.controller.ts
git commit -m "feat(queue): add NoopJob smoke-test (job, handler, internal endpoint)"
```

---

## Task 9: `QueueModule` and wire into `AppModule`

**Files:**
- Create: `apps/backend/src/queue/queue.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Write the QueueModule**

Create `apps/backend/src/queue/queue.module.ts`:

```ts
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import * as express from 'express';
import { NoopController } from './noop.controller';
import { NoopHandler } from './noop.handler';

@Module({
  controllers: [NoopController],
  providers: [NoopHandler],
})
export class QueueModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(express.json()).forRoutes(NoopController);
  }
}
```

- [ ] **Step 2: Wire `PgBossModule.forRoot()` and `QueueModule` into `AppModule`**

Edit `apps/backend/src/app.module.ts` — replace the entire file with:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './databases/pg-drizzle';
import { AppAuthModule } from './auth';
import { OrganizationsModule } from './organizations';
import { PgBossModule } from './queue';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    PgBossModule.forRoot(),
    AppAuthModule,
    OrganizationsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 3: Typecheck and lint**

Run:

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend lint
```

Expected: no errors.

- [ ] **Step 4: Run the full backend test suite**

Run: `pnpm --filter backend test`
Expected: PASS — every test green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/queue/queue.module.ts apps/backend/src/app.module.ts
git commit -m "feat(queue): wire PgBossModule and QueueModule into AppModule"
```

---

## Task 10: Update `.env.example` with new vars

**Files:**
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Append the new variables**

Edit `apps/backend/.env.example` — append to the end of the file:

```

# pg-boss queue
WORKER_ROLE=both
PG_BOSS_SCHEMA=pgboss
PG_BOSS_POOL_MAX=10
PG_BOSS_APPLICATION_NAME=launchstack-boss

# Internal smoke-test endpoint (POST /api/_internal/queue/noop)
INTERNAL_API_TOKEN=replace-with-openssl-rand-hex-32
```

- [ ] **Step 2: Mirror in your local `.env`**

Copy the new vars into `apps/backend/.env` so the dev server can boot. Generate a real token:

```bash
openssl rand -hex 32
```

Then paste the output as the value of `INTERNAL_API_TOKEN` in `apps/backend/.env` (do NOT commit `.env`).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/.env.example
git commit -m "docs(backend): document pg-boss + internal-token env vars"
```

---

## Task 11: Document operational notes in `apps/backend/AGENTS.md`

**Files:**
- Modify: `apps/backend/AGENTS.md`

- [ ] **Step 1: Append a "Background jobs (pg-boss)" section**

Edit `apps/backend/AGENTS.md` — append this section after the existing "Auth" section, before "Testing":

```markdown
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
  workOptions: { teamSize: 5, teamConcurrency: 5 },
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
});
```

Add a handler class with `@Handler(JobDef)` and register it in a feature module's `providers`. The handler is auto-discovered on boot.

**Run modes (`WORKER_ROLE`):**

| Value      | Boots `boss.start()` | Producers (`send`) | Handlers (`work`) |
| ---------- | -------------------- | ------------------ | ----------------- |
| `api`      | yes                  | yes                | no                |
| `worker`   | yes                  | yes                | yes               |
| `both` (default, dev) | yes       | yes                | yes               |

In production, run API replicas with `WORKER_ROLE=api` and worker replicas with `WORKER_ROLE=worker`. Worker capacity scales with replica count × per-job `teamConcurrency`.

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
- **DB connection growth.** pg-boss uses `node-postgres` and Drizzle uses `postgres-js`; they cannot share a pool. Total connections per worker replica ≈ `drizzle_pool + PG_BOSS_POOL_MAX`. Cap with `PG_BOSS_POOL_MAX` (default 10) and check Postgres `max_connections` headroom before scaling worker replicas.
- **Schema is owned by pg-boss.** Never reference the `pgboss` schema in `drizzle/` migrations.
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/AGENTS.md
git commit -m "docs(backend): document pg-boss integration, run modes, and ops risks"
```

---

## Task 12: Manual smoke test against real Postgres

This task does not change code. It verifies the end-to-end path works against the local Docker Postgres and produces a checklist for ops.

- [ ] **Step 1: Ensure Postgres is running**

Run from repo root:

```bash
docker compose up -d
```

Expected: Postgres listening on port 11753.

- [ ] **Step 2: Confirm `apps/backend/.env` has all new vars**

Required values: `WORKER_ROLE=both`, `PG_BOSS_SCHEMA=pgboss`, `PG_BOSS_POOL_MAX=10`, `PG_BOSS_APPLICATION_NAME=launchstack-boss`, and a real `INTERNAL_API_TOKEN` (generated via `openssl rand -hex 32`).

- [ ] **Step 3: Boot the backend and watch logs**

Run from repo root:

```bash
pnpm dev:backend
```

Expected log lines:

```
[PgBoss] pg-boss started
[PgBoss] WORKER_ROLE=both — registered 1 job handler(s)
```

- [ ] **Step 4: Confirm pg-boss created its schema**

In a second terminal:

```bash
docker compose exec postgres psql -U launchstack -d launchstack -c "\\dn"
```

Expected: a `pgboss` schema is listed.

- [ ] **Step 5: Trigger the noop job**

```bash
curl -i -X POST http://localhost:3000/api/_internal/queue/noop \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $(grep INTERNAL_API_TOKEN apps/backend/.env | cut -d= -f2)" \
  -d '{"message":"hello from smoke test"}'
```

Expected: `200 OK` with body shape `{"data":{"jobId":"<uuid>"},"message":"enqueued","success":true}`.

- [ ] **Step 6: Confirm the handler ran**

Within a few seconds, the backend logs should show:

```
[NoopHandler] [noop <jobId>] received: hello from smoke test
```

- [ ] **Step 7: Confirm bad-token requests are rejected**

```bash
curl -i -X POST http://localhost:3000/api/_internal/queue/noop \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: wrong" \
  -d '{"message":"nope"}'
```

Expected: `401 Unauthorized`.

- [ ] **Step 8: Confirm graceful shutdown**

Stop the backend with `Ctrl-C`. Expected log lines (no errors):

```
[PgBoss] pg-boss stopped
```

- [ ] **Step 9: Confirm `WORKER_ROLE=api` skips handler registration**

Set `WORKER_ROLE=api` in `apps/backend/.env`, restart the backend.

Expected log lines:

```
[PgBoss] pg-boss started
[PgBoss] WORKER_ROLE=api — skipping handler registration
```

Trigger the noop endpoint again — the producer call should succeed (`200 OK`, returns a `jobId`), but no `[NoopHandler]` log appears because no worker is registered. The job sits in the `pgboss.job` table waiting for a worker.

To drain it, set `WORKER_ROLE` back to `worker` (or `both`) and restart — the queued job runs immediately.

Restore `WORKER_ROLE=both` in `.env` when done.

- [ ] **Step 10: Final commit (none — all changes already committed)**

If any of the smoke-test steps revealed a fix, commit that fix as a follow-up commit referencing the failing step. Otherwise nothing to commit.

---

## Self-Review

Cross-checking the plan against `docs/superpowers/specs/2026-05-01-pg-boss-integration-design.md`:

| Spec section | Covered by |
| ------------ | ---------- |
| §3 Library pins (pg-boss@12, pg@8, engines bump) | Task 1 |
| §4.1 Module structure (`PgBossModule.forRoot()`) | Task 6, Task 9 |
| §4.2 Lifecycle (`onModuleInit`, `onApplicationShutdown`) | Task 6 |
| §4.3 Run-mode `WORKER_ROLE` gating | Task 6 (impl + tests), Task 12 step 9 |
| §4.4 Connection separation | Task 11 (documented) |
| §5.1 `defineJob` / `JobDefinition` / `JobContext` | Task 2 |
| §5.2 `@Handler` decorator + wrapper validation (`safeParse`, log-and-skip) | Task 3, Task 6 wrapper test |
| §5.3 `PgBossService` (`send`/`sendAfter`/`sendOnce`/`getJob`/`raw`) | Task 5 |
| §5.4 No producer-side decorators | Task 5 (single service) |
| §6 Concurrency (`teamSize`/`teamConcurrency` via job def) | Task 6 work-options test |
| §7.1 Env vars | Task 10 |
| §7.2 Schema auto-creation | Task 11 (documented) |
| §8 Smoke-test job + endpoint | Tasks 8, 9, 12 |
| §9 File layout | Tasks 2–9 |
| §10.1 Module spec coverage | Task 6 |
| §10.2 `define-job.spec.ts` (PgBossService + wrapper) | Task 5, Task 6 wrapper tests |
| §11 Open risks documented | Task 11 |

**Naming consistency:** `defineJob`/`JobDefinition`/`JobContext`/`Handler`/`PgBossService`/`PgBossModule`/`PG_BOSS_INSTANCE`/`HANDLER_METADATA_KEY`/`buildBossOptions`/`NoopJob`/`NoopHandler`/`NoopController`/`QueueModule` are used identically wherever they appear.

**Path consistency:** Spec section 8.3 prose says the endpoint is `POST /api/_internal/queue/noop` but the spec's example controller uses `@Controller('_internal/queue')`. Existing controllers in the codebase (`api/organizations`, etc.) embed the `api/` prefix in `@Controller(...)` rather than via a global prefix. The plan uses `@Controller('api/_internal/queue')` so the implemented route matches the documented route.

**No placeholders:** Every step contains either runnable commands or full file content. No "TBD" / "implement later" / "similar to above".

import { sql, type Kysely } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/databases/kysely/database.types';
import { createFileDatabase } from '../harness/database';
import { createTestApp, type TestApp } from '../harness/create-test-app';

describe('vitest ESM support', () => {
  it('imports the real better-auth package, not a mock', async () => {
    const mod = await import('better-auth');
    expect(typeof mod.betterAuth).toBe('function');
  });

  it('imports the real better-auth/api entry point', async () => {
    const mod = await import('better-auth/api');
    expect(typeof mod.createAuthMiddleware).toBe('function');
    expect(typeof mod.APIError).toBe('function');
  });

  it('imports the real better-auth/plugins entry point', async () => {
    const mod = await import('better-auth/plugins');
    expect(typeof mod.emailOTP).toBe('function');
    expect(typeof mod.openAPI).toBe('function');
  });
});

describe('template database', () => {
  let db: Kysely<Database>;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createFileDatabase());
  });

  afterAll(async () => {
    await close();
  });

  it('has the auth schema the migrations create', async () => {
    const rows = await sql<{ schemaName: string }>`
      select schema_name from information_schema.schemata
    `.execute(db);
    expect(rows.rows.map((r) => r.schemaName)).toContain('auth');
  });

  it('has the core tables and starts empty', async () => {
    // count(*) is int8, which pg returns as a string; ::int makes it a number.
    const users = await sql<{ n: number }>`
      select count(*)::int as n from auth."user"
    `.execute(db);
    const orgs = await sql<{ n: number }>`
      select count(*)::int as n from public.organizations
    `.execute(db);
    expect(users.rows[0].n).toBe(0);
    expect(orgs.rows[0].n).toBe(0);
  });

  it('exposes the camelCase Kysely surface the app uses', async () => {
    // Proves CamelCasePlugin is wired: 'auth.user' + 'emailVerified' only
    // resolve if the plugin rewrites them to auth.user / email_verified.
    const row = await db
      .selectFrom('auth.user')
      .select(['id', 'emailVerified'])
      .executeTakeFirst();
    expect(row).toBeUndefined();
  });
});

describe('app harness', () => {
  let testApp: TestApp;
  let closeDb: () => Promise<void>;

  beforeAll(async () => {
    ({ close: closeDb } = await createFileDatabase());
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
    await closeDb();
  });

  it('serves the anonymous root route', async () => {
    const res = await request(testApp.server).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Hello from launchstack!');
  });

  it('serves the anonymous liveness probe the container healthcheck uses', async () => {
    const res = await request(testApp.server).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok' });
  });

  it('reports ready when Postgres and Temporal answer', async () => {
    const res = await request(testApp.server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.checks.database.status).toBe('ok');
    expect(res.body.data.checks.temporal.status).toBe('ok');
  });

  it('protects a route that has no @AllowAnonymous', async () => {
    // AuthGuard is registered as a global APP_GUARD by
    // @thallesp/nestjs-better-auth and throws UnauthorizedException when there
    // is no session; anything without @AllowAnonymous is protected by default.
    const res = await request(testApp.server).get('/api/organizations/me');
    expect(res.status).toBe(401);
  });

  it('applies the global AllExceptionsFilter', async () => {
    // An unmatched route is a plain NotFoundException. The filter rewrites it
    // into the ApiError envelope; without configureApp() this body would be
    // Nest's default { statusCode, message }.
    const res = await request(testApp.server).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});

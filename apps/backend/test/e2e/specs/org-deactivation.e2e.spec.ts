import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { Kysely } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/databases/kysely/database.types';
// Side-effect free (SetMetadata only), so safe to load before the env is set.
import { RequireOrgRole } from '../../../src/organizations/decorators/require-org-role.decorator';
import { createFileDatabase } from '../harness/database';
import { createTestApp, type TestApp } from '../harness/create-test-app';
import { createVerifiedUser } from '../harness/auth-client';

const PASSWORD = 'correct-horse-battery-staple';

/**
 * Every real org-scoped write opts out with @AllowWhenDeactivated, so the
 * guard only bites on product routes that don't exist yet. These stand in.
 */
@Controller('api/_e2e/deactivation-probe')
class DeactivationProbeController {
  @Get()
  @RequireOrgRole('member')
  read() {
    return { ok: true };
  }

  @Post()
  @RequireOrgRole('admin')
  @HttpCode(204)
  write() {}
}

describe('organization deactivation', () => {
  let testApp: TestApp;
  let db: Kysely<Database>;
  let closeDb: () => Promise<void>;
  let ownerCookie: string;
  let outsiderCookie: string;
  let orgId: string;

  const probe = (method: 'get' | 'post', cookie: string) =>
    request(testApp.server)
      [method]('/api/_e2e/deactivation-probe')
      .set('Cookie', cookie)
      .set('X-Organization-Id', orgId);

  beforeAll(async () => {
    ({ db, close: closeDb } = await createFileDatabase());
    testApp = await createTestApp({
      controllers: [DeactivationProbeController],
    });
    ({ cookie: ownerCookie } = await createVerifiedUser(testApp.server, db, {
      email: 'deactivation-owner@example.com',
      password: PASSWORD,
      name: 'Owner',
    }));
    ({ cookie: outsiderCookie } = await createVerifiedUser(testApp.server, db, {
      email: 'deactivation-outsider@example.com',
      password: PASSWORD,
      name: 'Outsider',
    }));
    const res = await request(testApp.server)
      .post('/api/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: 'Frozen Co' });
    orgId = res.body.data.id as string;
  });

  afterAll(async () => {
    await testApp.close();
    await closeDb();
  });

  it('allows writes while active', async () => {
    expect((await probe('post', ownerCookie)).status).toBe(204);
  });

  describe('once deactivated', () => {
    beforeAll(async () => {
      await db
        .updateTable('organizations')
        .set({ deactivatedAt: new Date() })
        .where('id', '=', orgId)
        .execute();
    });

    it('rejects a non-exempt write with ORG_DEACTIVATED', async () => {
      const res = await probe('post', ownerCookie);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ORG_DEACTIVATED' });
    });

    it('keeps reads open and reports the freeze', async () => {
      expect((await probe('get', ownerCookie)).status).toBe(200);

      const current = await request(testApp.server)
        .get('/api/organizations/current')
        .set('Cookie', ownerCookie)
        .set('X-Organization-Id', orgId);
      expect(current.status).toBe(200);
      expect(current.body.data.organization.deactivatedAt).toEqual(
        expect.any(String),
      );
    });

    it('keeps the exempt organization routes writable', async () => {
      const res = await request(testApp.server)
        .patch('/api/organizations/current')
        .set('Cookie', ownerCookie)
        .set('X-Organization-Id', orgId)
        .send({ name: 'Frozen Co Renamed' });
      expect(res.status).toBe(200);
    });

    // Runs after OrgContextGuard: a non-member learns nothing about the freeze.
    it('answers a non-member with ORG_NOT_FOUND, not ORG_DEACTIVATED', async () => {
      const res = await probe('post', outsiderCookie);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'ORG_NOT_FOUND' });
    });
  });
});

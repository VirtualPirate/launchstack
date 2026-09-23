import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import type { Kysely } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/databases/kysely/database.types';
// Side-effect free, so safe to load before the env is set.
import {
  SA_ORG,
  orgSearchAttributes,
} from '../../../src/temporal/search-attributes';
import { createFileDatabase } from '../harness/database';
import { createTestApp, type TestApp } from '../harness/create-test-app';
import { createVerifiedUser } from '../harness/auth-client';

/**
 * DELETE /api/organizations/current terminates the org's running workflows.
 * Nothing polls this file's task queue, so a started workflow stays Running
 * until something terminates it.
 */
describe('organization teardown', () => {
  let testApp: TestApp;
  let db: Kysely<Database>;
  let closeDb: () => Promise<void>;
  let connection: Connection;
  let client: Client;
  const taskQueue = `e2e-teardown-${randomUUID()}`;

  const startParked = (organizationId: string) =>
    client.workflow.start('NoopWorkflow', {
      taskQueue,
      workflowId: `teardown-${randomUUID()}`,
      args: ['parked'],
      searchAttributes: orgSearchAttributes(organizationId),
    });

  /** Visibility is eventually consistent; wait until the list sees the run. */
  async function waitUntilVisible(organizationId: string): Promise<void> {
    const query = `${SA_ORG} = '${organizationId}' AND ExecutionStatus = 'Running'`;
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await client.workflow.count(query)).count > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`No running workflow visible for ${organizationId}`);
  }

  beforeAll(async () => {
    ({ db, close: closeDb } = await createFileDatabase());
    testApp = await createTestApp();
    connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS,
    });
    client = new Client({ connection, namespace: 'default' });
  });

  afterAll(async () => {
    await connection?.close();
    await testApp?.close();
    await closeDb?.();
  });

  it("terminates the deleted org's running workflows and no one else's", async () => {
    const { cookie } = await createVerifiedUser(testApp.server, db, {
      email: 'teardown-owner@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Teardown Owner',
    });
    const created = await request(testApp.server)
      .post('/api/organizations')
      .set('Cookie', cookie)
      .send({ name: 'Doomed Co' });
    const orgId = created.body.data.id as string;

    const doomed = await startParked(orgId);
    const bystander = await startParked(randomUUID());
    await waitUntilVisible(orgId);

    const res = await request(testApp.server)
      .delete('/api/organizations/current')
      .set('Cookie', cookie)
      .set('X-Organization-Id', orgId);
    expect(res.status).toBe(204);

    expect((await doomed.describe()).status.name).toBe('TERMINATED');
    expect((await bystander.describe()).status.name).toBe('RUNNING');
    await bystander.terminate('test cleanup');
  });
});

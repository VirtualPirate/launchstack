import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client, Connection } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildActivities } from '../../../src/temporal/activity-registry';
import { createFileDatabase } from '../harness/database';
import { createTestApp, type TestApp } from '../harness/create-test-app';

const TOKEN_HEADER = 'x-internal-token';

/**
 * API -> Temporal -> worker -> activity, end to end: the same path
 * src/worker.ts runs in production, against the dev server from global-setup.
 */
describe('POST /api/_internal/queue/noop', () => {
  let testApp: TestApp;
  let closeDb: () => Promise<void>;
  let connection: Connection;
  let client: Client;
  let nativeConnection: NativeConnection;
  let worker: Worker;
  const noopCalls: unknown[][] = [];

  beforeAll(async () => {
    ({ close: closeDb } = await createFileDatabase());

    // A task queue private to this file: files share one Temporal server, and
    // this is the only one running a worker. Set before createTestApp() so the
    // app's TemporalProducerService starts workflows on it.
    process.env.TEMPORAL_TASK_QUEUE = `e2e-queue-${randomUUID()}`;
    testApp = await createTestApp();

    // Discover the real @Activity methods off the booted app, exactly as
    // src/worker.ts does, and record each noop call on the way through.
    const activities = buildActivities(testApp.app);
    const noop = activities['noop.run'];
    activities['noop.run'] = (...args: unknown[]) => {
      noopCalls.push(args);
      return noop(...args);
    };

    nativeConnection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS,
    });
    worker = await Worker.create({
      connection: nativeConnection,
      namespace: 'default',
      taskQueue: process.env.TEMPORAL_TASK_QUEUE,
      // The .ts entry, not dist/: the worker bundles workflow code itself.
      workflowsPath: fileURLToPath(
        new URL('../../../src/temporal/workflows/index.ts', import.meta.url),
      ),
      activities,
    });

    connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS,
    });
    client = new Client({ connection, namespace: 'default' });
  });

  afterAll(async () => {
    await connection?.close();
    await nativeConnection?.close();
    await testApp?.close();
    await closeDb?.();
  });

  it('rejects a missing or wrong internal token', async () => {
    const missing = await request(testApp.server)
      .post('/api/_internal/queue/noop')
      .send({ message: 'hi' });
    expect(missing.status).toBe(401);

    const wrong = await request(testApp.server)
      .post('/api/_internal/queue/noop')
      .set(TOKEN_HEADER, 'not-the-token')
      .send({ message: 'hi' });
    expect(wrong.status).toBe(401);
  });

  it('starts NoopWorkflow and the worker runs noop.run to completion', async () => {
    await worker.runUntil(async () => {
      const res = await request(testApp.server)
        .post('/api/_internal/queue/noop')
        .set(TOKEN_HEADER, process.env.INTERNAL_API_TOKEN!)
        .send({ message: 'hello e2e' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ message: 'enqueued', success: true });

      const jobId = res.body.data.jobId as string;
      expect(jobId).toMatch(/^NoopWorkflow:/);

      const handle = client.workflow.getHandle(jobId);
      await handle.result();
      const description = await handle.describe();
      expect(description.status.name).toBe('COMPLETED');
    });

    expect(noopCalls).toEqual([['hello e2e']]);
  });
});

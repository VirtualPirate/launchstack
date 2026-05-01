const mockBossInstance = {
  start: jest.fn(),
  stop: jest.fn(),
  work: jest.fn(),
  createQueue: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  getJobById: jest.fn(),
};

jest.mock('pg-boss', () => ({
  __esModule: true,
  PgBoss: jest.fn().mockImplementation(() => mockBossInstance),
}));

import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { z } from 'zod';
import { defineJob } from './define-job';
import { Handler } from './handler.decorator';
import { PgBossModule } from './pg-boss.module';

const TestJob = defineJob({
  name: 'test-job',
  schema: z.object({ x: z.string() }),
  workOptions: { localConcurrency: 2 },
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
      DiscoveryModule,
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
  mockBossInstance.createQueue.mockResolvedValue(undefined);
  mockBossInstance.send.mockResolvedValue('job-id');
  mockBossInstance.getJobById.mockResolvedValue(null);
  mockBossInstance.start.mockClear();
  mockBossInstance.stop.mockClear();
  mockBossInstance.work.mockClear();
  mockBossInstance.createQueue.mockClear();
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
      { localConcurrency: 2 },
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

  it('graceful shutdown stops boss with { graceful: true }', async () => {
    const { app } = await buildApp('worker');
    await app.close();
    expect(mockBossInstance.stop).toHaveBeenCalledWith({ graceful: true });
  });

  it('handler wrapper calls user method with parsed JobContext on valid payload', async () => {
    const { app, moduleRef } = await buildApp('worker');
    const handler = moduleRef.get(TestRecordingHandler);
    const wrapper = mockBossInstance.work.mock.calls[0][2] as (
      jobs: Array<{ id: string; data: unknown; retryCount?: number }>,
    ) => Promise<void>;

    await wrapper([{ id: 'job-1', data: { x: 'hello' }, retryCount: 0 }]);

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
      jobs: Array<{ id: string; data: unknown; retryCount?: number }>,
    ) => Promise<void>;

    await wrapper([{ id: 'job-2', data: { x: 'retry' }, retryCount: 3 }]);
    expect(handler.calls[0].attempts).toBe(4);
    await app.close();
  });
});

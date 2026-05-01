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
      {
        priority: 9,
      },
    );
  });

  it('sendAfter passes startAfter as the delay in seconds', async () => {
    await service.sendAfter(Job, { msg: 'later' }, 60);
    expect(mockBoss.send).toHaveBeenCalledWith(
      'demo',
      { msg: 'later' },
      {
        startAfter: 60,
      },
    );
  });

  it('sendOnce passes singletonKey and returns null on duplicate', async () => {
    mockBoss.send.mockResolvedValueOnce(null);
    const result = await service.sendOnce(Job, { msg: 'once' }, 'key-abc');
    expect(result).toBeNull();
    expect(mockBoss.send).toHaveBeenCalledWith(
      'demo',
      { msg: 'once' },
      {
        singletonKey: 'key-abc',
      },
    );
  });

  it('getJob delegates to boss.getJobById', async () => {
    mockBoss.getJobById.mockResolvedValueOnce({ id: 'x' });
    const job = await service.getJob('demo', 'x');
    expect(job).toEqual({ id: 'x' });
    expect(mockBoss.getJobById).toHaveBeenCalledWith('demo', 'x');
  });

  it('raw exposes the underlying PGBoss instance', () => {
    expect(service.raw()).toBe(mockBoss);
  });
});

import { CommitsRepository } from '../commits.repository';

describe('CommitsRepository.findCommitTimestampsForScope', () => {
  it('returns [] without touching the db when repositoryIds is empty', async () => {
    const repo = new CommitsRepository({} as any);
    const out = await repo.findCommitTimestampsForScope({
      repositoryIds: [],
      periodStart: new Date('2025-06-06T00:00:00Z'),
      periodEnd: new Date('2026-06-06T00:00:00Z'),
    });
    expect(out).toEqual([]);
  });

  it('maps rows to their authoredAt dates', async () => {
    const d1 = new Date('2026-01-01T10:00:00Z');
    const d2 = new Date('2026-02-02T11:00:00Z');
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([{ authoredAt: d1 }, { authoredAt: d2 }]),
        }),
      }),
    };
    const repo = new CommitsRepository(fakeDb as never);
    const out = await repo.findCommitTimestampsForScope({
      repositoryIds: ['r1'],
      periodStart: new Date('2025-06-06T00:00:00Z'),
      periodEnd: new Date('2026-06-06T00:00:00Z'),
    });
    expect(out).toEqual([d1, d2]);
  });
});

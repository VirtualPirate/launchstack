import { AnalyzeRepoHandler } from '../handlers/analyze-repo.handler';
import { AnalyzeCommitJob } from '../jobs/analyze-commit.job';

function makeMocks() {
  return {
    commitsRepo: {
      findByRepositorySince: jest.fn(
        async () =>
          [] as Array<{
            id: string;
            parentCount: number;
          }>,
      ),
    } as any,
    analysesRepo: {
      findCommitIdsWithAnalysis: jest.fn(async () => new Set<string>()),
      upsertSkippedMerge: jest.fn(async () => undefined),
      deleteForCommitIds: jest.fn(async () => undefined),
    } as any,
    pgBoss: {
      send: jest.fn(async () => 'queued-id'),
    } as any,
  };
}

function makeHandler(overrides: Partial<ReturnType<typeof makeMocks>> = {}) {
  const m = { ...makeMocks(), ...overrides };
  return {
    handler: new AnalyzeRepoHandler(m.commitsRepo, m.analysesRepo, m.pgBoss),
    mocks: m,
  };
}

const ctx = (data: {
  repositoryId: string;
  sinceISO: string;
  force: boolean;
}) => ({
  id: 'job-1',
  data,
  attempts: 1,
  raw: {} as never,
});

describe('AnalyzeRepoHandler', () => {
  it('skips merge commits by upserting skipped_merge and never enqueues them', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findByRepositorySince.mockResolvedValueOnce([
      { id: 'm1', parentCount: 2 },
      { id: 'r1', parentCount: 1 },
    ]);

    await handler.handle(
      ctx({
        repositoryId: 'r',
        sinceISO: '2026-05-01T00:00:00Z',
        force: false,
      }),
    );

    expect(mocks.analysesRepo.upsertSkippedMerge).toHaveBeenCalledWith('m1');
    expect(mocks.pgBoss.send).toHaveBeenCalledTimes(1);
    expect(mocks.pgBoss.send).toHaveBeenCalledWith(AnalyzeCommitJob, {
      commitId: 'r1',
    });
  });

  it('skips already-analyzed commits when force=false', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findByRepositorySince.mockResolvedValueOnce([
      { id: 'r1', parentCount: 1 },
      { id: 'r2', parentCount: 1 },
    ]);
    mocks.analysesRepo.findCommitIdsWithAnalysis.mockResolvedValueOnce(
      new Set(['r1']),
    );

    await handler.handle(
      ctx({
        repositoryId: 'r',
        sinceISO: '2026-05-01T00:00:00Z',
        force: false,
      }),
    );

    expect(mocks.pgBoss.send).toHaveBeenCalledTimes(1);
    expect(mocks.pgBoss.send).toHaveBeenCalledWith(AnalyzeCommitJob, {
      commitId: 'r2',
    });
    expect(mocks.analysesRepo.deleteForCommitIds).not.toHaveBeenCalled();
  });

  it('deletes existing analyses and re-enqueues when force=true', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findByRepositorySince.mockResolvedValueOnce([
      { id: 'r1', parentCount: 1 },
      { id: 'r2', parentCount: 1 },
    ]);

    await handler.handle(
      ctx({ repositoryId: 'r', sinceISO: '2026-05-01T00:00:00Z', force: true }),
    );

    expect(mocks.analysesRepo.deleteForCommitIds).toHaveBeenCalledWith([
      'r1',
      'r2',
    ]);
    expect(mocks.pgBoss.send).toHaveBeenCalledTimes(2);
  });
});

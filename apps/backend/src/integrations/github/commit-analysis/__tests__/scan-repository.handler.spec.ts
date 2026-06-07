import { ScanRepositoryHandler } from '../handlers/scan-repository.handler';
import { AnalyzeRepoJob } from '../jobs/analyze-repo.job';

function makeMocks() {
  return {
    backfill: {
      runFromLatest: jest.fn(async () => ({ inserted: 0, sinceISO: null })),
    } as any,
    pgBoss: {
      send: jest.fn(async () => 'queued-id'),
    } as any,
  };
}

function makeHandler(overrides: Partial<ReturnType<typeof makeMocks>> = {}) {
  const m = { ...makeMocks(), ...overrides };
  return {
    handler: new ScanRepositoryHandler(m.backfill, m.pgBoss),
    mocks: m,
  };
}

const ctx = (data: { repositoryId: string; lookbackDays: number }) => ({
  id: 'job-1',
  data,
  attempts: 1,
  raw: {} as never,
});

describe('ScanRepositoryHandler', () => {
  it('pulls from latest then dispatches AnalyzeRepoJob with the computed sinceISO', async () => {
    const { handler, mocks } = makeHandler();
    mocks.backfill.runFromLatest.mockResolvedValueOnce({
      inserted: 3,
      sinceISO: '2025-05-10T00:00:00.000Z',
    });

    await handler.handle(ctx({ repositoryId: 'repo-1', lookbackDays: 365 }));

    expect(mocks.backfill.runFromLatest).toHaveBeenCalledWith({
      repositoryId: 'repo-1',
      lookbackDays: 365,
    });
    expect(mocks.pgBoss.send).toHaveBeenCalledWith(AnalyzeRepoJob, {
      repositoryId: 'repo-1',
      sinceISO: '2025-05-10T00:00:00.000Z',
      force: false,
    });
  });

  it('does not dispatch analysis for an empty repo (sinceISO=null)', async () => {
    const { handler, mocks } = makeHandler();
    mocks.backfill.runFromLatest.mockResolvedValueOnce({
      inserted: 0,
      sinceISO: null,
    });

    await handler.handle(ctx({ repositoryId: 'repo-1', lookbackDays: 365 }));

    expect(mocks.pgBoss.send).not.toHaveBeenCalled();
  });
});

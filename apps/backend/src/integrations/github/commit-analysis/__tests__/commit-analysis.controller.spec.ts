import { CommitAnalysisController } from '../controllers/commit-analysis.controller';
import { BackfillCommitsJob } from '../jobs/backfill-commits.job';
import { AnalyzeRepoJob } from '../jobs/analyze-repo.job';

function makeController() {
  const reposRepo = {
    findByIdScopedToOrg: jest.fn(),
  } as any;
  const commitsRepo = {
    countByRepositorySince: jest.fn(async () => 7),
  } as any;
  const pgBoss = {
    sendOnce: jest.fn(async () => 'queued-id'),
  } as any;

  return {
    controller: new CommitAnalysisController(reposRepo, commitsRepo, pgBoss),
    reposRepo,
    commitsRepo,
    pgBoss,
  };
}

const membership = { organizationId: 'org-1' } as any;

describe('CommitAnalysisController', () => {
  it('throws 404 when repo not found in org for backfill', async () => {
    const { controller, reposRepo } = makeController();
    reposRepo.findByIdScopedToOrg.mockResolvedValueOnce(null);
    await expect(
      controller.backfill(membership, { repoId: 'r1' }, { days: 30 }),
    ).rejects.toMatchObject({ code: 'GITHUB_REPOSITORY_NOT_FOUND' });
  });

  it('enqueues backfill with computed sinceISO and idempotency key', async () => {
    const { controller, reposRepo, pgBoss } = makeController();
    reposRepo.findByIdScopedToOrg.mockResolvedValueOnce({ id: 'r1' });
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00Z'));

    const res = await controller.backfill(
      membership,
      { repoId: 'r1' },
      { days: 30 },
    );

    expect(pgBoss.sendOnce).toHaveBeenCalledWith(
      BackfillCommitsJob,
      expect.objectContaining({
        repositoryId: 'r1',
        sinceISO: '2026-04-16T12:00:00.000Z',
      }),
      'backfill:r1',
    );
    expect(res.data.jobId).toBe('queued-id');
    jest.useRealTimers();
  });

  it('enqueues analyze with expectedCommitCount', async () => {
    const { controller, reposRepo, commitsRepo, pgBoss } = makeController();
    reposRepo.findByIdScopedToOrg.mockResolvedValueOnce({ id: 'r1' });
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00Z'));

    const res = await controller.analyze(
      membership,
      { repoId: 'r1' },
      { days: 7, force: true },
    );

    expect(commitsRepo.countByRepositorySince).toHaveBeenCalledWith(
      'r1',
      '2026-05-09T12:00:00.000Z',
    );
    expect(pgBoss.sendOnce).toHaveBeenCalledWith(
      AnalyzeRepoJob,
      expect.objectContaining({
        repositoryId: 'r1',
        sinceISO: '2026-05-09T12:00:00.000Z',
        force: true,
      }),
      'analyze:r1:7:true',
    );
    expect(res.data.expectedCommitCount).toBe(7);
    jest.useRealTimers();
  });
});

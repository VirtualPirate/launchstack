import { CommitBackfillService } from '../services/commit-backfill.service';

function makeMocks() {
  const repo = {
    id: 'repo-1',
    installationId: 'inst-1',
    fullName: 'acme/api',
  };
  const installation = {
    id: 'inst-1',
    githubInstallationId: 42n,
  };

  return {
    repo,
    installation,
    reposRepo: {
      findById: jest.fn(async () => repo),
    } as any,
    installsRepo: {
      findById: jest.fn(async () => installation),
    } as any,
    client: {
      getDefaultBranch: jest.fn(async () => 'main'),
      getLatestCommitDate: jest.fn(async () => null),
      listCommits: jest.fn(async () => []),
    } as any,
    commitsRepo: {
      upsertMany: jest.fn(async () => undefined),
    } as any,
  };
}

function makeService(overrides: Partial<ReturnType<typeof makeMocks>> = {}) {
  const m = { ...makeMocks(), ...overrides };
  return {
    svc: new CommitBackfillService(
      m.reposRepo,
      m.installsRepo,
      m.client,
      m.commitsRepo,
    ),
    mocks: m,
  };
}

function makeCommit(sha: string) {
  return {
    sha,
    parentCount: 1,
    message: `m-${sha}`,
    authorGithubUserId: 1n,
    authorGithubLogin: 'a',
    authorName: 'A',
    authorEmail: 'a@x',
    committerGithubUserId: 1n,
    committerGithubLogin: 'a',
    committerName: 'A',
    committerEmail: 'a@x',
    authoredAt: new Date('2026-05-01T00:00:00Z'),
    committedAt: new Date('2026-05-01T00:00:01Z'),
    raw: { sha },
  };
}

describe('CommitBackfillService', () => {
  it('throws NOT_FOUND when repo is missing', async () => {
    const { svc, mocks } = makeService();
    mocks.reposRepo.findById.mockResolvedValueOnce(null);
    await expect(
      svc.run({ repositoryId: 'repo-1', sinceISO: '2025-05-01T00:00:00Z' }),
    ).rejects.toMatchObject({ code: 'GITHUB_REPOSITORY_NOT_FOUND' });
  });

  it('fetches default branch + commits and upserts in batches', async () => {
    const { svc, mocks } = makeService();
    mocks.client.listCommits.mockResolvedValueOnce([
      makeCommit('a'),
      makeCommit('b'),
    ]);

    await svc.run({
      repositoryId: 'repo-1',
      sinceISO: '2025-05-01T00:00:00Z',
    });

    expect(mocks.client.getDefaultBranch).toHaveBeenCalledWith(42n, 'acme/api');
    expect(mocks.client.listCommits).toHaveBeenCalledWith(
      42n,
      'acme/api',
      '2025-05-01T00:00:00Z',
      'main',
    );
    expect(mocks.commitsRepo.upsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId: 'repo-1',
          sha: 'a',
          authorEmail: 'a@x',
        }),
        expect.objectContaining({ sha: 'b' }),
      ]),
    );
  });

  it('noops when no commits are returned', async () => {
    const { svc, mocks } = makeService();
    await svc.run({
      repositoryId: 'repo-1',
      sinceISO: '2025-05-01T00:00:00Z',
    });
    expect(mocks.commitsRepo.upsertMany).not.toHaveBeenCalled();
  });

  describe('runFromLatest', () => {
    it('computes since = latest - lookbackDays, pulls, and returns sinceISO', async () => {
      const { svc, mocks } = makeService();
      mocks.client.getLatestCommitDate.mockResolvedValueOnce(
        new Date('2026-05-10T00:00:00.000Z'),
      );
      mocks.client.listCommits.mockResolvedValueOnce([
        makeCommit('a'),
        makeCommit('b'),
      ]);

      const result = await svc.runFromLatest({
        repositoryId: 'repo-1',
        lookbackDays: 365,
      });

      const expectedSince = new Date(
        Date.parse('2026-05-10T00:00:00.000Z') - 365 * 24 * 60 * 60 * 1000,
      ).toISOString();

      expect(result).toEqual({ inserted: 2, sinceISO: expectedSince });
      expect(mocks.client.getLatestCommitDate).toHaveBeenCalledWith(
        42n,
        'acme/api',
        'main',
      );
      expect(mocks.client.listCommits).toHaveBeenCalledWith(
        42n,
        'acme/api',
        expectedSince,
        'main',
      );
      expect(mocks.commitsRepo.upsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ repositoryId: 'repo-1', sha: 'a' }),
          expect.objectContaining({ sha: 'b' }),
        ]),
      );
    });

    it('returns sinceISO=null and pulls nothing for an empty repo', async () => {
      const { svc, mocks } = makeService();
      mocks.client.getLatestCommitDate.mockResolvedValueOnce(null);

      const result = await svc.runFromLatest({
        repositoryId: 'repo-1',
        lookbackDays: 365,
      });

      expect(result).toEqual({ inserted: 0, sinceISO: null });
      expect(mocks.client.listCommits).not.toHaveBeenCalled();
      expect(mocks.commitsRepo.upsertMany).not.toHaveBeenCalled();
    });

    it('returns inserted=0 with a real sinceISO when no commits are in the window', async () => {
      const { svc, mocks } = makeService();
      mocks.client.getLatestCommitDate.mockResolvedValueOnce(
        new Date('2026-05-10T00:00:00.000Z'),
      );
      mocks.client.listCommits.mockResolvedValueOnce([]);

      const result = await svc.runFromLatest({
        repositoryId: 'repo-1',
        lookbackDays: 365,
      });

      const expectedSince = new Date(
        Date.parse('2026-05-10T00:00:00.000Z') - 365 * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(result).toEqual({ inserted: 0, sinceISO: expectedSince });
      expect(mocks.commitsRepo.upsertMany).not.toHaveBeenCalled();
    });
  });
});

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
});

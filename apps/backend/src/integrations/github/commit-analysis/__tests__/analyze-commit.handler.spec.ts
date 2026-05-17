import { AnalyzeCommitHandler } from '../handlers/analyze-commit.handler';

function makeMocks() {
  return {
    commitsRepo: {
      findById: jest.fn(),
    } as any,
    reposRepo: {
      findById: jest.fn(),
    } as any,
    installsRepo: {
      findById: jest.fn(),
    } as any,
    analysesRepo: {
      findByCommitId: jest.fn(async () => null),
      insert: jest.fn(async (row: any) => ({ id: 'a1', ...row })),
    } as any,
    client: {
      getCommit: jest.fn(),
    } as any,
    analyzer: {
      analyzeCommit: jest.fn(),
    } as any,
  };
}

function makeHandler(overrides: Partial<ReturnType<typeof makeMocks>> = {}) {
  const m = { ...makeMocks(), ...overrides };
  return {
    handler: new AnalyzeCommitHandler(
      m.commitsRepo,
      m.reposRepo,
      m.installsRepo,
      m.analysesRepo,
      m.client,
      m.analyzer,
    ),
    mocks: m,
  };
}

const ctx = (commitId: string) => ({
  id: 'job-1',
  data: { commitId },
  attempts: 1,
  raw: {} as never,
});

function commitRow() {
  return {
    id: 'c1',
    repositoryId: 'repo-1',
    sha: 'abc',
    parentCount: 1,
    message: 'feat: x',
    authorName: 'A',
    authorEmail: 'a@x',
  };
}

describe('AnalyzeCommitHandler', () => {
  it('exits silently when commit row is missing', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findById.mockResolvedValueOnce(null);
    await handler.handle(ctx('c1'));
    expect(mocks.analysesRepo.insert).not.toHaveBeenCalled();
  });

  it('exits silently when commit already analyzed (retry re-entry)', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findById.mockResolvedValueOnce(commitRow());
    mocks.analysesRepo.findByCommitId.mockResolvedValueOnce({
      id: 'existing',
      status: 'analyzed',
    });
    await handler.handle(ctx('c1'));
    expect(mocks.client.getCommit).not.toHaveBeenCalled();
    expect(mocks.analysesRepo.insert).not.toHaveBeenCalled();
  });

  it('writes analyzed row on success', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findById.mockResolvedValueOnce(commitRow());
    mocks.reposRepo.findById.mockResolvedValueOnce({
      id: 'repo-1',
      installationId: 'inst-1',
      fullName: 'acme/api',
    });
    mocks.installsRepo.findById.mockResolvedValueOnce({
      id: 'inst-1',
      githubInstallationId: 42n,
    });
    mocks.client.getCommit.mockResolvedValueOnce({
      files: [{ path: 'src/x.ts', additions: 1, deletions: 0, patch: 'p' }],
    });
    mocks.analyzer.analyzeCommit.mockResolvedValueOnce({
      status: 'analyzed',
      commitType: 'fix',
      summary: 's',
      changes: ['c1'],
      model: 'gpt-4o-mini',
      promptTokens: 10,
      completionTokens: 20,
      diffCharsSent: 100,
      diffWasTruncated: false,
      rawOutput: {},
    });

    await handler.handle(ctx('c1'));

    expect(mocks.analysesRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        commitId: 'c1',
        status: 'analyzed',
        commitType: 'fix',
        summary: 's',
        changes: ['c1'],
        model: 'gpt-4o-mini',
        promptTokens: 10,
        diffCharsSent: 100,
      }),
    );
  });

  it('writes skipped_empty row when analyzer reports it', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findById.mockResolvedValueOnce(commitRow());
    mocks.reposRepo.findById.mockResolvedValueOnce({
      id: 'repo-1',
      installationId: 'inst-1',
      fullName: 'acme/api',
    });
    mocks.installsRepo.findById.mockResolvedValueOnce({
      id: 'inst-1',
      githubInstallationId: 42n,
    });
    mocks.client.getCommit.mockResolvedValueOnce({ files: [] });
    mocks.analyzer.analyzeCommit.mockResolvedValueOnce({
      status: 'skipped_empty',
    });

    await handler.handle(ctx('c1'));

    expect(mocks.analysesRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ commitId: 'c1', status: 'skipped_empty' }),
    );
  });

  it('writes failed row and re-throws when analyzer throws', async () => {
    const { handler, mocks } = makeHandler();
    mocks.commitsRepo.findById.mockResolvedValueOnce(commitRow());
    mocks.reposRepo.findById.mockResolvedValueOnce({
      id: 'repo-1',
      installationId: 'inst-1',
      fullName: 'acme/api',
    });
    mocks.installsRepo.findById.mockResolvedValueOnce({
      id: 'inst-1',
      githubInstallationId: 42n,
    });
    mocks.client.getCommit.mockResolvedValueOnce({
      files: [{ path: 'src/x.ts', additions: 1, deletions: 0, patch: 'p' }],
    });
    mocks.analyzer.analyzeCommit.mockRejectedValueOnce(new Error('boom'));

    await expect(handler.handle(ctx('c1'))).rejects.toThrow('boom');
    expect(mocks.analysesRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        commitId: 'c1',
        status: 'failed',
        failureReason: 'boom',
      }),
    );
  });
});

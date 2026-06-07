import { BriefGeneratorService } from '../services/brief-generator.service';

function makeService() {
  const commits = { findForBriefScope: jest.fn() };
  const scopeResolver = { resolve: jest.fn() };
  const openai = { generate: jest.fn() };
  const svc = new BriefGeneratorService(
    commits as any,
    scopeResolver as any,
    openai as any,
    {
      apiKey: 'k',
      model: 'gpt-x',
      maxPromptChars: 10_000,
      dispatcherIntervalSeconds: 60,
      backfillMaxBriefs: 366,
    },
  );
  return { svc, commits, scopeResolver, openai };
}

const period = {
  start: new Date('2026-05-19T00:00:00Z'),
  end: new Date('2026-05-25T23:59:59Z'),
};

describe('BriefGeneratorService.generate', () => {
  it('returns empty-period result when no commits found', async () => {
    const { svc, scopeResolver, commits } = makeService();
    scopeResolver.resolve.mockResolvedValue({
      repositoryIds: ['r1'],
      scopeLabel: 'Project: Mobile',
    });
    commits.findForBriefScope.mockResolvedValue([]);
    const out = await svc.generate({
      organizationId: 'o1',
      scope: { type: 'project', projectId: 'p1' },
      period,
    });
    expect(out.kind).toBe('empty');
    if (out.kind === 'empty') {
      expect(out.contributorCount).toBe(0);
      expect(out.commitCount).toBe(0);
    }
  });

  it('calls LLM and returns title+summary for non-empty period', async () => {
    const { svc, scopeResolver, commits, openai } = makeService();
    scopeResolver.resolve.mockResolvedValue({
      repositoryIds: ['r1'],
      scopeLabel: 'Project: Mobile',
    });
    commits.findForBriefScope.mockResolvedValue([
      {
        commit: {
          id: 'c1',
          sha: 'abc',
          authorName: 'Ada',
          authorEmail: 'a@x.io',
          authorGithubUserId: BigInt(1),
          message: 'feat: x',
          authoredAt: new Date('2026-05-20T00:00:00Z'),
          parentCount: 1,
          repositoryId: 'r1',
        },
        analysis: {
          commitType: 'feature',
          summary: 'add X',
          changes: ['c1'],
          status: 'analyzed',
        },
      },
    ]);
    openai.generate.mockResolvedValue({
      parsed: { title: 'Mobile shipped X', summary: 'We did stuff.' },
      model: 'gpt-x',
      promptTokens: 100,
      completionTokens: 30,
    });
    const out = await svc.generate({
      organizationId: 'o1',
      scope: { type: 'project', projectId: 'p1' },
      period,
    });
    expect(out.kind).toBe('generated');
    if (out.kind === 'generated') {
      expect(out.title).toBe('Mobile shipped X');
      expect(out.commitCount).toBe(1);
      expect(out.contributorCount).toBe(1);
    }
  });

  it('propagates SCOPE_DELETED from the resolver', async () => {
    const { svc, scopeResolver } = makeService();
    scopeResolver.resolve.mockRejectedValue(
      new Error('SCOPE_DELETED: team missing'),
    );
    await expect(
      svc.generate({
        organizationId: 'o1',
        scope: { type: 'team', teamId: 't1' },
        period,
      }),
    ).rejects.toThrow(/SCOPE_DELETED/);
  });
});

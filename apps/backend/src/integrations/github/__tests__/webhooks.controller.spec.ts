import { GithubWebhooksController } from '../controllers/webhooks.controller';
import { SyncRepoCollaboratorsJob } from '../collaborators/jobs/sync-repo-collaborators.job';

function makeMocks() {
  return {
    verifier: { verify: jest.fn() } as any,
    webhookEvents: {
      create: jest.fn(async () => undefined),
      markProcessed: jest.fn(async () => undefined),
    } as any,
    reposRepo: {
      findByGithubRepoId: jest.fn(async () => null as any),
    } as any,
    pgBoss: { send: jest.fn(async () => 'job-id') } as any,
    config: { webhookSecret: 'secret' } as any,
  };
}

function makeController(overrides: Partial<ReturnType<typeof makeMocks>> = {}) {
  const m = { ...makeMocks(), ...overrides };
  return {
    ctrl: new GithubWebhooksController(
      m.verifier,
      m.webhookEvents,
      m.reposRepo,
      m.pgBoss,
      m.config,
    ),
    mocks: m,
  };
}

const req = (parsed: Record<string, unknown>) =>
  ({
    rawBody: Buffer.from(JSON.stringify(parsed)),
    body: parsed,
  }) as any;

describe('GithubWebhooksController', () => {
  it('writes outbox row and dispatches sync job for member.added on a tracked repo', async () => {
    const { ctrl, mocks } = makeController();
    mocks.reposRepo.findByGithubRepoId.mockResolvedValueOnce({
      id: 'r1',
      deletedAt: null,
    });

    await ctrl.handle(
      req({ action: 'added', repository: { id: 42 } }),
      'sig',
      'member',
      'd-1',
    );

    expect(mocks.webhookEvents.create).toHaveBeenCalled();
    expect(mocks.pgBoss.send).toHaveBeenCalledWith(SyncRepoCollaboratorsJob, {
      repositoryId: 'r1',
      trigger: 'webhook',
    });
    expect(mocks.webhookEvents.markProcessed).toHaveBeenCalledWith('d-1');
  });

  it('does not dispatch for non-member events', async () => {
    const { ctrl, mocks } = makeController();

    await ctrl.handle(
      req({ action: 'opened', repository: { id: 42 } }),
      'sig',
      'pull_request',
      'd-2',
    );

    expect(mocks.pgBoss.send).not.toHaveBeenCalled();
  });

  it('does not dispatch for unknown member actions', async () => {
    const { ctrl, mocks } = makeController();
    mocks.reposRepo.findByGithubRepoId.mockResolvedValueOnce({
      id: 'r1',
      deletedAt: null,
    });

    await ctrl.handle(
      req({ action: 'unknown', repository: { id: 42 } }),
      'sig',
      'member',
      'd-3',
    );

    expect(mocks.pgBoss.send).not.toHaveBeenCalled();
  });

  it('does not dispatch for untracked repos', async () => {
    const { ctrl, mocks } = makeController();
    mocks.reposRepo.findByGithubRepoId.mockResolvedValueOnce(null);

    await ctrl.handle(
      req({ action: 'added', repository: { id: 999 } }),
      'sig',
      'member',
      'd-4',
    );

    expect(mocks.pgBoss.send).not.toHaveBeenCalled();
  });

  it('does not dispatch when the tracked repo is soft-deleted', async () => {
    const { ctrl, mocks } = makeController();
    mocks.reposRepo.findByGithubRepoId.mockResolvedValueOnce({
      id: 'r1',
      deletedAt: new Date(),
    });

    await ctrl.handle(
      req({ action: 'added', repository: { id: 42 } }),
      'sig',
      'member',
      'd-5',
    );

    expect(mocks.pgBoss.send).not.toHaveBeenCalled();
  });
});

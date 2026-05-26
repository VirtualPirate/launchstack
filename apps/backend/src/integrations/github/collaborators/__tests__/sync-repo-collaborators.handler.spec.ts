import { SyncRepoCollaboratorsHandler } from '../handlers/sync-repo-collaborators.handler';

function makeMocks() {
  return {
    syncService: {
      syncRepo: jest.fn(async () => undefined),
    } as any,
  };
}

function makeHandler(overrides: Partial<ReturnType<typeof makeMocks>> = {}) {
  const m = { ...makeMocks(), ...overrides };
  return { handler: new SyncRepoCollaboratorsHandler(m.syncService), mocks: m };
}

const ctx = (data: {
  repositoryId: string;
  trigger: 'connected' | 'disconnected' | 'webhook' | 'manual';
}) =>
  ({
    id: 'job-1',
    data,
    attempts: 1,
    raw: {} as never,
  }) as any;

describe('SyncRepoCollaboratorsHandler', () => {
  it('delegates to the sync service with repositoryId and trigger', async () => {
    const { handler, mocks } = makeHandler();

    await handler.handle(ctx({ repositoryId: 'r1', trigger: 'webhook' }));

    expect(mocks.syncService.syncRepo).toHaveBeenCalledWith('r1', 'webhook');
  });

  it('propagates errors so pg-boss retries', async () => {
    const { handler, mocks } = makeHandler();
    mocks.syncService.syncRepo.mockRejectedValueOnce(new Error('boom'));

    await expect(
      handler.handle(ctx({ repositoryId: 'r1', trigger: 'connected' })),
    ).rejects.toThrow('boom');
  });
});

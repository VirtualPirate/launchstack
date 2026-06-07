import { BriefDispatcherBootstrap } from '../brief-dispatcher.bootstrap';

function makeBootstrap(opts: { role?: string; interval?: number | null }) {
  const pgBoss = { sendOnce: jest.fn().mockResolvedValue('boot-id') };
  const config = {
    get: jest.fn((key: string) =>
      key === 'WORKER_ROLE' ? opts.role : undefined,
    ),
  };
  const briefsConfig =
    opts.interval === null
      ? null
      : { dispatcherIntervalSeconds: opts.interval };
  const bootstrap = new BriefDispatcherBootstrap(
    pgBoss as any,
    config as any,
    briefsConfig as any,
  );
  return { bootstrap, pgBoss };
}

describe('BriefDispatcherBootstrap', () => {
  it('enqueues the boot tick throttled by the configured interval', async () => {
    const { bootstrap, pgBoss } = makeBootstrap({ role: 'both', interval: 30 });
    await bootstrap.onModuleInit();
    expect(pgBoss.sendOnce).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'briefs.dispatch-due' }),
      {},
      'briefs.dispatch-due-bootstrap',
      { singletonSeconds: 30 },
    );
  });

  it('falls back to a 60s throttle when briefs config is absent', async () => {
    const { bootstrap, pgBoss } = makeBootstrap({
      role: 'worker',
      interval: null,
    });
    await bootstrap.onModuleInit();
    expect(pgBoss.sendOnce).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'briefs.dispatch-due-bootstrap',
      { singletonSeconds: 60 },
    );
  });

  it('does not enqueue when WORKER_ROLE is api-only', async () => {
    const { bootstrap, pgBoss } = makeBootstrap({ role: 'api', interval: 60 });
    await bootstrap.onModuleInit();
    expect(pgBoss.sendOnce).not.toHaveBeenCalled();
  });
});

import { Logger } from '@nestjs/common';
import {
  ScheduleAlreadyRunning,
  ScheduleOverlapPolicy,
} from '@temporalio/client';
import {
  SchedulesBootstrap,
  syncSchedules,
  type ScheduleDefinition,
} from './schedules.bootstrap';

const DEF: ScheduleDefinition = {
  id: 'noop-every-minute',
  workflowType: 'NoopWorkflow',
  spec: { intervals: [{ every: '60s' }] },
};

// Matches @temporalio/client's isGrpcServiceError shape plus the gRPC code.
function grpcError(code: number) {
  return Object.assign(new Error('rpc error'), {
    code,
    details: 'rpc error',
    metadata: {},
  });
}

function makeClient() {
  const handle = { update: jest.fn().mockResolvedValue(undefined) };
  return {
    handle,
    client: {
      schedule: {
        create: jest.fn().mockResolvedValue(undefined),
        getHandle: jest.fn(() => handle),
      },
      connection: {
        operatorService: {
          addSearchAttributes: jest.fn().mockResolvedValue(undefined),
        },
      },
    } as any,
  };
}

const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

describe('syncSchedules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates each schedule with overlap SKIP on the task queue', async () => {
    const { client } = makeClient();

    await syncSchedules(client, 'launchstack', [DEF], logger);

    expect(client.schedule.create).toHaveBeenCalledWith({
      scheduleId: DEF.id,
      spec: DEF.spec,
      action: {
        type: 'startWorkflow',
        workflowType: 'NoopWorkflow',
        taskQueue: 'launchstack',
      },
      policies: { overlap: ScheduleOverlapPolicy.SKIP },
    });
  });

  it('replaces the spec of a schedule that already exists', async () => {
    const { client, handle } = makeClient();
    client.schedule.create.mockRejectedValue(
      new ScheduleAlreadyRunning('exists', DEF.id),
    );

    await syncSchedules(client, 'launchstack', [DEF], logger);

    expect(client.schedule.getHandle).toHaveBeenCalledWith(DEF.id);
    const updater = handle.update.mock.calls[0][0];
    const previous = { spec: { calendars: [] }, state: { paused: false } };
    expect(updater(previous)).toEqual({ ...previous, spec: DEF.spec });
  });

  it('logs a failed create and carries on with the next schedule', async () => {
    const { client } = makeClient();
    client.schedule.create
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(
      syncSchedules(
        client,
        'launchstack',
        [DEF, { ...DEF, id: 'second' }],
        logger,
      ),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(client.schedule.create).toHaveBeenCalledTimes(2);
  });
});

describe('SchedulesBootstrap', () => {
  const cfg = {
    address: 'x',
    namespace: 'default',
    taskQueue: 'launchstack',
    maxConcurrentActivities: 20,
    maxConcurrentWorkflowTasks: 20,
  };
  const config = (value?: string) =>
    ({
      get: (key: string) =>
        key === 'TEMPORAL_MANAGE_SCHEDULES' ? value : undefined,
    }) as any;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('registers the OrganizationId search attribute by default', async () => {
    const { client } = makeClient();

    await new SchedulesBootstrap(client, cfg, config()).onModuleInit();

    expect(
      client.connection.operatorService.addSearchAttributes,
    ).toHaveBeenCalledWith({
      namespace: 'default',
      searchAttributes: { OrganizationId: 2 },
    });
  });

  it('treats ALREADY_EXISTS as success', async () => {
    const { client } = makeClient();
    client.connection.operatorService.addSearchAttributes.mockRejectedValue(
      grpcError(6),
    );

    await new SchedulesBootstrap(client, cfg, config()).onModuleInit();

    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('never throws when registration fails', async () => {
    const { client } = makeClient();
    client.connection.operatorService.addSearchAttributes.mockRejectedValue(
      grpcError(14),
    );

    await expect(
      new SchedulesBootstrap(client, cfg, config()).onModuleInit(),
    ).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('does nothing when TEMPORAL_MANAGE_SCHEDULES is false', async () => {
    const { client } = makeClient();

    await new SchedulesBootstrap(client, cfg, config('false')).onModuleInit();

    expect(
      client.connection.operatorService.addSearchAttributes,
    ).not.toHaveBeenCalled();
    expect(client.schedule.create).not.toHaveBeenCalled();
  });
});

import { DispatchDueBriefsHandler } from '../handlers/dispatch-due-briefs.handler';
import { CadenceService } from '../../schedules/services/cadence.service';

function makeHandler() {
  const cadence = new CadenceService();
  const schedules = {
    findDueForUpdate: jest.fn(),
    update: jest.fn(),
  };
  const briefs = { create: jest.fn() };
  const pgBoss = {
    send: jest.fn().mockResolvedValue('job-id'),
    sendAfter: jest.fn().mockResolvedValue('next-tick'),
  };
  const db = {
    transaction: jest.fn(async (fn: any) => fn({})),
  };
  const config = { dispatcherIntervalSeconds: 60 };
  const handler = new DispatchDueBriefsHandler(
    schedules as any,
    briefs as any,
    cadence,
    pgBoss as any,
    db as any,
    config as any,
  );
  return { handler, schedules, briefs, pgBoss };
}

const dueRow = {
  id: 'sch1',
  organizationId: 'o1',
  name: 'X',
  cadenceType: 'daily' as const,
  cadenceTime: '16:00',
  cadenceDayOfWeek: null,
  cadenceDayOfMonth: null,
  timezone: 'UTC',
  scopeType: 'project' as const,
  scopeProjectId: 'p1',
  scopeTeamId: null,
  scopeCollaboratorId: null,
  scopeRepositoryId: null,
  paused: false,
  nextRunAt: new Date('2026-05-26T16:00:00Z'),
  lastSentAt: null,
  emailRecipients: [],
  slackInstallationId: null,
  slackChannelId: null,
  createdByMemberId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('DispatchDueBriefsHandler.handle', () => {
  it('re-enqueues itself first, then processes due schedules', async () => {
    const { handler, schedules, briefs, pgBoss } = makeHandler();
    schedules.findDueForUpdate.mockResolvedValue([dueRow]);
    briefs.create.mockResolvedValue({ id: 'b-new' });
    await handler.handle({
      id: 'tick-1',
      data: {},
      attempts: 1,
      raw: {} as any,
    });

    expect(pgBoss.sendAfter).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'briefs.dispatch-due' }),
      {},
      60,
      expect.objectContaining({
        singletonKey: 'briefs.dispatch-due',
        singletonSeconds: 60,
      }),
    );
    expect(pgBoss.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'briefs.generate' }),
      { briefId: 'b-new' },
    );
    expect(schedules.update).toHaveBeenCalledWith(
      'sch1',
      expect.objectContaining({ nextRunAt: expect.any(Date) }),
      expect.anything(),
    );
  });

  it('handles a tick with no due schedules cleanly', async () => {
    const { handler, schedules, pgBoss } = makeHandler();
    schedules.findDueForUpdate.mockResolvedValue([]);
    await handler.handle({
      id: 'tick-1',
      data: {},
      attempts: 1,
      raw: {} as any,
    });
    expect(pgBoss.sendAfter).toHaveBeenCalled();
    expect(pgBoss.send).not.toHaveBeenCalled();
  });
});

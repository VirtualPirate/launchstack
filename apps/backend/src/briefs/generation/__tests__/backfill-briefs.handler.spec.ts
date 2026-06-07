import { BackfillBriefsHandler } from '../handlers/backfill-briefs.handler';
import { CadenceService } from '../../schedules/services/cadence.service';

const baseSchedule = {
  id: 'sch1',
  organizationId: 'o1',
  name: 'Daily',
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
  nextRunAt: new Date('2026-06-06T16:00:00Z'),
  lastSentAt: null,
  emailRecipients: [],
  slackInstallationId: null,
  slackChannelId: null,
  createdByMemberId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function makeHandler(overrides?: { backfillMaxBriefs?: number; config?: any }) {
  const schedules = { findById: jest.fn().mockResolvedValue(baseSchedule) };
  const briefs = {
    findPeriodStartsForSchedule: jest.fn().mockResolvedValue(new Set<number>()),
    create: jest.fn().mockImplementation(async (i: any) => ({
      id: `b-${i.periodStart.getTime()}`,
    })),
  };
  const commits = {
    findCommitTimestampsForScope: jest.fn().mockResolvedValue([]),
  };
  const scopeResolver = {
    resolve: jest
      .fn()
      .mockResolvedValue({ repositoryIds: ['r1'], scopeLabel: 'Project: P' }),
  };
  const cadence = new CadenceService();
  const pgBoss = { send: jest.fn().mockResolvedValue('job-id') };
  const config =
    overrides?.config === null
      ? null
      : { backfillMaxBriefs: overrides?.backfillMaxBriefs ?? 366 };
  const handler = new BackfillBriefsHandler(
    schedules as any,
    briefs as any,
    commits as any,
    scopeResolver as any,
    cadence,
    pgBoss as any,
    config as any,
  );
  return { handler, schedules, briefs, commits, scopeResolver, pgBoss };
}

function run(handler: BackfillBriefsHandler) {
  return handler.handle({
    id: 'bf-1',
    data: { scheduleId: 'sch1' },
    attempts: 1,
    raw: {} as any,
  });
}

// Helper: point the handler's commits mock at a set of timestamps.
function handlerCommits(handler: BackfillBriefsHandler, dates: Date[]) {
  const commits = (handler as any).commits;
  commits.findCommitTimestampsForScope.mockResolvedValue(dates);
}

describe('BackfillBriefsHandler.handle', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-06T10:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a brief + suppressed generate job per commit-bearing day', async () => {
    const { handler, briefs, pgBoss } = makeHandler();
    // firstLivePeriod for nextRunAt 2026-06-06T16:00 (daily) = 2026-06-05 day,
    // so upperExclusive = 2026-06-05T00:00Z. These two days are strictly before it.
    handlerCommits(handler, [
      new Date('2026-06-03T09:00:00Z'),
      new Date('2026-06-04T20:00:00Z'),
    ]);
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(2);
    expect(briefs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'o1',
        briefScheduleId: 'sch1',
        scopeType: 'project',
        scopeProjectId: 'p1',
        status: 'pending',
      }),
    );
    expect(pgBoss.send).toHaveBeenCalledTimes(2);
    expect(pgBoss.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'briefs.generate' }),
      expect.objectContaining({ deliver: false }),
    );
  });

  it('does nothing when there are no commits in the year', async () => {
    const { handler, briefs, pgBoss } = makeHandler();
    await run(handler); // commits default to []
    expect(briefs.create).not.toHaveBeenCalled();
    expect(pgBoss.send).not.toHaveBeenCalled();
  });

  it('skips windows that already have a brief', async () => {
    const { handler, briefs, pgBoss } = makeHandler();
    const day = new Date('2026-06-04T20:00:00Z');
    handlerCommits(handler, [day]);
    briefs.findPeriodStartsForSchedule.mockResolvedValue(
      new Set<number>([new Date('2026-06-04T00:00:00Z').getTime()]),
    );
    await run(handler);
    expect(briefs.create).not.toHaveBeenCalled();
    expect(pgBoss.send).not.toHaveBeenCalled();
  });

  it('excludes the period the first live run will generate (no overlap)', async () => {
    const { handler, briefs } = makeHandler();
    // 2026-06-05 falls in firstLivePeriod (>= upperExclusive) → excluded.
    handlerCommits(handler, [new Date('2026-06-05T12:00:00Z')]);
    await run(handler);
    expect(briefs.create).not.toHaveBeenCalled();
  });

  it('caps the number of briefs and still creates only up to the cap', async () => {
    const { handler, briefs } = makeHandler({ backfillMaxBriefs: 1 });
    handlerCommits(handler, [
      new Date('2026-06-02T09:00:00Z'),
      new Date('2026-06-03T09:00:00Z'),
      new Date('2026-06-04T09:00:00Z'),
    ]);
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when generation is not configured (config null)', async () => {
    const { handler, briefs, commits } = makeHandler({ config: null });
    await run(handler);
    expect(commits.findCommitTimestampsForScope).not.toHaveBeenCalled();
    expect(briefs.create).not.toHaveBeenCalled();
  });

  it('is a no-op when the scope was deleted', async () => {
    const { handler, scopeResolver, briefs } = makeHandler();
    scopeResolver.resolve.mockRejectedValue(
      new Error('SCOPE_DELETED: project missing'),
    );
    await expect(run(handler)).resolves.toBeUndefined();
    expect(briefs.create).not.toHaveBeenCalled();
  });
});

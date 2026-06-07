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

function makeHandler(overrides?: {
  backfillMaxBriefs?: number;
  config?: any;
  oldest?: Date | null;
}) {
  const schedules = { findById: jest.fn().mockResolvedValue(baseSchedule) };
  const briefs = {
    findPeriodStartsForSchedule: jest.fn().mockResolvedValue(new Set<number>()),
    create: jest.fn().mockImplementation(async (i: any) => ({
      id: `b-${i.periodStart.getTime()}`,
    })),
  };
  // Default oldest commit: 2026-06-01T09:00Z (5 days before the fake "now").
  const oldest =
    overrides && 'oldest' in overrides
      ? overrides.oldest
      : new Date('2026-06-01T09:00:00Z');
  const commits = {
    findOldestCommitTimestampForScope: jest.fn().mockResolvedValue(oldest),
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

describe('BackfillBriefsHandler.handle', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-06T10:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('backfills every day from the oldest commit window forward, including no-activity days', async () => {
    // Fake now: 2026-06-06T10:00Z. Oldest commit: 2026-06-01T09:00Z.
    // windowContaining(oldest) for daily = 2026-06-01 day → rangeStart = 2026-06-01T00:00Z.
    // firstLivePeriod for nextRunAt 2026-06-06T16:00 (daily) = 2026-06-05 day.
    // upperExclusive = 2026-06-05T00:00Z.
    // windows: 2026-06-01, 06-02, 06-03, 06-04 = 4 days (every day, regardless of commits).
    const { handler, briefs, pgBoss } = makeHandler();
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(4);
    expect(pgBoss.send).toHaveBeenCalledTimes(4);
    expect(briefs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'o1',
        briefScheduleId: 'sch1',
        scopeType: 'project',
        scopeProjectId: 'p1',
        status: 'pending',
      }),
    );
    // A day with no commits in the span is still created (e.g. 2026-06-02).
    expect(briefs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2026-06-02T00:00:00Z'),
      }),
    );
    expect(pgBoss.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'briefs.generate' }),
      expect.objectContaining({ deliver: false }),
    );
  });

  it('queries the oldest commit with a one-year floor and the resolved scope', async () => {
    const { handler, commits } = makeHandler();
    await run(handler);
    expect(commits.findOldestCommitTimestampForScope).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryIds: ['r1'],
        since: new Date('2025-06-06T10:00:00Z'), // subYears(now, 1)
      }),
    );
  });

  it('is a no-op when there are no commits in the last year', async () => {
    const { handler, briefs, pgBoss } = makeHandler({ oldest: null });
    await run(handler);
    expect(briefs.create).not.toHaveBeenCalled();
    expect(pgBoss.send).not.toHaveBeenCalled();
  });

  it('skips windows that already have a brief', async () => {
    // 4 windows (06-01..06-04); mark 06-04 existing → 3 creates, none for 06-04.
    const { handler, briefs } = makeHandler();
    briefs.findPeriodStartsForSchedule.mockResolvedValue(
      new Set<number>([new Date('2026-06-04T00:00:00Z').getTime()]),
    );
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(3);
    expect(briefs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2026-06-04T00:00:00Z'),
      }),
    );
  });

  it('excludes the period the first live run will generate (no overlap)', async () => {
    // upperExclusive = 2026-06-05T00:00Z → that period must NOT be backfilled.
    const { handler, briefs } = makeHandler();
    await run(handler);
    expect(briefs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2026-06-05T00:00:00Z'),
      }),
    );
  });

  it('caps the number of briefs to backfillMaxBriefs, keeping the most recent', async () => {
    // Oldest commit ~a year back → ~360 windows; cap = 3 → only 3 created.
    const { handler, briefs } = makeHandler({
      backfillMaxBriefs: 3,
      oldest: new Date('2025-06-10T09:00:00Z'),
    });
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(3);
  });

  it('is a no-op when generation is not configured (config null)', async () => {
    const { handler, briefs, commits } = makeHandler({ config: null });
    await run(handler);
    expect(commits.findOldestCommitTimestampForScope).not.toHaveBeenCalled();
    expect(briefs.create).not.toHaveBeenCalled();
  });

  it('is a no-op when the schedule no longer exists', async () => {
    const { handler, schedules, briefs } = makeHandler();
    schedules.findById.mockResolvedValue(null);
    await run(handler);
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

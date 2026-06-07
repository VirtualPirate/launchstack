import { subDays, subWeeks } from 'date-fns';
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
  newest?: Date | null;
  schedule?: any;
}) {
  const schedule =
    overrides && 'schedule' in overrides ? overrides.schedule : baseSchedule;
  const schedules = { findById: jest.fn().mockResolvedValue(schedule) };
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
  // Default newest commit: 2026-06-04T09:00Z — so the active span (oldest →
  // newest window) reaches the day before the first live period.
  const newest =
    overrides && 'newest' in overrides
      ? overrides.newest
      : new Date('2026-06-04T09:00:00Z');
  const commits = {
    findOldestCommitTimestampForScope: jest.fn().mockResolvedValue(oldest),
    findNewestCommitTimestampForScope: jest.fn().mockResolvedValue(newest),
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

  it('backfills every window across the active span (oldest → newest), including in-span no-activity days', async () => {
    // Fake now: 2026-06-06T10:00Z. Oldest commit 2026-06-01, newest 2026-06-03.
    // rangeStart = 2026-06-01. Active span stops after the newest commit's
    // window (06-03), i.e. upperExclusive = 2026-06-04T00:00Z.
    // windows: 2026-06-01, 06-02, 06-03 = 3 days (06-02 has no commits but is
    // inside the span, so it is still created).
    const { handler, briefs, pgBoss } = makeHandler({
      newest: new Date('2026-06-03T09:00:00Z'),
    });
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(3);
    expect(pgBoss.send).toHaveBeenCalledTimes(3);
    expect(briefs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'o1',
        briefScheduleId: 'sch1',
        scopeType: 'project',
        scopeProjectId: 'p1',
        status: 'pending',
      }),
    );
    // A day with no commits inside the span is still created (2026-06-02).
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

  it('does not backfill the trailing inactivity after the newest commit', async () => {
    // Oldest 2026-06-01, newest 2026-06-02. Days 06-03 / 06-04 are after the
    // last commit and must NOT be backfilled, even though they precede the
    // first live period (06-05).
    const { handler, briefs } = makeHandler({
      oldest: new Date('2026-06-01T09:00:00Z'),
      newest: new Date('2026-06-02T09:00:00Z'),
    });
    await run(handler);
    expect(briefs.create).toHaveBeenCalledTimes(2);
    expect(briefs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2026-06-03T00:00:00Z'),
      }),
    );
    expect(briefs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2026-06-04T00:00:00Z'),
      }),
    );
  });

  it('backfills a repo whose latest activity is older than one year (lookback is not capped at 1 year)', async () => {
    // Regression: a weekly schedule on a repo whose newest commit is ~15
    // months old. The old 1-year floor (subYears(now, 1)) excluded all of it,
    // so backfill produced nothing. The cadence-aware floor reaches back far
    // enough, and the active span covers the weeks that actually have commits.
    const weekly = {
      ...baseSchedule,
      cadenceType: 'weekly' as const,
      cadenceTime: '09:00',
      cadenceDayOfWeek: 2,
      cadenceDayOfMonth: null,
      nextRunAt: new Date('2026-06-09T03:30:00Z'),
    };
    const { handler, briefs, commits } = makeHandler({
      schedule: weekly,
      oldest: new Date('2025-01-06T09:00:00Z'), // Mon 6 Jan 2025
      newest: new Date('2025-02-24T09:00:00Z'), // Mon 24 Feb 2025
    });
    await run(handler);

    // Lookback floor reaches well past one year ago (subWeeks(now, 366)).
    const now = new Date('2026-06-06T10:00:00Z');
    expect(commits.findOldestCommitTimestampForScope).toHaveBeenCalledWith(
      expect.objectContaining({ since: subWeeks(now, 366) }),
    );
    // 8 ISO weeks span Mon 6 Jan → Mon 24 Feb 2025 inclusive.
    expect(briefs.create).toHaveBeenCalledTimes(8);
    expect(briefs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2025-01-06T00:00:00Z'),
      }),
    );
    // Nothing after the newest commit's week.
    expect(briefs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: new Date('2025-03-03T00:00:00Z'),
      }),
    );
  });

  it('queries oldest and newest commit with a cadence-aware lookback floor and the resolved scope', async () => {
    const { handler, commits } = makeHandler();
    await run(handler);
    const now = new Date('2026-06-06T10:00:00Z');
    // Daily cadence, cap 366 → floor is subDays(now, 366) (not subYears(now, 1)).
    expect(commits.findOldestCommitTimestampForScope).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryIds: ['r1'],
        since: subDays(now, 366),
      }),
    );
    expect(commits.findNewestCommitTimestampForScope).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryIds: ['r1'],
        since: subDays(now, 366),
      }),
    );
  });

  it('is a no-op when there are no commits in the lookback window', async () => {
    const { handler, briefs, pgBoss, commits } = makeHandler({ oldest: null });
    await run(handler);
    expect(briefs.create).not.toHaveBeenCalled();
    expect(pgBoss.send).not.toHaveBeenCalled();
    // We short-circuit before even asking for the newest commit.
    expect(commits.findNewestCommitTimestampForScope).not.toHaveBeenCalled();
  });

  it('skips windows that already have a brief', async () => {
    // Default span 06-01..06-04 (4 windows); mark 06-04 existing → 3 creates.
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
    // firstLivePeriod = 2026-06-05; that period must NOT be backfilled.
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

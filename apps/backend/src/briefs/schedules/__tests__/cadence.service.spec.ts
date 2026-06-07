import { CadenceService } from '../services/cadence.service';

const svc = new CadenceService();

describe('CadenceService.computeNextRunAt', () => {
  it('daily — same time tomorrow when current time has passed', () => {
    const next = svc.computeNextRunAt(
      { cadenceType: 'daily', cadenceTime: '16:00', timezone: 'UTC' },
      new Date('2026-05-26T16:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-27T16:00:00.000Z');
  });

  it('daily — handles non-UTC timezone', () => {
    // 09:00 America/New_York = 13:00 UTC (EDT, summer)
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'daily',
        cadenceTime: '09:00',
        timezone: 'America/New_York',
      },
      new Date('2026-05-26T09:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-26T13:00:00.000Z');
  });

  it('weekly — next occurrence of dayOfWeek', () => {
    // 2026-05-26 is a Tuesday (dayOfWeek = 2). Friday = 5.
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'weekly',
        cadenceTime: '12:00',
        cadenceDayOfWeek: 5,
        timezone: 'UTC',
      },
      new Date('2026-05-26T12:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-29T12:00:00.000Z');
  });

  it('weekly — same day later this week if time has not passed', () => {
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'weekly',
        cadenceTime: '18:00',
        cadenceDayOfWeek: 2,
        timezone: 'UTC',
      },
      new Date('2026-05-26T09:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-26T18:00:00.000Z');
  });

  it('monthly — next occurrence of dayOfMonth', () => {
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'monthly',
        cadenceTime: '08:00',
        cadenceDayOfMonth: 1,
        timezone: 'UTC',
      },
      new Date('2026-05-26T00:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-06-01T08:00:00.000Z');
  });

  it('monthly — clamps day 31 to end of February', () => {
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'monthly',
        cadenceTime: '00:00',
        cadenceDayOfMonth: 31,
        timezone: 'UTC',
      },
      new Date('2027-01-31T01:00:00Z'),
    );
    expect(next.toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });

  it('monthly — clamps day 31 to Feb 29 in a leap year', () => {
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'monthly',
        cadenceTime: '00:00',
        cadenceDayOfMonth: 31,
        timezone: 'UTC',
      },
      new Date('2028-01-31T01:00:00Z'),
    );
    expect(next.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('DST spring-forward in America/New_York rounds forward', () => {
    // 2026 DST in US starts on Sunday 2026-03-08; clocks jump 02:00 → 03:00 local.
    const next = svc.computeNextRunAt(
      {
        cadenceType: 'daily',
        cadenceTime: '02:30',
        timezone: 'America/New_York',
      },
      new Date('2026-03-07T07:30:00Z'),
    );
    expect(next.toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });
});

describe('CadenceService.computePeriod', () => {
  it('daily — previous full local day', () => {
    const period = svc.computePeriod(
      { cadenceType: 'daily', cadenceTime: '16:00', timezone: 'UTC' },
      new Date('2026-05-26T16:00:00Z'),
    );
    expect(period.start.toISOString()).toBe('2026-05-25T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-05-25T23:59:59.999Z');
  });

  it('weekly — previous Monday through Sunday in tz', () => {
    const period = svc.computePeriod(
      {
        cadenceType: 'weekly',
        cadenceTime: '09:00',
        cadenceDayOfWeek: 1,
        timezone: 'UTC',
      },
      new Date('2026-06-01T09:00:00Z'),
    );
    expect(period.start.toISOString()).toBe('2026-05-25T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-05-31T23:59:59.999Z');
  });

  it('monthly — previous calendar month', () => {
    const period = svc.computePeriod(
      {
        cadenceType: 'monthly',
        cadenceTime: '08:00',
        cadenceDayOfMonth: 1,
        timezone: 'UTC',
      },
      new Date('2026-06-01T08:00:00Z'),
    );
    expect(period.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-05-31T23:59:59.999Z');
  });
});

describe('CadenceService.windowContaining', () => {
  it('daily — returns the calendar day containing the instant (UTC)', () => {
    const w = svc.windowContaining(
      { cadenceType: 'daily', cadenceTime: '00:00', timezone: 'UTC' },
      new Date('2026-05-20T13:45:00Z'),
    );
    expect(w.start.toISOString()).toBe('2026-05-20T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-05-20T23:59:59.999Z');
  });

  it('weekly — returns the Mon–Sun week containing the instant', () => {
    // 2026-05-20 is a Wednesday; that ISO week is Mon 2026-05-18 .. Sun 2026-05-24.
    const w = svc.windowContaining(
      {
        cadenceType: 'weekly',
        cadenceTime: '00:00',
        cadenceDayOfWeek: 1,
        timezone: 'UTC',
      },
      new Date('2026-05-20T13:45:00Z'),
    );
    expect(w.start.toISOString()).toBe('2026-05-18T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-05-24T23:59:59.999Z');
  });

  it('weekly — Sunday belongs to the week that started the previous Monday', () => {
    const w = svc.windowContaining(
      {
        cadenceType: 'weekly',
        cadenceTime: '00:00',
        cadenceDayOfWeek: 1,
        timezone: 'UTC',
      },
      new Date('2026-05-24T10:00:00Z'), // Sunday
    );
    expect(w.start.toISOString()).toBe('2026-05-18T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-05-24T23:59:59.999Z');
  });

  it('monthly — returns the calendar month containing the instant', () => {
    const w = svc.windowContaining(
      {
        cadenceType: 'monthly',
        cadenceTime: '00:00',
        cadenceDayOfMonth: 1,
        timezone: 'UTC',
      },
      new Date('2026-02-15T12:00:00Z'),
    );
    expect(w.start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });

  it('daily — respects timezone boundaries', () => {
    // 2026-05-20T02:00Z is still 2026-05-19 (22:00) in America/New_York.
    const w = svc.windowContaining(
      {
        cadenceType: 'daily',
        cadenceTime: '00:00',
        timezone: 'America/New_York',
      },
      new Date('2026-05-20T02:00:00Z'),
    );
    // Local day 2026-05-19 00:00 EDT = 2026-05-19T04:00Z.
    expect(w.start.toISOString()).toBe('2026-05-19T04:00:00.000Z');
  });
});

describe('CadenceService.windowsInRange', () => {
  it('daily — returns one window per calendar day in range', () => {
    const windows = svc.windowsInRange(
      { cadenceType: 'daily', cadenceTime: '00:00', timezone: 'UTC' },
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-04T00:00:00Z'), // exclusive
    );
    expect(windows).toHaveLength(3);
    expect(windows[0].start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(windows[0].end.toISOString()).toBe('2026-06-01T23:59:59.999Z');
    expect(windows[2].start.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it('weekly — returns one window per ISO week in range', () => {
    // 2026-06-01 is a Monday, so week = Mon 2026-06-01 – Sun 2026-06-07.
    // rangeEnd = 2026-06-08 (the next Monday) is exclusive → 1 week returned.
    const windows = svc.windowsInRange(
      {
        cadenceType: 'weekly',
        cadenceTime: '00:00',
        cadenceDayOfWeek: 1,
        timezone: 'UTC',
      },
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-08T00:00:00Z'),
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(windows[0].end.toISOString()).toBe('2026-06-07T23:59:59.999Z');
  });

  it('weekly — includes multiple weeks when range spans them', () => {
    const windows = svc.windowsInRange(
      {
        cadenceType: 'weekly',
        cadenceTime: '00:00',
        cadenceDayOfWeek: 1,
        timezone: 'UTC',
      },
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-15T00:00:00Z'),
    );
    expect(windows).toHaveLength(2);
    expect(windows[0].start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(windows[1].start.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('monthly — returns one window per calendar month in range', () => {
    const windows = svc.windowsInRange(
      {
        cadenceType: 'monthly',
        cadenceTime: '00:00',
        cadenceDayOfMonth: 1,
        timezone: 'UTC',
      },
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-07-01T00:00:00Z'), // exclusive
    );
    expect(windows).toHaveLength(3);
    expect(windows[0].start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(windows[1].start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(windows[2].start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('returns empty array when rangeEnd <= rangeStart', () => {
    const windows = svc.windowsInRange(
      { cadenceType: 'daily', cadenceTime: '00:00', timezone: 'UTC' },
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'), // equal → empty
    );
    expect(windows).toHaveLength(0);
  });

  it('rangeStart mid-window still includes that window', () => {
    // rangeStart is 12:00 on June 1; the containing window starts at 00:00 June 1,
    // which is < rangeEnd (June 3 00:00). Both June 1 and June 2 are included.
    const windows = svc.windowsInRange(
      { cadenceType: 'daily', cadenceTime: '00:00', timezone: 'UTC' },
      new Date('2026-06-01T12:00:00Z'),
      new Date('2026-06-03T00:00:00Z'),
    );
    expect(windows).toHaveLength(2);
    expect(windows[0].start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(windows[1].start.toISOString()).toBe('2026-06-02T00:00:00.000Z');
  });
});

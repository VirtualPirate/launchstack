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
      { cadenceType: 'daily', cadenceTime: '09:00', timezone: 'America/New_York' },
      new Date('2026-05-26T09:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-26T13:00:00.000Z');
  });

  it('weekly — next occurrence of dayOfWeek', () => {
    // 2026-05-26 is a Tuesday (dayOfWeek = 2). Friday = 5.
    const next = svc.computeNextRunAt(
      { cadenceType: 'weekly', cadenceTime: '12:00', cadenceDayOfWeek: 5, timezone: 'UTC' },
      new Date('2026-05-26T12:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-29T12:00:00.000Z');
  });

  it('weekly — same day later this week if time has not passed', () => {
    const next = svc.computeNextRunAt(
      { cadenceType: 'weekly', cadenceTime: '18:00', cadenceDayOfWeek: 2, timezone: 'UTC' },
      new Date('2026-05-26T09:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-05-26T18:00:00.000Z');
  });

  it('monthly — next occurrence of dayOfMonth', () => {
    const next = svc.computeNextRunAt(
      { cadenceType: 'monthly', cadenceTime: '08:00', cadenceDayOfMonth: 1, timezone: 'UTC' },
      new Date('2026-05-26T00:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-06-01T08:00:00.000Z');
  });

  it('monthly — clamps day 31 to end of February', () => {
    const next = svc.computeNextRunAt(
      { cadenceType: 'monthly', cadenceTime: '00:00', cadenceDayOfMonth: 31, timezone: 'UTC' },
      new Date('2027-01-31T01:00:00Z'),
    );
    expect(next.toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });

  it('monthly — clamps day 31 to Feb 29 in a leap year', () => {
    const next = svc.computeNextRunAt(
      { cadenceType: 'monthly', cadenceTime: '00:00', cadenceDayOfMonth: 31, timezone: 'UTC' },
      new Date('2028-01-31T01:00:00Z'),
    );
    expect(next.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('DST spring-forward in America/New_York rounds forward', () => {
    // 2026 DST in US starts on Sunday 2026-03-08; clocks jump 02:00 → 03:00 local.
    const next = svc.computeNextRunAt(
      { cadenceType: 'daily', cadenceTime: '02:30', timezone: 'America/New_York' },
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
      { cadenceType: 'weekly', cadenceTime: '09:00', cadenceDayOfWeek: 1, timezone: 'UTC' },
      new Date('2026-06-01T09:00:00Z'),
    );
    expect(period.start.toISOString()).toBe('2026-05-25T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-05-31T23:59:59.999Z');
  });

  it('monthly — previous calendar month', () => {
    const period = svc.computePeriod(
      { cadenceType: 'monthly', cadenceTime: '08:00', cadenceDayOfMonth: 1, timezone: 'UTC' },
      new Date('2026-06-01T08:00:00Z'),
    );
    expect(period.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-05-31T23:59:59.999Z');
  });
});

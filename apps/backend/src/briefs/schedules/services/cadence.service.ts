import { Injectable } from '@nestjs/common';
import {
  addDays,
  addMonths,
  getDaysInMonth,
  lastDayOfMonth,
  setDate,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface CadenceScheduleLike {
  cadenceType: 'daily' | 'weekly' | 'monthly';
  cadenceTime: string;
  cadenceDayOfWeek?: number | null;
  cadenceDayOfMonth?: number | null;
  timezone: string;
}

export interface PeriodWindow {
  start: Date;
  end: Date;
}

@Injectable()
export class CadenceService {
  computeNextRunAt(schedule: CadenceScheduleLike, fromInstant: Date): Date {
    switch (schedule.cadenceType) {
      case 'daily':
        return this.computeDailyNext(schedule, fromInstant);
      case 'weekly':
        return this.computeWeeklyNext(schedule, fromInstant);
      case 'monthly':
        return this.computeMonthlyNext(schedule, fromInstant);
    }
  }

  computePeriod(schedule: CadenceScheduleLike, firingAt: Date): PeriodWindow {
    const tz = schedule.timezone;
    switch (schedule.cadenceType) {
      case 'daily': {
        const local = toZonedTime(firingAt, tz);
        const prev = addDays(local, -1);
        const startLocal = this.setLocalTime(prev, 0, 0, 0, 0);
        const endLocal = this.setLocalTime(prev, 23, 59, 59, 999);
        return {
          start: fromZonedTime(startLocal, tz),
          end: fromZonedTime(endLocal, tz),
        };
      }
      case 'weekly': {
        const local = toZonedTime(firingAt, tz);
        // ISO weekday: Mon = 1 ... Sun = 7. JS getDay: Sun = 0 ... Sat = 6.
        const jsDay = local.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        const thisWeekMonday = addDays(local, -(isoDay - 1));
        const lastWeekMonday = addDays(thisWeekMonday, -7);
        const lastWeekSunday = addDays(thisWeekMonday, -1);
        return {
          start: fromZonedTime(
            this.setLocalTime(lastWeekMonday, 0, 0, 0, 0),
            tz,
          ),
          end: fromZonedTime(
            this.setLocalTime(lastWeekSunday, 23, 59, 59, 999),
            tz,
          ),
        };
      }
      case 'monthly': {
        const local = toZonedTime(firingAt, tz);
        const prevMonthStart = startOfMonth(subMonths(local, 1));
        const prevMonthEnd = lastDayOfMonth(prevMonthStart);
        return {
          start: fromZonedTime(
            this.setLocalTime(prevMonthStart, 0, 0, 0, 0),
            tz,
          ),
          end: fromZonedTime(
            this.setLocalTime(prevMonthEnd, 23, 59, 59, 999),
            tz,
          ),
        };
      }
    }
  }

  /**
   * The aligned period window (day / Mon–Sun week / calendar month) that
   * CONTAINS the given instant — used for backfilling historical briefs.
   * Alignment mirrors computePeriod and is independent of cadenceTime /
   * cadenceDayOfWeek / cadenceDayOfMonth (those only affect firing time).
   */
  windowContaining(schedule: CadenceScheduleLike, instant: Date): PeriodWindow {
    const tz = schedule.timezone;
    const local = toZonedTime(instant, tz);
    switch (schedule.cadenceType) {
      case 'daily': {
        return {
          start: fromZonedTime(this.setLocalTime(local, 0, 0, 0, 0), tz),
          end: fromZonedTime(this.setLocalTime(local, 23, 59, 59, 999), tz),
        };
      }
      case 'weekly': {
        const jsDay = local.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        const monday = addDays(local, -(isoDay - 1));
        const sunday = addDays(monday, 6);
        return {
          start: fromZonedTime(this.setLocalTime(monday, 0, 0, 0, 0), tz),
          end: fromZonedTime(this.setLocalTime(sunday, 23, 59, 59, 999), tz),
        };
      }
      case 'monthly': {
        const monthStart = startOfMonth(local);
        const monthEnd = lastDayOfMonth(local);
        return {
          start: fromZonedTime(this.setLocalTime(monthStart, 0, 0, 0, 0), tz),
          end: fromZonedTime(this.setLocalTime(monthEnd, 23, 59, 59, 999), tz),
        };
      }
    }
  }

  /**
   * The earliest instant backfill should look back to when discovering a
   * schedule's commits — `maxWindows` cadence periods before `from`. This
   * bounds backfill to at most `maxWindows` windows for every cadence and
   * replaces a fixed one-year floor that silently skipped any repository
   * whose most recent activity predated the last calendar year.
   */
  backfillLookbackStart(
    schedule: Pick<CadenceScheduleLike, 'cadenceType'>,
    from: Date,
    maxWindows: number,
  ): Date {
    switch (schedule.cadenceType) {
      case 'daily':
        return subDays(from, maxWindows);
      case 'weekly':
        return subWeeks(from, maxWindows);
      case 'monthly':
        return subMonths(from, maxWindows);
    }
  }

  windowsInRange(
    schedule: CadenceScheduleLike,
    rangeStart: Date,
    rangeEnd: Date,
  ): PeriodWindow[] {
    const windows: PeriodWindow[] = [];
    if (rangeEnd.getTime() <= rangeStart.getTime()) return windows;
    let current = this.windowContaining(schedule, rangeStart);
    while (current.start.getTime() < rangeEnd.getTime()) {
      windows.push(current);
      current = this.windowContaining(
        schedule,
        new Date(current.end.getTime() + 1),
      );
    }
    return windows;
  }

  formatPeriodLabel(period: PeriodWindow, tz: string): string {
    const startStr = formatInTimeZone(period.start, tz, 'LLL d');
    const endStr = formatInTimeZone(period.end, tz, 'LLL d, yyyy');
    return `${startStr} – ${endStr}`;
  }

  private parseHhmm(time: string): { h: number; m: number } {
    const [h, m] = time.split(':').map(Number);
    return { h, m };
  }

  private setLocalTime(
    d: Date,
    h: number,
    m: number,
    s: number,
    ms: number,
  ): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s, ms);
  }

  private resolveLocalToUtc(local: Date, tz: string): Date {
    const candidate = fromZonedTime(local, tz);
    const back = toZonedTime(candidate, tz);
    // Detect DST spring-forward gap: back-converted local time differs from
    // the intent. date-fns-tz interprets gap times in the post-transition
    // offset, which yields a UTC instant that doesn't read back as the same
    // local time. Round the candidate up to the next full hour so that we
    // land at the first valid local time after the gap.
    const sameLocal =
      back.getFullYear() === local.getFullYear() &&
      back.getMonth() === local.getMonth() &&
      back.getDate() === local.getDate() &&
      back.getHours() === local.getHours() &&
      back.getMinutes() === local.getMinutes();
    if (sameLocal) return candidate;
    const HOUR_MS = 3_600_000;
    return new Date(Math.ceil(candidate.getTime() / HOUR_MS) * HOUR_MS);
  }

  private computeDailyNext(schedule: CadenceScheduleLike, from: Date): Date {
    const tz = schedule.timezone;
    const { h, m } = this.parseHhmm(schedule.cadenceTime);
    const localFrom = toZonedTime(from, tz);
    let candidateLocal = this.setLocalTime(localFrom, h, m, 0, 0);
    let candidateUtc = this.resolveLocalToUtc(candidateLocal, tz);
    if (candidateUtc.getTime() <= from.getTime()) {
      candidateLocal = this.setLocalTime(addDays(localFrom, 1), h, m, 0, 0);
      candidateUtc = this.resolveLocalToUtc(candidateLocal, tz);
    }
    return candidateUtc;
  }

  private computeWeeklyNext(schedule: CadenceScheduleLike, from: Date): Date {
    const tz = schedule.timezone;
    const { h, m } = this.parseHhmm(schedule.cadenceTime);
    const targetDow = schedule.cadenceDayOfWeek ?? 0;
    const localFrom = toZonedTime(from, tz);
    const currentDow = localFrom.getDay();
    const daysAhead = (targetDow - currentDow + 7) % 7;
    let candidateLocal = this.setLocalTime(
      addDays(localFrom, daysAhead),
      h,
      m,
      0,
      0,
    );
    let candidateUtc = this.resolveLocalToUtc(candidateLocal, tz);
    if (candidateUtc.getTime() <= from.getTime()) {
      candidateLocal = this.setLocalTime(
        addDays(localFrom, daysAhead + 7),
        h,
        m,
        0,
        0,
      );
      candidateUtc = this.resolveLocalToUtc(candidateLocal, tz);
    }
    return candidateUtc;
  }

  private computeMonthlyNext(schedule: CadenceScheduleLike, from: Date): Date {
    const tz = schedule.timezone;
    const { h, m } = this.parseHhmm(schedule.cadenceTime);
    const desiredDay = schedule.cadenceDayOfMonth ?? 1;
    const localFrom = toZonedTime(from, tz);

    const tryMonth = (monthAnchor: Date): Date => {
      const clampedDay = Math.min(desiredDay, getDaysInMonth(monthAnchor));
      const dayDate = setDate(monthAnchor, clampedDay);
      return this.resolveLocalToUtc(this.setLocalTime(dayDate, h, m, 0, 0), tz);
    };

    let candidate = tryMonth(localFrom);
    if (candidate.getTime() <= from.getTime()) {
      candidate = tryMonth(addMonths(localFrom, 1));
    }
    return candidate;
  }
}

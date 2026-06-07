import { Inject, Injectable, Logger } from '@nestjs/common';
import { subYears } from 'date-fns';
import { Handler, PgBossService, type JobContext } from '../../../queue';
import { BRIEFS_CONFIG_TOKEN } from '../../tokens';
import type { BriefsConfig } from '../../briefs-config';
import { CommitsRepository } from '../../../integrations/github/commit-analysis/repositories/commits.repository';
import { BriefSchedulesRepository } from '../../schedules/repositories/brief-schedules.repository';
import {
  CadenceService,
  type PeriodWindow,
} from '../../schedules/services/cadence.service';
import { BriefsRepository } from '../repositories/briefs.repository';
import {
  BriefScopeResolver,
  type BriefScope,
} from '../services/brief-scope.resolver';
import { BackfillBriefsJob } from '../jobs/backfill-briefs.job';
import { GenerateBriefJob } from '../jobs/generate-brief.job';
import type { BriefScheduleSelect } from '../../../databases/pg-drizzle/types';

@Injectable()
export class BackfillBriefsHandler {
  private readonly logger = new Logger(BackfillBriefsHandler.name);

  constructor(
    private readonly schedules: BriefSchedulesRepository,
    private readonly briefs: BriefsRepository,
    private readonly commits: CommitsRepository,
    private readonly scopeResolver: BriefScopeResolver,
    private readonly cadence: CadenceService,
    private readonly pgBoss: PgBossService,
    @Inject(BRIEFS_CONFIG_TOKEN) private readonly config: BriefsConfig | null,
  ) {}

  @Handler(BackfillBriefsJob)
  async handle({
    id,
    data,
  }: JobContext<typeof BackfillBriefsJob>): Promise<void> {
    if (!this.config) {
      this.logger.warn(
        `[backfill ${id}] briefs generation not configured; skipping`,
      );
      return;
    }

    const schedule = await this.schedules.findById(data.scheduleId);
    if (!schedule) {
      this.logger.warn(
        `[backfill ${id}] schedule ${data.scheduleId} not found; skipping`,
      );
      return;
    }

    let resolved;
    try {
      resolved = await this.scopeResolver.resolve({
        organizationId: schedule.organizationId,
        scope: this.scopeFromSchedule(schedule),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[backfill ${id}] schedule ${schedule.id} scope unresolved: ${message}`,
      );
      return;
    }

    const now = new Date();
    const rangeStart = subYears(now, 1);
    const firstLivePeriod = this.cadence.computePeriod(
      schedule,
      schedule.nextRunAt,
    );
    const upperExclusive = firstLivePeriod.start;

    const timestamps = await this.commits.findCommitTimestampsForScope({
      repositoryIds: resolved.repositoryIds,
      periodStart: rangeStart,
      periodEnd: upperExclusive,
      collaboratorGithubUserIds: resolved.authorFilter,
    });

    const windowsByStart = new Map<number, PeriodWindow>();
    for (const ts of timestamps) {
      const w = this.cadence.windowContaining(schedule, ts);
      const startMs = w.start.getTime();
      if (
        startMs >= rangeStart.getTime() &&
        startMs < upperExclusive.getTime()
      ) {
        windowsByStart.set(startMs, w);
      }
    }

    const existing = await this.briefs.findPeriodStartsForSchedule(
      schedule.id,
      rangeStart,
    );

    let windows = [...windowsByStart.values()]
      .filter((w) => !existing.has(w.start.getTime()))
      .sort((a, b) => b.start.getTime() - a.start.getTime());

    const cap = this.config.backfillMaxBriefs;
    if (windows.length > cap) {
      this.logger.warn(
        `[backfill ${id}] schedule ${schedule.id}: ${windows.length} windows exceed cap ${cap}; dropping ${windows.length - cap} oldest`,
      );
      windows = windows.slice(0, cap);
    }

    let created = 0;
    for (const w of windows) {
      try {
        const briefRow = await this.briefs.create({
          organizationId: schedule.organizationId,
          briefScheduleId: schedule.id,
          scopeType: schedule.scopeType,
          scopeProjectId: schedule.scopeProjectId,
          scopeTeamId: schedule.scopeTeamId,
          scopeCollaboratorId: schedule.scopeCollaboratorId,
          scopeRepositoryId: schedule.scopeRepositoryId,
          periodStart: w.start,
          periodEnd: w.end,
          status: 'pending',
        });
        await this.pgBoss.send(GenerateBriefJob, {
          briefId: briefRow.id,
          deliver: false,
        });
        created += 1;
      } catch (err) {
        this.logger.error(
          `[backfill ${id}] schedule ${schedule.id} window ${w.start.toISOString()} failed`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.log(
      `[backfill ${id}] schedule ${schedule.id} created=${created}`,
    );
  }

  private scopeFromSchedule(schedule: BriefScheduleSelect): BriefScope {
    if (schedule.scopeType === 'project')
      return { type: 'project', projectId: schedule.scopeProjectId! };
    if (schedule.scopeType === 'team')
      return { type: 'team', teamId: schedule.scopeTeamId! };
    if (schedule.scopeType === 'collaborator')
      return {
        type: 'collaborator',
        collaboratorId: schedule.scopeCollaboratorId!,
      };
    return { type: 'repository', repositoryId: schedule.scopeRepositoryId! };
  }
}

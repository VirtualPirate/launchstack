import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { Handler, PgBossService, type JobContext } from '../../../queue';
import { BRIEFS_CONFIG_TOKEN } from '../../tokens';
import type { BriefsConfig } from '../../briefs-config';
import { BriefSchedulesRepository } from '../../schedules/repositories/brief-schedules.repository';
import { CadenceService } from '../../schedules/services/cadence.service';
import { BriefsRepository } from '../repositories/briefs.repository';
import { DispatchDueBriefsJob } from '../jobs/dispatch-due-briefs.job';
import { GenerateBriefJob } from '../jobs/generate-brief.job';

type Db = PostgresJsDatabase<Record<string, unknown>>;

@Injectable()
export class DispatchDueBriefsHandler {
  private readonly logger = new Logger(DispatchDueBriefsHandler.name);

  constructor(
    private readonly schedules: BriefSchedulesRepository,
    private readonly briefs: BriefsRepository,
    private readonly cadence: CadenceService,
    private readonly pgBoss: PgBossService,
    @Inject(DRIZZLE_DB) private readonly db: Db,
    @Inject(BRIEFS_CONFIG_TOKEN) private readonly config: BriefsConfig,
  ) {}

  @Handler(DispatchDueBriefsJob)
  async handle({
    id,
  }: JobContext<typeof DispatchDueBriefsJob>): Promise<void> {
    const intervalSeconds = this.config?.dispatcherIntervalSeconds ?? 60;

    const bucket = Math.floor(Date.now() / 1000 / intervalSeconds) + 1;
    try {
      await this.pgBoss.sendAfter(DispatchDueBriefsJob, {}, intervalSeconds, {
        singletonKey: `briefs.dispatch-due:${bucket}`,
      });
    } catch (err) {
      this.logger.error(
        `[dispatch-due ${id}] failed to enqueue next tick`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    let processed = 0;
    try {
      await this.db.transaction(async (tx) => {
        const due = await this.schedules.findDueForUpdate(100, tx);
        for (const schedule of due) {
          try {
            const period = this.cadence.computePeriod(
              schedule,
              schedule.nextRunAt,
            );
            const nextRunAt = this.cadence.computeNextRunAt(
              schedule,
              schedule.nextRunAt,
            );

            const briefRow = await this.briefs.create(
              {
                organizationId: schedule.organizationId,
                briefScheduleId: schedule.id,
                scopeType: schedule.scopeType,
                scopeProjectId: schedule.scopeProjectId,
                scopeTeamId: schedule.scopeTeamId,
                scopeCollaboratorId: schedule.scopeCollaboratorId,
                scopeRepositoryId: schedule.scopeRepositoryId,
                periodStart: period.start,
                periodEnd: period.end,
                status: 'pending',
              },
              tx,
            );
            await this.schedules.update(schedule.id, { nextRunAt }, tx);
            await this.pgBoss.send(GenerateBriefJob, { briefId: briefRow.id });
            processed += 1;
          } catch (err) {
            this.logger.error(
              `[dispatch-due ${id}] schedule ${schedule.id} failed`,
              err instanceof Error ? err.stack : String(err),
            );
          }
        }
      });
    } catch (err) {
      this.logger.error(
        `[dispatch-due ${id}] outer transaction failed`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    this.logger.log(`[dispatch-due ${id}] processed=${processed}`);
  }
}

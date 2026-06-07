import { Injectable, Logger } from '@nestjs/common';
import { Handler, PgBossService, type JobContext } from '../../../../queue';
import { AnalyzeRepoJob } from '../jobs/analyze-repo.job';
import { ScanRepositoryJob } from '../jobs/scan-repository.job';
import { CommitBackfillService } from '../services/commit-backfill.service';

@Injectable()
export class ScanRepositoryHandler {
  private readonly logger = new Logger(ScanRepositoryHandler.name);

  constructor(
    private readonly backfill: CommitBackfillService,
    private readonly pgBoss: PgBossService,
  ) {}

  @Handler(ScanRepositoryJob)
  async handle({
    id,
    data,
  }: JobContext<typeof ScanRepositoryJob>): Promise<void> {
    const { inserted, sinceISO } = await this.backfill.runFromLatest({
      repositoryId: data.repositoryId,
      lookbackDays: data.lookbackDays,
    });

    if (sinceISO === null) {
      this.logger.log(
        `[scan-repository ${id}] repo=${data.repositoryId} empty repo — nothing to analyze`,
      );
      return;
    }

    await this.pgBoss.send(AnalyzeRepoJob, {
      repositoryId: data.repositoryId,
      sinceISO,
      force: false,
    });

    this.logger.log(
      `[scan-repository ${id}] repo=${data.repositoryId} inserted=${inserted} analyze dispatched since=${sinceISO}`,
    );
  }
}

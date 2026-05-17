import { Injectable, Logger } from '@nestjs/common';
import type { JobContext } from '../../../../queue';
import { Handler } from '../../../../queue';
import { BackfillCommitsJob } from '../jobs/backfill-commits.job';
import { CommitBackfillService } from '../services/commit-backfill.service';

@Injectable()
export class BackfillCommitsHandler {
  private readonly logger = new Logger(BackfillCommitsHandler.name);

  constructor(private readonly svc: CommitBackfillService) {}

  @Handler(BackfillCommitsJob)
  async handle({
    id,
    data,
  }: JobContext<typeof BackfillCommitsJob>): Promise<void> {
    const result = await this.svc.run({
      repositoryId: data.repositoryId,
      sinceISO: data.sinceISO,
    });
    this.logger.log(
      `[backfill-commits ${id}] repo=${data.repositoryId} inserted=${result.inserted}`,
    );
  }
}

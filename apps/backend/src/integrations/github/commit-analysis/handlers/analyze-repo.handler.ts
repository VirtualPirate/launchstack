import { Injectable, Logger } from '@nestjs/common';
import { Handler, PgBossService, type JobContext } from '../../../../queue';
import { AnalyzeCommitJob } from '../jobs/analyze-commit.job';
import { AnalyzeRepoJob } from '../jobs/analyze-repo.job';
import { CommitAnalysesRepository } from '../repositories/commit-analyses.repository';
import { CommitsRepository } from '../repositories/commits.repository';

@Injectable()
export class AnalyzeRepoHandler {
  private readonly logger = new Logger(AnalyzeRepoHandler.name);

  constructor(
    private readonly commits: CommitsRepository,
    private readonly analyses: CommitAnalysesRepository,
    private readonly pgBoss: PgBossService,
  ) {}

  @Handler(AnalyzeRepoJob)
  async handle({ id, data }: JobContext<typeof AnalyzeRepoJob>): Promise<void> {
    const allCommits = await this.commits.findByRepositorySince(
      data.repositoryId,
      data.sinceISO,
    );

    const mergeIds: string[] = [];
    const candidateIds: string[] = [];
    for (const c of allCommits) {
      if (c.parentCount > 1) mergeIds.push(c.id);
      else candidateIds.push(c.id);
    }

    for (const mergeId of mergeIds) {
      await this.analyses.upsertSkippedMerge(mergeId);
    }

    let toEnqueue = candidateIds;
    if (data.force) {
      await this.analyses.deleteForCommitIds(candidateIds);
    } else {
      const already =
        await this.analyses.findCommitIdsWithAnalysis(candidateIds);
      toEnqueue = candidateIds.filter((cid) => !already.has(cid));
    }

    for (const commitId of toEnqueue) {
      await this.pgBoss.send(AnalyzeCommitJob, { commitId });
    }

    this.logger.log(
      `[analyze-repo ${id}] repo=${data.repositoryId} merges=${mergeIds.length} candidates=${candidateIds.length} enqueued=${toEnqueue.length}`,
    );
  }
}

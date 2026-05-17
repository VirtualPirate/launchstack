import { Injectable, Logger } from '@nestjs/common';
import { Handler, type JobContext } from '../../../../queue';
import {
  GithubAppClient,
  type GithubCommitDetail,
} from '../../github-app.client';
import { GithubInstallationsRepository } from '../../repositories/installations.repository';
import { GithubRepositoriesRepository } from '../../repositories/repositories.repository';
import { AnalyzeCommitJob } from '../jobs/analyze-commit.job';
import { CommitAnalysesRepository } from '../repositories/commit-analyses.repository';
import { CommitsRepository } from '../repositories/commits.repository';
import { CommitAnalyzerService } from '../services/commit-analyzer.service';

@Injectable()
export class AnalyzeCommitHandler {
  private readonly logger = new Logger(AnalyzeCommitHandler.name);

  constructor(
    private readonly commits: CommitsRepository,
    private readonly repos: GithubRepositoriesRepository,
    private readonly installs: GithubInstallationsRepository,
    private readonly analyses: CommitAnalysesRepository,
    private readonly client: GithubAppClient,
    private readonly analyzer: CommitAnalyzerService,
  ) {}

  @Handler(AnalyzeCommitJob)
  async handle({
    id,
    data,
  }: JobContext<typeof AnalyzeCommitJob>): Promise<void> {
    const commit = await this.commits.findById(data.commitId);
    if (!commit) {
      this.logger.warn(
        `[analyze-commit ${id}] commit ${data.commitId} not found; exiting`,
      );
      return;
    }

    const existing = await this.analyses.findByCommitId(commit.id);
    if (existing && existing.status !== 'failed') {
      this.logger.log(
        `[analyze-commit ${id}] commit ${commit.id} already has ${existing.status}; exiting`,
      );
      return;
    }

    const repo = await this.repos.findById(commit.repositoryId);
    if (!repo) {
      this.logger.warn(
        `[analyze-commit ${id}] repo ${commit.repositoryId} not found; exiting`,
      );
      return;
    }
    const installation = await this.installs.findById(repo.installationId);
    if (!installation) {
      this.logger.warn(
        `[analyze-commit ${id}] installation ${repo.installationId} not found; exiting`,
      );
      return;
    }

    let detail: GithubCommitDetail;
    try {
      detail = await this.client.getCommit(
        installation.githubInstallationId,
        repo.fullName,
        commit.sha,
      );
    } catch (err) {
      await this.recordFailed(commit.id, err);
      throw err;
    }

    try {
      const result = await this.analyzer.analyzeCommit({
        repoFullName: repo.fullName,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        message: commit.message,
        files: detail.files,
      });

      if (result.status === 'skipped_empty') {
        await this.analyses.insert({
          commitId: commit.id,
          status: 'skipped_empty',
          diffWasTruncated: false,
        });
        return;
      }

      await this.analyses.insert({
        commitId: commit.id,
        status: 'analyzed',
        commitType: result.commitType,
        summary: result.summary,
        changes: result.changes,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        diffCharsSent: result.diffCharsSent,
        diffWasTruncated: result.diffWasTruncated,
      });
    } catch (err) {
      await this.recordFailed(commit.id, err);
      throw err;
    }
  }

  private async recordFailed(commitId: string, err: unknown): Promise<void> {
    const reason = err instanceof Error ? err.message : 'Unknown error';
    try {
      await this.analyses.insert({
        commitId,
        status: 'failed',
        failureReason: reason,
        diffWasTruncated: false,
      });
    } catch {
      // If a row already exists (race with another retry), ignore — the
      // unique index keeps us idempotent.
    }
  }
}

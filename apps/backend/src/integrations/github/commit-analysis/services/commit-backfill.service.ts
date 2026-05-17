import { Injectable } from '@nestjs/common';
import { AppError } from '../../../../common/errors';
import { GithubAppClient } from '../../github-app.client';
import { GithubInstallationsRepository } from '../../repositories/installations.repository';
import { GithubRepositoriesRepository } from '../../repositories/repositories.repository';
import { CommitsRepository } from '../repositories/commits.repository';
import type { GithubCommitInsert } from '../../../../databases/pg-drizzle/types';

export interface BackfillArgs {
  repositoryId: string;
  sinceISO: string;
}

@Injectable()
export class CommitBackfillService {
  constructor(
    private readonly repos: GithubRepositoriesRepository,
    private readonly installs: GithubInstallationsRepository,
    private readonly client: GithubAppClient,
    private readonly commits: CommitsRepository,
  ) {}

  async run(args: BackfillArgs): Promise<{ inserted: number }> {
    const repo = await this.repos.findById(args.repositoryId);
    if (!repo) throw AppError.GITHUB_REPOSITORY_NOT_FOUND();

    const installation = await this.installs.findById(repo.installationId);
    if (!installation) throw AppError.GITHUB_INSTALLATION_NOT_FOUND();

    const defaultBranch = await this.client.getDefaultBranch(
      installation.githubInstallationId,
      repo.fullName,
    );

    const items = await this.client.listCommits(
      installation.githubInstallationId,
      repo.fullName,
      args.sinceISO,
      defaultBranch,
    );

    if (items.length === 0) return { inserted: 0 };

    const rows: GithubCommitInsert[] = items.map((c) => ({
      repositoryId: repo.id,
      sha: c.sha,
      parentCount: c.parentCount,
      message: c.message,
      authorGithubUserId: c.authorGithubUserId,
      authorGithubLogin: c.authorGithubLogin,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      committerGithubUserId: c.committerGithubUserId,
      committerGithubLogin: c.committerGithubLogin,
      committerName: c.committerName,
      committerEmail: c.committerEmail,
      authoredAt: c.authoredAt,
      committedAt: c.committedAt,
      raw: c.raw,
    }));

    await this.commits.upsertMany(rows);
    return { inserted: rows.length };
  }
}

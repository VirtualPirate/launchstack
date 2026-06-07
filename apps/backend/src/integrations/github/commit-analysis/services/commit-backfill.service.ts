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

export interface BackfillFromLatestArgs {
  repositoryId: string;
  lookbackDays: number;
}

interface RepoContext {
  installationGithubId: bigint;
  repoId: string;
  fullName: string;
  defaultBranch: string;
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
    const ctx = await this.resolveContext(args.repositoryId);
    const inserted = await this.pullAndUpsert(ctx, args.sinceISO);
    return { inserted };
  }

  async runFromLatest(
    args: BackfillFromLatestArgs,
  ): Promise<{ inserted: number; sinceISO: string | null }> {
    const ctx = await this.resolveContext(args.repositoryId);

    const latest = await this.client.getLatestCommitDate(
      ctx.installationGithubId,
      ctx.fullName,
      ctx.defaultBranch,
    );
    if (!latest) return { inserted: 0, sinceISO: null };

    const sinceISO = new Date(
      latest.getTime() - args.lookbackDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const inserted = await this.pullAndUpsert(ctx, sinceISO);
    return { inserted, sinceISO };
  }

  private async resolveContext(repositoryId: string): Promise<RepoContext> {
    const repo = await this.repos.findById(repositoryId);
    if (!repo) throw AppError.GITHUB_REPOSITORY_NOT_FOUND();

    const installation = await this.installs.findById(repo.installationId);
    if (!installation) throw AppError.GITHUB_INSTALLATION_NOT_FOUND();

    const defaultBranch = await this.client.getDefaultBranch(
      installation.githubInstallationId,
      repo.fullName,
    );

    return {
      installationGithubId: installation.githubInstallationId,
      repoId: repo.id,
      fullName: repo.fullName,
      defaultBranch,
    };
  }

  private async pullAndUpsert(
    ctx: RepoContext,
    sinceISO: string,
  ): Promise<number> {
    const items = await this.client.listCommits(
      ctx.installationGithubId,
      ctx.fullName,
      sinceISO,
      ctx.defaultBranch,
    );

    if (items.length === 0) return 0;

    const rows: GithubCommitInsert[] = items.map((c) => ({
      repositoryId: ctx.repoId,
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
    return rows.length;
  }
}

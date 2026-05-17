import { createRequire } from 'node:module';
import { AppError } from '../../common/errors';
import type { GithubAppConfig } from './github-app.config';

export interface GithubRepoSummary {
  githubRepoId: string;
  name: string;
  fullName: string;
  private: boolean;
  raw: unknown;
}

export interface GithubInstallationMeta {
  githubInstallationId: string;
  githubAccountId: string;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  accountAvatarUrl: string | null;
  targetType: string;
  suspendedAt: Date | null;
  raw: unknown;
}

type RawRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
};

type RawInstallation = {
  id: number;
  account: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
    avatar_url: string | null;
  };
  target_type: string;
  suspended_at: string | null;
};

type RawCommitListItem = {
  sha: string;
  parents: { sha: string }[];
  commit: {
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
    message: string;
  };
  author: { id: number; login: string } | null;
  committer: { id: number; login: string } | null;
};

type RawCommitDetail = RawCommitListItem & {
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>;
};

export interface GithubCommitListItem {
  sha: string;
  parentCount: number;
  message: string;
  authorGithubUserId: bigint | null;
  authorGithubLogin: string | null;
  authorName: string;
  authorEmail: string;
  committerGithubUserId: bigint | null;
  committerGithubLogin: string | null;
  committerName: string;
  committerEmail: string;
  authoredAt: Date;
  committedAt: Date;
  raw: unknown;
}

export interface GithubCommitFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface GithubCommitDetail extends GithubCommitListItem {
  files: GithubCommitFile[];
}

type InstallationOctokit = {
  request: (
    route: string,
    params: Record<string, string | number>,
  ) => Promise<{ data: unknown }>;
  paginate: {
    iterator: (
      route: string,
      params: Record<string, string | number>,
    ) => AsyncIterable<{ data: unknown[] }>;
  };
};

type GithubAppInstance = {
  octokit: {
    request: (
      route: string,
      params: Record<string, string>,
    ) => Promise<{ data: unknown }>;
  };
  getInstallationOctokit: (
    installationId: number,
  ) => Promise<InstallationOctokit>;
  eachRepository: {
    iterator: (query: { installationId: number }) => AsyncIterable<{
      octokit: unknown;
      repository: RawRepo;
    }>;
  };
};

type GithubAppConstructor = new (opts: {
  appId: number | string;
  privateKey: string;
}) => GithubAppInstance;

async function loadGithubAppConstructor(): Promise<GithubAppConstructor> {
  if (process.env.JEST_WORKER_ID) {
    const module = createRequire(__filename)('@octokit/app') as {
      App: GithubAppConstructor;
    };
    return module.App;
  }

  const [appMod, coreMod, paginateMod] = await Promise.all([
    import('@octokit/app'),
    import('@octokit/core'),
    import('@octokit/plugin-paginate-rest'),
  ]);
  const { App } = appMod as unknown as {
    App: { defaults: (d: { Octokit: unknown }) => GithubAppConstructor };
  };
  const { Octokit } = coreMod as unknown as {
    Octokit: { plugin: (p: unknown) => unknown };
  };
  const { paginateRest } = paginateMod as unknown as {
    paginateRest: unknown;
  };

  const PaginatedOctokit = Octokit.plugin(paginateRest);
  return App.defaults({ Octokit: PaginatedOctokit });
}

export class GithubAppClient {
  private readonly appPromise: Promise<GithubAppInstance>;

  constructor(config: GithubAppConfig) {
    this.appPromise = loadGithubAppConstructor().then(
      (GithubApp) =>
        new GithubApp({
          appId: config.appId,
          privateKey: config.privateKey,
        }),
    );
  }

  private async getApp(): Promise<GithubAppInstance> {
    return this.appPromise;
  }

  async getInstallation(
    installationId: bigint,
  ): Promise<GithubInstallationMeta> {
    try {
      const app = await this.getApp();
      const { data } = await app.octokit.request(
        'GET /app/installations/{installation_id}',
        {
          installation_id: installationId.toString(),
        },
      );

      const raw = data as RawInstallation;
      return {
        githubInstallationId: raw.id.toString(),
        githubAccountId: raw.account.id.toString(),
        accountLogin: raw.account.login,
        accountType: raw.account.type,
        accountAvatarUrl: raw.account.avatar_url,
        targetType: raw.target_type,
        suspendedAt: raw.suspended_at ? new Date(raw.suspended_at) : null,
        raw: data,
      };
    } catch (err) {
      throw AppError.GITHUB_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async listInstallationRepos(
    installationId: bigint,
  ): Promise<GithubRepoSummary[]> {
    try {
      const app = await this.getApp();
      const out: GithubRepoSummary[] = [];
      for await (const { repository } of app.eachRepository.iterator({
        installationId: Number(installationId),
      })) {
        out.push({
          githubRepoId: repository.id.toString(),
          name: repository.name,
          fullName: repository.full_name,
          private: repository.private,
          raw: repository,
        });
      }
      return out;
    } catch (err) {
      throw AppError.GITHUB_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async deleteInstallation(installationId: bigint): Promise<void> {
    const app = await this.getApp();
    await app.octokit.request('DELETE /app/installations/{installation_id}', {
      installation_id: installationId.toString(),
    });
  }

  async listCommits(
    installationId: bigint,
    repoFullName: string,
    sinceISO: string,
    sha: string,
  ): Promise<GithubCommitListItem[]> {
    const [owner, repo] = repoFullName.split('/');
    try {
      const app = await this.getApp();
      const octokit = await app.getInstallationOctokit(Number(installationId));
      const out: GithubCommitListItem[] = [];
      for await (const page of octokit.paginate.iterator(
        'GET /repos/{owner}/{repo}/commits',
        { owner, repo, sha, since: sinceISO, per_page: 100 },
      )) {
        for (const item of page.data as RawCommitListItem[]) {
          out.push(toCommitListItem(item));
        }
      }
      return out;
    } catch (err) {
      throw AppError.GITHUB_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async getCommit(
    installationId: bigint,
    repoFullName: string,
    sha: string,
  ): Promise<GithubCommitDetail> {
    const [owner, repo] = repoFullName.split('/');
    try {
      const app = await this.getApp();
      const octokit = await app.getInstallationOctokit(Number(installationId));
      const { data } = await octokit.request(
        'GET /repos/{owner}/{repo}/commits/{ref}',
        { owner, repo, ref: sha },
      );
      const raw = data as RawCommitDetail;
      return {
        ...toCommitListItem(raw),
        files: (raw.files ?? []).map((f) => ({
          path: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
      };
    } catch (err) {
      throw AppError.GITHUB_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async getDefaultBranch(
    installationId: bigint,
    repoFullName: string,
  ): Promise<string> {
    const [owner, repo] = repoFullName.split('/');
    try {
      const app = await this.getApp();
      const octokit = await app.getInstallationOctokit(Number(installationId));
      const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });
      const branch = (data as { default_branch?: string }).default_branch;
      if (!branch) throw new Error('default_branch missing');
      return branch;
    } catch (err) {
      throw AppError.GITHUB_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}

function toCommitListItem(raw: RawCommitListItem): GithubCommitListItem {
  return {
    sha: raw.sha,
    parentCount: raw.parents.length,
    message: raw.commit.message,
    authorGithubUserId: raw.author ? BigInt(raw.author.id) : null,
    authorGithubLogin: raw.author?.login ?? null,
    authorName: raw.commit.author.name,
    authorEmail: raw.commit.author.email,
    committerGithubUserId: raw.committer ? BigInt(raw.committer.id) : null,
    committerGithubLogin: raw.committer?.login ?? null,
    committerName: raw.commit.committer.name,
    committerEmail: raw.commit.committer.email,
    authoredAt: new Date(raw.commit.author.date),
    committedAt: new Date(raw.commit.committer.date),
    raw,
  };
}

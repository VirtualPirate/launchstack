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

type GithubAppInstance = {
  octokit: {
    request: (
      route: string,
      params: Record<string, string>,
    ) => Promise<{ data: unknown }>;
  };
  getInstallationOctokit: (installationId: number) => Promise<unknown>;
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

  const module = await import('@octokit/app');
  return (module as { App: GithubAppConstructor }).App;
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
}

import { Inject, Injectable } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  GithubInstallation,
  GithubInstallationWithRepos,
  GithubRepository,
} from '@launchstack/api-interfaces';
import { AppError } from '../../../common/errors';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import type {
  GithubInstallationSelect,
  GithubRepositorySelect,
} from '../../../databases/pg-drizzle/types';
import { PgBossService } from '../../../queue';
import { SyncRepoCollaboratorsJob } from '../collaborators/jobs/sync-repo-collaborators.job';
import { ScanRepositoryJob } from '../commit-analysis/jobs/scan-repository.job';
import type { GithubAppConfig } from '../github-app.config';
import type { GithubAppClient } from '../github-app.client';
import { GithubInstallationsRepository } from '../repositories/installations.repository';
import { GithubRepositoriesRepository } from '../repositories/repositories.repository';
import { StateTokenService } from './state-token.service';

const SCAN_LOOKBACK_DAYS = 365;

type Db = PostgresJsDatabase<Record<string, unknown>>;

function serializeInstallation(
  row: GithubInstallationSelect,
): GithubInstallation {
  return {
    id: row.id,
    githubInstallationId: row.githubInstallationId.toString(),
    accountLogin: row.githubAccountLogin,
    accountType: row.githubAccountType,
    accountAvatarUrl: row.githubAccountAvatarUrl,
    suspendedAt: row.suspendedAt ? row.suspendedAt.toISOString() : null,
    connectedByUserId: row.connectedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeRepo(row: GithubRepositorySelect): GithubRepository {
  return {
    id: row.id,
    githubRepoId: row.githubRepoId.toString(),
    name: row.name,
    fullName: row.fullName,
    private: row.private,
  };
}

@Injectable()
export class GithubInstallationsService {
  constructor(
    private readonly installs: GithubInstallationsRepository,
    private readonly repos: GithubRepositoriesRepository,
    private readonly stateToken: StateTokenService,
    private readonly client: GithubAppClient,
    private readonly config: GithubAppConfig | null,
    @Inject(DRIZZLE_DB) private readonly db: Db,
    private readonly pgBoss: PgBossService,
  ) {}

  private requireConfig(): GithubAppConfig {
    if (!this.config) {
      throw AppError.GITHUB_APP_NOT_CONFIGURED();
    }
    return this.config;
  }

  buildInstallUrl(input: { orgId: string; userId: string }): string {
    const config = this.requireConfig();
    const state = this.stateToken.sign(input);
    return `https://github.com/apps/${config.slug}/installations/new?state=${state}`;
  }

  async handleCallback(input: {
    state: string | undefined;
    installationId: bigint;
    setupAction: 'install' | 'update';
    sessionUserId: string | null;
  }): Promise<{ orgId: string }> {
    this.requireConfig();

    const existing = await this.installs.findByGithubInstallationId(
      input.installationId,
    );

    let orgId: string;
    let connectedByUserId: string | null;

    if (input.state) {
      let payload: { orgId: string; userId: string };
      try {
        payload = this.stateToken.verify(input.state);
      } catch {
        throw AppError.GITHUB_STATE_INVALID();
      }
      if (input.sessionUserId && payload.userId !== input.sessionUserId) {
        throw AppError.GITHUB_STATE_USER_MISMATCH();
      }
      orgId = payload.orgId;
      connectedByUserId = payload.userId;
    } else {
      // Stateless callback — GitHub "Configure" flow from app settings.
      // Only valid for an already-known installation we're re-syncing.
      if (input.setupAction !== 'update' || !existing) {
        throw AppError.GITHUB_STATE_INVALID();
      }
      orgId = existing.organizationId;
      connectedByUserId = null;
    }

    const repos = await this.client.listInstallationRepos(input.installationId);
    const repoRows = repos.map((repo) => ({
      githubRepoId: BigInt(repo.githubRepoId),
      name: repo.name,
      fullName: repo.fullName,
      private: repo.private,
      raw: repo.raw,
    }));

    const beforeIds: string[] = existing
      ? (await this.repos.listByInstallation(existing.id)).map((r) => r.id)
      : [];

    const installationRowId = await this.db.transaction(async (tx) => {
      let rowId = existing?.id;

      if (!rowId) {
        const meta = await this.client.getInstallation(input.installationId);
        const created = await this.installs.create(
          {
            organizationId: orgId,
            githubInstallationId: BigInt(meta.githubInstallationId),
            githubAccountId: BigInt(meta.githubAccountId),
            githubAccountLogin: meta.accountLogin,
            githubAccountType: meta.accountType,
            githubAccountAvatarUrl: meta.accountAvatarUrl,
            targetType: meta.targetType,
            suspendedAt: meta.suspendedAt,
            connectedByUserId,
            raw: meta.raw,
          },
          tx,
        );
        rowId = created.id;
      } else if (existing?.deletedAt) {
        // Re-install of a previously-disconnected app: un-delete the existing
        // row instead of creating a duplicate (the unique index on
        // github_installation_id would block one anyway).
        await this.installs.undelete(existing.id, tx);
      }

      await this.repos.reconcileForInstallation(rowId, repoRows, tx);
      return rowId;
    });

    const afterIds = (
      await this.repos.listByInstallation(installationRowId)
    ).map((r) => r.id);
    const beforeSet = new Set(beforeIds);
    const afterSet = new Set(afterIds);
    const connected = afterIds.filter((id) => !beforeSet.has(id));
    const disconnected = beforeIds.filter((id) => !afterSet.has(id));

    for (const repositoryId of connected) {
      await this.pgBoss.send(SyncRepoCollaboratorsJob, {
        repositoryId,
        trigger: 'connected',
      });
      await this.pgBoss.sendOnce(
        ScanRepositoryJob,
        { repositoryId, lookbackDays: SCAN_LOOKBACK_DAYS },
        `scan:${repositoryId}`,
      );
    }
    for (const repositoryId of disconnected) {
      await this.pgBoss.send(SyncRepoCollaboratorsJob, {
        repositoryId,
        trigger: 'disconnected',
      });
    }

    return { orgId };
  }

  async listForOrg(orgId: string): Promise<GithubInstallationWithRepos[]> {
    const installations = await this.installs.listByOrganization(orgId);
    const out: GithubInstallationWithRepos[] = [];

    for (const installation of installations) {
      const repos = await this.repos.listByInstallation(installation.id);
      out.push({
        ...serializeInstallation(installation),
        repositories: repos.map(serializeRepo),
      });
    }

    return out;
  }

  async sync(
    orgId: string,
    installationRowId: string,
  ): Promise<GithubInstallationWithRepos> {
    this.requireConfig();

    const installation = await this.installs.findByIdScopedToOrg(
      installationRowId,
      orgId,
    );
    if (!installation) {
      throw AppError.GITHUB_INSTALLATION_NOT_FOUND();
    }

    const beforeIds = (
      await this.repos.listByInstallation(installation.id)
    ).map((r) => r.id);

    const repos = await this.client.listInstallationRepos(
      installation.githubInstallationId,
    );

    await this.repos.reconcileForInstallation(
      installation.id,
      repos.map((repo) => ({
        githubRepoId: BigInt(repo.githubRepoId),
        name: repo.name,
        fullName: repo.fullName,
        private: repo.private,
        raw: repo.raw,
      })),
    );

    const updatedRepos = await this.repos.listByInstallation(installation.id);
    const afterIds = updatedRepos.map((r) => r.id);
    const beforeSet = new Set(beforeIds);
    const afterSet = new Set(afterIds);
    const connected = afterIds.filter((id) => !beforeSet.has(id));
    const disconnected = beforeIds.filter((id) => !afterSet.has(id));

    for (const repositoryId of connected) {
      await this.pgBoss.send(SyncRepoCollaboratorsJob, {
        repositoryId,
        trigger: 'connected',
      });
      await this.pgBoss.sendOnce(
        ScanRepositoryJob,
        { repositoryId, lookbackDays: SCAN_LOOKBACK_DAYS },
        `scan:${repositoryId}`,
      );
    }
    for (const repositoryId of disconnected) {
      await this.pgBoss.send(SyncRepoCollaboratorsJob, {
        repositoryId,
        trigger: 'disconnected',
      });
    }

    return {
      ...serializeInstallation(installation),
      repositories: updatedRepos.map(serializeRepo),
    };
  }

  async disconnect(orgId: string, installationRowId: string): Promise<void> {
    const installation = await this.installs.findByIdScopedToOrg(
      installationRowId,
      orgId,
    );
    if (!installation) {
      throw AppError.GITHUB_INSTALLATION_NOT_FOUND();
    }

    const reposToDisconnect = await this.repos.listByInstallation(
      installation.id,
    );

    try {
      await this.client.deleteInstallation(installation.githubInstallationId);
    } catch {
      // GitHub side may already be gone (suspended / manually removed);
      // we still soft-delete locally.
    }

    await this.db.transaction(async (tx) => {
      await this.repos.softDeleteAllForInstallation(installation.id, tx);
      await this.installs.softDelete(installation.id, tx);
    });

    for (const repo of reposToDisconnect) {
      await this.pgBoss.send(SyncRepoCollaboratorsJob, {
        repositoryId: repo.id,
        trigger: 'disconnected',
      });
    }
  }
}

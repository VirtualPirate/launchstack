import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, notInArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { githubRepositories } from '../../../databases/pg-drizzle/github-schema';
import type { GithubRepositorySelect } from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

export interface RepoReconcileRow {
  githubRepoId: bigint;
  name: string;
  fullName: string;
  private: boolean;
  raw: unknown;
}

@Injectable()
export class GithubRepositoriesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async listByInstallation(
    installationId: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubRepositorySelect[]> {
    return this.exec(tx)
      .select()
      .from(githubRepositories)
      .where(
        and(
          eq(githubRepositories.installationId, installationId),
          isNull(githubRepositories.deletedAt),
        ),
      );
  }

  /**
   * Reconcile the repo set for an installation against the latest GitHub
   * payload. Upserts each payload row on (installation_id, github_repo_id):
   * refreshes name/full_name/private/raw, clears deleted_at, bumps updated_at.
   * Soft-deletes (deleted_at = now()) any DB row not in the payload.
   *
   * Both statements run on the supplied executor (tx or db) so the caller
   * can wrap them in a larger transaction.
   */
  async reconcileForInstallation(
    installationId: string,
    rows: RepoReconcileRow[],
    tx?: DrizzleExecutor,
  ): Promise<void> {
    const exec = this.exec(tx);
    const now = new Date();

    if (rows.length > 0) {
      await exec
        .insert(githubRepositories)
        .values(
          rows.map((r) => ({
            installationId,
            githubRepoId: r.githubRepoId,
            name: r.name,
            fullName: r.fullName,
            private: r.private,
            raw: r.raw,
          })),
        )
        .onConflictDoUpdate({
          target: [
            githubRepositories.installationId,
            githubRepositories.githubRepoId,
          ],
          set: {
            name: sql`excluded.name`,
            fullName: sql`excluded.full_name`,
            private: sql`excluded.private`,
            raw: sql`excluded.raw`,
            deletedAt: null,
            updatedAt: now,
          },
        });
    }

    const keepIds = rows.map((r) => r.githubRepoId);
    const conditions = [
      eq(githubRepositories.installationId, installationId),
      isNull(githubRepositories.deletedAt),
    ];
    if (keepIds.length > 0) {
      conditions.push(notInArray(githubRepositories.githubRepoId, keepIds));
    }

    await exec
      .update(githubRepositories)
      .set({ deletedAt: now })
      .where(and(...conditions));
  }

  async softDeleteAllForInstallation(
    installationId: string,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .update(githubRepositories)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(githubRepositories.installationId, installationId),
          isNull(githubRepositories.deletedAt),
        ),
      );
  }
}

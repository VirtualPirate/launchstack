import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { projectRepositories } from '../../../databases/pg-drizzle/briefs-schema';
import type { ProjectRepositorySelect } from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class ProjectRepositoriesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async listByProject(
    projectId: string,
    tx?: DrizzleExecutor,
  ): Promise<ProjectRepositorySelect[]> {
    return this.exec(tx)
      .select()
      .from(projectRepositories)
      .where(eq(projectRepositories.projectId, projectId));
  }

  async listRepositoryIdsForProjects(
    projectIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<Map<string, string[]>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.exec(tx)
      .select({
        projectId: projectRepositories.projectId,
        repositoryId: projectRepositories.repositoryId,
      })
      .from(projectRepositories)
      .where(inArray(projectRepositories.projectId, projectIds));
    const map = new Map<string, string[]>();
    for (const id of projectIds) map.set(id, []);
    for (const r of rows) {
      map.get(r.projectId)?.push(r.repositoryId);
    }
    return map;
  }

  async replaceForProject(
    projectId: string,
    repositoryIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<void> {
    const executor = this.exec(tx);
    await executor
      .delete(projectRepositories)
      .where(eq(projectRepositories.projectId, projectId));
    if (repositoryIds.length === 0) return;
    await executor.insert(projectRepositories).values(
      repositoryIds.map((repositoryId) => ({ projectId, repositoryId })),
    );
  }

  async deleteOne(
    projectId: string,
    repositoryId: string,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .delete(projectRepositories)
      .where(
        and(
          eq(projectRepositories.projectId, projectId),
          eq(projectRepositories.repositoryId, repositoryId),
        ),
      );
  }
}

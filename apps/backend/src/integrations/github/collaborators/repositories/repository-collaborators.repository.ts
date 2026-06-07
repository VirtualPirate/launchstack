import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, notInArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../../databases/pg-drizzle';
import {
  githubCollaborators,
  githubRepositoryCollaborators,
} from '../../../../databases/pg-drizzle/github-schema';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

export interface UpsertRepoCollaboratorInput {
  repositoryId: string;
  collaboratorId: string;
  roleName: string;
  permissionAdmin: boolean;
  permissionMaintain: boolean;
  permissionPush: boolean;
  permissionTriage: boolean;
  permissionPull: boolean;
  raw: unknown;
}

export interface ActiveRepoCollaboratorRow {
  joinId: string;
  collaboratorId: string;
  githubUserId: bigint;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  type: string | null;
  siteAdmin: boolean;
  roleName: string;
  permissionAdmin: boolean;
  permissionMaintain: boolean;
  permissionPush: boolean;
  permissionTriage: boolean;
  permissionPull: boolean;
  updatedAt: Date;
}

@Injectable()
export class RepositoryCollaboratorsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async upsertByRepoCollaborator(
    input: UpsertRepoCollaboratorInput,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .insert(githubRepositoryCollaborators)
      .values({
        repositoryId: input.repositoryId,
        collaboratorId: input.collaboratorId,
        roleName: input.roleName,
        permissionAdmin: input.permissionAdmin,
        permissionMaintain: input.permissionMaintain,
        permissionPush: input.permissionPush,
        permissionTriage: input.permissionTriage,
        permissionPull: input.permissionPull,
        raw: input.raw,
      })
      .onConflictDoUpdate({
        target: [
          githubRepositoryCollaborators.repositoryId,
          githubRepositoryCollaborators.collaboratorId,
        ],
        set: {
          roleName: input.roleName,
          permissionAdmin: input.permissionAdmin,
          permissionMaintain: input.permissionMaintain,
          permissionPush: input.permissionPush,
          permissionTriage: input.permissionTriage,
          permissionPull: input.permissionPull,
          raw: input.raw,
          deletedAt: null,
        },
      });
  }

  async softDeleteAllForRepo(
    repositoryId: string,
    tx?: DrizzleExecutor,
  ): Promise<number> {
    const result = await this.exec(tx)
      .update(githubRepositoryCollaborators)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(githubRepositoryCollaborators.repositoryId, repositoryId),
          isNull(githubRepositoryCollaborators.deletedAt),
        ),
      )
      .returning({ id: githubRepositoryCollaborators.id });
    return result.length;
  }

  async softDeleteMissingForRepo(
    repositoryId: string,
    liveCollaboratorIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<number> {
    const conditions = [
      eq(githubRepositoryCollaborators.repositoryId, repositoryId),
      isNull(githubRepositoryCollaborators.deletedAt),
    ];
    if (liveCollaboratorIds.length > 0) {
      conditions.push(
        notInArray(
          githubRepositoryCollaborators.collaboratorId,
          liveCollaboratorIds,
        ),
      );
    }
    const result = await this.exec(tx)
      .update(githubRepositoryCollaborators)
      .set({ deletedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: githubRepositoryCollaborators.id });
    return result.length;
  }

  async findActiveByRepoId(
    repositoryId: string,
    tx?: DrizzleExecutor,
  ): Promise<ActiveRepoCollaboratorRow[]> {
    return this.exec(tx)
      .select({
        joinId: githubRepositoryCollaborators.id,
        collaboratorId: githubCollaborators.id,
        githubUserId: githubCollaborators.githubUserId,
        login: githubCollaborators.login,
        avatarUrl: githubCollaborators.avatarUrl,
        htmlUrl: githubCollaborators.htmlUrl,
        type: githubCollaborators.type,
        siteAdmin: githubCollaborators.siteAdmin,
        roleName: githubRepositoryCollaborators.roleName,
        permissionAdmin: githubRepositoryCollaborators.permissionAdmin,
        permissionMaintain: githubRepositoryCollaborators.permissionMaintain,
        permissionPush: githubRepositoryCollaborators.permissionPush,
        permissionTriage: githubRepositoryCollaborators.permissionTriage,
        permissionPull: githubRepositoryCollaborators.permissionPull,
        updatedAt: githubRepositoryCollaborators.updatedAt,
      })
      .from(githubRepositoryCollaborators)
      .innerJoin(
        githubCollaborators,
        eq(
          githubRepositoryCollaborators.collaboratorId,
          githubCollaborators.id,
        ),
      )
      .where(
        and(
          eq(githubRepositoryCollaborators.repositoryId, repositoryId),
          isNull(githubRepositoryCollaborators.deletedAt),
          isNull(githubCollaborators.deletedAt),
        ),
      )
      .orderBy(
        desc(githubRepositoryCollaborators.roleName),
        asc(githubCollaborators.login),
      );
  }
}

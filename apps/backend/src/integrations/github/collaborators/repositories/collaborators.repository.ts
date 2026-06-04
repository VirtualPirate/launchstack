import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../../databases/pg-drizzle';
import {
  githubCollaborators,
  githubInstallations,
  githubRepositories,
  githubRepositoryCollaborators,
} from '../../../../databases/pg-drizzle/github-schema';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

export type CollaboratorRow = typeof githubCollaborators.$inferSelect;

export interface UpsertCollaboratorInput {
  githubUserId: bigint;
  login: string;
  nodeId: string | null;
  avatarUrl: string | null;
  htmlUrl: string | null;
  type: string | null;
  siteAdmin: boolean;
  raw: unknown;
}

@Injectable()
export class CollaboratorsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<CollaboratorRow | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubCollaborators)
      .where(eq(githubCollaborators.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByGithubUserId(
    githubUserId: bigint,
    tx?: DrizzleExecutor,
  ): Promise<CollaboratorRow | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubCollaborators)
      .where(eq(githubCollaborators.githubUserId, githubUserId))
      .limit(1);
    return row ?? null;
  }

  async findByIdScopedToOrg(
    collaboratorId: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<CollaboratorRow | null> {
    const [row] = await this.exec(tx)
      .select({ collaborator: githubCollaborators })
      .from(githubCollaborators)
      .innerJoin(
        githubRepositoryCollaborators,
        eq(githubRepositoryCollaborators.collaboratorId, githubCollaborators.id),
      )
      .innerJoin(
        githubRepositories,
        eq(githubRepositories.id, githubRepositoryCollaborators.repositoryId),
      )
      .innerJoin(
        githubInstallations,
        eq(githubInstallations.id, githubRepositories.installationId),
      )
      .where(
        and(
          eq(githubCollaborators.id, collaboratorId),
          eq(githubInstallations.organizationId, organizationId),
          isNull(githubCollaborators.deletedAt),
          isNull(githubRepositoryCollaborators.deletedAt),
        ),
      )
      .limit(1);
    return row?.collaborator ?? null;
  }

  async upsertByGithubUserId(
    input: UpsertCollaboratorInput,
    tx?: DrizzleExecutor,
  ): Promise<CollaboratorRow> {
    const [row] = await this.exec(tx)
      .insert(githubCollaborators)
      .values({
        githubUserId: input.githubUserId,
        login: input.login,
        nodeId: input.nodeId,
        avatarUrl: input.avatarUrl,
        htmlUrl: input.htmlUrl,
        type: input.type,
        siteAdmin: input.siteAdmin,
        raw: input.raw as object,
      })
      .onConflictDoUpdate({
        target: githubCollaborators.githubUserId,
        set: {
          login: input.login,
          nodeId: input.nodeId,
          avatarUrl: input.avatarUrl,
          htmlUrl: input.htmlUrl,
          type: input.type,
          siteAdmin: input.siteAdmin,
          raw: input.raw as object,
          deletedAt: null,
        },
      })
      .returning();
    return row;
  }
}

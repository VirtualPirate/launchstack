import { Inject, Injectable } from '@nestjs/common';
import {
  aliasedTable,
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../../databases/pg-drizzle';
import {
  githubCollaborators,
  githubCommitAnalyses,
  githubCommits,
} from '../../../../databases/pg-drizzle/github-schema';
import type {
  GithubCommitInsert,
  GithubCommitSelect,
} from '../../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class CommitsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async upsertMany(
    rows: GithubCommitInsert[],
    tx?: DrizzleExecutor,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.exec(tx)
      .insert(githubCommits)
      .values(rows)
      .onConflictDoUpdate({
        target: [githubCommits.repositoryId, githubCommits.sha],
        set: {
          raw: sql`excluded.raw`,
          message: sql`excluded.message`,
          updatedAt: new Date(),
        },
      });
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubCommitSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubCommits)
      .where(and(eq(githubCommits.id, id), isNull(githubCommits.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByRepositorySince(
    repositoryId: string,
    sinceISO: string,
    tx?: DrizzleExecutor,
  ): Promise<Array<Pick<GithubCommitSelect, 'id' | 'parentCount'>>> {
    const rows = await this.exec(tx)
      .select({
        id: githubCommits.id,
        parentCount: githubCommits.parentCount,
      })
      .from(githubCommits)
      .where(
        and(
          eq(githubCommits.repositoryId, repositoryId),
          gte(githubCommits.authoredAt, new Date(sinceISO)),
          isNull(githubCommits.deletedAt),
        ),
      );
    return rows;
  }

  async countByRepositorySince(
    repositoryId: string,
    sinceISO: string,
    tx?: DrizzleExecutor,
  ): Promise<number> {
    const [row] = await this.exec(tx)
      .select({ count: sql<number>`count(*)::int` })
      .from(githubCommits)
      .where(
        and(
          eq(githubCommits.repositoryId, repositoryId),
          gte(githubCommits.authoredAt, new Date(sinceISO)),
          isNull(githubCommits.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async findWithCollaborators(input: {
    repositoryId: string;
    limit: number;
  }): Promise<
    Array<{
      commit: typeof githubCommits.$inferSelect;
      author: typeof githubCollaborators.$inferSelect | null;
      committer: typeof githubCollaborators.$inferSelect | null;
    }>
  > {
    const committerAlias = aliasedTable(githubCollaborators, 'committer');
    return this.db
      .select({
        commit: githubCommits,
        author: githubCollaborators,
        committer: committerAlias,
      })
      .from(githubCommits)
      .leftJoin(
        githubCollaborators,
        and(
          eq(
            githubCollaborators.githubUserId,
            githubCommits.authorGithubUserId,
          ),
          isNull(githubCollaborators.deletedAt),
        ),
      )
      .leftJoin(
        committerAlias,
        and(
          eq(committerAlias.githubUserId, githubCommits.committerGithubUserId),
          isNull(committerAlias.deletedAt),
        ),
      )
      .where(
        and(
          eq(githubCommits.repositoryId, input.repositoryId),
          isNull(githubCommits.deletedAt),
        ),
      )
      .orderBy(desc(githubCommits.authoredAt))
      .limit(input.limit);
  }

  async findForBriefScope(input: {
    repositoryIds: string[];
    periodStart: Date;
    periodEnd: Date;
    collaboratorGithubUserIds?: bigint[];
    limit?: number;
    tx?: DrizzleExecutor;
  }): Promise<
    Array<{
      commit: typeof githubCommits.$inferSelect;
      analysis: typeof githubCommitAnalyses.$inferSelect | null;
    }>
  > {
    if (input.repositoryIds.length === 0) return [];
    const conditions = [
      inArray(githubCommits.repositoryId, input.repositoryIds),
      gte(githubCommits.authoredAt, input.periodStart),
      lte(githubCommits.authoredAt, input.periodEnd),
      isNull(githubCommits.deletedAt),
      eq(githubCommits.parentCount, 1),
    ];
    if (
      input.collaboratorGithubUserIds &&
      input.collaboratorGithubUserIds.length > 0
    ) {
      conditions.push(
        inArray(
          githubCommits.authorGithubUserId,
          input.collaboratorGithubUserIds,
        ),
      );
    }
    const executor = input.tx ?? this.db;
    return executor
      .select({
        commit: githubCommits,
        analysis: githubCommitAnalyses,
      })
      .from(githubCommits)
      .leftJoin(
        githubCommitAnalyses,
        eq(githubCommitAnalyses.commitId, githubCommits.id),
      )
      .where(and(...conditions))
      .orderBy(desc(githubCommits.authoredAt))
      .limit(input.limit ?? 5000);
  }

  async findCommitTimestampsForScope(input: {
    repositoryIds: string[];
    periodStart: Date;
    periodEnd: Date;
    collaboratorGithubUserIds?: bigint[];
    tx?: DrizzleExecutor;
  }): Promise<Date[]> {
    if (input.repositoryIds.length === 0) return [];
    const conditions = [
      inArray(githubCommits.repositoryId, input.repositoryIds),
      gte(githubCommits.authoredAt, input.periodStart),
      lte(githubCommits.authoredAt, input.periodEnd),
      isNull(githubCommits.deletedAt),
      eq(githubCommits.parentCount, 1),
    ];
    if (
      input.collaboratorGithubUserIds &&
      input.collaboratorGithubUserIds.length > 0
    ) {
      conditions.push(
        inArray(
          githubCommits.authorGithubUserId,
          input.collaboratorGithubUserIds,
        ),
      );
    }
    const rows = await this.exec(input.tx)
      .select({ authoredAt: githubCommits.authoredAt })
      .from(githubCommits)
      .where(and(...conditions));
    return rows.map((r) => r.authoredAt);
  }
}

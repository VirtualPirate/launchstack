import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../../databases/pg-drizzle';
import { githubCommits } from '../../../../databases/pg-drizzle/github-schema';
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
}

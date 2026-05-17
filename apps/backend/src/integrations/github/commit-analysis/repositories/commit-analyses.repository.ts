import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../../databases/pg-drizzle';
import { githubCommitAnalyses } from '../../../../databases/pg-drizzle/github-schema';
import type {
  GithubCommitAnalysisInsert,
  GithubCommitAnalysisSelect,
} from '../../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class CommitAnalysesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findByCommitId(
    commitId: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubCommitAnalysisSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubCommitAnalyses)
      .where(eq(githubCommitAnalyses.commitId, commitId))
      .limit(1);
    return row ?? null;
  }

  async findCommitIdsWithAnalysis(
    commitIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<Set<string>> {
    if (commitIds.length === 0) return new Set();
    const rows = await this.exec(tx)
      .select({ commitId: githubCommitAnalyses.commitId })
      .from(githubCommitAnalyses)
      .where(inArray(githubCommitAnalyses.commitId, commitIds));
    return new Set(rows.map((r) => r.commitId));
  }

  async upsertSkippedMerge(
    commitId: string,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .insert(githubCommitAnalyses)
      .values({
        commitId,
        status: 'skipped_merge',
        diffWasTruncated: false,
      })
      .onConflictDoUpdate({
        target: [githubCommitAnalyses.commitId],
        set: { status: 'skipped_merge', updatedAt: new Date() },
      });
  }

  async deleteForCommitIds(
    commitIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<void> {
    if (commitIds.length === 0) return;
    await this.exec(tx)
      .delete(githubCommitAnalyses)
      .where(inArray(githubCommitAnalyses.commitId, commitIds));
  }

  async insert(
    input: GithubCommitAnalysisInsert,
    tx?: DrizzleExecutor,
  ): Promise<GithubCommitAnalysisSelect> {
    const [row] = await this.exec(tx)
      .insert(githubCommitAnalyses)
      .values(input)
      .returning();
    return row;
  }
}

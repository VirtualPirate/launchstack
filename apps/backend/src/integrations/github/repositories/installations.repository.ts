import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { githubInstallations } from '../../../databases/pg-drizzle/github-schema';
import type {
  GithubInstallationInsert,
  GithubInstallationSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class GithubInstallationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubInstallations)
      .where(
        and(
          eq(githubInstallations.id, id),
          isNull(githubInstallations.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Looks up by the GitHub-side installation id. Intentionally does NOT filter
   * on deleted_at so the re-install path can find a soft-deleted row and
   * un-delete it instead of inserting a duplicate (which the unique index on
   * github_installation_id would block anyway).
   */
  async findByGithubInstallationId(
    githubInstallationId: bigint,
    tx?: DrizzleExecutor,
  ): Promise<GithubInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
      .limit(1);
    return row ?? null;
  }

  async findByIdIncludingDeleted(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByIdScopedToOrg(
    id: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(githubInstallations)
      .where(
        and(
          eq(githubInstallations.id, id),
          eq(githubInstallations.organizationId, organizationId),
          isNull(githubInstallations.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listByOrganization(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<GithubInstallationSelect[]> {
    return this.exec(tx)
      .select()
      .from(githubInstallations)
      .where(
        and(
          eq(githubInstallations.organizationId, organizationId),
          isNull(githubInstallations.deletedAt),
        ),
      );
  }

  async create(
    input: GithubInstallationInsert,
    tx?: DrizzleExecutor,
  ): Promise<GithubInstallationSelect> {
    const [row] = await this.exec(tx)
      .insert(githubInstallations)
      .values(input)
      .returning();
    return row;
  }

  async softDelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(githubInstallations)
      .set({ deletedAt: new Date() })
      .where(eq(githubInstallations.id, id));
  }

  async undelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(githubInstallations)
      .set({ deletedAt: null })
      .where(eq(githubInstallations.id, id));
  }
}

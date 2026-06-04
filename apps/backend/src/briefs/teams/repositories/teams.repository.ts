import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { teams } from '../../../databases/pg-drizzle/briefs-schema';
import type {
  TeamInsert,
  TeamSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class TeamsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async listByOrganization(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<TeamSelect[]> {
    return this.exec(tx)
      .select()
      .from(teams)
      .where(
        and(eq(teams.organizationId, organizationId), isNull(teams.deletedAt)),
      )
      .orderBy(desc(teams.createdAt));
  }

  async findByIdScopedToOrg(
    id: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<TeamSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.id, id),
          eq(teams.organizationId, organizationId),
          isNull(teams.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByNameInOrg(
    organizationId: string,
    name: string,
    tx?: DrizzleExecutor,
  ): Promise<TeamSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.organizationId, organizationId),
          eq(teams.name, name),
          isNull(teams.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: TeamInsert, tx?: DrizzleExecutor): Promise<TeamSelect> {
    const [row] = await this.exec(tx).insert(teams).values(input).returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<TeamInsert>,
    tx?: DrizzleExecutor,
  ): Promise<TeamSelect | null> {
    const [row] = await this.exec(tx)
      .update(teams)
      .set(patch)
      .where(and(eq(teams.id, id), isNull(teams.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(teams)
      .set({ deletedAt: new Date() })
      .where(eq(teams.id, id));
  }
}

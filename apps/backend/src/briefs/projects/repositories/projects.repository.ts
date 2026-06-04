import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { projects } from '../../../databases/pg-drizzle/briefs-schema';
import type {
  ProjectInsert,
  ProjectSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class ProjectsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async listByOrganization(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<ProjectSelect[]> {
    return this.exec(tx)
      .select()
      .from(projects)
      .where(
        and(eq(projects.organizationId, organizationId), isNull(projects.deletedAt)),
      )
      .orderBy(desc(projects.createdAt));
  }

  async findByIdScopedToOrg(
    id: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<ProjectSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.organizationId, organizationId),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByNameInOrg(
    organizationId: string,
    name: string,
    tx?: DrizzleExecutor,
  ): Promise<ProjectSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(projects.name, name),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: ProjectInsert, tx?: DrizzleExecutor): Promise<ProjectSelect> {
    const [row] = await this.exec(tx).insert(projects).values(input).returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<ProjectInsert>,
    tx?: DrizzleExecutor,
  ): Promise<ProjectSelect | null> {
    const [row] = await this.exec(tx)
      .update(projects)
      .set(patch)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, id));
  }
}

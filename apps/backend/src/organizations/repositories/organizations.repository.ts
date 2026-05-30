import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import { organizations } from '../../databases/pg-drizzle/schema';
import type {
  OrganizationInsert,
  OrganizationSelect,
} from '../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(
    slug: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async findByOwnerId(
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId))
      .limit(1);
    return row ?? null;
  }

  async create(
    input: OrganizationInsert,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect> {
    const [row] = await this.exec(tx)
      .insert(organizations)
      .values(input)
      .returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<Pick<OrganizationSelect, 'name' | 'slug'>>,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizations)
      .set(patch)
      .where(eq(organizations.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx).delete(organizations).where(eq(organizations.id, id));
  }

  async setOwner(
    id: string,
    newOwnerId: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizations)
      .set({ ownerId: newOwnerId })
      .where(and(eq(organizations.id, id)))
      .returning();
    return row ?? null;
  }
}

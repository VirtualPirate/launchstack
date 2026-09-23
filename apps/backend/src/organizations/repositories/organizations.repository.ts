import { Inject, Injectable } from '@nestjs/common';
import { KYSELY_DB } from '../../databases/kysely';
import type {
  AppDatabase,
  OrganizationInsert,
  OrganizationSelect,
} from '../../databases/kysely';

// Kysely's Transaction<DB> extends Kysely<DB>, so one type covers both.
export type DbExecutor = AppDatabase;

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  private exec(tx?: DbExecutor): DbExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DbExecutor,
  ): Promise<OrganizationSelect | null> {
    const row = await this.exec(tx)
      .selectFrom('organizations')
      .selectAll()
      .where('id', '=', id)
      .limit(1)
      .executeTakeFirst();
    return row ?? null;
  }

  /**
   * The one column OrgDeactivationGuard needs on every write. A missing row
   * reads as active: OrgContextGuard already proved the membership exists.
   */
  async findDeactivatedAt(id: string, tx?: DbExecutor): Promise<Date | null> {
    const row = await this.exec(tx)
      .selectFrom('organizations')
      .select('deactivatedAt')
      .where('id', '=', id)
      .executeTakeFirst();
    return row?.deactivatedAt ?? null;
  }

  async create(
    input: OrganizationInsert,
    tx?: DbExecutor,
  ): Promise<OrganizationSelect> {
    return this.exec(tx)
      .insertInto('organizations')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    id: string,
    patch: Partial<Pick<OrganizationSelect, 'name' | 'slug'>>,
    tx?: DbExecutor,
  ): Promise<OrganizationSelect | null> {
    const row = await this.exec(tx)
      .updateTable('organizations')
      .set({ ...patch, updatedAt: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ?? null;
  }

  async delete(id: string, tx?: DbExecutor): Promise<void> {
    await this.exec(tx)
      .deleteFrom('organizations')
      .where('id', '=', id)
      .execute();
  }

  /** Row lock; transaction-only by signature, since outside one it is released at once. */
  async lockById(id: string, tx: DbExecutor): Promise<{ id: string } | null> {
    const row = await tx
      .selectFrom('organizations')
      .select('id')
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    return row ?? null;
  }

  async setOwner(
    id: string,
    newOwnerId: string,
    tx?: DbExecutor,
  ): Promise<OrganizationSelect | null> {
    const row = await this.exec(tx)
      .updateTable('organizations')
      .set({ ownerId: newOwnerId, updatedAt: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ?? null;
  }
}

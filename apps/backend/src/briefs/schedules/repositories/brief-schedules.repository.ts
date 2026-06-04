import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { briefSchedules } from '../../../databases/pg-drizzle/briefs-schema';
import type {
  BriefScheduleInsert,
  BriefScheduleSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class BriefSchedulesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async listByOrganization(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<BriefScheduleSelect[]> {
    return this.exec(tx)
      .select()
      .from(briefSchedules)
      .where(
        and(
          eq(briefSchedules.organizationId, organizationId),
          isNull(briefSchedules.deletedAt),
        ),
      )
      .orderBy(desc(briefSchedules.createdAt));
  }

  async findByIdScopedToOrg(
    id: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<BriefScheduleSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(briefSchedules)
      .where(
        and(
          eq(briefSchedules.id, id),
          eq(briefSchedules.organizationId, organizationId),
          isNull(briefSchedules.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<BriefScheduleSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(briefSchedules)
      .where(and(eq(briefSchedules.id, id), isNull(briefSchedules.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async create(
    input: BriefScheduleInsert,
    tx?: DrizzleExecutor,
  ): Promise<BriefScheduleSelect> {
    const [row] = await this.exec(tx)
      .insert(briefSchedules)
      .values(input)
      .returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<BriefScheduleInsert>,
    tx?: DrizzleExecutor,
  ): Promise<BriefScheduleSelect | null> {
    const [row] = await this.exec(tx)
      .update(briefSchedules)
      .set(patch)
      .where(and(eq(briefSchedules.id, id), isNull(briefSchedules.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(briefSchedules)
      .set({ deletedAt: new Date() })
      .where(eq(briefSchedules.id, id));
  }

  /**
   * Selects due schedules and locks the rows for the duration of the transaction.
   * Caller MUST be inside a transaction (uses FOR UPDATE SKIP LOCKED).
   */
  async findDueForUpdate(
    limit: number,
    tx: DrizzleExecutor,
  ): Promise<BriefScheduleSelect[]> {
    const rows = await tx.execute(sql`
      SELECT * FROM briefs.brief_schedules
       WHERE deleted_at IS NULL
         AND paused = false
         AND next_run_at <= now()
       ORDER BY next_run_at ASC
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
    `);
    return rows as unknown as BriefScheduleSelect[];
  }
}

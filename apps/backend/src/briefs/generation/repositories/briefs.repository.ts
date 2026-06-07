import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { briefs } from '../../../databases/pg-drizzle/briefs-schema';
import type {
  BriefInsert,
  BriefSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

export interface ListBriefsFilters {
  organizationId: string;
  scheduleId?: string;
  scopeType?: 'project' | 'team' | 'collaborator' | 'repository';
  scopeProjectId?: string;
  scopeTeamId?: string;
  scopeCollaboratorId?: string;
  scopeRepositoryId?: string;
  limit: number;
  cursorPeriodEnd?: Date;
  cursorId?: string;
}

@Injectable()
export class BriefsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<BriefSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(briefs)
      .where(and(eq(briefs.id, id), isNull(briefs.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByIdScopedToOrg(
    id: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<BriefSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(briefs)
      .where(
        and(
          eq(briefs.id, id),
          eq(briefs.organizationId, organizationId),
          isNull(briefs.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: BriefInsert, tx?: DrizzleExecutor): Promise<BriefSelect> {
    const [row] = await this.exec(tx).insert(briefs).values(input).returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<BriefInsert>,
    tx?: DrizzleExecutor,
  ): Promise<BriefSelect | null> {
    const [row] = await this.exec(tx)
      .update(briefs)
      .set(patch)
      .where(and(eq(briefs.id, id), isNull(briefs.deletedAt)))
      .returning();
    return row ?? null;
  }

  async list(
    filters: ListBriefsFilters,
    tx?: DrizzleExecutor,
  ): Promise<BriefSelect[]> {
    const conditions = [
      eq(briefs.organizationId, filters.organizationId),
      isNull(briefs.deletedAt),
    ];
    if (filters.scheduleId)
      conditions.push(eq(briefs.briefScheduleId, filters.scheduleId));
    if (filters.scopeType)
      conditions.push(eq(briefs.scopeType, filters.scopeType));
    if (filters.scopeProjectId)
      conditions.push(eq(briefs.scopeProjectId, filters.scopeProjectId));
    if (filters.scopeTeamId)
      conditions.push(eq(briefs.scopeTeamId, filters.scopeTeamId));
    if (filters.scopeCollaboratorId)
      conditions.push(
        eq(briefs.scopeCollaboratorId, filters.scopeCollaboratorId),
      );
    if (filters.scopeRepositoryId)
      conditions.push(eq(briefs.scopeRepositoryId, filters.scopeRepositoryId));
    if (filters.cursorPeriodEnd && filters.cursorId) {
      conditions.push(
        or(
          lt(briefs.periodEnd, filters.cursorPeriodEnd),
          and(
            eq(briefs.periodEnd, filters.cursorPeriodEnd),
            lt(briefs.id, filters.cursorId),
          ),
        )!,
      );
    }
    return this.exec(tx)
      .select()
      .from(briefs)
      .where(and(...conditions))
      .orderBy(desc(briefs.periodEnd), desc(briefs.id))
      .limit(filters.limit);
  }

  async findPeriodStartsForSchedule(
    scheduleId: string,
    since: Date,
    tx?: DrizzleExecutor,
  ): Promise<Set<number>> {
    const rows = await this.exec(tx)
      .select({ periodStart: briefs.periodStart })
      .from(briefs)
      .where(
        and(
          eq(briefs.briefScheduleId, scheduleId),
          gte(briefs.periodStart, since),
          isNull(briefs.deletedAt),
        ),
      );
    return new Set(rows.map((r) => r.periodStart.getTime()));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import {
  slackInstallations,
  type SlackInstallationRaw,
} from '../../../databases/pg-drizzle/slack-schema';
import type {
  SlackInstallationInsert,
  SlackInstallationSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class SlackInstallationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<SlackInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(slackInstallations)
      .where(
        and(eq(slackInstallations.id, id), isNull(slackInstallations.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  }

  async findActiveByOrganizationId(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<SlackInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(slackInstallations)
      .where(
        and(
          eq(slackInstallations.organizationId, organizationId),
          isNull(slackInstallations.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByOrganizationIdIncludingDeleted(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<SlackInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(slackInstallations)
      .where(eq(slackInstallations.organizationId, organizationId))
      .limit(1);
    return row ?? null;
  }

  async findByIdScopedToOrg(
    id: string,
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<SlackInstallationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(slackInstallations)
      .where(
        and(
          eq(slackInstallations.id, id),
          eq(slackInstallations.organizationId, organizationId),
          isNull(slackInstallations.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(
    input: SlackInstallationInsert,
    tx?: DrizzleExecutor,
  ): Promise<SlackInstallationSelect> {
    const [row] = await this.exec(tx)
      .insert(slackInstallations)
      .values(input)
      .returning();
    return row;
  }

  async updateTokenAndRaw(
    id: string,
    accessToken: string,
    raw: SlackInstallationRaw,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .update(slackInstallations)
      .set({ accessToken, raw, deletedAt: null })
      .where(eq(slackInstallations.id, id));
  }

  async softDelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(slackInstallations)
      .set({ deletedAt: new Date() })
      .where(eq(slackInstallations.id, id));
  }

  async undelete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .update(slackInstallations)
      .set({ deletedAt: null })
      .where(eq(slackInstallations.id, id));
  }
}

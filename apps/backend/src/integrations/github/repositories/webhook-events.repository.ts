import { Inject, Injectable } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { githubWebhookEvents } from '../../../databases/pg-drizzle/github-schema';
import type {
  GithubWebhookEventInsert,
  GithubWebhookEventSelect,
} from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class GithubWebhookEventsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async create(
    input: GithubWebhookEventInsert,
    tx?: DrizzleExecutor,
  ): Promise<GithubWebhookEventSelect> {
    const [row] = await this.exec(tx)
      .insert(githubWebhookEvents)
      .values(input)
      .returning();
    return row;
  }
}

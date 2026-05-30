import { sql } from 'drizzle-orm';
import type { MigrationArgs } from '@drepkovsky/drizzle-migrations';

export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE TABLE "demo" (
	"id" serial PRIMARY KEY NOT NULL
);

        `);
}

export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "demo" CASCADE;
        `);
}

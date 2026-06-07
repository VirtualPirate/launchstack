
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE INDEX "briefs_organization_period_end_idx" ON "briefs"."briefs" USING btree ("organization_id","period_end");
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP INDEX "briefs"."briefs_organization_period_end_idx";
        `);
  
  };
  
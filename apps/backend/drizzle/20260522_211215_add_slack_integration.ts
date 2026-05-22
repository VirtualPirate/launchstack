
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE SCHEMA "slack";

CREATE TABLE "slack"."installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "slack"."installations" ADD CONSTRAINT "installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "slack_installations_org_active_unique" ON "slack"."installations" USING btree ("organization_id") WHERE "slack"."installations"."deleted_at" IS NULL;
CREATE INDEX "slack_installations_organization_idx" ON "slack"."installations" USING btree ("organization_id");
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "slack"."installations" CASCADE;
DROP SCHEMA "slack";

        `);
  
  };
  
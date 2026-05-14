
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE SCHEMA "github";

CREATE TYPE "github"."account_type" AS ENUM('User', 'Organization');
CREATE TABLE "github"."installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"github_installation_id" bigint NOT NULL,
	"github_account_id" bigint NOT NULL,
	"github_account_login" text NOT NULL,
	"github_account_type" "github"."account_type" NOT NULL,
	"github_account_avatar_url" text,
	"target_type" text NOT NULL,
	"suspended_at" timestamp with time zone,
	"connected_by_user_id" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE "github"."repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"private" boolean NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "github"."installations" ADD CONSTRAINT "installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "github"."installations" ADD CONSTRAINT "installations_connected_by_user_id_user_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "github"."repositories" ADD CONSTRAINT "repositories_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "github"."installations"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "installations_github_installation_id_unique" ON "github"."installations" USING btree ("github_installation_id");
CREATE INDEX "installations_organization_idx" ON "github"."installations" USING btree ("organization_id");
CREATE UNIQUE INDEX "repositories_installation_repo_unique" ON "github"."repositories" USING btree ("installation_id","github_repo_id");
CREATE INDEX "repositories_installation_idx" ON "github"."repositories" USING btree ("installation_id");
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "github"."installations" CASCADE;
DROP TABLE "github"."repositories" CASCADE;
DROP TYPE "github"."account_type";
DROP SCHEMA "github";

        `);
  
  };
  
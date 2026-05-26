
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE TABLE "github"."collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_user_id" bigint NOT NULL,
	"login" text NOT NULL,
	"node_id" text,
	"avatar_url" text,
	"html_url" text,
	"type" text,
	"site_admin" boolean DEFAULT false NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE "github"."repository_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	"permission_admin" boolean NOT NULL,
	"permission_maintain" boolean NOT NULL,
	"permission_push" boolean NOT NULL,
	"permission_triage" boolean NOT NULL,
	"permission_pull" boolean NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "github"."repository_collaborators" ADD CONSTRAINT "repository_collaborators_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "github"."repositories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "github"."repository_collaborators" ADD CONSTRAINT "repository_collaborators_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "github"."collaborators"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "collaborators_github_user_id_unique" ON "github"."collaborators" USING btree ("github_user_id");
CREATE INDEX "collaborators_login_idx" ON "github"."collaborators" USING btree ("login");
CREATE UNIQUE INDEX "repo_collaborators_repo_collab_unique" ON "github"."repository_collaborators" USING btree ("repository_id","collaborator_id");
CREATE INDEX "repo_collaborators_collaborator_idx" ON "github"."repository_collaborators" USING btree ("collaborator_id");
CREATE INDEX "repo_collaborators_active_repo_idx" ON "github"."repository_collaborators" USING btree ("repository_id") WHERE "github"."repository_collaborators"."deleted_at" IS NULL;
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "github"."collaborators" CASCADE;
DROP TABLE "github"."repository_collaborators" CASCADE;
        `);
  
  };
  
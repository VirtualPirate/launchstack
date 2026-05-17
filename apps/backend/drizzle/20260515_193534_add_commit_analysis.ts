
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE TYPE "github"."commit_analysis_status" AS ENUM('analyzed', 'skipped_merge', 'skipped_empty', 'failed');
CREATE TYPE "github"."commit_type" AS ENUM('fix', 'feature', 'optimization', 'refactor', 'docs', 'test', 'chore');
CREATE TABLE "github"."commit_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commit_id" uuid NOT NULL,
	"commit_type" "github"."commit_type",
	"summary" text,
	"changes" jsonb,
	"status" "github"."commit_analysis_status" NOT NULL,
	"failure_reason" text,
	"model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"diff_chars_sent" integer,
	"diff_was_truncated" boolean DEFAULT false NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE "github"."commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"sha" varchar(40) NOT NULL,
	"parent_count" integer NOT NULL,
	"message" text NOT NULL,
	"author_github_user_id" bigint,
	"author_github_login" text,
	"author_name" text NOT NULL,
	"author_email" text NOT NULL,
	"committer_github_user_id" bigint,
	"committer_github_login" text,
	"committer_name" text NOT NULL,
	"committer_email" text NOT NULL,
	"authored_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "github"."commit_analyses" ADD CONSTRAINT "commit_analyses_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "github"."commits"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "github"."commits" ADD CONSTRAINT "commits_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "github"."repositories"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "commit_analyses_commit_unique" ON "github"."commit_analyses" USING btree ("commit_id");
CREATE UNIQUE INDEX "commits_repo_sha_unique" ON "github"."commits" USING btree ("repository_id","sha");
CREATE INDEX "commits_repo_authored_at_idx" ON "github"."commits" USING btree ("repository_id","authored_at");
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "github"."commit_analyses" CASCADE;
DROP TABLE "github"."commits" CASCADE;
DROP TYPE "github"."commit_analysis_status";
DROP TYPE "github"."commit_type";
        `);
  
  };
  
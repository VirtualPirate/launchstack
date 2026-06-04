
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE SCHEMA "briefs";

CREATE TYPE "briefs"."cadence_type" AS ENUM('daily', 'weekly', 'monthly');
CREATE TYPE "briefs"."scope_type" AS ENUM('project', 'team', 'collaborator', 'repository');
CREATE TYPE "briefs"."status" AS ENUM('pending', 'generating', 'generated', 'delivered', 'failed');
CREATE TABLE "briefs"."brief_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"cadence_type" "briefs"."cadence_type" NOT NULL,
	"cadence_time" time NOT NULL,
	"cadence_day_of_week" smallint,
	"cadence_day_of_month" smallint,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"scope_type" "briefs"."scope_type" NOT NULL,
	"scope_project_id" uuid,
	"scope_team_id" uuid,
	"scope_collaborator_id" uuid,
	"scope_repository_id" uuid,
	"paused" boolean DEFAULT false NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone,
	"email_recipients" text[] DEFAULT '{}'::text[] NOT NULL,
	"slack_installation_id" uuid,
	"slack_channel_id" text,
	"created_by_member_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "brief_schedules_cadence_day_of_week_check" CHECK ("briefs"."brief_schedules"."cadence_day_of_week" IS NULL OR ("briefs"."brief_schedules"."cadence_day_of_week" BETWEEN 0 AND 6)),
	CONSTRAINT "brief_schedules_cadence_day_of_month_check" CHECK ("briefs"."brief_schedules"."cadence_day_of_month" IS NULL OR ("briefs"."brief_schedules"."cadence_day_of_month" BETWEEN 1 AND 31)),
	CONSTRAINT "brief_schedules_scope_xor" CHECK ((
        (CASE WHEN "briefs"."brief_schedules"."scope_project_id"      IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "briefs"."brief_schedules"."scope_team_id"         IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "briefs"."brief_schedules"."scope_collaborator_id" IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "briefs"."brief_schedules"."scope_repository_id"   IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1),
	CONSTRAINT "brief_schedules_scope_type_matches" CHECK ((
        ("briefs"."brief_schedules"."scope_type" = 'project'      AND "briefs"."brief_schedules"."scope_project_id"      IS NOT NULL) OR
        ("briefs"."brief_schedules"."scope_type" = 'team'         AND "briefs"."brief_schedules"."scope_team_id"         IS NOT NULL) OR
        ("briefs"."brief_schedules"."scope_type" = 'collaborator' AND "briefs"."brief_schedules"."scope_collaborator_id" IS NOT NULL) OR
        ("briefs"."brief_schedules"."scope_type" = 'repository'   AND "briefs"."brief_schedules"."scope_repository_id"   IS NOT NULL)
      )),
	CONSTRAINT "brief_schedules_slack_pair" CHECK (("briefs"."brief_schedules"."slack_installation_id" IS NULL AND "briefs"."brief_schedules"."slack_channel_id" IS NULL)
        OR ("briefs"."brief_schedules"."slack_installation_id" IS NOT NULL AND "briefs"."brief_schedules"."slack_channel_id" IS NOT NULL))
);

CREATE TABLE "briefs"."briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brief_schedule_id" uuid,
	"scope_type" "briefs"."scope_type" NOT NULL,
	"scope_project_id" uuid,
	"scope_team_id" uuid,
	"scope_collaborator_id" uuid,
	"scope_repository_id" uuid,
	"title" varchar(200) DEFAULT '' NOT NULL,
	"brief_info_title" varchar(300) DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"contributor_count" integer DEFAULT 0 NOT NULL,
	"commit_count" integer DEFAULT 0 NOT NULL,
	"status" "briefs"."status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"delivery_emails" text[] DEFAULT '{}'::text[] NOT NULL,
	"delivery_slack_channel_id" text,
	"generated_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE "briefs"."project_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "briefs"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500),
	"color" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE "briefs"."team_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "briefs"."teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500),
	"color" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_scope_project_id_projects_id_fk" FOREIGN KEY ("scope_project_id") REFERENCES "briefs"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_scope_team_id_teams_id_fk" FOREIGN KEY ("scope_team_id") REFERENCES "briefs"."teams"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_scope_collaborator_id_collaborators_id_fk" FOREIGN KEY ("scope_collaborator_id") REFERENCES "github"."collaborators"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_scope_repository_id_repositories_id_fk" FOREIGN KEY ("scope_repository_id") REFERENCES "github"."repositories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_slack_installation_id_installations_id_fk" FOREIGN KEY ("slack_installation_id") REFERENCES "slack"."installations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."brief_schedules" ADD CONSTRAINT "brief_schedules_created_by_member_id_user_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."briefs" ADD CONSTRAINT "briefs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."briefs" ADD CONSTRAINT "briefs_brief_schedule_id_brief_schedules_id_fk" FOREIGN KEY ("brief_schedule_id") REFERENCES "briefs"."brief_schedules"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."briefs" ADD CONSTRAINT "briefs_scope_project_id_projects_id_fk" FOREIGN KEY ("scope_project_id") REFERENCES "briefs"."projects"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."briefs" ADD CONSTRAINT "briefs_scope_team_id_teams_id_fk" FOREIGN KEY ("scope_team_id") REFERENCES "briefs"."teams"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."briefs" ADD CONSTRAINT "briefs_scope_collaborator_id_collaborators_id_fk" FOREIGN KEY ("scope_collaborator_id") REFERENCES "github"."collaborators"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."briefs" ADD CONSTRAINT "briefs_scope_repository_id_repositories_id_fk" FOREIGN KEY ("scope_repository_id") REFERENCES "github"."repositories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "briefs"."project_repositories" ADD CONSTRAINT "project_repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "briefs"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."project_repositories" ADD CONSTRAINT "project_repositories_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "github"."repositories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."team_collaborators" ADD CONSTRAINT "team_collaborators_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "briefs"."teams"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."team_collaborators" ADD CONSTRAINT "team_collaborators_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "github"."collaborators"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "briefs"."teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "brief_schedules_organization_idx" ON "briefs"."brief_schedules" USING btree ("organization_id");
CREATE INDEX "brief_schedules_next_run_active_idx" ON "briefs"."brief_schedules" USING btree ("next_run_at") WHERE "briefs"."brief_schedules"."paused" = false AND "briefs"."brief_schedules"."deleted_at" IS NULL;
CREATE INDEX "briefs_organization_created_idx" ON "briefs"."briefs" USING btree ("organization_id","created_at");
CREATE INDEX "briefs_schedule_idx" ON "briefs"."briefs" USING btree ("brief_schedule_id");
CREATE INDEX "briefs_org_scope_idx" ON "briefs"."briefs" USING btree ("organization_id","scope_type","scope_project_id","scope_team_id","scope_collaborator_id","scope_repository_id");
CREATE UNIQUE INDEX "project_repositories_pair_unique" ON "briefs"."project_repositories" USING btree ("project_id","repository_id");
CREATE INDEX "project_repositories_project_idx" ON "briefs"."project_repositories" USING btree ("project_id");
CREATE INDEX "project_repositories_repository_idx" ON "briefs"."project_repositories" USING btree ("repository_id");
CREATE INDEX "projects_organization_idx" ON "briefs"."projects" USING btree ("organization_id");
CREATE UNIQUE INDEX "projects_org_name_unique" ON "briefs"."projects" USING btree ("organization_id","name") WHERE "briefs"."projects"."deleted_at" IS NULL;
CREATE UNIQUE INDEX "team_collaborators_pair_unique" ON "briefs"."team_collaborators" USING btree ("team_id","collaborator_id");
CREATE INDEX "team_collaborators_team_idx" ON "briefs"."team_collaborators" USING btree ("team_id");
CREATE INDEX "team_collaborators_collaborator_idx" ON "briefs"."team_collaborators" USING btree ("collaborator_id");
CREATE INDEX "teams_organization_idx" ON "briefs"."teams" USING btree ("organization_id");
CREATE UNIQUE INDEX "teams_org_name_unique" ON "briefs"."teams" USING btree ("organization_id","name") WHERE "briefs"."teams"."deleted_at" IS NULL;
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "briefs"."brief_schedules" CASCADE;
DROP TABLE "briefs"."briefs" CASCADE;
DROP TABLE "briefs"."project_repositories" CASCADE;
DROP TABLE "briefs"."projects" CASCADE;
DROP TABLE "briefs"."team_collaborators" CASCADE;
DROP TABLE "briefs"."teams" CASCADE;
DROP TYPE "briefs"."cadence_type";
DROP TYPE "briefs"."scope_type";
DROP TYPE "briefs"."status";
DROP SCHEMA "briefs";

        `);
  
  };
  
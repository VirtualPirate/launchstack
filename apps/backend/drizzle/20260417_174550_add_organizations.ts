import { sql } from 'drizzle-orm';
import type { MigrationArgs } from '@drepkovsky/drizzle-migrations';

export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          CREATE TYPE "public"."invite_role" AS ENUM('admin', 'viewer');
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'viewer');
CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "invite_role" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" text,
	"accepted_by_user_id" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "organization_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;
CREATE UNIQUE INDEX "organization_invites_token_hash_unique" ON "organization_invites" USING btree ("token_hash");
CREATE UNIQUE INDEX "organization_invites_pending_org_email_unique" ON "organization_invites" USING btree ("organization_id","email") WHERE "organization_invites"."status" = 'pending';
CREATE INDEX "organization_invites_email_idx" ON "organization_invites" USING btree ("email");
CREATE INDEX "organization_invites_organization_idx" ON "organization_invites" USING btree ("organization_id");
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");
CREATE UNIQUE INDEX "organizations_owner_id_unique" ON "organizations" USING btree ("owner_id");
        `);
}

export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          DROP TABLE "organization_invites" CASCADE;
DROP TABLE "organization_members" CASCADE;
DROP TABLE "organizations" CASCADE;
DROP TYPE "public"."invite_role";
DROP TYPE "public"."invite_status";
DROP TYPE "public"."organization_role";
        `);
}

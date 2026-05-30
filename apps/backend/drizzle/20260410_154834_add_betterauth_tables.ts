import { sql } from 'drizzle-orm';
import type { MigrationArgs } from '@drepkovsky/drizzle-migrations';

export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
CREATE SCHEMA IF NOT EXISTS "auth";

CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);

CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "account_userId_idx" ON "auth"."account" USING btree ("user_id");
CREATE INDEX "session_userId_idx" ON "auth"."session" USING btree ("user_id");
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");
        `);
}

export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
DROP TABLE "auth"."account" CASCADE;
DROP TABLE "auth"."session" CASCADE;
DROP TABLE "auth"."user" CASCADE;
DROP TABLE "auth"."verification" CASCADE;
DROP SCHEMA IF EXISTS "auth";
        `);
}

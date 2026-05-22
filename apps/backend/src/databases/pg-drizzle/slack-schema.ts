import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './schema';

export const slackSchema = pgSchema('slack');

export interface SlackInstallationRaw {
  teamId: string;
  teamName: string;
  botUserId: string;
  appId: string;
  scope: string;
  authedUserId?: string;
  connectedByUserId?: string;
  oauthResponse: unknown;
}

export const slackInstallations = slackSchema.table(
  'installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    raw: jsonb('raw').$type<SlackInstallationRaw>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('slack_installations_org_active_unique')
      .on(table.organizationId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('slack_installations_organization_idx').on(table.organizationId),
  ],
);

export const slackInstallationsRelations = relations(
  slackInstallations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [slackInstallations.organizationId],
      references: [organizations.id],
    }),
  }),
);

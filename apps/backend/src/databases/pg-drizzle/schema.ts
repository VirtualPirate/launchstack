import { relations, sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// Keep the demo table for now so existing migrations remain valid.
export const demo = pgTable('demo', {
  id: serial('id').primaryKey(),
});

export const organizationRoleEnum = pgEnum('organization_role', [
  'owner',
  'admin',
  'viewer',
]);

export const inviteRoleEnum = pgEnum('invite_role', ['admin', 'viewer']);

export const inviteStatusEnum = pgEnum('invite_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('organizations_slug_unique').on(table.slug),
    uniqueIndex('organizations_owner_id_unique').on(table.ownerId),
  ],
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: organizationRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('organization_members_org_user_unique').on(
      table.organizationId,
      table.userId,
    ),
    index('organization_members_user_idx').on(table.userId),
  ],
);

export const organizationInvites = pgTable(
  'organization_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: inviteRoleEnum('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    status: inviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    acceptedByUserId: text('accepted_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('organization_invites_token_hash_unique').on(table.tokenHash),
    uniqueIndex('organization_invites_pending_org_email_unique')
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index('organization_invites_email_idx').on(table.email),
    index('organization_invites_organization_idx').on(table.organizationId),
  ],
);

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    owner: one(user, {
      fields: [organizations.ownerId],
      references: [user.id],
    }),
    members: many(organizationMembers),
    invites: many(organizationInvites),
  }),
);

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(user, {
      fields: [organizationMembers.userId],
      references: [user.id],
    }),
  }),
);

export const organizationInvitesRelations = relations(
  organizationInvites,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvites.organizationId],
      references: [organizations.id],
    }),
    invitedBy: one(user, {
      fields: [organizationInvites.invitedByUserId],
      references: [user.id],
      relationName: 'invite_inviter',
    }),
    acceptedBy: one(user, {
      fields: [organizationInvites.acceptedByUserId],
      references: [user.id],
      relationName: 'invite_acceptor',
    }),
  }),
);

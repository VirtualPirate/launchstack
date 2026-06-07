import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
import { organizations } from './schema';
import { githubCollaborators, githubRepositories } from './github-schema';
import { slackInstallations } from './slack-schema';

export const briefsSchema = pgSchema('briefs');

export const briefCadenceTypeEnum = briefsSchema.enum('cadence_type', [
  'daily',
  'weekly',
  'monthly',
]);

export const briefScopeTypeEnum = briefsSchema.enum('scope_type', [
  'project',
  'team',
  'collaborator',
  'repository',
]);

export const briefStatusEnum = briefsSchema.enum('status', [
  'pending',
  'generating',
  'generated',
  'delivered',
  'failed',
]);

export const projects = briefsSchema.table(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    color: varchar('color', { length: 16 }),
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
    index('projects_organization_idx').on(table.organizationId),
    uniqueIndex('projects_org_name_unique')
      .on(table.organizationId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const projectRepositories = briefsSchema.table(
  'project_repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => githubRepositories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('project_repositories_pair_unique').on(
      table.projectId,
      table.repositoryId,
    ),
    index('project_repositories_project_idx').on(table.projectId),
    index('project_repositories_repository_idx').on(table.repositoryId),
  ],
);

export const teams = briefsSchema.table(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    color: varchar('color', { length: 16 }),
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
    index('teams_organization_idx').on(table.organizationId),
    uniqueIndex('teams_org_name_unique')
      .on(table.organizationId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const teamCollaborators = briefsSchema.table(
  'team_collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    collaboratorId: uuid('collaborator_id')
      .notNull()
      .references(() => githubCollaborators.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('team_collaborators_pair_unique').on(
      table.teamId,
      table.collaboratorId,
    ),
    index('team_collaborators_team_idx').on(table.teamId),
    index('team_collaborators_collaborator_idx').on(table.collaboratorId),
  ],
);

export const briefSchedules = briefsSchema.table(
  'brief_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),

    cadenceType: briefCadenceTypeEnum('cadence_type').notNull(),
    cadenceTime: time('cadence_time').notNull(),
    cadenceDayOfWeek: smallint('cadence_day_of_week'),
    cadenceDayOfMonth: smallint('cadence_day_of_month'),
    timezone: text('timezone').notNull().default('UTC'),

    scopeType: briefScopeTypeEnum('scope_type').notNull(),
    scopeProjectId: uuid('scope_project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    scopeTeamId: uuid('scope_team_id').references(() => teams.id, {
      onDelete: 'cascade',
    }),
    scopeCollaboratorId: uuid('scope_collaborator_id').references(
      () => githubCollaborators.id,
      { onDelete: 'cascade' },
    ),
    scopeRepositoryId: uuid('scope_repository_id').references(
      () => githubRepositories.id,
      { onDelete: 'cascade' },
    ),

    paused: boolean('paused').notNull().default(false),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),

    emailRecipients: text('email_recipients')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    slackInstallationId: uuid('slack_installation_id').references(
      () => slackInstallations.id,
      { onDelete: 'set null' },
    ),
    slackChannelId: text('slack_channel_id'),

    createdByMemberId: text('created_by_member_id').references(() => user.id, {
      onDelete: 'set null',
    }),
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
    check(
      'brief_schedules_cadence_day_of_week_check',
      sql`${table.cadenceDayOfWeek} IS NULL OR (${table.cadenceDayOfWeek} BETWEEN 0 AND 6)`,
    ),
    check(
      'brief_schedules_cadence_day_of_month_check',
      sql`${table.cadenceDayOfMonth} IS NULL OR (${table.cadenceDayOfMonth} BETWEEN 1 AND 31)`,
    ),
    check(
      'brief_schedules_scope_xor',
      sql`(
        (CASE WHEN ${table.scopeProjectId}      IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN ${table.scopeTeamId}         IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN ${table.scopeCollaboratorId} IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN ${table.scopeRepositoryId}   IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1`,
    ),
    check(
      'brief_schedules_scope_type_matches',
      sql`(
        (${table.scopeType} = 'project'      AND ${table.scopeProjectId}      IS NOT NULL) OR
        (${table.scopeType} = 'team'         AND ${table.scopeTeamId}         IS NOT NULL) OR
        (${table.scopeType} = 'collaborator' AND ${table.scopeCollaboratorId} IS NOT NULL) OR
        (${table.scopeType} = 'repository'   AND ${table.scopeRepositoryId}   IS NOT NULL)
      )`,
    ),
    check(
      'brief_schedules_slack_pair',
      sql`(${table.slackInstallationId} IS NULL AND ${table.slackChannelId} IS NULL)
        OR (${table.slackInstallationId} IS NOT NULL AND ${table.slackChannelId} IS NOT NULL)`,
    ),
    index('brief_schedules_organization_idx').on(table.organizationId),
    index('brief_schedules_next_run_active_idx')
      .on(table.nextRunAt)
      .where(sql`${table.paused} = false AND ${table.deletedAt} IS NULL`),
  ],
);

export const briefs = briefsSchema.table(
  'briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    briefScheduleId: uuid('brief_schedule_id').references(
      () => briefSchedules.id,
      { onDelete: 'set null' },
    ),

    scopeType: briefScopeTypeEnum('scope_type').notNull(),
    scopeProjectId: uuid('scope_project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    scopeTeamId: uuid('scope_team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),
    scopeCollaboratorId: uuid('scope_collaborator_id').references(
      () => githubCollaborators.id,
      { onDelete: 'set null' },
    ),
    scopeRepositoryId: uuid('scope_repository_id').references(
      () => githubRepositories.id,
      { onDelete: 'set null' },
    ),

    title: varchar('title', { length: 200 }).notNull().default(''),
    briefInfoTitle: varchar('brief_info_title', { length: 300 })
      .notNull()
      .default(''),
    summary: text('summary').notNull().default(''),

    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    contributorCount: integer('contributor_count').notNull().default(0),
    commitCount: integer('commit_count').notNull().default(0),

    status: briefStatusEnum('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    model: text('model'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),

    deliveryEmails: text('delivery_emails')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    deliverySlackChannelId: text('delivery_slack_channel_id'),

    generatedAt: timestamp('generated_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

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
    index('briefs_organization_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('briefs_organization_period_end_idx').on(
      table.organizationId,
      table.periodEnd,
    ),
    index('briefs_schedule_idx').on(table.briefScheduleId),
    index('briefs_org_scope_idx').on(
      table.organizationId,
      table.scopeType,
      table.scopeProjectId,
      table.scopeTeamId,
      table.scopeCollaboratorId,
      table.scopeRepositoryId,
    ),
  ],
);

export const projectsRelations = relations(projects, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  repositories: many(projectRepositories),
}));

export const projectRepositoriesRelations = relations(
  projectRepositories,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectRepositories.projectId],
      references: [projects.id],
    }),
    repository: one(githubRepositories, {
      fields: [projectRepositories.repositoryId],
      references: [githubRepositories.id],
    }),
  }),
);

export const teamsRelations = relations(teams, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  collaborators: many(teamCollaborators),
}));

export const teamCollaboratorsRelations = relations(
  teamCollaborators,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamCollaborators.teamId],
      references: [teams.id],
    }),
    collaborator: one(githubCollaborators, {
      fields: [teamCollaborators.collaboratorId],
      references: [githubCollaborators.id],
    }),
  }),
);

export const briefSchedulesRelations = relations(briefSchedules, ({ one }) => ({
  organization: one(organizations, {
    fields: [briefSchedules.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [briefSchedules.scopeProjectId],
    references: [projects.id],
  }),
  team: one(teams, {
    fields: [briefSchedules.scopeTeamId],
    references: [teams.id],
  }),
  slackInstallation: one(slackInstallations, {
    fields: [briefSchedules.slackInstallationId],
    references: [slackInstallations.id],
  }),
}));

export const briefsRelations = relations(briefs, ({ one }) => ({
  organization: one(organizations, {
    fields: [briefs.organizationId],
    references: [organizations.id],
  }),
  schedule: one(briefSchedules, {
    fields: [briefs.briefScheduleId],
    references: [briefSchedules.id],
  }),
}));

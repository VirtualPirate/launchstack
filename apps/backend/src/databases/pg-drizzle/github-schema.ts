import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
import { organizations } from './schema';

export const githubSchema = pgSchema('github');

export const githubAccountTypeEnum = githubSchema.enum('account_type', [
  'User',
  'Organization',
]);

export const githubCommitTypeEnum = githubSchema.enum('commit_type', [
  'fix',
  'feature',
  'optimization',
  'refactor',
  'docs',
  'test',
  'chore',
]);

export const githubCommitAnalysisStatusEnum = githubSchema.enum(
  'commit_analysis_status',
  ['analyzed', 'skipped_merge', 'skipped_empty', 'failed'],
);

export const githubInstallations = githubSchema.table(
  'installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    githubInstallationId: bigint('github_installation_id', {
      mode: 'bigint',
    }).notNull(),
    githubAccountId: bigint('github_account_id', { mode: 'bigint' }).notNull(),
    githubAccountLogin: text('github_account_login').notNull(),
    githubAccountType: githubAccountTypeEnum('github_account_type').notNull(),
    githubAccountAvatarUrl: text('github_account_avatar_url'),
    targetType: text('target_type').notNull(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    connectedByUserId: text('connected_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    raw: jsonb('raw'),
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
    uniqueIndex('installations_github_installation_id_unique').on(
      table.githubInstallationId,
    ),
    index('installations_organization_idx').on(table.organizationId),
  ],
);

export const githubRepositories = githubSchema.table(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installationId: uuid('installation_id')
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    githubRepoId: bigint('github_repo_id', { mode: 'bigint' }).notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull(),
    private: boolean('private').notNull(),
    raw: jsonb('raw'),
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
    uniqueIndex('repositories_installation_repo_unique').on(
      table.installationId,
      table.githubRepoId,
    ),
    index('repositories_installation_idx').on(table.installationId),
  ],
);

export const githubCommits = githubSchema.table(
  'commits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => githubRepositories.id, { onDelete: 'cascade' }),
    sha: varchar('sha', { length: 40 }).notNull(),
    parentCount: integer('parent_count').notNull(),
    message: text('message').notNull(),
    authorGithubUserId: bigint('author_github_user_id', { mode: 'bigint' }),
    authorGithubLogin: text('author_github_login'),
    authorName: text('author_name').notNull(),
    authorEmail: text('author_email').notNull(),
    committerGithubUserId: bigint('committer_github_user_id', {
      mode: 'bigint',
    }),
    committerGithubLogin: text('committer_github_login'),
    committerName: text('committer_name').notNull(),
    committerEmail: text('committer_email').notNull(),
    authoredAt: timestamp('authored_at', { withTimezone: true }).notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true }).notNull(),
    raw: jsonb('raw').notNull(),
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
    uniqueIndex('commits_repo_sha_unique').on(table.repositoryId, table.sha),
    index('commits_repo_authored_at_idx').on(
      table.repositoryId,
      table.authoredAt,
    ),
  ],
);

export const githubCommitAnalyses = githubSchema.table(
  'commit_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commitId: uuid('commit_id')
      .notNull()
      .references(() => githubCommits.id, { onDelete: 'cascade' }),
    commitType: githubCommitTypeEnum('commit_type'),
    summary: text('summary'),
    changes: jsonb('changes').$type<string[]>(),
    status: githubCommitAnalysisStatusEnum('status').notNull(),
    failureReason: text('failure_reason'),
    model: text('model'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    diffCharsSent: integer('diff_chars_sent'),
    diffWasTruncated: boolean('diff_was_truncated').notNull().default(false),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('commit_analyses_commit_unique').on(table.commitId)],
);

export const githubWebhookEvents = githubSchema.table('webhook_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  event: varchar('event', { length: 64 }),
  raw: jsonb('raw').notNull(),
  state: varchar('state', { length: 32 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const githubInstallationsRelations = relations(
  githubInstallations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [githubInstallations.organizationId],
      references: [organizations.id],
    }),
    connectedBy: one(user, {
      fields: [githubInstallations.connectedByUserId],
      references: [user.id],
    }),
    repositories: many(githubRepositories),
  }),
);

export const githubRepositoriesRelations = relations(
  githubRepositories,
  ({ one }) => ({
    installation: one(githubInstallations, {
      fields: [githubRepositories.installationId],
      references: [githubInstallations.id],
    }),
  }),
);

export const githubCommitsRelations = relations(githubCommits, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubCommits.repositoryId],
    references: [githubRepositories.id],
  }),
  analysis: one(githubCommitAnalyses, {
    fields: [githubCommits.id],
    references: [githubCommitAnalyses.commitId],
  }),
}));

export const githubCommitAnalysesRelations = relations(
  githubCommitAnalyses,
  ({ one }) => ({
    commit: one(githubCommits, {
      fields: [githubCommitAnalyses.commitId],
      references: [githubCommits.id],
    }),
  }),
);

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  demo,
  organizations,
  organizationInvites,
  organizationMembers,
} from './schema';
import type { githubInstallations, githubRepositories } from './github-schema';
import type { user, session, account, verification } from './auth-schema';

export type DemoSelect = InferSelectModel<typeof demo>;
export type DemoInsert = InferInsertModel<typeof demo>;

export type UserSelect = InferSelectModel<typeof user>;
export type UserInsert = InferInsertModel<typeof user>;

export type SessionSelect = InferSelectModel<typeof session>;
export type SessionInsert = InferInsertModel<typeof session>;

export type AccountSelect = InferSelectModel<typeof account>;
export type AccountInsert = InferInsertModel<typeof account>;

export type VerificationSelect = InferSelectModel<typeof verification>;
export type VerificationInsert = InferInsertModel<typeof verification>;

export type OrganizationSelect = InferSelectModel<typeof organizations>;
export type OrganizationInsert = InferInsertModel<typeof organizations>;

export type OrganizationMemberSelect = InferSelectModel<
  typeof organizationMembers
>;
export type OrganizationMemberInsert = InferInsertModel<
  typeof organizationMembers
>;

export type OrganizationInviteSelect = InferSelectModel<
  typeof organizationInvites
>;
export type OrganizationInviteInsert = InferInsertModel<
  typeof organizationInvites
>;

export type GithubInstallationSelect = InferSelectModel<
  typeof githubInstallations
>;
export type GithubInstallationInsert = InferInsertModel<
  typeof githubInstallations
>;

export type GithubRepositorySelect = InferSelectModel<
  typeof githubRepositories
>;
export type GithubRepositoryInsert = InferInsertModel<
  typeof githubRepositories
>;

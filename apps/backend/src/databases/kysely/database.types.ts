import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely';

/**
 * Column helpers.
 *
 * The Kysely instance runs with CamelCasePlugin, so all table/column
 * identifiers here are camelCase and are translated to snake_case SQL.
 * Timestamps come back as Date (node-postgres parses them).
 *
 * Kysely has no `$onUpdate`: repositories set `updatedAt: new Date()`
 * explicitly on every update.
 */
export type GeneratedTimestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>;

// ---------------------------------------------------------------------------
// Enums (Postgres enum types)
// ---------------------------------------------------------------------------

export type OrganizationRole = 'owner' | 'admin' | 'viewer';
export type InviteRole = 'admin' | 'viewer';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

// ---------------------------------------------------------------------------
// public schema
// ---------------------------------------------------------------------------

export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  ownerId: string;
  /** Set = frozen read-only; see OrgDeactivationGuard. */
  deactivatedAt: Date | null;
  createdAt: GeneratedTimestamp;
  updatedAt: GeneratedTimestamp;
}

export interface OrganizationMembersTable {
  id: Generated<string>;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: GeneratedTimestamp;
}

export interface OrganizationInvitesTable {
  id: Generated<string>;
  organizationId: string;
  email: string;
  role: InviteRole;
  tokenHash: string;
  status: Generated<InviteStatus>;
  expiresAt: Date;
  invitedByUserId: string | null;
  acceptedByUserId: string | null;
  acceptedAt: Date | null;
  createdAt: GeneratedTimestamp;
  updatedAt: GeneratedTimestamp;
}

// ---------------------------------------------------------------------------
// auth schema (Better Auth)
// ---------------------------------------------------------------------------

export interface AuthUserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: Generated<boolean>;
  image: string | null;
  createdAt: GeneratedTimestamp;
  updatedAt: GeneratedTimestamp;
}

export interface AuthSessionTable {
  id: string;
  expiresAt: Date;
  token: string;
  createdAt: GeneratedTimestamp;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string;
}

export interface AuthAccountTable {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: GeneratedTimestamp;
  updatedAt: Date;
}

export interface AuthVerificationTable {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: GeneratedTimestamp;
  updatedAt: GeneratedTimestamp;
}

// ---------------------------------------------------------------------------
// Database interface — keys are camelCase; CamelCasePlugin maps them to the
// snake_case (and schema-qualified) SQL identifiers.
// ---------------------------------------------------------------------------

export interface Database {
  organizations: OrganizationsTable;
  organizationMembers: OrganizationMembersTable;
  organizationInvites: OrganizationInvitesTable;

  'auth.user': AuthUserTable;
  'auth.session': AuthSessionTable;
  'auth.account': AuthAccountTable;
  'auth.verification': AuthVerificationTable;
}

// ---------------------------------------------------------------------------
// Row type aliases
// ---------------------------------------------------------------------------

export type UserSelect = Selectable<AuthUserTable>;
export type UserInsert = Insertable<AuthUserTable>;

export type SessionSelect = Selectable<AuthSessionTable>;
export type SessionInsert = Insertable<AuthSessionTable>;

export type AccountSelect = Selectable<AuthAccountTable>;
export type AccountInsert = Insertable<AuthAccountTable>;

export type VerificationSelect = Selectable<AuthVerificationTable>;
export type VerificationInsert = Insertable<AuthVerificationTable>;

export type OrganizationSelect = Selectable<OrganizationsTable>;
export type OrganizationInsert = Insertable<OrganizationsTable>;
export type OrganizationUpdate = Updateable<OrganizationsTable>;

export type OrganizationMemberSelect = Selectable<OrganizationMembersTable>;
export type OrganizationMemberInsert = Insertable<OrganizationMembersTable>;

export type OrganizationInviteSelect = Selectable<OrganizationInvitesTable>;
export type OrganizationInviteInsert = Insertable<OrganizationInvitesTable>;
export type OrganizationInviteUpdate = Updateable<OrganizationInvitesTable>;

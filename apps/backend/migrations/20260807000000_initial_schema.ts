import { Kysely, sql } from 'kysely';

/**
 * Initial schema: Better Auth (auth) and organizations (public).
 *
 * Migrations are intentionally independent of application code — they use only
 * `kysely` imports and literal snake_case identifiers (the app's CamelCasePlugin
 * is not installed on the migration connection).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await createAuthSchema(db);
  await createOrganizations(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    'organization_invites',
    'organization_members',
    'organizations',
  ]) {
    await db.schema.dropTable(table).ifExists().cascade().execute();
  }
  for (const type of ['invite_role', 'invite_status', 'organization_role']) {
    await db.schema.dropType(type).ifExists().execute();
  }

  await db.schema.dropSchema('auth').ifExists().cascade().execute();
}

// ---------------------------------------------------------------------------
// auth — Better Auth owns these tables. Timestamps are deliberately naive
// (`timestamp`, no time zone) to match what Better Auth reads and writes.
// ---------------------------------------------------------------------------

async function createAuthSchema(db: Kysely<any>): Promise<void> {
  await db.schema.createSchema('auth').ifNotExists().execute();

  await db.schema
    .withSchema('auth')
    .createTable('user')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('email_verified', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('image', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('user_email_unique', ['email'])
    .execute();

  await db.schema
    .withSchema('auth')
    .createTable('session')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('auth.user.id').onDelete('cascade'),
    )
    .addUniqueConstraint('session_token_unique', ['token'])
    .execute();

  await db.schema
    .withSchema('auth')
    .createTable('account')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('account_id', 'text', (col) => col.notNull())
    .addColumn('provider_id', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('auth.user.id').onDelete('cascade'),
    )
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('id_token', 'text')
    .addColumn('access_token_expires_at', 'timestamp')
    .addColumn('refresh_token_expires_at', 'timestamp')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .execute();

  await db.schema
    .withSchema('auth')
    .createTable('verification')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .withSchema('auth')
    .createIndex('session_userId_idx')
    .on('session')
    .column('user_id')
    .execute();

  await db.schema
    .withSchema('auth')
    .createIndex('account_userId_idx')
    .on('account')
    .column('user_id')
    .execute();

  await db.schema
    .withSchema('auth')
    .createIndex('verification_identifier_idx')
    .on('verification')
    .column('identifier')
    .execute();
}

// ---------------------------------------------------------------------------
// public — organizations, membership, invites
// ---------------------------------------------------------------------------

async function createOrganizations(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType('organization_role')
    .asEnum(['owner', 'admin', 'viewer'])
    .execute();
  await db.schema
    .createType('invite_role')
    .asEnum(['admin', 'viewer'])
    .execute();
  await db.schema
    .createType('invite_status')
    .asEnum(['pending', 'accepted', 'revoked', 'expired'])
    .execute();

  await db.schema
    .createTable('organizations')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('owner_id', 'text', (col) =>
      col.notNull().references('auth.user.id').onDelete('restrict'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('organization_members')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('organization_id', 'uuid', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('auth.user.id').onDelete('cascade'),
    )
    .addColumn('role', sql`organization_role`, (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('organization_invites')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('organization_id', 'uuid', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('role', sql`invite_role`, (col) => col.notNull())
    .addColumn('token_hash', 'text', (col) => col.notNull())
    .addColumn('status', sql`invite_status`, (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('invited_by_user_id', 'text', (col) =>
      col.references('auth.user.id').onDelete('set null'),
    )
    .addColumn('accepted_by_user_id', 'text', (col) =>
      col.references('auth.user.id').onDelete('set null'),
    )
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('organizations_slug_unique')
    .unique()
    .on('organizations')
    .column('slug')
    .execute();

  await db.schema
    .createIndex('organizations_owner_id_unique')
    .unique()
    .on('organizations')
    .column('owner_id')
    .execute();

  await db.schema
    .createIndex('organization_members_org_user_unique')
    .unique()
    .on('organization_members')
    .columns(['organization_id', 'user_id'])
    .execute();

  await db.schema
    .createIndex('organization_members_user_idx')
    .on('organization_members')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('organization_invites_token_hash_unique')
    .unique()
    .on('organization_invites')
    .column('token_hash')
    .execute();

  // One live invite per email per org; revoked/expired rows may accumulate.
  await db.schema
    .createIndex('organization_invites_pending_org_email_unique')
    .unique()
    .on('organization_invites')
    .columns(['organization_id', 'email'])
    .where(sql<boolean>`status = 'pending'`)
    .execute();

  await db.schema
    .createIndex('organization_invites_email_idx')
    .on('organization_invites')
    .column('email')
    .execute();

  await db.schema
    .createIndex('organization_invites_organization_idx')
    .on('organization_invites')
    .column('organization_id')
    .execute();
}

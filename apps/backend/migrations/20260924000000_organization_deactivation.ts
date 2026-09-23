import { Kysely } from 'kysely';

/**
 * `organizations.deactivated_at`: set = the organization is frozen read-only.
 * `OrgDeactivationGuard` rejects every org-scoped route above `member` that
 * has not opted out with `@AllowWhenDeactivated()`.
 *
 * A nullable timestamp rather than a boolean: it records when, and
 * reactivating is setting it back to NULL. There is no admin API yet, so an
 * operator flips it in SQL. No index: every read goes through the primary key.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('organizations')
    .addColumn('deactivated_at', 'timestamptz')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('organizations')
    .dropColumn('deactivated_at')
    .execute();
}

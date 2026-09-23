import { Kysely, sql } from 'kysely';

/**
 * One owner row per organization.
 *
 * The (organization_id, user_id) index alone let two concurrent ownership
 * transfers leave an org with two `owner` rows, and the extra owner cannot be
 * demoted, removed or made to leave through the API. The service now locks the
 * org row before reading memberships; this index is the backstop under it.
 * If it fails to build, Postgres names the duplicated organization_id: demote
 * the extra owners to admin and re-run.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('organization_members_single_owner_unique')
    .unique()
    .on('organization_members')
    .column('organization_id')
    .where(sql<boolean>`role = 'owner'`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('organization_members_single_owner_unique')
    .execute();
}

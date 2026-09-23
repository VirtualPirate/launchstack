import type { Kysely } from 'kysely';
import type { Database } from '../../../src/databases/kysely/database.types';

/**
 * Insert a membership directly.
 *
 * Deliberately bypasses the invite flow: routing role setup through invites
 * would couple guard tests to invite behaviour, so a failure in either would
 * light up both suites. The invite flow has its own spec.
 */
export async function seedMember(
  db: Kysely<Database>,
  member: {
    organizationId: string;
    userId: string;
    role: 'admin' | 'viewer';
  },
): Promise<void> {
  await db.insertInto('organizationMembers').values(member).execute();
}

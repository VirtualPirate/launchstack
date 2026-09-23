import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_DEACTIVATED_KEY = 'allowWhenDeactivated';

/**
 * Opts a write route out of OrgDeactivationGuard.
 *
 * A deactivated organization is frozen, not abandoned: it can still be
 * renamed, handed over and deleted, members can still be invited, managed and
 * leave. Every controller under `src/organizations/controllers/` carries this
 * at class level for that reason. Product routes that create or change data
 * must not.
 */
export const AllowWhenDeactivated = () =>
  SetMetadata(ALLOW_WHEN_DEACTIVATED_KEY, true);

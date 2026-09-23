import { proxyActivities } from '@temporalio/workflow';
import type { Activities } from '../activities.interface';

// Shared retry profiles. Add one per distinct timeout/retry need; pg-boss's
// `retryLimit N` maps to `maximumAttempts: N + 1`, `retryDelay` to
// `initialInterval`, `retryBackoff: true` to `backoffCoefficient: 2`.

// No retry (noop)
const once = proxyActivities<Activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 1 },
});

export { once };

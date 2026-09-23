import { proxyActivities } from '@temporalio/workflow';
import type { Activities } from '../activities.interface';

// Shared retry profiles. Add one per distinct timeout/retry need; pg-boss's
// `retryLimit N` maps to `maximumAttempts: N + 1`, `retryDelay` to
// `initialInterval`, `retryBackoff: true` to `backoffCoefficient: 2`.

// Default for idempotent activities: 4 attempts, 30s then doubling.
const standard = proxyActivities<Activities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 4, initialInterval: '30s', backoffCoefficient: 2 },
});

// No retry (noop, or anything a retry would race rather than help)
const once = proxyActivities<Activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 1 },
});

export { standard, once };

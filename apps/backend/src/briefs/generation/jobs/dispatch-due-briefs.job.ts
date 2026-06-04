import { z } from 'zod';
import { defineJob } from '../../../queue';

export const DispatchDueBriefsJob = defineJob({
  name: 'briefs.dispatch-due',
  schema: z.object({}),
  retryLimit: 0,
  workOptions: { localConcurrency: 1 },
});

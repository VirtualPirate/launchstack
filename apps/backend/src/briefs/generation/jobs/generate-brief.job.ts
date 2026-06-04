import { z } from 'zod';
import { defineJob } from '../../../queue';

export const GenerateBriefJob = defineJob({
  name: 'briefs.generate',
  schema: z.object({ briefId: z.string().uuid() }),
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  workOptions: { localConcurrency: 3 },
});

import { z } from 'zod';
import { defineJob } from '../../../queue';

export const BackfillBriefsJob = defineJob({
  name: 'briefs.backfill',
  schema: z.object({ scheduleId: z.string().uuid() }),
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  // Each instance fans out many child GenerateBriefJobs; keep parallelism low.
  workOptions: { localConcurrency: 2 },
});

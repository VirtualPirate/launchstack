import { z } from 'zod';
import { defineJob } from '../../../../queue';

export const BackfillCommitsJob = defineJob({
  name: 'github.backfill-commits',
  schema: z.object({
    repositoryId: z.string().uuid(),
    sinceISO: z.string().datetime(),
  }),
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
});

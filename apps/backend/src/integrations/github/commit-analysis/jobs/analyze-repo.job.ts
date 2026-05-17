import { z } from 'zod';
import { defineJob } from '../../../../queue';

export const AnalyzeRepoJob = defineJob({
  name: 'github.analyze-repo',
  schema: z.object({
    repositoryId: z.string().uuid(),
    sinceISO: z.string().datetime(),
    force: z.boolean(),
  }),
  retryLimit: 2,
});

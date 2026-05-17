import { z } from 'zod';
import { defineJob } from '../../../../queue';

export const AnalyzeCommitJob = defineJob({
  name: 'github.analyze-commit',
  schema: z.object({
    commitId: z.string().uuid(),
  }),
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
});

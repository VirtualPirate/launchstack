import { z } from 'zod';
import { defineJob } from '../../../../queue';

export const ScanRepositoryJob = defineJob({
  name: 'github.scan-repository',
  schema: z.object({
    repositoryId: z.string().uuid(),
    lookbackDays: z.number().int().positive(),
  }),
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
});

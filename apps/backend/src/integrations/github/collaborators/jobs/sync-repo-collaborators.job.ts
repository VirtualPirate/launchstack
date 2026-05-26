import { z } from 'zod';
import { defineJob } from '../../../../queue';

export const SyncRepoCollaboratorsJob = defineJob({
  name: 'github.sync-repo-collaborators',
  schema: z.object({
    repositoryId: z.string().uuid(),
    trigger: z.enum(['connected', 'disconnected', 'webhook', 'manual']),
  }),
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  workOptions: { localConcurrency: 5 },
});

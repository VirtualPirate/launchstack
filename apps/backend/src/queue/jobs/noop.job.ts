import { z } from 'zod';
import { defineJob } from '../define-job';

export const NoopJob = defineJob({
  name: 'noop',
  schema: z.object({ message: z.string() }),
  retryLimit: 0,
});

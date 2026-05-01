import type { Job, WorkOptions } from 'pg-boss';
import type { z } from 'zod';

export interface JobDefinition<TSchema extends z.ZodTypeAny> {
  name: string;
  schema: TSchema;
  workOptions?: WorkOptions;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  __payload?: z.infer<TSchema>;
}

export const defineJob = <T extends z.ZodTypeAny>(
  cfg: Omit<JobDefinition<T>, '__payload'>,
): JobDefinition<T> => cfg;

export interface JobContext<J extends JobDefinition<z.ZodTypeAny>> {
  id: string;
  data: z.infer<J['schema']>;
  attempts: number;
  raw: Job<z.infer<J['schema']>>;
}

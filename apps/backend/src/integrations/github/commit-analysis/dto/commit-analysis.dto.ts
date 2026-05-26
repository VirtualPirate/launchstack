import { z } from 'zod';

export const RepositoryIdParamSchema = z.object({
  repoId: z.string().uuid(),
});

export const BackfillBodySchema = z.object({
  days: z.number().int().min(1).optional(),
});

export type BackfillBody = z.infer<typeof BackfillBodySchema>;

export const AnalyzeBodySchema = z.object({
  days: z.number().int().min(1),
  force: z.boolean().optional(),
});

export type AnalyzeBody = z.infer<typeof AnalyzeBodySchema>;

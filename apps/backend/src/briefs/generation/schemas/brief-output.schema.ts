import { z } from 'zod';

export const BriefOutputSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
});

export type BriefOutput = z.infer<typeof BriefOutputSchema>;

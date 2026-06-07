import { z } from 'zod';

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

export const CadenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily'), time: hhmmSchema }),
  z.object({
    type: z.literal('weekly'),
    time: hhmmSchema,
    dayOfWeek: z.number().int().min(0).max(6),
  }),
  z.object({
    type: z.literal('monthly'),
    time: hhmmSchema,
    dayOfMonth: z.number().int().min(1).max(31),
  }),
]);
export type CadenceInput = z.infer<typeof CadenceSchema>;

export const ScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project'), projectId: z.string().uuid() }),
  z.object({ type: z.literal('team'), teamId: z.string().uuid() }),
  z.object({
    type: z.literal('collaborator'),
    collaboratorId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('repository'),
    repositoryId: z.string().uuid(),
  }),
]);
export type ScopeInput = z.infer<typeof ScopeSchema>;

export const DeliveryInputSchema = z.object({
  emails: z.array(z.string().email()).max(20).optional(),
  slackChannelId: z.string().min(1).optional(),
});
export type DeliveryInput = z.infer<typeof DeliveryInputSchema>;

// Projects
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  color: z.string().max(16).optional(),
  repositoryIds: z.array(z.string().uuid()).default([]),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(16).nullable().optional(),
});
export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;

export const SetProjectRepositoriesSchema = z.object({
  repositoryIds: z.array(z.string().uuid()),
});
export type SetProjectRepositoriesRequest = z.infer<
  typeof SetProjectRepositoriesSchema
>;

// Teams
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  color: z.string().max(16).optional(),
  collaboratorIds: z.array(z.string().uuid()).default([]),
});
export type CreateTeamRequest = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(16).nullable().optional(),
});
export type UpdateTeamRequest = z.infer<typeof UpdateTeamSchema>;

export const SetTeamCollaboratorsSchema = z.object({
  collaboratorIds: z.array(z.string().uuid()),
});
export type SetTeamCollaboratorsRequest = z.infer<
  typeof SetTeamCollaboratorsSchema
>;

// Brief schedules
export const CreateBriefScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  cadence: CadenceSchema,
  timezone: z.string().min(1),
  scope: ScopeSchema,
  delivery: DeliveryInputSchema.default({}),
});
export type CreateBriefScheduleRequest = z.infer<
  typeof CreateBriefScheduleSchema
>;

export const UpdateBriefScheduleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  cadence: CadenceSchema.optional(),
  timezone: z.string().min(1).optional(),
  scope: ScopeSchema.optional(),
  delivery: DeliveryInputSchema.optional(),
});
export type UpdateBriefScheduleRequest = z.infer<
  typeof UpdateBriefScheduleSchema
>;

// Briefs (ad-hoc generate)
export const GenerateBriefSchema = z.object({
  scope: ScopeSchema,
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  delivery: DeliveryInputSchema.optional(),
});
export type GenerateBriefRequest = z.infer<typeof GenerateBriefSchema>;

export const ListBriefsQuerySchema = z.object({
  scheduleId: z.string().uuid().optional(),
  scopeType: z.enum(['project', 'team', 'collaborator', 'repository']).optional(),
  scopeProjectId: z.string().uuid().optional(),
  scopeTeamId: z.string().uuid().optional(),
  scopeCollaboratorId: z.string().uuid().optional(),
  scopeRepositoryId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  excludeNoActivity: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type ListBriefsQuery = z.infer<typeof ListBriefsQuerySchema>;

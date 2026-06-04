export type BriefScopeType =
  | 'project'
  | 'team'
  | 'collaborator'
  | 'repository';

export type BriefCadenceType = 'daily' | 'weekly' | 'monthly';

export type BriefStatus =
  | 'pending'
  | 'generating'
  | 'generated'
  | 'delivered'
  | 'failed';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string | null;
  repositoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string | null;
  collaboratorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BriefScheduleResponse {
  id: string;
  organizationId: string;
  name: string;
  cadence:
    | { type: 'daily'; time: string }
    | { type: 'weekly'; time: string; dayOfWeek: number }
    | { type: 'monthly'; time: string; dayOfMonth: number };
  timezone: string;
  scope:
    | { type: 'project'; projectId: string }
    | { type: 'team'; teamId: string }
    | { type: 'collaborator'; collaboratorId: string }
    | { type: 'repository'; repositoryId: string };
  paused: boolean;
  nextRunAt: string;
  lastSentAt: string | null;
  delivery: {
    emails: string[];
    slackChannelId: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BriefResponse {
  id: string;
  organizationId: string;
  briefScheduleId: string | null;
  scope:
    | { type: 'project'; projectId: string | null }
    | { type: 'team'; teamId: string | null }
    | { type: 'collaborator'; collaboratorId: string | null }
    | { type: 'repository'; repositoryId: string | null };
  title: string;
  briefInfoTitle: string;
  summary: string;
  periodStart: string;
  periodEnd: string;
  contributorCount: number;
  commitCount: number;
  status: BriefStatus;
  failureReason: string | null;
  generatedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateBriefEnqueueResponse {
  briefId: string;
  jobId: string;
}

export interface PaginatedBriefs {
  items: BriefResponse[];
  nextCursor: string | null;
}

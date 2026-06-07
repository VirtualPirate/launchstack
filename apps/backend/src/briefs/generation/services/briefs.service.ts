import { Injectable } from '@nestjs/common';
import type {
  BriefResponse,
  GenerateBriefEnqueueResponse,
  GenerateBriefRequest,
  ListBriefsQuery,
  PaginatedBriefs,
} from '@launchstack/api-interfaces';
import { AppError } from '../../../common/errors';
import { PgBossService } from '../../../queue';
import { CollaboratorsRepository } from '../../../integrations/github/collaborators/repositories/collaborators.repository';
import { GithubRepositoriesRepository } from '../../../integrations/github/repositories/repositories.repository';
import { SlackInstallationsRepository } from '../../../integrations/slack/repositories/installations.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { TeamsRepository } from '../../teams/repositories/teams.repository';
import { BriefsRepository } from '../repositories/briefs.repository';
import { GenerateBriefJob } from '../jobs/generate-brief.job';
import type { BriefSelect } from '../../../databases/pg-drizzle/types';

@Injectable()
export class BriefsService {
  constructor(
    private readonly briefs: BriefsRepository,
    private readonly projects: ProjectsRepository,
    private readonly teams: TeamsRepository,
    private readonly collaborators: CollaboratorsRepository,
    private readonly repos: GithubRepositoriesRepository,
    private readonly slack: SlackInstallationsRepository,
    private readonly pgBoss: PgBossService,
  ) {}

  async list(
    organizationId: string,
    q: ListBriefsQuery,
  ): Promise<PaginatedBriefs> {
    const cursor = q.cursor ? this.decodeCursor(q.cursor) : null;
    const rows = await this.briefs.list({
      organizationId,
      scheduleId: q.scheduleId,
      scopeType: q.scopeType,
      scopeProjectId: q.scopeProjectId,
      scopeTeamId: q.scopeTeamId,
      scopeCollaboratorId: q.scopeCollaboratorId,
      scopeRepositoryId: q.scopeRepositoryId,
      limit: q.limit + 1,
      cursorPeriodEnd: cursor?.periodEnd,
      cursorId: cursor?.id,
    });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const nextCursor = hasMore
      ? this.encodeCursor({
          periodEnd: page[page.length - 1].periodEnd,
          id: page[page.length - 1].id,
        })
      : null;
    return {
      items: page.map((r) => this.toResponse(r)),
      nextCursor,
    };
  }

  async get(organizationId: string, briefId: string): Promise<BriefResponse> {
    const row = await this.briefs.findByIdScopedToOrg(briefId, organizationId);
    if (!row) throw AppError.BRIEF_NOT_FOUND();
    return this.toResponse(row);
  }

  async generateAdHoc(
    organizationId: string,
    body: GenerateBriefRequest,
  ): Promise<GenerateBriefEnqueueResponse> {
    const now = new Date();
    const periodStart = body.periodStart
      ? new Date(body.periodStart)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : now;
    if (periodEnd.getTime() <= periodStart.getTime()) {
      throw AppError.BRIEF_INVALID_PERIOD({
        reason: 'periodEnd must be after periodStart',
      });
    }

    await this.assertScopeInOrg(organizationId, body.scope);
    if (body.delivery?.slackChannelId) {
      const install =
        await this.slack.findActiveByOrganizationId(organizationId);
      if (!install) throw AppError.SLACK_INSTALLATION_NOT_FOUND();
    }

    const briefRow = await this.briefs.create({
      organizationId,
      briefScheduleId: null,
      scopeType: body.scope.type,
      scopeProjectId:
        body.scope.type === 'project' ? body.scope.projectId : null,
      scopeTeamId: body.scope.type === 'team' ? body.scope.teamId : null,
      scopeCollaboratorId:
        body.scope.type === 'collaborator' ? body.scope.collaboratorId : null,
      scopeRepositoryId:
        body.scope.type === 'repository' ? body.scope.repositoryId : null,
      periodStart,
      periodEnd,
      status: 'pending',
      deliveryEmails: body.delivery?.emails ?? [],
      deliverySlackChannelId: body.delivery?.slackChannelId ?? null,
    });

    const jobId = await this.pgBoss.send(GenerateBriefJob, {
      briefId: briefRow.id,
    });
    return { briefId: briefRow.id, jobId };
  }

  private async assertScopeInOrg(
    organizationId: string,
    scope: GenerateBriefRequest['scope'],
  ): Promise<void> {
    if (scope.type === 'project') {
      if (
        !(await this.projects.findByIdScopedToOrg(
          scope.projectId,
          organizationId,
        ))
      ) {
        throw AppError.PROJECT_NOT_FOUND();
      }
    } else if (scope.type === 'team') {
      if (
        !(await this.teams.findByIdScopedToOrg(scope.teamId, organizationId))
      ) {
        throw AppError.TEAM_NOT_FOUND();
      }
    } else if (scope.type === 'collaborator') {
      if (
        !(await this.collaborators.findByIdScopedToOrg(
          scope.collaboratorId,
          organizationId,
        ))
      ) {
        throw AppError.GITHUB_COLLABORATOR_NOT_FOUND();
      }
    } else {
      if (
        !(await this.repos.findByIdScopedToOrg(
          scope.repositoryId,
          organizationId,
        ))
      ) {
        throw AppError.GITHUB_REPOSITORY_NOT_FOUND();
      }
    }
  }

  private encodeCursor(c: { periodEnd: Date; id: string }): string {
    return Buffer.from(
      JSON.stringify({ periodEnd: c.periodEnd.toISOString(), id: c.id }),
    ).toString('base64url');
  }

  private decodeCursor(s: string): { periodEnd: Date; id: string } {
    try {
      const obj = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as {
        periodEnd: string;
        id: string;
      };
      return { periodEnd: new Date(obj.periodEnd), id: obj.id };
    } catch {
      throw AppError.BAD_REQUEST({ message: 'Invalid cursor' });
    }
  }

  private toResponse(row: BriefSelect): BriefResponse {
    return {
      id: row.id,
      organizationId: row.organizationId,
      briefScheduleId: row.briefScheduleId,
      scope:
        row.scopeType === 'project'
          ? { type: 'project', projectId: row.scopeProjectId }
          : row.scopeType === 'team'
            ? { type: 'team', teamId: row.scopeTeamId }
            : row.scopeType === 'collaborator'
              ? {
                  type: 'collaborator',
                  collaboratorId: row.scopeCollaboratorId,
                }
              : { type: 'repository', repositoryId: row.scopeRepositoryId },
      title: row.title,
      briefInfoTitle: row.briefInfoTitle,
      summary: row.summary,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      contributorCount: row.contributorCount,
      commitCount: row.commitCount,
      status: row.status,
      failureReason: row.failureReason,
      generatedAt: row.generatedAt ? row.generatedAt.toISOString() : null,
      deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

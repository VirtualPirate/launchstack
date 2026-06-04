import { Injectable } from '@nestjs/common';
import type {
  BriefScheduleResponse,
  CreateBriefScheduleRequest,
  UpdateBriefScheduleRequest,
} from '@launchstack/api-interfaces';
import { AppError } from '../../../common/errors';
import { GithubRepositoriesRepository } from '../../../integrations/github/repositories/repositories.repository';
import { CollaboratorsRepository } from '../../../integrations/github/collaborators/repositories/collaborators.repository';
import { SlackInstallationsRepository } from '../../../integrations/slack/repositories/installations.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { TeamsRepository } from '../../teams/repositories/teams.repository';
import { BriefSchedulesRepository } from '../repositories/brief-schedules.repository';
import { CadenceService } from './cadence.service';
import type { BriefScheduleSelect } from '../../../databases/pg-drizzle/types';

@Injectable()
export class BriefSchedulesService {
  constructor(
    private readonly schedules: BriefSchedulesRepository,
    private readonly projects: ProjectsRepository,
    private readonly teams: TeamsRepository,
    private readonly collaborators: CollaboratorsRepository,
    private readonly repos: GithubRepositoriesRepository,
    private readonly slack: SlackInstallationsRepository,
    private readonly cadence: CadenceService,
  ) {}

  async list(organizationId: string): Promise<BriefScheduleResponse[]> {
    const rows = await this.schedules.listByOrganization(organizationId);
    return rows.map((r) => this.toResponse(r));
  }

  async get(organizationId: string, id: string): Promise<BriefScheduleResponse> {
    const row = await this.schedules.findByIdScopedToOrg(id, organizationId);
    if (!row) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    return this.toResponse(row);
  }

  async create(
    organizationId: string,
    createdByUserId: string,
    body: CreateBriefScheduleRequest,
  ): Promise<BriefScheduleResponse> {
    this.assertValidTimezone(body.timezone);
    this.assertValidCadence(body.cadence);
    await this.assertScopeInOrg(organizationId, body.scope);
    const slackInstallationId = await this.resolveSlackInstallationId(
      organizationId,
      body.delivery?.slackChannelId,
    );

    const nextRunAt = this.cadence.computeNextRunAt(
      {
        cadenceType: body.cadence.type,
        cadenceTime: body.cadence.time,
        cadenceDayOfWeek:
          body.cadence.type === 'weekly' ? body.cadence.dayOfWeek : null,
        cadenceDayOfMonth:
          body.cadence.type === 'monthly' ? body.cadence.dayOfMonth : null,
        timezone: body.timezone,
      },
      new Date(),
    );

    const insertable = this.buildScheduleInsert(
      organizationId,
      createdByUserId,
      body,
      slackInstallationId,
      nextRunAt,
    );
    const row = await this.schedules.create(insertable);
    return this.toResponse(row);
  }

  async update(
    organizationId: string,
    id: string,
    body: UpdateBriefScheduleRequest,
  ): Promise<BriefScheduleResponse> {
    const existing = await this.schedules.findByIdScopedToOrg(id, organizationId);
    if (!existing) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();

    if (body.timezone) this.assertValidTimezone(body.timezone);
    if (body.cadence) this.assertValidCadence(body.cadence);
    if (body.scope) await this.assertScopeInOrg(organizationId, body.scope);

    const newTimezone = body.timezone ?? existing.timezone;
    const newCadenceType = body.cadence?.type ?? existing.cadenceType;
    const newCadenceTime = body.cadence?.time ?? existing.cadenceTime;
    const newDow =
      body.cadence?.type === 'weekly'
        ? body.cadence.dayOfWeek
        : existing.cadenceDayOfWeek;
    const newDom =
      body.cadence?.type === 'monthly'
        ? body.cadence.dayOfMonth
        : existing.cadenceDayOfMonth;

    const cadenceChanged =
      !!body.cadence || (!!body.timezone && body.timezone !== existing.timezone);
    const nextRunAt = cadenceChanged
      ? this.cadence.computeNextRunAt(
          {
            cadenceType: newCadenceType,
            cadenceTime: newCadenceTime,
            cadenceDayOfWeek: newDow,
            cadenceDayOfMonth: newDom,
            timezone: newTimezone,
          },
          new Date(),
        )
      : existing.nextRunAt;

    let slackInstallationId = existing.slackInstallationId;
    if (body.delivery?.slackChannelId !== undefined) {
      slackInstallationId = await this.resolveSlackInstallationId(
        organizationId,
        body.delivery.slackChannelId ?? undefined,
      );
    }

    const patch: Record<string, unknown> = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.cadence
        ? {
            cadenceType: newCadenceType,
            cadenceTime: newCadenceTime,
            cadenceDayOfWeek: newDow ?? null,
            cadenceDayOfMonth: newDom ?? null,
          }
        : {}),
      ...(body.timezone ? { timezone: newTimezone } : {}),
      ...(body.scope ? this.scopePatch(body.scope) : {}),
      ...(body.delivery?.emails !== undefined
        ? { emailRecipients: body.delivery.emails }
        : {}),
      ...(body.delivery?.slackChannelId !== undefined
        ? {
            slackInstallationId,
            slackChannelId: body.delivery.slackChannelId ?? null,
          }
        : {}),
      ...(cadenceChanged ? { nextRunAt } : {}),
    };

    const updated = await this.schedules.update(id, patch);
    if (!updated) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    return this.toResponse(updated);
  }

  async pause(organizationId: string, id: string): Promise<BriefScheduleResponse> {
    const existing = await this.schedules.findByIdScopedToOrg(id, organizationId);
    if (!existing) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    const updated = await this.schedules.update(id, { paused: true });
    if (!updated) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    return this.toResponse(updated);
  }

  async resume(
    organizationId: string,
    id: string,
  ): Promise<BriefScheduleResponse> {
    const existing = await this.schedules.findByIdScopedToOrg(id, organizationId);
    if (!existing) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    const nextRunAt = this.cadence.computeNextRunAt(
      {
        cadenceType: existing.cadenceType,
        cadenceTime: existing.cadenceTime,
        cadenceDayOfWeek: existing.cadenceDayOfWeek,
        cadenceDayOfMonth: existing.cadenceDayOfMonth,
        timezone: existing.timezone,
      },
      new Date(),
    );
    const updated = await this.schedules.update(id, { paused: false, nextRunAt });
    if (!updated) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    return this.toResponse(updated);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.schedules.findByIdScopedToOrg(id, organizationId);
    if (!existing) throw AppError.BRIEF_SCHEDULE_NOT_FOUND();
    await this.schedules.softDelete(id);
  }

  private buildScheduleInsert(
    organizationId: string,
    createdByUserId: string,
    body: CreateBriefScheduleRequest,
    slackInstallationId: string | null,
    nextRunAt: Date,
  ) {
    return {
      organizationId,
      createdByMemberId: createdByUserId,
      name: body.name,
      cadenceType: body.cadence.type,
      cadenceTime: body.cadence.time,
      cadenceDayOfWeek:
        body.cadence.type === 'weekly' ? body.cadence.dayOfWeek : null,
      cadenceDayOfMonth:
        body.cadence.type === 'monthly' ? body.cadence.dayOfMonth : null,
      timezone: body.timezone,
      scopeType: body.scope.type,
      ...this.scopePatch(body.scope),
      paused: false,
      nextRunAt,
      emailRecipients: body.delivery?.emails ?? [],
      slackInstallationId,
      slackChannelId: body.delivery?.slackChannelId ?? null,
    };
  }

  private scopePatch(scope: CreateBriefScheduleRequest['scope']) {
    return {
      scopeProjectId: scope.type === 'project' ? scope.projectId : null,
      scopeTeamId: scope.type === 'team' ? scope.teamId : null,
      scopeCollaboratorId:
        scope.type === 'collaborator' ? scope.collaboratorId : null,
      scopeRepositoryId:
        scope.type === 'repository' ? scope.repositoryId : null,
    };
  }

  private async assertScopeInOrg(
    organizationId: string,
    scope: CreateBriefScheduleRequest['scope'],
  ): Promise<void> {
    if (scope.type === 'project') {
      const row = await this.projects.findByIdScopedToOrg(
        scope.projectId,
        organizationId,
      );
      if (!row) throw AppError.PROJECT_NOT_FOUND();
    } else if (scope.type === 'team') {
      const row = await this.teams.findByIdScopedToOrg(
        scope.teamId,
        organizationId,
      );
      if (!row) throw AppError.TEAM_NOT_FOUND();
    } else if (scope.type === 'collaborator') {
      const row = await this.collaborators.findByIdScopedToOrg(
        scope.collaboratorId,
        organizationId,
      );
      if (!row) throw AppError.GITHUB_COLLABORATOR_NOT_FOUND();
    } else {
      const row = await this.repos.findByIdScopedToOrg(
        scope.repositoryId,
        organizationId,
      );
      if (!row) throw AppError.GITHUB_REPOSITORY_NOT_FOUND();
    }
  }

  private assertValidTimezone(tz: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      throw AppError.BRIEF_SCHEDULE_INVALID_TIMEZONE({ timezone: tz });
    }
  }

  private assertValidCadence(cadence: CreateBriefScheduleRequest['cadence']): void {
    if (cadence.type === 'weekly' && (cadence as any).dayOfWeek === undefined) {
      throw AppError.BRIEF_SCHEDULE_INVALID_CADENCE({
        reason: 'weekly cadence requires dayOfWeek',
      });
    }
    if (cadence.type === 'monthly' && (cadence as any).dayOfMonth === undefined) {
      throw AppError.BRIEF_SCHEDULE_INVALID_CADENCE({
        reason: 'monthly cadence requires dayOfMonth',
      });
    }
  }

  private async resolveSlackInstallationId(
    organizationId: string,
    channelId: string | undefined,
  ): Promise<string | null> {
    if (!channelId) return null;
    const install = await this.slack.findActiveByOrganizationId(organizationId);
    if (!install) throw AppError.SLACK_INSTALLATION_NOT_FOUND();
    return install.id;
  }

  private toResponse(row: BriefScheduleSelect): BriefScheduleResponse {
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      cadence:
        row.cadenceType === 'daily'
          ? { type: 'daily', time: row.cadenceTime }
          : row.cadenceType === 'weekly'
            ? {
                type: 'weekly',
                time: row.cadenceTime,
                dayOfWeek: row.cadenceDayOfWeek ?? 0,
              }
            : {
                type: 'monthly',
                time: row.cadenceTime,
                dayOfMonth: row.cadenceDayOfMonth ?? 1,
              },
      timezone: row.timezone,
      scope:
        row.scopeType === 'project'
          ? { type: 'project', projectId: row.scopeProjectId! }
          : row.scopeType === 'team'
            ? { type: 'team', teamId: row.scopeTeamId! }
            : row.scopeType === 'collaborator'
              ? {
                  type: 'collaborator',
                  collaboratorId: row.scopeCollaboratorId!,
                }
              : { type: 'repository', repositoryId: row.scopeRepositoryId! },
      paused: row.paused,
      nextRunAt: row.nextRunAt.toISOString(),
      lastSentAt: row.lastSentAt ? row.lastSentAt.toISOString() : null,
      delivery: {
        emails: row.emailRecipients,
        slackChannelId: row.slackChannelId,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

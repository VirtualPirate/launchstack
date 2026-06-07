import { Injectable } from '@nestjs/common';
import { CollaboratorsRepository } from '../../../integrations/github/collaborators/repositories/collaborators.repository';
import { GithubRepositoriesRepository } from '../../../integrations/github/repositories/repositories.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { ProjectRepositoriesRepository } from '../../projects/repositories/project-repositories.repository';
import { TeamsRepository } from '../../teams/repositories/teams.repository';
import { TeamCollaboratorsRepository } from '../../teams/repositories/team-collaborators.repository';

export type BriefScope =
  | { type: 'project'; projectId: string }
  | { type: 'team'; teamId: string }
  | { type: 'collaborator'; collaboratorId: string }
  | { type: 'repository'; repositoryId: string };

export interface ResolvedScope {
  repositoryIds: string[];
  scopeLabel: string;
  authorFilter?: bigint[];
}

@Injectable()
export class BriefScopeResolver {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly projectLinks: ProjectRepositoriesRepository,
    private readonly teams: TeamsRepository,
    private readonly teamLinks: TeamCollaboratorsRepository,
    private readonly collaborators: CollaboratorsRepository,
    private readonly repos: GithubRepositoriesRepository,
  ) {}

  async resolve(input: {
    organizationId: string;
    scope: BriefScope;
  }): Promise<ResolvedScope> {
    const { organizationId, scope } = input;
    if (scope.type === 'project') {
      const project = await this.projects.findByIdScopedToOrg(
        scope.projectId,
        organizationId,
      );
      if (!project) throw new Error('SCOPE_DELETED: project missing');
      const links = await this.projectLinks.listByProject(project.id);
      return {
        repositoryIds: links.map((l) => l.repositoryId),
        scopeLabel: `Project: ${project.name}`,
      };
    }
    if (scope.type === 'team') {
      const team = await this.teams.findByIdScopedToOrg(
        scope.teamId,
        organizationId,
      );
      if (!team) throw new Error('SCOPE_DELETED: team missing');
      const memberLinks = await this.teamLinks.listByTeam(team.id);
      const collabRows = await Promise.all(
        memberLinks.map((l) => this.collaborators.findById(l.collaboratorId)),
      );
      const authorFilter = collabRows
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => c.githubUserId);
      const repositoryIds =
        await this.repos.listIdsByOrganization(organizationId);
      return { repositoryIds, scopeLabel: `Team: ${team.name}`, authorFilter };
    }
    if (scope.type === 'collaborator') {
      const collab = await this.collaborators.findByIdScopedToOrg(
        scope.collaboratorId,
        organizationId,
      );
      if (!collab) throw new Error('SCOPE_DELETED: collaborator missing');
      const repositoryIds =
        await this.repos.listIdsByOrganization(organizationId);
      return {
        repositoryIds,
        scopeLabel: `Collaborator: ${collab.login}`,
        authorFilter: [collab.githubUserId],
      };
    }
    const repo = await this.repos.findByIdScopedToOrg(
      scope.repositoryId,
      organizationId,
    );
    if (!repo) throw new Error('SCOPE_DELETED: repository missing');
    return {
      repositoryIds: [repo.id],
      scopeLabel: `Repository: ${repo.fullName}`,
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { BriefsConfig } from '../../briefs-config';
import { BRIEFS_CONFIG_TOKEN } from '../../tokens';
import { CommitsRepository } from '../../../integrations/github/commit-analysis/repositories/commits.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { ProjectRepositoriesRepository } from '../../projects/repositories/project-repositories.repository';
import { TeamsRepository } from '../../teams/repositories/teams.repository';
import { TeamCollaboratorsRepository } from '../../teams/repositories/team-collaborators.repository';
import { CollaboratorsRepository } from '../../../integrations/github/collaborators/repositories/collaborators.repository';
import { GithubRepositoriesRepository } from '../../../integrations/github/repositories/repositories.repository';
import { OpenAIBriefClient } from './openai-brief.client';
import {
  BRIEF_SYSTEM_PROMPT,
  buildBriefUserPrompt,
  type BriefPromptCommit,
} from './brief-summary-prompt';

export type BriefScope =
  | { type: 'project'; projectId: string }
  | { type: 'team'; teamId: string }
  | { type: 'collaborator'; collaboratorId: string }
  | { type: 'repository'; repositoryId: string };

export interface GenerateInput {
  organizationId: string;
  scope: BriefScope;
  period: { start: Date; end: Date };
}

export type GenerateOutput =
  | {
      kind: 'empty';
      scopeLabel: string;
      contributorCount: 0;
      commitCount: 0;
    }
  | {
      kind: 'generated';
      scopeLabel: string;
      title: string;
      summary: string;
      contributorCount: number;
      commitCount: number;
      model: string;
      promptTokens: number | null;
      completionTokens: number | null;
    };

@Injectable()
export class BriefGeneratorService {
  constructor(
    private readonly commits: CommitsRepository,
    private readonly projects: ProjectsRepository,
    private readonly projectLinks: ProjectRepositoriesRepository,
    private readonly teams: TeamsRepository,
    private readonly teamLinks: TeamCollaboratorsRepository,
    private readonly collaborators: CollaboratorsRepository,
    private readonly repos: GithubRepositoriesRepository,
    private readonly openai: OpenAIBriefClient,
    @Inject(BRIEFS_CONFIG_TOKEN) private readonly config: BriefsConfig,
  ) {}

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const { repositoryIds, scopeLabel, authorFilter } =
      await this.resolveScope(input);

    const rows = await this.commits.findForBriefScope({
      repositoryIds,
      periodStart: input.period.start,
      periodEnd: input.period.end,
      collaboratorGithubUserIds: authorFilter,
    });

    if (rows.length === 0) {
      return { kind: 'empty', scopeLabel, contributorCount: 0, commitCount: 0 };
    }

    const distinctAuthors = new Set<string>();
    const promptCommits: BriefPromptCommit[] = [];
    for (const r of rows) {
      const authorKey = r.commit.authorGithubUserId
        ? String(r.commit.authorGithubUserId)
        : `${r.commit.authorEmail}|${r.commit.authorName}`;
      distinctAuthors.add(authorKey);
      promptCommits.push({
        sha: r.commit.sha,
        authorName: r.commit.authorName,
        authorEmail: r.commit.authorEmail,
        messageFirstLine: r.commit.message.split('\n', 1)[0],
        analysis:
          r.analysis &&
          r.analysis.status === 'analyzed' &&
          r.analysis.commitType
            ? {
                commitType: r.analysis.commitType,
                summary: r.analysis.summary ?? '',
                changes: r.analysis.changes ?? [],
              }
            : null,
      });
    }

    const userPrompt = buildBriefUserPrompt({
      scopeLabel,
      period: input.period,
      commits: promptCommits,
      maxChars: this.config.maxPromptChars,
    });

    const result = await this.openai.generate({
      systemPrompt: BRIEF_SYSTEM_PROMPT,
      userPrompt,
    });

    return {
      kind: 'generated',
      scopeLabel,
      title: result.parsed.title,
      summary: result.parsed.summary,
      contributorCount: distinctAuthors.size,
      commitCount: rows.length,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    };
  }

  private async resolveScope(input: GenerateInput): Promise<{
    repositoryIds: string[];
    scopeLabel: string;
    authorFilter?: bigint[];
  }> {
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
      const repositoryIds = await this.repos.listIdsByOrganization(organizationId);
      return { repositoryIds, scopeLabel: `Team: ${team.name}`, authorFilter };
    }
    if (scope.type === 'collaborator') {
      const collab = await this.collaborators.findByIdScopedToOrg(
        scope.collaboratorId,
        organizationId,
      );
      if (!collab) throw new Error('SCOPE_DELETED: collaborator missing');
      const repositoryIds = await this.repos.listIdsByOrganization(organizationId);
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

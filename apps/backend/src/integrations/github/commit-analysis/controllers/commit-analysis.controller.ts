import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import type {
  ApiResponse,
  CommitAnalysisEnqueueResponse,
  CommitBackfillEnqueueResponse,
} from '@launchstack/api-interfaces';
import { AppError } from '../../../../common/errors';
import {
  OrgMembership,
  type OrgMembershipContext,
} from '../../../../organizations/decorators/org-membership.decorator';
import { RequireOrgRole } from '../../../../organizations/decorators/require-org-role.decorator';
import { ZodValidationPipe } from '../../../../organizations/dto/zod-validation.pipe';
import { PgBossService } from '../../../../queue';
import { GithubRepositoriesRepository } from '../../repositories/repositories.repository';
import {
  AnalyzeBodySchema,
  BackfillBodySchema,
  RepositoryIdParamSchema,
  type AnalyzeBody,
  type BackfillBody,
} from '../dto/commit-analysis.dto';
import { AnalyzeRepoJob } from '../jobs/analyze-repo.job';
import { BackfillCommitsJob } from '../jobs/backfill-commits.job';
import { CommitsRepository } from '../repositories/commits.repository';

const DEFAULT_BACKFILL_DAYS = 365;

function sinceISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

@Controller('api/integrations/github/repositories/:repoId/commits')
export class CommitAnalysisController {
  constructor(
    private readonly repos: GithubRepositoriesRepository,
    private readonly commits: CommitsRepository,
    private readonly pgBoss: PgBossService,
  ) {}

  @Post('backfill')
  @RequireOrgRole('admin')
  @HttpCode(202)
  async backfill(
    @OrgMembership() membership: OrgMembershipContext,
    @Param(new ZodValidationPipe(RepositoryIdParamSchema))
    params: { repoId: string },
    @Body(new ZodValidationPipe(BackfillBodySchema)) body: BackfillBody,
  ): Promise<ApiResponse<CommitBackfillEnqueueResponse>> {
    const repo = await this.repos.findByIdScopedToOrg(
      params.repoId,
      membership.organizationId,
    );
    if (!repo) throw AppError.GITHUB_REPOSITORY_NOT_FOUND();

    const days = body.days ?? DEFAULT_BACKFILL_DAYS;
    const jobId = await this.pgBoss.sendOnce(
      BackfillCommitsJob,
      { repositoryId: repo.id, sinceISO: sinceISO(days) },
      `backfill:${repo.id}`,
    );

    return {
      data: { jobId: jobId ?? 'duplicate' },
      message: 'OK',
      success: true,
    };
  }

  @Post('analyze')
  @RequireOrgRole('admin')
  @HttpCode(202)
  async analyze(
    @OrgMembership() membership: OrgMembershipContext,
    @Param(new ZodValidationPipe(RepositoryIdParamSchema))
    params: { repoId: string },
    @Body(new ZodValidationPipe(AnalyzeBodySchema)) body: AnalyzeBody,
  ): Promise<ApiResponse<CommitAnalysisEnqueueResponse>> {
    const repo = await this.repos.findByIdScopedToOrg(
      params.repoId,
      membership.organizationId,
    );
    if (!repo) throw AppError.GITHUB_REPOSITORY_NOT_FOUND();

    const since = sinceISO(body.days);
    const force = body.force ?? false;
    const expectedCommitCount = await this.commits.countByRepositorySince(
      repo.id,
      since,
    );

    const jobId = await this.pgBoss.sendOnce(
      AnalyzeRepoJob,
      { repositoryId: repo.id, sinceISO: since, force },
      `analyze:${repo.id}:${body.days}:${force}`,
    );

    return {
      data: {
        jobId: jobId ?? 'duplicate',
        expectedCommitCount,
      },
      message: 'OK',
      success: true,
    };
  }
}

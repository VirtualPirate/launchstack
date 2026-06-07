import { Injectable, Logger } from '@nestjs/common';
import { Handler, type JobContext } from '../../../queue';
import { BriefDelivererService } from '../../delivery/services/brief-deliverer.service';
import { CadenceService } from '../../schedules/services/cadence.service';
import { BriefsRepository } from '../repositories/briefs.repository';
import {
  BriefGeneratorService,
  type BriefScope,
} from '../services/brief-generator.service';
import { GenerateBriefJob } from '../jobs/generate-brief.job';

@Injectable()
export class GenerateBriefHandler {
  private readonly logger = new Logger(GenerateBriefHandler.name);

  constructor(
    private readonly briefs: BriefsRepository,
    private readonly generator: BriefGeneratorService,
    private readonly cadence: CadenceService,
    private readonly deliverer: BriefDelivererService,
  ) {}

  @Handler(GenerateBriefJob)
  async handle({
    id,
    data,
  }: JobContext<typeof GenerateBriefJob>): Promise<void> {
    const brief = await this.briefs.findById(data.briefId);
    if (!brief) {
      this.logger.warn(
        `[generate-brief ${id}] brief ${data.briefId} not found`,
      );
      return;
    }
    if (brief.status !== 'pending' && brief.status !== 'failed') {
      this.logger.log(
        `[generate-brief ${id}] brief ${brief.id} already ${brief.status}; exiting`,
      );
      return;
    }

    await this.briefs.update(brief.id, { status: 'generating' });

    const scope = this.scopeFromBrief(brief);
    let result;
    try {
      result = await this.generator.generate({
        organizationId: brief.organizationId,
        scope,
        period: { start: brief.periodStart, end: brief.periodEnd },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('SCOPE_DELETED')) {
        await this.briefs.update(brief.id, {
          status: 'failed',
          failureReason: message,
        });
        return;
      }
      await this.briefs.update(brief.id, {
        status: 'failed',
        failureReason: message,
      });
      throw err;
    }

    const periodLabel = this.cadence.formatPeriodLabel(
      { start: brief.periodStart, end: brief.periodEnd },
      'UTC',
    );

    if (result.kind === 'empty') {
      await this.briefs.update(brief.id, {
        status: 'generated',
        title: `${result.scopeLabel} — no activity`,
        briefInfoTitle: `${periodLabel} · 0 contributors · 0 commits`,
        summary: 'No activity in this period.',
        contributorCount: 0,
        commitCount: 0,
        generatedAt: new Date(),
      });
    } else {
      await this.briefs.update(brief.id, {
        status: 'generated',
        title: result.title,
        briefInfoTitle: `${periodLabel} · ${result.contributorCount} contributors · ${result.commitCount} commits`,
        summary: result.summary,
        contributorCount: result.contributorCount,
        commitCount: result.commitCount,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        generatedAt: new Date(),
      });
    }

    if (data.deliver === false) {
      this.logger.log(
        `[generate-brief ${id}] brief ${brief.id} generated; delivery suppressed (backfill)`,
      );
      return;
    }

    await this.deliverer.deliver(brief.id);
  }

  private scopeFromBrief(brief: {
    scopeType: 'project' | 'team' | 'collaborator' | 'repository';
    scopeProjectId: string | null;
    scopeTeamId: string | null;
    scopeCollaboratorId: string | null;
    scopeRepositoryId: string | null;
  }): BriefScope {
    if (brief.scopeType === 'project')
      return { type: 'project', projectId: brief.scopeProjectId! };
    if (brief.scopeType === 'team')
      return { type: 'team', teamId: brief.scopeTeamId! };
    if (brief.scopeType === 'collaborator')
      return {
        type: 'collaborator',
        collaboratorId: brief.scopeCollaboratorId!,
      };
    return { type: 'repository', repositoryId: brief.scopeRepositoryId! };
  }
}

import { randomUUID } from 'node:crypto';
import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { AppError } from '../../../common/errors';
import { PgBossService } from '../../../queue';
import { SyncRepoCollaboratorsJob } from '../collaborators/jobs/sync-repo-collaborators.job';
import type { GithubAppConfig } from '../github-app.config';
import { GITHUB_APP_CONFIG_TOKEN } from '../tokens';
import { GithubRepositoriesRepository } from '../repositories/repositories.repository';
import { GithubWebhookEventsRepository } from '../repositories/webhook-events.repository';
import { WebhookVerifierService } from '../services/webhook-verifier.service';

@Controller('api/integrations/github/webhook')
@AllowAnonymous()
export class GithubWebhooksController {
  private readonly logger = new Logger(GithubWebhooksController.name);

  constructor(
    private readonly verifier: WebhookVerifierService,
    private readonly webhookEvents: GithubWebhookEventsRepository,
    private readonly reposRepository: GithubRepositoriesRepository,
    private readonly pgBoss: PgBossService,
    @Inject(GITHUB_APP_CONFIG_TOKEN)
    private readonly config: GithubAppConfig | null,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
  ): Promise<{ ok: true }> {
    if (!this.config) {
      throw AppError.GITHUB_APP_NOT_CONFIGURED();
    }

    const rawBody = req.rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      throw AppError.GITHUB_WEBHOOK_SIGNATURE_INVALID();
    }

    this.verifier.verify({
      body: rawBody,
      signature,
      secret: this.config.webhookSecret,
    });

    const parsed =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : null;

    let outboxId: string | null = null;
    if (parsed) {
      outboxId = typeof deliveryId === 'string' ? deliveryId : randomUUID();
      await this.webhookEvents.create({
        id: outboxId,
        event: event ?? null,
        raw: parsed,
      });
    }

    const installationId =
      (
        parsed?.installation as { id?: number | string } | undefined
      )?.id?.toString() ?? null;

    this.logger.log(
      `github webhook received event=${event ?? '?'} delivery=${deliveryId ?? '?'} installation=${installationId ?? '?'}`,
    );

    if (
      parsed &&
      event === 'member' &&
      typeof parsed.action === 'string' &&
      ['added', 'removed', 'edited'].includes(parsed.action)
    ) {
      const githubRepoId = (
        parsed.repository as { id?: number | string } | undefined
      )?.id;
      if (githubRepoId != null) {
        const repo = await this.reposRepository.findByGithubRepoId(
          BigInt(githubRepoId),
        );
        if (repo && !repo.deletedAt) {
          await this.pgBoss.send(SyncRepoCollaboratorsJob, {
            repositoryId: repo.id,
            trigger: 'webhook',
          });
          if (outboxId) {
            await this.webhookEvents.markProcessed(outboxId);
          }
        }
      }
    }

    return { ok: true };
  }
}

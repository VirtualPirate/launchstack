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
import type { GithubAppConfig } from '../github-app.config';
import { GITHUB_APP_CONFIG_TOKEN } from '../tokens';
import { WebhookVerifierService } from '../services/webhook-verifier.service';

@Controller('api/integrations/github/webhooks')
@AllowAnonymous()
export class GithubWebhooksController {
  private readonly logger = new Logger(GithubWebhooksController.name);

  constructor(
    private readonly verifier: WebhookVerifierService,
    @Inject(GITHUB_APP_CONFIG_TOKEN)
    private readonly config: GithubAppConfig | null,
  ) {}

  @Post()
  @HttpCode(200)
  handle(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
  ): { ok: true } {
    if (!this.config) {
      throw AppError.GITHUB_APP_NOT_CONFIGURED();
    }

    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body)) {
      throw AppError.GITHUB_WEBHOOK_SIGNATURE_INVALID();
    }

    this.verifier.verify({
      body,
      signature,
      secret: this.config.webhookSecret,
    });

    let installationId: string | null = null;
    try {
      const parsed = JSON.parse(body.toString('utf8')) as {
        installation?: { id?: number | string };
      };
      installationId = parsed.installation?.id?.toString() ?? null;
    } catch {
      // Ignore non-JSON payloads after signature verification.
    }

    this.logger.log(
      `github webhook received event=${event ?? '?'} delivery=${deliveryId ?? '?'} installation=${installationId ?? '?'}`,
    );

    return { ok: true };
  }
}

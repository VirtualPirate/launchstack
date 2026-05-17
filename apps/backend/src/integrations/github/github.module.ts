import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppError } from '../../common/errors';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import { GithubInstallationsController } from './controllers/installations.controller';
import { GithubWebhooksController } from './controllers/webhooks.controller';
import { GithubAppClient } from './github-app.client';
import { loadGithubAppConfig } from './github-app.config';
import { GithubInstallationsRepository } from './repositories/installations.repository';
import { GithubRepositoriesRepository } from './repositories/repositories.repository';
import { GithubWebhookEventsRepository } from './repositories/webhook-events.repository';
import { GithubInstallationsService } from './services/installations.service';
import { StateTokenService } from './services/state-token.service';
import { WebhookVerifierService } from './services/webhook-verifier.service';
import { GITHUB_APP_CONFIG_TOKEN } from './tokens';

@Module({
  controllers: [GithubInstallationsController, GithubWebhooksController],
  providers: [
    {
      provide: GITHUB_APP_CONFIG_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => loadGithubAppConfig(config),
    },
    {
      provide: GithubAppClient,
      inject: [GITHUB_APP_CONFIG_TOKEN],
      useFactory: (cfg: ReturnType<typeof loadGithubAppConfig>) => {
        if (!cfg) {
          return {
            getInstallation: () =>
              Promise.reject(AppError.GITHUB_APP_NOT_CONFIGURED()),
            listInstallationRepos: () =>
              Promise.reject(AppError.GITHUB_APP_NOT_CONFIGURED()),
            deleteInstallation: () =>
              Promise.reject(AppError.GITHUB_APP_NOT_CONFIGURED()),
            listCommits: () =>
              Promise.reject(AppError.GITHUB_APP_NOT_CONFIGURED()),
            getCommit: () =>
              Promise.reject(AppError.GITHUB_APP_NOT_CONFIGURED()),
            getDefaultBranch: () =>
              Promise.reject(AppError.GITHUB_APP_NOT_CONFIGURED()),
          };
        }
        return new GithubAppClient(cfg);
      },
    },
    {
      provide: StateTokenService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new StateTokenService(config.getOrThrow<string>('BETTER_AUTH_SECRET')),
    },
    {
      provide: GithubInstallationsService,
      inject: [
        GithubInstallationsRepository,
        GithubRepositoriesRepository,
        StateTokenService,
        GithubAppClient,
        GITHUB_APP_CONFIG_TOKEN,
        DRIZZLE_DB,
      ],
      useFactory: (
        installs: GithubInstallationsRepository,
        repos: GithubRepositoriesRepository,
        stateToken: StateTokenService,
        client: GithubAppClient,
        cfg: ReturnType<typeof loadGithubAppConfig>,
        db: PostgresJsDatabase<Record<string, unknown>>,
      ) =>
        new GithubInstallationsService(
          installs,
          repos,
          stateToken,
          client,
          cfg,
          db,
        ),
    },
    GithubInstallationsRepository,
    GithubRepositoriesRepository,
    GithubWebhookEventsRepository,
    WebhookVerifierService,
  ],
  exports: [
    GithubAppClient,
    GithubInstallationsRepository,
    GithubRepositoriesRepository,
  ],
})
export class GithubIntegrationsModule {}

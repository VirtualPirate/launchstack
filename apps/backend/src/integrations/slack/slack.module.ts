import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppError } from '../../common/errors';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import { SlackInstallationsController } from './controllers/installations.controller';
import { SlackMessagesController } from './controllers/messages.controller';
import { SlackInstallationsRepository } from './repositories/installations.repository';
import { SlackInstallationsService } from './services/installations.service';
import { SlackMessagesService } from './services/messages.service';
import { StateTokenService } from './services/state-token.service';
import { SlackClient } from './slack.client';
import { loadSlackConfig, type SlackConfig } from './slack.config';
import { SLACK_CONFIG_TOKEN } from './tokens';

function makeNotConfiguredStub(): SlackClient {
  const reject = () => Promise.reject(AppError.SLACK_NOT_CONFIGURED());
  return {
    generateAuthUri: () => {
      throw AppError.SLACK_NOT_CONFIGURED();
    },
    exchangeCodeForToken: reject,
    revokeToken: reject,
    postMessage: reject,
    getChannels: reject,
    getMembers: reject,
  } as unknown as SlackClient;
}

@Module({
  controllers: [SlackInstallationsController, SlackMessagesController],
  providers: [
    {
      provide: SLACK_CONFIG_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => loadSlackConfig(config),
    },
    {
      provide: SlackClient,
      inject: [SLACK_CONFIG_TOKEN],
      useFactory: (cfg: SlackConfig | null) =>
        cfg ? new SlackClient(cfg) : makeNotConfiguredStub(),
    },
    {
      provide: StateTokenService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new StateTokenService(config.getOrThrow<string>('BETTER_AUTH_SECRET')),
    },
    {
      provide: SlackInstallationsService,
      inject: [
        SlackInstallationsRepository,
        StateTokenService,
        SlackClient,
        SLACK_CONFIG_TOKEN,
        DRIZZLE_DB,
      ],
      useFactory: (
        installs: SlackInstallationsRepository,
        stateToken: StateTokenService,
        client: SlackClient,
        cfg: SlackConfig | null,
        db: PostgresJsDatabase<Record<string, unknown>>,
      ) =>
        new SlackInstallationsService(installs, stateToken, client, cfg, db),
    },
    SlackInstallationsRepository,
    SlackMessagesService,
  ],
  exports: [SlackClient, SlackInstallationsRepository, SlackMessagesService],
})
export class SlackIntegrationsModule {}

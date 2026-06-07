import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppError } from '../../../common/errors';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import type { SlackInstallationRaw } from '../../../databases/pg-drizzle/slack-schema';
import type { SlackInstallationSelect } from '../../../databases/pg-drizzle/types';
import { SlackClient } from '../slack.client';
import type { SlackConfig } from '../slack.config';
import { SlackInstallationsRepository } from '../repositories/installations.repository';
import { StateTokenService } from './state-token.service';

type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface SlackInstallationView {
  id: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  appId: string;
  scope: string;
  authedUserId: string | null;
  connectedByUserId: string | null;
  createdAt: string;
}

function serialize(row: SlackInstallationSelect): SlackInstallationView {
  const raw = row.raw;
  return {
    id: row.id,
    teamId: raw.teamId,
    teamName: raw.teamName,
    botUserId: raw.botUserId,
    appId: raw.appId,
    scope: raw.scope,
    authedUserId: raw.authedUserId ?? null,
    connectedByUserId: raw.connectedByUserId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

interface OauthAccessResponseShape {
  access_token?: string;
  team?: { id?: string; name?: string };
  bot_user_id?: string;
  app_id?: string;
  scope?: string;
  authed_user?: { id?: string };
}

function buildRaw(
  oauth: OauthAccessResponseShape,
  connectedByUserId: string | null,
): { accessToken: string; raw: SlackInstallationRaw } {
  if (
    !oauth.access_token ||
    !oauth.team?.id ||
    !oauth.team?.name ||
    !oauth.bot_user_id ||
    !oauth.app_id ||
    !oauth.scope
  ) {
    throw AppError.SLACK_OAUTH_EXCHANGE_FAILED({
      reason: 'OAuth response missing required fields',
    });
  }
  return {
    accessToken: oauth.access_token,
    raw: {
      teamId: oauth.team.id,
      teamName: oauth.team.name,
      botUserId: oauth.bot_user_id,
      appId: oauth.app_id,
      scope: oauth.scope,
      authedUserId: oauth.authed_user?.id,
      connectedByUserId: connectedByUserId ?? undefined,
      oauthResponse: oauth,
    },
  };
}

@Injectable()
export class SlackInstallationsService {
  private readonly logger = new Logger(SlackInstallationsService.name);

  constructor(
    private readonly installs: SlackInstallationsRepository,
    private readonly stateToken: StateTokenService,
    private readonly client: SlackClient,
    private readonly config: SlackConfig | null,
    @Inject(DRIZZLE_DB) private readonly db: Db,
  ) {}

  private requireConfig(): SlackConfig {
    if (!this.config) {
      throw AppError.SLACK_NOT_CONFIGURED();
    }
    return this.config;
  }

  buildInstallUrl(input: { orgId: string; userId: string }): string {
    this.requireConfig();
    const state = this.stateToken.sign(input);
    return this.client.generateAuthUri(state);
  }

  async handleCallback(input: {
    state: string | undefined;
    code: string | undefined;
    sessionUserId: string | null;
  }): Promise<{ orgId: string }> {
    this.requireConfig();

    if (!input.state || !input.code) {
      throw AppError.SLACK_STATE_INVALID();
    }

    let payload: { orgId: string; userId: string };
    try {
      payload = this.stateToken.verify(input.state);
    } catch {
      throw AppError.SLACK_STATE_INVALID();
    }

    if (input.sessionUserId && payload.userId !== input.sessionUserId) {
      throw AppError.SLACK_STATE_USER_MISMATCH();
    }

    const oauth = (await this.client.exchangeCodeForToken(
      input.code,
    )) as OauthAccessResponseShape;
    const built = buildRaw(oauth, payload.userId);

    await this.db.transaction(async (tx) => {
      const existing = await this.installs.findByOrganizationIdIncludingDeleted(
        payload.orgId,
        tx,
      );

      if (existing && existing.deletedAt === null) {
        throw AppError.SLACK_ORG_ALREADY_CONNECTED();
      }

      if (existing) {
        await this.installs.updateTokenAndRaw(
          existing.id,
          built.accessToken,
          built.raw,
          tx,
        );
        this.logger.log(
          `Slack re-installed for org=${payload.orgId} team=${built.raw.teamId}`,
        );
        return;
      }

      await this.installs.create(
        {
          organizationId: payload.orgId,
          accessToken: built.accessToken,
          raw: built.raw,
        },
        tx,
      );
      this.logger.log(
        `Slack installed for org=${payload.orgId} team=${built.raw.teamId}`,
      );
    });

    return { orgId: payload.orgId };
  }

  async listForOrg(orgId: string): Promise<SlackInstallationView[]> {
    const row = await this.installs.findActiveByOrganizationId(orgId);
    return row ? [serialize(row)] : [];
  }

  async disconnect(orgId: string, installationId: string): Promise<void> {
    const row = await this.installs.findByIdScopedToOrg(installationId, orgId);
    if (!row) {
      throw AppError.SLACK_INSTALLATION_NOT_FOUND();
    }

    try {
      await this.client.revokeToken(row.accessToken);
    } catch (err) {
      this.logger.warn(
        `Slack token revoke failed for org=${orgId}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    await this.installs.softDelete(installationId);
    this.logger.log(
      `Slack disconnected for org=${orgId} installation=${installationId}`,
    );
  }
}

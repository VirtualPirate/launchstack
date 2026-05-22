import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../../common/errors';
import { SlackInstallationsRepository } from '../repositories/installations.repository';
import { SlackClient } from '../slack.client';

@Injectable()
export class SlackMessagesService {
  private readonly logger = new Logger(SlackMessagesService.name);

  constructor(
    private readonly installs: SlackInstallationsRepository,
    private readonly client: SlackClient,
  ) {}

  private async requireInstallation(orgId: string) {
    const row = await this.installs.findActiveByOrganizationId(orgId);
    if (!row) {
      throw AppError.SLACK_INSTALLATION_NOT_FOUND();
    }
    return row;
  }

  async postMessage(
    orgId: string,
    channelId: string,
    text: string,
  ): Promise<{ success: true; ts: string }> {
    const installation = await this.requireInstallation(orgId);
    const res = await this.client.postMessage(
      installation.accessToken,
      channelId,
      text,
    );
    this.logger.log(
      `Slack message posted org=${orgId} team=${installation.raw.teamId} channel=${channelId}`,
    );
    return { success: true, ts: String(res.ts ?? '') };
  }

  async listChannels(orgId: string) {
    const installation = await this.requireInstallation(orgId);
    return this.client.getChannels(installation.accessToken);
  }

  async listMembers(orgId: string) {
    const installation = await this.requireInstallation(orgId);
    return this.client.getMembers(installation.accessToken);
  }
}

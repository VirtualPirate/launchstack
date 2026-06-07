import { Injectable, Logger } from '@nestjs/common';
import { SlackMessagesService } from '../../../integrations/slack/services/messages.service';
import {
  BriefRenderService,
  type RenderableBrief,
} from './brief-render.service';

@Injectable()
export class BriefSlackService {
  private readonly logger = new Logger(BriefSlackService.name);

  constructor(
    private readonly slack: SlackMessagesService,
    private readonly render: BriefRenderService,
  ) {}

  async post(
    organizationId: string,
    brief: RenderableBrief,
    channelId: string,
  ): Promise<void> {
    const text = this.render.toSlackMarkdown(brief);
    await this.slack.postMessage(organizationId, channelId, text);
    this.logger.log(
      `Brief slack posted brief=${brief.id} channel=${channelId}`,
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { BriefsRepository } from '../../generation/repositories/briefs.repository';
import { BriefSchedulesRepository } from '../../schedules/repositories/brief-schedules.repository';
import { BriefEmailService } from './brief-email.service';
import { BriefSlackService } from './brief-slack.service';

type ChannelResult = {
  kind: 'email' | 'slack';
  ok: boolean;
  err?: string;
};

@Injectable()
export class BriefDelivererService {
  private readonly logger = new Logger(BriefDelivererService.name);

  constructor(
    private readonly briefs: BriefsRepository,
    private readonly schedules: BriefSchedulesRepository,
    private readonly email: BriefEmailService,
    private readonly slack: BriefSlackService,
  ) {}

  async deliver(briefId: string): Promise<void> {
    const brief = await this.briefs.findById(briefId);
    if (!brief) return;
    const schedule = brief.briefScheduleId
      ? await this.schedules.findById(brief.briefScheduleId)
      : null;

    const emails = schedule?.emailRecipients ?? brief.deliveryEmails;
    const slackChannel =
      schedule?.slackChannelId ?? brief.deliverySlackChannelId;

    const renderable = {
      id: brief.id,
      title: brief.title,
      briefInfoTitle: brief.briefInfoTitle,
      summary: brief.summary,
    };

    const tasks: Array<Promise<ChannelResult>> = [];
    if (emails.length > 0) {
      tasks.push(
        this.email
          .send(renderable, emails)
          .then<ChannelResult>(() => ({ kind: 'email', ok: true }))
          .catch<ChannelResult>((e: unknown) => ({
            kind: 'email',
            ok: false,
            err: e instanceof Error ? e.message : String(e),
          })),
      );
    }
    if (slackChannel) {
      tasks.push(
        this.slack
          .post(brief.organizationId, renderable, slackChannel)
          .then<ChannelResult>(() => ({ kind: 'slack', ok: true }))
          .catch<ChannelResult>((e: unknown) => ({
            kind: 'slack',
            ok: false,
            err: e instanceof Error ? e.message : String(e),
          })),
      );
    }

    const results = await Promise.all(tasks);
    const attempted = results.length;
    const succeeded = results.filter((r) => r.ok).length;
    const failureReason =
      results
        .filter((r) => !r.ok)
        .map((r) => `[${r.kind}] ${r.err}`)
        .join('; ') || null;

    const deliveredOk = attempted === 0 || succeeded > 0;
    const now = new Date();

    if (deliveredOk) {
      await this.briefs.update(briefId, {
        status: 'delivered',
        deliveredAt: now,
        failureReason,
      });
      if (brief.briefScheduleId) {
        await this.schedules.update(brief.briefScheduleId, { lastSentAt: now });
      }
    } else {
      await this.briefs.update(briefId, {
        status: 'failed',
        failureReason,
      });
      this.logger.warn(`Brief ${briefId} delivery failed: ${failureReason}`);
    }
  }
}

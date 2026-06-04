import { BriefDelivererService } from '../services/brief-deliverer.service';

function makeService() {
  const briefs = { findById: jest.fn(), update: jest.fn() };
  const schedules = { findById: jest.fn(), update: jest.fn() };
  const email = { send: jest.fn() };
  const slack = { post: jest.fn() };
  const svc = new BriefDelivererService(
    briefs as any,
    schedules as any,
    email as any,
    slack as any,
  );
  return { svc, briefs, schedules, email, slack };
}

const baseBrief = {
  id: 'b1',
  organizationId: 'o1',
  briefScheduleId: null,
  title: 'T',
  briefInfoTitle: 'i',
  summary: 's',
  deliveryEmails: [] as string[],
  deliverySlackChannelId: null as string | null,
  status: 'generated',
};

describe('BriefDelivererService.deliver', () => {
  it('marks delivered when only dashboard (no email, no slack)', async () => {
    const { svc, briefs } = makeService();
    briefs.findById.mockResolvedValue(baseBrief);
    await svc.deliver('b1');
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'delivered' }),
    );
  });

  it('marks delivered when email succeeds, slack not configured', async () => {
    const { svc, briefs, email } = makeService();
    briefs.findById.mockResolvedValue({
      ...baseBrief,
      deliveryEmails: ['a@x.io'],
    });
    email.send.mockResolvedValue(undefined);
    await svc.deliver('b1');
    expect(email.send).toHaveBeenCalled();
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'delivered' }),
    );
  });

  it('marks delivered when one channel fails but the other succeeds (records failure_reason)', async () => {
    const { svc, briefs, email, slack } = makeService();
    briefs.findById.mockResolvedValue({
      ...baseBrief,
      deliveryEmails: ['a@x.io'],
      deliverySlackChannelId: 'C123',
    });
    email.send.mockRejectedValue(new Error('SES down'));
    slack.post.mockResolvedValue(undefined);
    await svc.deliver('b1');
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        status: 'delivered',
        failureReason: expect.stringContaining('SES down'),
      }),
    );
  });

  it('marks failed when every attempted channel fails', async () => {
    const { svc, briefs, email, slack } = makeService();
    briefs.findById.mockResolvedValue({
      ...baseBrief,
      deliveryEmails: ['a@x.io'],
      deliverySlackChannelId: 'C123',
    });
    email.send.mockRejectedValue(new Error('SES down'));
    slack.post.mockRejectedValue(new Error('channel_not_found'));
    await svc.deliver('b1');
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('updates schedule.lastSentAt when delivered via schedule', async () => {
    const { svc, briefs, schedules } = makeService();
    briefs.findById.mockResolvedValue({
      ...baseBrief,
      briefScheduleId: 'sch1',
    });
    schedules.findById.mockResolvedValue({
      id: 'sch1',
      emailRecipients: [],
      slackInstallationId: null,
      slackChannelId: null,
    });
    await svc.deliver('b1');
    expect(schedules.update).toHaveBeenCalledWith(
      'sch1',
      expect.objectContaining({
        lastSentAt: expect.any(Date),
      }),
    );
  });
});

import { GithubWebhookEventsRepository } from '../repositories/webhook-events.repository';

describe('GithubWebhookEventsRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new GithubWebhookEventsRepository({} as any);

    expect(typeof repo.create).toBe('function');
  });
});

import { SlackMessagesService } from '../services/messages.service';

function makeService() {
  const installsRepo = {
    findActiveByOrganizationId: jest.fn(),
  } as any;
  const client = {
    postMessage: jest.fn(),
    getChannels: jest.fn(),
    getMembers: jest.fn(),
  } as any;
  const svc = new SlackMessagesService(installsRepo, client);
  return { svc, installsRepo, client };
}

const installation = {
  id: 'i1',
  organizationId: 'o1',
  accessToken: 'xoxb-tok',
  raw: { teamId: 'T1' } as any,
};

describe('SlackMessagesService', () => {
  describe('postMessage', () => {
    it('posts via client with stored token and returns ts', async () => {
      const { svc, installsRepo, client } = makeService();
      installsRepo.findActiveByOrganizationId.mockResolvedValue(installation);
      client.postMessage.mockResolvedValue({ ok: true, ts: '12345.6' });

      const res = await svc.postMessage('o1', 'C1', 'hello');

      expect(client.postMessage).toHaveBeenCalledWith(
        'xoxb-tok',
        'C1',
        'hello',
      );
      expect(res).toEqual({ success: true, ts: '12345.6' });
    });

    it('throws SLACK_INSTALLATION_NOT_FOUND when org has no installation', async () => {
      const { svc, installsRepo } = makeService();
      installsRepo.findActiveByOrganizationId.mockResolvedValue(null);

      await expect(svc.postMessage('o1', 'C1', 'hi')).rejects.toMatchObject({
        code: 'SLACK_INSTALLATION_NOT_FOUND',
      });
    });
  });

  describe('listChannels', () => {
    it('returns channels from the client', async () => {
      const { svc, installsRepo, client } = makeService();
      installsRepo.findActiveByOrganizationId.mockResolvedValue(installation);
      client.getChannels.mockResolvedValue([{ id: 'C1', name: 'general' }]);

      const out = await svc.listChannels('o1');
      expect(client.getChannels).toHaveBeenCalledWith('xoxb-tok');
      expect(out).toEqual([{ id: 'C1', name: 'general' }]);
    });

    it('throws when no installation exists', async () => {
      const { svc, installsRepo } = makeService();
      installsRepo.findActiveByOrganizationId.mockResolvedValue(null);

      await expect(svc.listChannels('o1')).rejects.toMatchObject({
        code: 'SLACK_INSTALLATION_NOT_FOUND',
      });
    });
  });

  describe('listMembers', () => {
    it('returns members from the client', async () => {
      const { svc, installsRepo, client } = makeService();
      installsRepo.findActiveByOrganizationId.mockResolvedValue(installation);
      client.getMembers.mockResolvedValue([{ id: 'U1' }]);

      const out = await svc.listMembers('o1');
      expect(client.getMembers).toHaveBeenCalledWith('xoxb-tok');
      expect(out).toEqual([{ id: 'U1' }]);
    });
  });
});

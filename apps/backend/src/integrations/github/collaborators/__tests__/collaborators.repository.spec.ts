import { CollaboratorsRepository } from '../repositories/collaborators.repository';

describe('CollaboratorsRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new CollaboratorsRepository({} as any);

    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByGithubUserId).toBe('function');
    expect(typeof repo.upsertByGithubUserId).toBe('function');
    expect(typeof repo.listByOrganization).toBe('function');
  });

  describe('listByOrganization', () => {
    it('returns rows distinct on collaborator id', async () => {
      const fakeDb = {
        selectDistinct: () => ({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () =>
                    Promise.resolve([
                      {
                        id: 'c1',
                        githubUserId: BigInt(10),
                        login: 'ada',
                        nodeId: null,
                        avatarUrl: null,
                        htmlUrl: null,
                        type: 'User',
                        siteAdmin: false,
                        raw: {},
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        deletedAt: null,
                      },
                    ]),
                }),
              }),
            }),
          }),
        }),
      };
      const repo = new CollaboratorsRepository(fakeDb as never);
      const rows = await repo.listByOrganization('org-1');
      expect(rows).toHaveLength(1);
      expect(rows[0].login).toBe('ada');
    });
  });
});

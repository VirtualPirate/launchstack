import { CollaboratorsRepository } from '../repositories/collaborators.repository';

describe('CollaboratorsRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new CollaboratorsRepository({} as any);

    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByGithubUserId).toBe('function');
    expect(typeof repo.upsertByGithubUserId).toBe('function');
  });
});

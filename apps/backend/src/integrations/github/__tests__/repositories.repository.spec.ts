import { GithubRepositoriesRepository } from '../repositories/repositories.repository';

describe('GithubRepositoriesRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new GithubRepositoriesRepository({} as any);

    expect(typeof repo.listByInstallation).toBe('function');
    expect(typeof repo.reconcileForInstallation).toBe('function');
    expect(typeof repo.softDeleteAllForInstallation).toBe('function');
    expect(typeof repo.findByGithubRepoId).toBe('function');
    expect(typeof repo.findByIdIncludingDeleted).toBe('function');
  });
});

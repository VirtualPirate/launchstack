import { CommitsRepository } from '../repositories/commits.repository';

describe('CommitsRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new CommitsRepository({} as never);
    expect(typeof repo.upsertMany).toBe('function');
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByRepositorySince).toBe('function');
    expect(typeof repo.countByRepositorySince).toBe('function');
    expect(typeof repo.findWithCollaborators).toBe('function');
  });
});

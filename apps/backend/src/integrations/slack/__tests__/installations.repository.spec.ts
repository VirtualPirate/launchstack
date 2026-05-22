import { SlackInstallationsRepository } from '../repositories/installations.repository';

describe('SlackInstallationsRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new SlackInstallationsRepository({} as any);

    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findActiveByOrganizationId).toBe('function');
    expect(typeof repo.findByOrganizationIdIncludingDeleted).toBe('function');
    expect(typeof repo.findByIdScopedToOrg).toBe('function');
    expect(typeof repo.create).toBe('function');
    expect(typeof repo.updateTokenAndRaw).toBe('function');
    expect(typeof repo.softDelete).toBe('function');
    expect(typeof repo.undelete).toBe('function');
  });
});

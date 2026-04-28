import { OrganizationsService } from '../services/organizations.service';

function makeMocks() {
  const orgsRepo = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findByOwnerId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setOwner: jest.fn(),
  } as any;

  const membersRepo = {
    findByOrgAndUser: jest.fn(),
    listByUser: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    delete: jest.fn(),
    deleteByOrgAndUser: jest.fn(),
  } as any;

  const db = {
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ __tx: true }),
    ),
  } as any;

  return { orgsRepo, membersRepo, db };
}

describe('OrganizationsService', () => {
  describe('create', () => {
    it('rejects with 409 when caller already owns an org', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findByOwnerId.mockResolvedValue({ id: 'existing' });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.createOrganization('user-1', { name: 'Acme' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('creates org + owner membership in a transaction', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findByOwnerId.mockResolvedValue(null);
      orgsRepo.findBySlug.mockResolvedValue(null);
      orgsRepo.create.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        slug: 'acme-abc123',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      membersRepo.create.mockResolvedValue({
        id: 'm-1',
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: new Date(),
      });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const result = await svc.createOrganization('user-1', { name: 'Acme' });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(orgsRepo.create).toHaveBeenCalledTimes(1);
      expect(membersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          role: 'owner',
        }),
        expect.anything(),
      );
      expect(result.organization.id).toBe('org-1');
      expect(result.membership.role).toBe('owner');
    });
  });

  describe('updateOrganization', () => {
    it('rejects slug conflicts with 409', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findBySlug.mockResolvedValue({ id: 'other', slug: 'taken' });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.updateOrganization('org-1', { slug: 'taken' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('updates when slug is free', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findBySlug.mockResolvedValue(null);
      orgsRepo.update.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        slug: 'acme-new',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const result = await svc.updateOrganization('org-1', {
        slug: 'acme-new',
      });
      expect(result.slug).toBe('acme-new');
    });
  });

  describe('transferOwnership', () => {
    it('rejects when target is not an admin of this org', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.findByOrgAndUser.mockResolvedValue(null);

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.transferOwnership({
          organizationId: 'org-1',
          currentOwnerUserId: 'user-1',
          newOwnerUserId: 'user-2',
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejects when target already owns another org', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.findByOrgAndUser.mockResolvedValueOnce({
        role: 'admin',
        id: 'm2',
      });
      orgsRepo.findByOwnerId.mockResolvedValue({ id: 'other' });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.transferOwnership({
          organizationId: 'org-1',
          currentOwnerUserId: 'user-1',
          newOwnerUserId: 'user-2',
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('flips owner_id and swaps role rows in a transaction', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.findByOrgAndUser.mockImplementation(
        async (_orgId: string, userId: string) =>
          userId === 'user-2'
            ? { id: 'm2', role: 'admin' }
            : { id: 'm1', role: 'owner' },
      );
      orgsRepo.findByOwnerId.mockResolvedValue(null);
      orgsRepo.setOwner.mockResolvedValue({
        id: 'org-1',
        ownerId: 'user-2',
        name: 'Acme',
        slug: 'acme',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await svc.transferOwnership({
        organizationId: 'org-1',
        currentOwnerUserId: 'user-1',
        newOwnerUserId: 'user-2',
      });

      expect(orgsRepo.setOwner).toHaveBeenCalledWith(
        'org-1',
        'user-2',
        expect.anything(),
      );
      expect(membersRepo.updateRole).toHaveBeenCalledWith(
        'm2',
        'owner',
        expect.anything(),
      );
      expect(membersRepo.updateRole).toHaveBeenCalledWith(
        'm1',
        'admin',
        expect.anything(),
      );
    });
  });

  describe('deleteOrganization', () => {
    it('calls repo.delete (cascade handles members/invites)', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await svc.deleteOrganization('org-1');
      expect(orgsRepo.delete).toHaveBeenCalledWith('org-1');
    });
  });

  describe('listMyOrganizations', () => {
    it('returns rows shaped as { organization, role }', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.listByUser.mockResolvedValue([
        {
          organization: {
            id: 'o1',
            name: 'A',
            slug: 'a',
            ownerId: 'u1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          member: {
            id: 'm1',
            role: 'admin',
            userId: 'u1',
            organizationId: 'o1',
            createdAt: new Date(),
          },
        },
      ]);

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const out = await svc.listMyOrganizations('u1');
      expect(out).toHaveLength(1);
      expect(out[0].role).toBe('admin');
      expect(out[0].organization.id).toBe('o1');
    });
  });
});

import { OrganizationsService } from '../services/organizations.service';

/** The shape pg gives a unique-index rejection. */
function uniqueViolation(constraint: string) {
  return Object.assign(new Error('duplicate key'), {
    code: '23505',
    constraint,
  });
}

function makeMocks() {
  const orgsRepo = {
    findById: jest.fn(),
    lockById: jest.fn().mockResolvedValue({ id: 'org-1' }),
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
    transaction: jest.fn(() => ({
      execute: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ __tx: true }),
    })),
  } as any;

  return { orgsRepo, membersRepo, db };
}

describe('OrganizationsService', () => {
  describe('create', () => {
    it('rejects with 409 when caller already owns an org', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.create.mockRejectedValue(
        uniqueViolation('organizations_owner_id_unique'),
      );

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.createOrganization('user-1', { name: 'Acme' }),
      ).rejects.toMatchObject({ status: 409, code: 'ORG_OWNER_CONFLICT' });
      expect(orgsRepo.create).toHaveBeenCalledTimes(1);
    });

    it('retries a slug clash with a fresh slug', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.create
        .mockRejectedValueOnce(uniqueViolation('organizations_slug_unique'))
        .mockResolvedValueOnce({
          id: 'org-1',
          name: 'Acme',
          slug: 'acme-def456',
          ownerId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      membersRepo.create.mockResolvedValue({ id: 'm-1', role: 'owner' });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const result = await svc.createOrganization('user-1', { name: 'Acme' });

      expect(orgsRepo.create).toHaveBeenCalledTimes(2);
      expect(result.organization.id).toBe('org-1');
    });

    it('creates org + owner membership in a transaction', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
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
      orgsRepo.update.mockRejectedValue(
        uniqueViolation('organizations_slug_unique'),
      );

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.updateOrganization('org-1', { slug: 'taken' }),
      ).rejects.toMatchObject({ status: 409, code: 'ORG_SLUG_CONFLICT' });
    });

    it('updates when slug is free', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
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
      membersRepo.findByOrgAndUser.mockImplementation(
        async (_orgId: string, userId: string) =>
          userId === 'user-2'
            ? { id: 'm2', role: 'admin' }
            : { id: 'm1', role: 'owner' },
      );
      orgsRepo.setOwner.mockRejectedValue(
        uniqueViolation('organizations_owner_id_unique'),
      );

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.transferOwnership({
          organizationId: 'org-1',
          currentOwnerUserId: 'user-1',
          newOwnerUserId: 'user-2',
        }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'ORG_TRANSFER_TARGET_OWNS_ELSEWHERE',
      });
    });

    it('flips owner_id and swaps role rows in a transaction', async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.findByOrgAndUser.mockImplementation(
        async (_orgId: string, userId: string) =>
          userId === 'user-2'
            ? { id: 'm2', role: 'admin' }
            : { id: 'm1', role: 'owner' },
      );
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
      // Lock before any membership read; demote before promote.
      expect(orgsRepo.lockById.mock.invocationCallOrder[0]).toBeLessThan(
        membersRepo.findByOrgAndUser.mock.invocationCallOrder[0],
      );
      expect(membersRepo.updateRole.mock.calls).toEqual([
        ['m1', 'admin', expect.anything()],
        ['m2', 'owner', expect.anything()],
      ]);
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

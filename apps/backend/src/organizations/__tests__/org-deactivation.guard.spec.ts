import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgDeactivationGuard } from '../guards/org-deactivation.guard';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { ALLOW_WHEN_DEACTIVATED_KEY } from '../decorators/allow-when-deactivated.decorator';
import { REQUIRE_ORG_ROLE_KEY } from '../decorators/require-org-role.decorator';

const ORG_ID = '3f1a9c62-2c1f-4f2e-9a52-4b1d0d5f8e11';

function makeContext(opts: {
  level?: 'owner' | 'admin' | 'member';
  allowWhenDeactivated?: boolean;
  membership?: boolean;
  deactivatedAt?: Date | null;
}) {
  const request: any = {
    orgMembership:
      opts.membership === false
        ? undefined
        : { organizationId: ORG_ID, userId: 'user-1', role: 'admin' },
  };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === REQUIRE_ORG_ROLE_KEY
        ? opts.level
        : key === ALLOW_WHEN_DEACTIVATED_KEY
          ? opts.allowWhenDeactivated
          : undefined,
    ),
  } as unknown as Reflector;

  const organizations = {
    findDeactivatedAt: jest.fn().mockResolvedValue(opts.deactivatedAt ?? null),
  } as unknown as OrganizationsRepository;

  return { ctx, reflector, organizations };
}

const DEACTIVATED = new Date('2026-08-31T00:00:00.000Z');

describe('OrgDeactivationGuard', () => {
  it('is a no-op when @RequireOrgRole is absent', async () => {
    const { ctx, reflector, organizations } = makeContext({
      level: undefined,
      deactivatedAt: DEACTIVATED,
    });
    const guard = new OrgDeactivationGuard(reflector, organizations);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(organizations.findDeactivatedAt).not.toHaveBeenCalled();
  });

  // The whole point of the feature: a deactivated org is *view only*, not shut
  // off, so every read a viewer would make still has to pass.
  it('lets reads through on a deactivated organization without a query', async () => {
    const { ctx, reflector, organizations } = makeContext({
      level: 'member',
      deactivatedAt: DEACTIVATED,
    });
    const guard = new OrgDeactivationGuard(reflector, organizations);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(organizations.findDeactivatedAt).not.toHaveBeenCalled();
  });

  it.each(['admin', 'owner'] as const)(
    'rejects a %s-level write on a deactivated organization',
    async (level) => {
      const { ctx, reflector, organizations } = makeContext({
        level,
        deactivatedAt: DEACTIVATED,
      });
      const guard = new OrgDeactivationGuard(reflector, organizations);

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        HttpException,
      );
      expect(organizations.findDeactivatedAt).toHaveBeenCalledWith(ORG_ID);
    },
  );

  it('allows the same write on an active organization', async () => {
    const { ctx, reflector, organizations } = makeContext({
      level: 'admin',
      deactivatedAt: null,
    });
    const guard = new OrgDeactivationGuard(reflector, organizations);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // Routes that opted out (the organization controllers) survive the freeze.
  it('allows a write that opted out with @AllowWhenDeactivated', async () => {
    const { ctx, reflector, organizations } = makeContext({
      level: 'admin',
      allowWhenDeactivated: true,
      deactivatedAt: DEACTIVATED,
    });
    const guard = new OrgDeactivationGuard(reflector, organizations);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(organizations.findDeactivatedAt).not.toHaveBeenCalled();
  });

  // Fails closed: if the guard order is ever changed so this runs before
  // OrgContextGuard, a write must not sail past unchecked.
  it('rejects a write when no membership was resolved onto the request', async () => {
    const { ctx, reflector, organizations } = makeContext({
      level: 'admin',
      membership: false,
    });
    const guard = new OrgDeactivationGuard(reflector, organizations);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
    expect(organizations.findDeactivatedAt).not.toHaveBeenCalled();
  });
});

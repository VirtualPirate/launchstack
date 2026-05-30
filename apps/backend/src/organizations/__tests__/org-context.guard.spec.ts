import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgContextGuard } from '../guards/org-context.guard';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import { REQUIRE_ORG_ROLE_KEY } from '../decorators/require-org-role.decorator';

function makeContext(opts: {
  header?: string;
  session?: { user?: { id?: string } };
  membership?: { role: 'owner' | 'admin' | 'viewer' } | null;
  level?: 'owner' | 'admin' | 'member';
}) {
  const request: any = {
    headers: opts.header ? { 'x-organization-id': opts.header } : {},
    session: opts.session ?? { user: { id: 'user-1' } },
  };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(opts.level),
  } as unknown as Reflector;

  const membersRepo = {
    findByOrgAndUser: jest.fn().mockResolvedValue(
      opts.membership
        ? {
            id: 'm1',
            organizationId: opts.header,
            userId: opts.session?.user?.id ?? 'user-1',
            role: opts.membership.role,
          }
        : null,
    ),
  } as unknown as OrganizationMembersRepository;

  return { ctx, request, reflector, membersRepo };
}

describe('OrgContextGuard', () => {
  it('is a no-op when @RequireOrgRole is absent', async () => {
    const { ctx, reflector, membersRepo } = makeContext({ level: undefined });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('400 when header missing and route is org-scoped', async () => {
    const { ctx, reflector, membersRepo } = makeContext({ level: 'member' });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('401 when no session on an org-scoped route', async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: 'member',
      header: 'org-1',
      session: {},
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('404 when caller is not a member', async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: 'member',
      header: 'org-1',
      membership: null,
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('403 when role is insufficient', async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: 'owner',
      header: 'org-1',
      membership: { role: 'admin' },
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('allows owner when admin is required', async () => {
    const { ctx, request, reflector, membersRepo } = makeContext({
      level: 'admin',
      header: 'org-1',
      membership: { role: 'owner' },
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.orgMembership).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
    });
  });

  it('allows viewer when member is required', async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: 'member',
      header: 'org-1',
      membership: { role: 'viewer' },
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

// Force ts to not strip imports; keep the test file focused.
void REQUIRE_ORG_ROLE_KEY;
void HttpException;

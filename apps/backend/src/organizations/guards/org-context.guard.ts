import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '@launchstack/api-interfaces';
import {
  OrgRoleLevel,
  REQUIRE_ORG_ROLE_KEY,
} from '../decorators/require-org-role.decorator';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import { AppError } from '../../common/errors';

const ROLE_RANK: Record<OrganizationRole, number> = {
  viewer: 1,
  admin: 2,
  owner: 3,
};

const LEVEL_MIN_RANK: Record<OrgRoleLevel, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membersRepo: OrganizationMembersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const level = this.reflector.getAllAndOverride<OrgRoleLevel | undefined>(
      REQUIRE_ORG_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!level) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      session?: { user?: { id?: string } };
      orgMembership?: {
        organizationId: string;
        userId: string;
        role: OrganizationRole;
      };
    }>();

    const headerValue = request.headers['x-organization-id'];
    const organizationId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    if (!organizationId || typeof organizationId !== 'string') {
      throw AppError.ORG_HEADER_REQUIRED();
    }

    const userId = request.session?.user?.id;
    if (!userId) {
      throw AppError.UNAUTHENTICATED();
    }

    const membership = await this.membersRepo.findByOrgAndUser(
      organizationId,
      userId,
    );
    if (!membership) {
      throw AppError.ORG_NOT_FOUND();
    }

    if (ROLE_RANK[membership.role] < LEVEL_MIN_RANK[level]) {
      throw AppError.ORG_FORBIDDEN();
    }

    request.orgMembership = {
      organizationId,
      userId,
      role: membership.role,
    };
    return true;
  }
}

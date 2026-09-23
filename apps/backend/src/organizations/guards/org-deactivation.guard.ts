import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_WHEN_DEACTIVATED_KEY } from '../decorators/allow-when-deactivated.decorator';
import type { OrgMembershipContext } from '../decorators/org-membership.decorator';
import {
  OrgRoleLevel,
  REQUIRE_ORG_ROLE_KEY,
} from '../decorators/require-org-role.decorator';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { AppError } from '../../common/errors';

/**
 * Freezes a deactivated organization read-only.
 *
 * Mirrors the role rule (reads are `member`, writes are `admin`/`owner`; see
 * the backend AGENTS.md): gating exactly the routes above `member` gives a
 * viewer's view of the whole app without annotating every controller. Routes
 * that must keep working opt out with `@AllowWhenDeactivated()`.
 *
 * Registered as an `APP_GUARD` after OrgContextGuard, whose resolved
 * membership it reads, so a caller cannot probe another tenant's state.
 */
@Injectable()
export class OrgDeactivationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizations: OrganizationsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const level = this.reflector.getAllAndOverride<OrgRoleLevel | undefined>(
      REQUIRE_ORG_ROLE_KEY,
      targets,
    );
    // No level: not org-scoped. `member`: a read, which stays open.
    if (!level || level === 'member') {
      return true;
    }
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(
        ALLOW_WHEN_DEACTIVATED_KEY,
        targets,
      )
    ) {
      return true;
    }

    const organizationId = context
      .switchToHttp()
      .getRequest<{ orgMembership?: OrgMembershipContext }>()
      .orgMembership?.organizationId;
    // OrgContextGuard sets it or throws first. Fail closed if the guard order
    // ever changes rather than let a write through unchecked.
    if (!organizationId) {
      throw AppError.ORG_HEADER_REQUIRED();
    }

    if (await this.organizations.findDeactivatedAt(organizationId)) {
      throw AppError.ORG_DEACTIVATED();
    }
    return true;
  }
}

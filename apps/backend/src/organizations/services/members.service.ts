import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type {
  OrganizationMember,
  OrganizationRole,
} from '@launchstack/api-interfaces';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import type { OrgMembershipContext } from '../decorators/org-membership.decorator';
import type { MemberRowWithUser } from '../repositories/members.repository';

function apiError(code: string, message: string) {
  return { code, message };
}

function serializeMember(row: MemberRowWithUser): OrganizationMember {
  return {
    id: row.member.id,
    organizationId: row.member.organizationId,
    userId: row.member.userId,
    role: row.member.role,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image ?? null,
    },
    createdAt: row.member.createdAt.toISOString(),
  };
}

@Injectable()
export class MembersService {
  constructor(private readonly members: OrganizationMembersRepository) {}

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await this.members.listByOrg(organizationId);
    return rows.map(serializeMember);
  }

  async updateMemberRole(input: {
    organizationId: string;
    memberId: string;
    newRole: Exclude<OrganizationRole, 'owner'>;
  }): Promise<OrganizationMember> {
    const rows = await this.members.listByOrg(input.organizationId);
    const target = rows.find((r) => r.member.id === input.memberId);
    if (!target) {
      throw new HttpException(
        apiError('MEMBER_NOT_FOUND', 'Member not found'),
        HttpStatus.NOT_FOUND,
      );
    }
    if (target.member.role === 'owner') {
      throw new HttpException(
        apiError(
          'MEMBER_IS_OWNER',
          'Use transfer-ownership to change the owner role',
        ),
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.members.updateRole(
      input.memberId,
      input.newRole,
    );
    if (!updated) {
      throw new HttpException(
        apiError('MEMBER_NOT_FOUND', 'Member not found'),
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeMember({ member: updated, user: target.user });
  }

  async removeMember(input: {
    organizationId: string;
    callerMembership: OrgMembershipContext;
    targetMemberId: string;
  }): Promise<void> {
    const rows = await this.members.listByOrg(input.organizationId);
    const target = rows.find((r) => r.member.id === input.targetMemberId);
    if (!target) {
      throw new HttpException(
        apiError('MEMBER_NOT_FOUND', 'Member not found'),
        HttpStatus.NOT_FOUND,
      );
    }

    const callerRole = input.callerMembership.role;

    if (target.member.role === 'owner') {
      throw new HttpException(
        apiError(
          'MEMBER_FORBIDDEN',
          'Cannot remove the owner — use transfer-ownership or delete',
        ),
        HttpStatus.FORBIDDEN,
      );
    }

    if (target.member.userId === input.callerMembership.userId) {
      throw new HttpException(
        apiError(
          'MEMBER_FORBIDDEN',
          'Use the leave endpoint to remove yourself',
        ),
        HttpStatus.FORBIDDEN,
      );
    }

    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new HttpException(
        apiError('MEMBER_FORBIDDEN', 'Insufficient role'),
        HttpStatus.FORBIDDEN,
      );
    }

    await this.members.delete(input.targetMemberId);
  }

  async leaveOrganization(input: {
    organizationId: string;
    callerMembership: OrgMembershipContext;
  }): Promise<void> {
    if (input.callerMembership.role === 'owner') {
      throw new HttpException(
        apiError(
          'OWNER_CANNOT_LEAVE',
          'Owner must transfer ownership or delete the organization',
        ),
        HttpStatus.CONFLICT,
      );
    }
    await this.members.deleteByOrgAndUser(
      input.organizationId,
      input.callerMembership.userId,
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  MyOrganization,
  Organization,
  OrganizationRole,
} from '@launchstack/api-interfaces';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import type {
  OrganizationMemberSelect,
  OrganizationSelect,
} from '../../databases/pg-drizzle/types';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import { AppError } from '../../common/errors';

type Db = PostgresJsDatabase<Record<string, unknown>>;

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  return `${base || 'org'}-${suffix}`;
}

export function serializeOrganization(row: OrganizationSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgs: OrganizationsRepository,
    private readonly members: OrganizationMembersRepository,
    @Inject(DRIZZLE_DB) private readonly db: Db,
  ) {}

  async createOrganization(
    ownerUserId: string,
    input: { name: string },
  ): Promise<{
    organization: Organization;
    membership: OrganizationMemberSelect;
  }> {
    const existing = await this.orgs.findByOwnerId(ownerUserId);
    if (existing) {
      throw AppError.ORG_OWNER_CONFLICT();
    }

    const result = await this.db.transaction(async (tx) => {
      let slug = buildSlug(input.name);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await this.orgs.findBySlug(slug, tx);
        if (!clash) break;
        slug = buildSlug(input.name);
      }

      const org = await this.orgs.create(
        { name: input.name, slug, ownerId: ownerUserId },
        tx,
      );
      const membership = await this.members.create(
        { organizationId: org.id, userId: ownerUserId, role: 'owner' },
        tx,
      );
      return { org, membership };
    });

    return {
      organization: serializeOrganization(result.org),
      membership: result.membership,
    };
  }

  async listMyOrganizations(userId: string): Promise<MyOrganization[]> {
    const rows = await this.members.listByUser(userId);
    return rows.map((r) => ({
      organization: serializeOrganization(r.organization),
      role: r.member.role,
    }));
  }

  async getCurrentOrganization(
    organizationId: string,
    role: OrganizationRole,
  ): Promise<{ organization: Organization; role: OrganizationRole }> {
    const row = await this.orgs.findById(organizationId);
    if (!row) {
      throw AppError.ORG_NOT_FOUND();
    }
    return { organization: serializeOrganization(row), role };
  }

  async updateOrganization(
    organizationId: string,
    patch: { name?: string; slug?: string },
  ): Promise<Organization> {
    if (patch.slug) {
      const clash = await this.orgs.findBySlug(patch.slug);
      if (clash && clash.id !== organizationId) {
        throw AppError.ORG_SLUG_CONFLICT();
      }
    }
    const updated = await this.orgs.update(organizationId, patch);
    if (!updated) {
      throw AppError.ORG_NOT_FOUND();
    }
    return serializeOrganization(updated);
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.orgs.delete(organizationId);
  }

  async transferOwnership(input: {
    organizationId: string;
    currentOwnerUserId: string;
    newOwnerUserId: string;
  }): Promise<Organization> {
    if (input.currentOwnerUserId === input.newOwnerUserId) {
      throw AppError.ORG_TRANSFER_TO_SELF();
    }

    return await this.db.transaction(async (tx) => {
      const target = await this.members.findByOrgAndUser(
        input.organizationId,
        input.newOwnerUserId,
        tx,
      );
      if (!target || target.role !== 'admin') {
        throw AppError.ORG_TRANSFER_TARGET_NOT_ADMIN();
      }

      const targetOwnsElsewhere = await this.orgs.findByOwnerId(
        input.newOwnerUserId,
        tx,
      );
      if (targetOwnsElsewhere) {
        throw AppError.ORG_TRANSFER_TARGET_OWNS_ELSEWHERE();
      }

      const currentOwnerMembership = await this.members.findByOrgAndUser(
        input.organizationId,
        input.currentOwnerUserId,
        tx,
      );
      if (!currentOwnerMembership || currentOwnerMembership.role !== 'owner') {
        throw AppError.ORG_TRANSFER_CALLER_NOT_OWNER();
      }

      const updatedOrg = await this.orgs.setOwner(
        input.organizationId,
        input.newOwnerUserId,
        tx,
      );
      if (!updatedOrg) {
        throw AppError.ORG_NOT_FOUND();
      }

      await this.members.updateRole(target.id, 'owner', tx);
      await this.members.updateRole(currentOwnerMembership.id, 'admin', tx);

      return serializeOrganization(updatedOrg);
    });
  }
}

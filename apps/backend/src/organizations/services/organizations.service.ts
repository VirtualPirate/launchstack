import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  MyOrganization,
  Organization,
  OrganizationRole,
} from '@launchstack/api-interfaces';
import { KYSELY_DB } from '../../databases/kysely';
import type {
  AppDatabase,
  OrganizationMemberSelect,
  OrganizationSelect,
} from '../../databases/kysely';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import { OrganizationTeardownService } from './organization-teardown.service';
import { AppError } from '../../common/errors';

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  return `${base || 'org'}-${suffix}`;
}

/**
 * Name of the unique index that rejected a write (Postgres 23505), if any.
 * Pre-checks can't see a concurrent uncommitted insert, so the indexes are
 * what arbitrate slug and owner clashes.
 */
function uniqueViolation(err: unknown): string | undefined {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  return e?.code === '23505' && typeof e.constraint === 'string'
    ? e.constraint
    : undefined;
}

export function serializeOrganization(row: OrganizationSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.ownerId,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgs: OrganizationsRepository,
    private readonly members: OrganizationMembersRepository,
    @Inject(KYSELY_DB) private readonly db: AppDatabase,
    private readonly teardown: OrganizationTeardownService,
  ) {}

  async createOrganization(
    ownerUserId: string,
    input: { name: string },
  ): Promise<{
    organization: Organization;
    membership: OrganizationMemberSelect;
  }> {
    // A slug clash retries with a fresh random suffix; an owner clash is final.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await this.db.transaction().execute(async (tx) => {
          const org = await this.orgs.create(
            {
              name: input.name,
              slug: buildSlug(input.name),
              ownerId: ownerUserId,
            },
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
      } catch (err) {
        const index = uniqueViolation(err);
        if (index === 'organizations_owner_id_unique') {
          throw AppError.ORG_OWNER_CONFLICT();
        }
        if (index !== 'organizations_slug_unique') {
          throw err;
        }
      }
    }
    throw AppError.ORG_SLUG_CONFLICT();
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
    let updated: OrganizationSelect | null;
    try {
      updated = await this.orgs.update(organizationId, patch);
    } catch (err) {
      if (uniqueViolation(err) === 'organizations_slug_unique') {
        throw AppError.ORG_SLUG_CONFLICT();
      }
      throw err;
    }
    if (!updated) {
      throw AppError.ORG_NOT_FOUND();
    }
    return serializeOrganization(updated);
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.teardown.run(organizationId);
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

    try {
      return await this.db.transaction().execute(async (tx) => {
        // Lock first: otherwise two concurrent transfers both read the old
        // roles under READ COMMITTED and each promotes its own target.
        if (!(await this.orgs.lockById(input.organizationId, tx))) {
          throw AppError.ORG_NOT_FOUND();
        }

        const target = await this.members.findByOrgAndUser(
          input.organizationId,
          input.newOwnerUserId,
          tx,
        );
        if (!target || target.role !== 'admin') {
          throw AppError.ORG_TRANSFER_TARGET_NOT_ADMIN();
        }

        const currentOwnerMembership = await this.members.findByOrgAndUser(
          input.organizationId,
          input.currentOwnerUserId,
          tx,
        );
        if (
          !currentOwnerMembership ||
          currentOwnerMembership.role !== 'owner'
        ) {
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

        // Demote before promote: organization_members_single_owner_unique is
        // checked per statement.
        await this.members.updateRole(currentOwnerMembership.id, 'admin', tx);
        await this.members.updateRole(target.id, 'owner', tx);

        return serializeOrganization(updatedOrg);
      });
    } catch (err) {
      if (uniqueViolation(err) === 'organizations_owner_id_unique') {
        throw AppError.ORG_TRANSFER_TARGET_OWNS_ELSEWHERE();
      }
      throw err;
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import {
  organizationInvites,
  organizations,
} from '../../databases/pg-drizzle/schema';
import { user } from '../../databases/pg-drizzle/auth-schema';
import type {
  OrganizationInviteInsert,
  OrganizationInviteSelect,
  OrganizationSelect,
  UserSelect,
} from '../../databases/pg-drizzle/types';
import type { DrizzleExecutor } from './organizations.repository';

type Db = PostgresJsDatabase<Record<string, unknown>>;

type InviteStatus = OrganizationInviteSelect['status'];

export interface InviteWithRefs {
  invite: OrganizationInviteSelect;
  organization: OrganizationSelect;
  invitedBy: Pick<UserSelect, 'id' | 'name' | 'email'> | null;
}

@Injectable()
export class OrganizationInvitesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByTokenHash(
    tokenHash: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async findPendingByOrgAndEmail(
    organizationId: string,
    email: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationInvites)
      .where(
        and(
          eq(organizationInvites.organizationId, organizationId),
          eq(organizationInvites.email, email),
          eq(organizationInvites.status, 'pending'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listByOrg(
    organizationId: string,
    opts: { status?: InviteStatus | 'all' } = {},
    tx?: DrizzleExecutor,
  ): Promise<InviteWithRefs[]> {
    const conditions = [eq(organizationInvites.organizationId, organizationId)];
    if (opts.status && opts.status !== 'all') {
      conditions.push(eq(organizationInvites.status, opts.status));
    }
    const rows = await this.exec(tx)
      .select({
        invite: organizationInvites,
        organization: organizations,
        invitedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(organizationInvites)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationInvites.organizationId),
      )
      .leftJoin(user, eq(user.id, organizationInvites.invitedByUserId))
      .where(and(...conditions))
      .orderBy(desc(organizationInvites.createdAt));
    return rows.map((r) => ({
      invite: r.invite,
      organization: r.organization,
      invitedBy: r.invitedBy?.id ? r.invitedBy : null,
    }));
  }

  async listByEmail(
    email: string,
    opts: { status?: InviteStatus | 'all'; notExpiredAfter?: Date } = {},
    tx?: DrizzleExecutor,
  ): Promise<InviteWithRefs[]> {
    const conditions = [eq(organizationInvites.email, email)];
    if (opts.status && opts.status !== 'all') {
      conditions.push(eq(organizationInvites.status, opts.status));
    }
    if (opts.notExpiredAfter) {
      conditions.push(gt(organizationInvites.expiresAt, opts.notExpiredAfter));
    }
    const rows = await this.exec(tx)
      .select({
        invite: organizationInvites,
        organization: organizations,
        invitedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(organizationInvites)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationInvites.organizationId),
      )
      .leftJoin(user, eq(user.id, organizationInvites.invitedByUserId))
      .where(and(...conditions))
      .orderBy(desc(organizationInvites.createdAt));
    return rows.map((r) => ({
      invite: r.invite,
      organization: r.organization,
      invitedBy: r.invitedBy?.id ? r.invitedBy : null,
    }));
  }

  async create(
    input: OrganizationInviteInsert,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect> {
    const [row] = await this.exec(tx)
      .insert(organizationInvites)
      .values(input)
      .returning();
    return row;
  }

  async updateStatus(
    id: string,
    status: InviteStatus,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationInvites)
      .set({ status })
      .where(eq(organizationInvites.id, id))
      .returning();
    return row ?? null;
  }

  async rotateToken(
    id: string,
    patch: { tokenHash: string; expiresAt: Date },
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationInvites)
      .set({ tokenHash: patch.tokenHash, expiresAt: patch.expiresAt })
      .where(eq(organizationInvites.id, id))
      .returning();
    return row ?? null;
  }

  async markAccepted(
    id: string,
    acceptedByUserId: string,
    acceptedAt: Date,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationInvites)
      .set({ status: 'accepted', acceptedByUserId, acceptedAt })
      .where(eq(organizationInvites.id, id))
      .returning();
    return row ?? null;
  }
}

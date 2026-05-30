import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import {
  organizationMembers,
  organizations,
} from '../../databases/pg-drizzle/schema';
import { user } from '../../databases/pg-drizzle/auth-schema';
import type {
  OrganizationMemberInsert,
  OrganizationMemberSelect,
  OrganizationSelect,
  UserSelect,
} from '../../databases/pg-drizzle/types';
import type { DrizzleExecutor } from './organizations.repository';

type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface MemberRowWithUser {
  member: OrganizationMemberSelect;
  user: Pick<UserSelect, 'id' | 'name' | 'email' | 'image'>;
}

export interface MyOrganizationRow {
  organization: OrganizationSelect;
  member: OrganizationMemberSelect;
}

@Injectable()
export class OrganizationMembersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findByOrgAndUser(
    organizationId: string,
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationMemberSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listByOrg(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<MemberRowWithUser[]> {
    const rows = await this.exec(tx)
      .select({
        member: organizationMembers,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(organizationMembers)
      .innerJoin(user, eq(organizationMembers.userId, user.id))
      .where(eq(organizationMembers.organizationId, organizationId));
    return rows;
  }

  async listByUser(
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<MyOrganizationRow[]> {
    const rows = await this.exec(tx)
      .select({
        organization: organizations,
        member: organizationMembers,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(eq(organizationMembers.userId, userId));
    return rows;
  }

  async create(
    input: OrganizationMemberInsert,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationMemberSelect> {
    const [row] = await this.exec(tx)
      .insert(organizationMembers)
      .values(input)
      .returning();
    return row;
  }

  async updateRole(
    id: string,
    role: OrganizationMemberInsert['role'],
    tx?: DrizzleExecutor,
  ): Promise<OrganizationMemberSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationMembers)
      .set({ role })
      .where(eq(organizationMembers.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx)
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, id));
  }

  async deleteByOrgAndUser(
    organizationId: string,
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );
  }
}

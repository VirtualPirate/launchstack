import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DB } from '../../../databases/pg-drizzle';
import { teamCollaborators } from '../../../databases/pg-drizzle/briefs-schema';
import type { TeamCollaboratorSelect } from '../../../databases/pg-drizzle/types';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class TeamCollaboratorsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async listByTeam(
    teamId: string,
    tx?: DrizzleExecutor,
  ): Promise<TeamCollaboratorSelect[]> {
    return this.exec(tx)
      .select()
      .from(teamCollaborators)
      .where(eq(teamCollaborators.teamId, teamId));
  }

  async listCollaboratorIdsForTeams(
    teamIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<Map<string, string[]>> {
    if (teamIds.length === 0) return new Map();
    const rows = await this.exec(tx)
      .select({
        teamId: teamCollaborators.teamId,
        collaboratorId: teamCollaborators.collaboratorId,
      })
      .from(teamCollaborators)
      .where(inArray(teamCollaborators.teamId, teamIds));
    const map = new Map<string, string[]>();
    for (const id of teamIds) map.set(id, []);
    for (const r of rows) map.get(r.teamId)?.push(r.collaboratorId);
    return map;
  }

  async replaceForTeam(
    teamId: string,
    collaboratorIds: string[],
    tx?: DrizzleExecutor,
  ): Promise<void> {
    const executor = this.exec(tx);
    await executor
      .delete(teamCollaborators)
      .where(eq(teamCollaborators.teamId, teamId));
    if (collaboratorIds.length === 0) return;
    await executor.insert(teamCollaborators).values(
      collaboratorIds.map((collaboratorId) => ({ teamId, collaboratorId })),
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Handler, type JobContext } from '../../../../queue';
import { CollaboratorSyncService } from '../services/collaborator-sync.service';
import { SyncRepoCollaboratorsJob } from '../jobs/sync-repo-collaborators.job';

@Injectable()
export class SyncRepoCollaboratorsHandler {
  private readonly logger = new Logger(SyncRepoCollaboratorsHandler.name);

  constructor(private readonly sync: CollaboratorSyncService) {}

  @Handler(SyncRepoCollaboratorsJob)
  async handle({
    id,
    data,
  }: JobContext<typeof SyncRepoCollaboratorsJob>): Promise<void> {
    this.logger.log(
      `[sync-repo-collaborators ${id}] repo=${data.repositoryId} trigger=${data.trigger}`,
    );
    await this.sync.syncRepo(data.repositoryId, data.trigger);
  }
}

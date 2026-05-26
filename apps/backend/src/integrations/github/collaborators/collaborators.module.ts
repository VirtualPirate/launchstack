import { Module } from '@nestjs/common';
import { GithubIntegrationsModule } from '../github.module';
import { GithubCollaboratorsController } from './controllers/collaborators.controller';
import { SyncRepoCollaboratorsHandler } from './handlers/sync-repo-collaborators.handler';
import { CollaboratorsRepository } from './repositories/collaborators.repository';
import { RepositoryCollaboratorsRepository } from './repositories/repository-collaborators.repository';
import { CollaboratorSyncService } from './services/collaborator-sync.service';

@Module({
  imports: [GithubIntegrationsModule],
  controllers: [GithubCollaboratorsController],
  providers: [
    CollaboratorsRepository,
    RepositoryCollaboratorsRepository,
    CollaboratorSyncService,
    SyncRepoCollaboratorsHandler,
  ],
  exports: [
    CollaboratorsRepository,
    RepositoryCollaboratorsRepository,
    CollaboratorSyncService,
  ],
})
export class GithubCollaboratorsModule {}

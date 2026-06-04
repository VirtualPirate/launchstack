import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './databases/pg-drizzle';
import { AppAuthModule } from './auth';
import { OrganizationsModule } from './organizations';
import { GithubIntegrationsModule } from './integrations/github';
import { SlackIntegrationsModule } from './integrations/slack';
import { CommitAnalysisModule } from './integrations/github/commit-analysis/commit-analysis.module';
import { GithubCollaboratorsModule } from './integrations/github/collaborators/collaborators.module';
import { BriefsModule } from './briefs';
import { PgBossModule } from './queue';
import { QueueModule } from './queue/queue.module';
import { LoggerModule, RequestIdMiddleware } from './logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    DrizzleModule,
    PgBossModule.forRoot(),
    AppAuthModule,
    OrganizationsModule,
    GithubIntegrationsModule,
    SlackIntegrationsModule,
    CommitAnalysisModule,
    GithubCollaboratorsModule,
    BriefsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

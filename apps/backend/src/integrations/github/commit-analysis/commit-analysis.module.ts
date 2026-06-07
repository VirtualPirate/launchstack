import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../../common/errors';
import { GithubIntegrationsModule } from '../github.module';
import { CommitAnalysisController } from './controllers/commit-analysis.controller';
import {
  loadCommitAnalysisConfig,
  type CommitAnalysisConfig,
} from './commit-analysis.config';
import { BackfillCommitsHandler } from './handlers/backfill-commits.handler';
import { AnalyzeRepoHandler } from './handlers/analyze-repo.handler';
import { AnalyzeCommitHandler } from './handlers/analyze-commit.handler';
import { ScanRepositoryHandler } from './handlers/scan-repository.handler';
import { CommitAnalysesRepository } from './repositories/commit-analyses.repository';
import { CommitsRepository } from './repositories/commits.repository';
import { CommitAnalyzerService } from './services/commit-analyzer.service';
import { CommitBackfillService } from './services/commit-backfill.service';
import { OpenAIClient } from './services/openai.client';
import { COMMIT_ANALYSIS_CONFIG_TOKEN } from './tokens';

@Module({
  imports: [GithubIntegrationsModule],
  controllers: [CommitAnalysisController],
  providers: [
    {
      provide: COMMIT_ANALYSIS_CONFIG_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => loadCommitAnalysisConfig(config),
    },
    {
      provide: OpenAIClient,
      inject: [COMMIT_ANALYSIS_CONFIG_TOKEN],
      useFactory: (cfg: CommitAnalysisConfig | null) => {
        if (!cfg) {
          return {
            analyze: () => Promise.reject(AppError.OPENAI_NOT_CONFIGURED()),
          };
        }
        return new OpenAIClient(cfg);
      },
    },
    {
      provide: CommitAnalyzerService,
      inject: [OpenAIClient, COMMIT_ANALYSIS_CONFIG_TOKEN],
      useFactory: (openai: OpenAIClient, cfg: CommitAnalysisConfig | null) => {
        const effective: CommitAnalysisConfig = cfg ?? {
          apiKey: '',
          model: '',
          maxDiffChars: 60_000,
          teamSize: 4,
          teamConcurrency: 2,
        };
        return new CommitAnalyzerService(openai, effective);
      },
    },
    CommitBackfillService,
    CommitsRepository,
    CommitAnalysesRepository,
    BackfillCommitsHandler,
    AnalyzeRepoHandler,
    AnalyzeCommitHandler,
    ScanRepositoryHandler,
  ],
  exports: [CommitsRepository, CommitAnalysesRepository],
})
export class CommitAnalysisModule {}

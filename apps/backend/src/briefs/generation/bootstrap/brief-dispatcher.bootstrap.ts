import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBossService } from '../../../queue';
import { DispatchDueBriefsJob } from '../jobs/dispatch-due-briefs.job';

@Injectable()
export class BriefDispatcherBootstrap implements OnModuleInit {
  private readonly logger = new Logger(BriefDispatcherBootstrap.name);

  constructor(
    private readonly pgBoss: PgBossService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const role = this.config.get<string>('WORKER_ROLE') ?? 'both';
    if (role !== 'worker' && role !== 'both') {
      this.logger.log(`WORKER_ROLE=${role} — not enqueuing dispatcher`);
      return;
    }
    try {
      const id = await this.pgBoss.sendOnce(
        DispatchDueBriefsJob,
        {},
        'briefs.dispatch-due-bootstrap',
      );
      this.logger.log(
        `Dispatcher tick enqueued (sendOnce id=${id ?? 'duplicate'})`,
      );
    } catch (err) {
      this.logger.error(
        'Failed to enqueue dispatcher tick on boot',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBossService } from '../../../queue';
import { BRIEFS_CONFIG_TOKEN } from '../../tokens';
import type { BriefsConfig } from '../../briefs-config';
import { DispatchDueBriefsJob } from '../jobs/dispatch-due-briefs.job';

@Injectable()
export class BriefDispatcherBootstrap implements OnModuleInit {
  private readonly logger = new Logger(BriefDispatcherBootstrap.name);

  constructor(
    private readonly pgBoss: PgBossService,
    private readonly config: ConfigService,
    @Inject(BRIEFS_CONFIG_TOKEN)
    private readonly briefsConfig: BriefsConfig | null,
  ) {}

  async onModuleInit(): Promise<void> {
    const role = this.config.get<string>('WORKER_ROLE') ?? 'both';
    if (role !== 'worker' && role !== 'both') {
      this.logger.log(`WORKER_ROLE=${role} — not enqueuing dispatcher`);
      return;
    }
    const intervalSeconds = this.briefsConfig?.dispatcherIntervalSeconds ?? 60;
    try {
      // Throttle the boot tick to one per interval slot so repeated restarts
      // (e.g. dev watch reloads) can't each spawn a fresh dispatcher chain.
      const id = await this.pgBoss.sendOnce(
        DispatchDueBriefsJob,
        {},
        'briefs.dispatch-due-bootstrap',
        { singletonSeconds: intervalSeconds },
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

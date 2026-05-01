/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import type { JobContext } from './define-job';
import { Handler } from './handler.decorator';
import { NoopJob } from './jobs/noop.job';

@Injectable()
export class NoopHandler {
  private readonly logger = new Logger(NoopHandler.name);

  @Handler(NoopJob)
  async handle({ id, data }: JobContext<typeof NoopJob>): Promise<void> {
    this.logger.log(`[noop ${id}] received: ${data.message}`);
  }
}

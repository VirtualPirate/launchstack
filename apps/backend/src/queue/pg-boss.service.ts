import { Inject, Injectable } from '@nestjs/common';
import { PgBoss, type JobWithMetadata, type SendOptions } from 'pg-boss';
import type { z } from 'zod';
import type { JobDefinition } from './define-job';
import { PG_BOSS_INSTANCE } from './pg-boss.tokens';

@Injectable()
export class PgBossService {
  constructor(@Inject(PG_BOSS_INSTANCE) private readonly boss: PgBoss) {}

  async send<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    opts: SendOptions = {},
  ): Promise<string> {
    const parsed = job.schema.parse(data) as z.infer<T>;
    const merged = { ...this.retryOptionsFromJob(job), ...opts };
    const id = await this.boss.send(job.name, parsed as object, merged);
    return id as string;
  }

  async sendAfter<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    delaySeconds: number,
    opts: SendOptions = {},
  ): Promise<string> {
    return this.send(job, data, { ...opts, startAfter: delaySeconds });
  }

  async sendOnce<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    singletonKey: string,
    opts: SendOptions = {},
  ): Promise<string | null> {
    const parsed = job.schema.parse(data) as z.infer<T>;
    const merged = {
      ...this.retryOptionsFromJob(job),
      ...opts,
      singletonKey,
    };
    return this.boss.send(job.name, parsed as object, merged);
  }

  getJob(name: string, id: string): Promise<JobWithMetadata | null> {
    return this.boss.getJobById(name, id);
  }

  raw(): PgBoss {
    return this.boss;
  }

  private retryOptionsFromJob<T extends z.ZodTypeAny>(
    job: JobDefinition<T>,
  ): SendOptions {
    const out: SendOptions = {};
    if (job.retryLimit !== undefined) out.retryLimit = job.retryLimit;
    if (job.retryDelay !== undefined) out.retryDelay = job.retryDelay;
    if (job.retryBackoff !== undefined) out.retryBackoff = job.retryBackoff;
    if (job.expireInSeconds !== undefined) {
      out.expireInSeconds = job.expireInSeconds;
    }
    return out;
  }
}

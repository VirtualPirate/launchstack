import {
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  type DynamicModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from '@nestjs/core';
import { PgBoss, type Job } from 'pg-boss';
import { buildBossOptions } from './pg-boss.config';
import type { JobDefinition } from './define-job';
import { PgBossService } from './pg-boss.service';
import { HANDLER_METADATA_KEY, PG_BOSS_INSTANCE } from './pg-boss.tokens';

type WorkerRole = 'api' | 'worker' | 'both';

@Injectable()
class PgBossLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('PgBoss');

  constructor(
    @Inject(PG_BOSS_INSTANCE) private readonly boss: PgBoss,
    private readonly config: ConfigService,
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  async onModuleInit(): Promise<void> {
    this.boss.on('error', (err: Error) =>
      this.logger.error('pg-boss error', err.stack ?? err.message),
    );
    await this.boss.start();
    this.logger.log('pg-boss started');

    const role = (this.config.get<string>('WORKER_ROLE') ??
      'both') as WorkerRole;
    if (role === 'api') {
      this.logger.log('WORKER_ROLE=api — skipping handler registration');
      return;
    }

    const providers = this.discovery.getProviders();
    let registered = 0;
    for (const wrapper of providers) {
      const instance = wrapper.instance as Record<string, unknown> | null;
      if (!instance || typeof instance !== 'object') continue;
      const proto = Object.getPrototypeOf(instance) as object;
      if (!proto) continue;

      for (const methodName of this.metadataScanner.getAllMethodNames(proto)) {
        const method = instance[methodName] as
          | ((...args: unknown[]) => unknown)
          | undefined;
        if (typeof method !== 'function') continue;

        const jobDef = this.reflector.get<JobDefinition<any> | undefined>(
          HANDLER_METADATA_KEY,
          method,
        );
        if (!jobDef) continue;

        await this.registerHandler(jobDef, instance, method);
        registered += 1;
      }
    }

    this.logger.log(
      `WORKER_ROLE=${role} — registered ${registered} job handler(s)`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true });
    this.logger.log('pg-boss stopped');
  }

  private async registerHandler(
    jobDef: JobDefinition<any>,
    instance: Record<string, unknown>,
    method: (...args: unknown[]) => unknown,
  ): Promise<void> {
    await this.boss.createQueue(jobDef.name);
    await this.boss.work(
      jobDef.name,
      jobDef.workOptions ?? {},
      async (jobs: Array<Job<unknown>>) => {
        for (const job of jobs) {
          const parsed = jobDef.schema.safeParse(job.data);
          if (!parsed.success) {
            this.logger.error(
              `[${jobDef.name}] invalid payload — skipping job ${job.id}`,
              JSON.stringify({
                jobId: job.id,
                issues: parsed.error.issues,
              }),
            );
            continue;
          }

          const ctx = {
            id: job.id,
            data: parsed.data,
            attempts:
              ((job as unknown as { retryCount?: number }).retryCount ?? 0) + 1,
            raw: job,
          };
          await (method as (c: unknown) => Promise<void>).call(instance, ctx);
        }
      },
    );
  }
}

@Module({})
export class PgBossModule {
  static forRoot(): DynamicModule {
    return {
      module: PgBossModule,
      global: true,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: PG_BOSS_INSTANCE,
          inject: [ConfigService],
          useFactory: (config: ConfigService): PgBoss => {
            const opts = buildBossOptions(config);
            return new PgBoss(opts);
          },
        },
        PgBossService,
        PgBossLifecycle,
      ],
      exports: [PgBossService],
    };
  }
}

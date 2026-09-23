import {
  Inject,
  Injectable,
  Logger,
  type LoggerService,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  isGrpcServiceError,
  ScheduleAlreadyRunning,
  ScheduleOverlapPolicy,
  type ScheduleSpec,
} from '@temporalio/client';
import { TEMPORAL_CLIENT, TEMPORAL_CONFIG } from './temporal.tokens';
import type { TemporalConfig } from './temporal.config';
import type { WorkflowType } from './workflow-types';
import { SA_ORG } from './search-attributes';

// Numeric proto/gRPC values: @temporalio/proto and @grpc/grpc-js are only
// transitive dependencies, so their enums aren't importable from here.
const INDEXED_VALUE_TYPE_KEYWORD = 2;
const GRPC_ALREADY_EXISTS = 6;

export interface ScheduleDefinition {
  id: string;
  workflowType: WorkflowType;
  /** e.g. `{ intervals: [{ every: '60s' }] }` or `{ cronExpressions: ['55 23 * * *'], timezone: 'Etc/UTC' }`. */
  spec: ScheduleSpec;
}

/**
 * Temporal Schedules the API creates on boot. Add an entry per recurring
 * workflow; an edited `spec` reaches a running cluster on the next API boot.
 * Removing an entry does not delete the Schedule: do that with
 * `temporal schedule delete`.
 */
export const SCHEDULES: ScheduleDefinition[] = [];

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Creates each Schedule, or replaces the spec of one that already exists
 * (`create` alone would leave an edited spec unapplied forever). `SKIP`
 * overlap: a run that outlasts its interval is not stacked. Never throws, so a
 * misbehaving cluster can't crash API boot.
 */
export async function syncSchedules(
  client: Client,
  taskQueue: string,
  schedules: readonly ScheduleDefinition[],
  logger: LoggerService,
): Promise<void> {
  for (const def of schedules) {
    try {
      await client.schedule.create({
        scheduleId: def.id,
        spec: def.spec,
        action: {
          type: 'startWorkflow',
          workflowType: def.workflowType,
          taskQueue,
        },
        policies: { overlap: ScheduleOverlapPolicy.SKIP },
      });
      logger.log(`Schedule '${def.id}' created`);
    } catch (err) {
      if (!(err instanceof ScheduleAlreadyRunning)) {
        logger.error(`Failed to create schedule '${def.id}': ${describe(err)}`);
        continue;
      }
      try {
        // Replaced wholesale: a described cron spec comes back normalised
        // into calendars, so patching it in place would keep the old times.
        await client.schedule
          .getHandle(def.id)
          .update((previous) => ({ ...previous, spec: def.spec }));
        logger.log(`Schedule '${def.id}' spec synced`);
      } catch (updateErr) {
        logger.error(
          `Failed to update schedule '${def.id}': ${describe(updateErr)}`,
        );
      }
    }
  }
}

/**
 * Runs in every process that boots AppModule. `TEMPORAL_MANAGE_SCHEDULES`
 * (default `true`) gates it; `worker.ts` forces it off so only the API does
 * this work.
 */
@Injectable()
export class SchedulesBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SchedulesBootstrap.name);

  constructor(
    @Inject(TEMPORAL_CLIENT) private readonly client: Client,
    @Inject(TEMPORAL_CONFIG) private readonly cfg: TemporalConfig,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('TEMPORAL_MANAGE_SCHEDULES') === 'false') {
      return;
    }
    // First: a Schedule's workflow may start org-scoped children.
    await this.registerSearchAttributes();
    await syncSchedules(
      this.client,
      this.cfg.taskQueue,
      SCHEDULES,
      this.logger,
    );
  }

  private async registerSearchAttributes(): Promise<void> {
    try {
      await this.client.connection.operatorService.addSearchAttributes({
        namespace: this.cfg.namespace,
        searchAttributes: { [SA_ORG]: INDEXED_VALUE_TYPE_KEYWORD },
      });
      this.logger.log(`Search attribute '${SA_ORG}' registered`);
    } catch (err) {
      if (isGrpcServiceError(err) && Number(err.code) === GRPC_ALREADY_EXISTS) {
        return;
      }
      this.logger.error(
        `Failed to register search attribute '${SA_ORG}': ${describe(err)}`,
      );
    }
  }
}

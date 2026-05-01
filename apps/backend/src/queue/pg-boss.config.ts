import { ConfigService } from '@nestjs/config';
import type { ConstructorOptions } from 'pg-boss';

export type BossConstructorOptions = ConstructorOptions;

export function buildBossOptions(
  config: ConfigService,
): BossConstructorOptions {
  const connectionString = config.getOrThrow<string>('DATABASE_URL');
  const schema = config.get<string>('PG_BOSS_SCHEMA') ?? 'pgboss';
  const application_name =
    config.get<string>('PG_BOSS_APPLICATION_NAME') ?? 'launchstack-boss';

  const rawMax = config.get<string>('PG_BOSS_POOL_MAX');
  const max = rawMax === undefined ? 10 : Number(rawMax);
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(
      `PG_BOSS_POOL_MAX must be a positive integer; got "${rawMax}"`,
    );
  }

  return {
    connectionString,
    schema,
    max,
    application_name,
    persistWarnings: true,
  };
}

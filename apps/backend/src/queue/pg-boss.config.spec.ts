import { ConfigService } from '@nestjs/config';
import { buildBossOptions } from './pg-boss.config';

const cs = (env: Record<string, string | undefined>): ConfigService =>
  new ConfigService(env);

describe('buildBossOptions', () => {
  it('reads connection string and applies defaults', () => {
    const opts = buildBossOptions(
      cs({ DATABASE_URL: 'postgres://u:p@h:5432/db' }),
    );
    expect(opts.connectionString).toBe('postgres://u:p@h:5432/db');
    expect(opts.schema).toBe('pgboss');
    expect(opts.max).toBe(10);
    expect(opts.application_name).toBe('launchstack-boss');
    expect(opts.persistWarnings).toBe(true);
  });

  it('overrides defaults from env', () => {
    const opts = buildBossOptions(
      cs({
        DATABASE_URL: 'postgres://x',
        PG_BOSS_SCHEMA: 'jobs',
        PG_BOSS_POOL_MAX: '25',
        PG_BOSS_APPLICATION_NAME: 'custom-app',
      }),
    );
    expect(opts.schema).toBe('jobs');
    expect(opts.max).toBe(25);
    expect(opts.application_name).toBe('custom-app');
    expect(opts.persistWarnings).toBe(true);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => buildBossOptions(cs({}))).toThrow(/DATABASE_URL/);
  });

  it('throws when PG_BOSS_POOL_MAX is not a positive integer', () => {
    expect(() =>
      buildBossOptions(
        cs({ DATABASE_URL: 'postgres://x', PG_BOSS_POOL_MAX: 'banana' }),
      ),
    ).toThrow(/PG_BOSS_POOL_MAX/);
  });
});

import 'dotenv/config';
import { defineConfig, getKnexTimestampPrefix } from 'kysely-ctl';
import { Pool } from 'pg';

export default defineConfig({
  dialect: 'pg',
  dialectConfig: {
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    }),
  },
  migrations: {
    migrationFolder: 'migrations',
    // YYYYMMDDHHmmss_ — sorts lexically, which is how Kysely orders migrations.
    getMigrationPrefix: getKnexTimestampPrefix,
  },
});

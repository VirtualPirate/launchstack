import 'dotenv/config';
import { defineConfig } from '@drepkovsky/drizzle-migrations';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export default defineConfig({
  out: './drizzle',
  schema: './src/databases/pg-drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  getMigrator: async () => {
    const client = postgres(process.env.DATABASE_URL!, { max: 1 });
    return drizzle(client);
  },
});

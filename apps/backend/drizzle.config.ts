/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from '@drepkovsky/drizzle-migrations';
import type { Config as DrizzleKitConfig } from 'drizzle-kit';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const config: DrizzleKitConfig = defineConfig({
  out: './drizzle',
  schema: [
    './src/databases/pg-drizzle/schema.ts',
    './src/databases/pg-drizzle/auth-schema.ts',
    './src/databases/pg-drizzle/github-schema.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  getMigrator: () => {
    const client = postgres(process.env.DATABASE_URL!, { max: 1 });
    return Promise.resolve(drizzle(client) as any);
  },
});

export default config;

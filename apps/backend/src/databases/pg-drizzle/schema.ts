import { pgTable, serial } from 'drizzle-orm/pg-core';

export const demo = pgTable('demo', {
  id: serial('id').primaryKey(),
});

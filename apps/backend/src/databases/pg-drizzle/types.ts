import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { demo } from './schema';

export type DemoSelect = InferSelectModel<typeof demo>;
export type DemoInsert = InferInsertModel<typeof demo>;

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { demo } from './schema';
import type { user, session, account, verification } from './auth-schema';

export type DemoSelect = InferSelectModel<typeof demo>;
export type DemoInsert = InferInsertModel<typeof demo>;

export type UserSelect = InferSelectModel<typeof user>;
export type UserInsert = InferInsertModel<typeof user>;

export type SessionSelect = InferSelectModel<typeof session>;
export type SessionInsert = InferInsertModel<typeof session>;

export type AccountSelect = InferSelectModel<typeof account>;
export type AccountInsert = InferInsertModel<typeof account>;

export type VerificationSelect = InferSelectModel<typeof verification>;
export type VerificationInsert = InferInsertModel<typeof verification>;

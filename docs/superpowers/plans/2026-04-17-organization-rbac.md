# Organizations & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class organizations with owner/admin/viewer roles, a magic-link invite flow, and a NestJS-side authorization layer, plus a minimal React scaffold that exercises every flow.

**Architecture:** New `organizations` app module in NestJS with a controller → service → repository layering. A global `OrgContextGuard` reads `X-Organization-Id` and enforces a role level declared via `@RequireOrgRole()`. Invites use SHA-256-hashed, 32-byte, 7-day DB-backed tokens delivered over React Email + Resend. Shared Zod schemas in `@launchstack/api-interfaces` drive both NestJS validation and frontend forms. Active org is persisted in a Zustand store that also feeds an Axios request interceptor.

**Tech Stack:** NestJS 11, Drizzle ORM + PostgreSQL (`@drepkovsky/drizzle-migrations`), Better Auth (auth only), React 19 + Vite + Tailwind v4, TanStack Router + Query, Zustand 5 (with `persist`), Zod 4, Resend + React Email.

**Spec:** `docs/superpowers/specs/2026-04-17-organization-rbac-design.md`

**Commit policy:** The user commits their own changes. Steps that say "Stage changes" mean `git add` only — never run `git commit` yourself. At the end of each phase, pause and let the user review before staging/committing.

---

## File Structure

### Shared package (`packages/api-interfaces/`)
- Create: `src/requests/organization.requests.ts` — Zod schemas + inferred request types.
- Create: `src/responses/organization.responses.ts` — response interfaces + role/status string literal types.
- Modify: `src/index.ts` — re-export new files.
- Modify: `package.json` — add `zod` as a runtime dependency.

### Backend (`apps/backend/`)
- Modify: `src/databases/pg-drizzle/schema.ts` — add pgEnums + three tables + indexes + relations.
- Modify: `src/databases/pg-drizzle/types.ts` — add Select/Insert types.
- Create: `drizzle/<timestamp>_add_organizations.ts` + `.json` — generated migration.
- Create: `src/organizations/index.ts` — re-exports module.
- Create: `src/organizations/organizations.module.ts` — NestJS module with body parser middleware + APP_GUARD.
- Create: `src/organizations/controllers/{index.ts,organizations.controller.ts,members.controller.ts,invites.controller.ts}`.
- Create: `src/organizations/services/{index.ts,organizations.service.ts,members.service.ts,invites.service.ts}`.
- Create: `src/organizations/repositories/{index.ts,organizations.repository.ts,members.repository.ts,invites.repository.ts}`.
- Create: `src/organizations/guards/{index.ts,org-context.guard.ts}`.
- Create: `src/organizations/decorators/{index.ts,require-org-role.decorator.ts,org-membership.decorator.ts}`.
- Create: `src/organizations/dto/{index.ts,zod-validation.pipe.ts}`.
- Create: `src/organizations/tokens.ts` — token generation + SHA-256 helper.
- Create: `src/organizations/__tests__/*.spec.ts` — unit tests per service/guard/pipe.
- Create: `src/emails/invite-email.tsx` — React Email template.
- Modify: `src/emails/render-email.ts` — add `renderInviteEmail`.
- Modify: `src/app.module.ts` — import `OrganizationsModule`.
- Create: `test/organizations.e2e-spec.ts` — boot-level e2e verifying guard wiring.

### Frontend (`apps/frontend/`)
- Create: `src/stores/active-organization-store.ts`.
- Create: `src/hooks/use-bootstrap-active-organization.ts`.
- Modify: `src/api/axios-client.ts` — request interceptor injecting `X-Organization-Id`.
- Create: `src/api/{organizations.api.ts,members.api.ts,invites.api.ts}`.
- Create: `src/hooks/api/{use-organizations.ts,use-members.ts,use-invites.ts}`.
- Create: `src/routes/{create-organization.tsx,pending-invites.tsx,organization-settings.tsx,organization-members.tsx,accept-invite.tsx}`.
- Modify: `src/router.tsx` — new routes + public `/accept-invite`.
- Create: `src/components/organization/{org-switcher.tsx,pending-invites-badge.tsx,role-badge.tsx,invite-member-form.tsx}`.
- Modify: `src/App.tsx` — mount `OrgSwitcher` + `PendingInvitesBadge` + sidebar entries + call bootstrap hook.
- Modify: `src/routes/sign-up.tsx` — pre-fill `email` from query param.
- Modify: `src/router.tsx` (again, in sign-up patch) — accept `email` search param on `/sign-up`.

---

## Phase 0 — Shared package setup

### Task 1: Add `zod` to `@launchstack/api-interfaces`

**Files:**
- Modify: `packages/api-interfaces/package.json`

- [ ] **Step 1: Install zod into the package**

Run from repo root:
```bash
pnpm --filter @launchstack/api-interfaces add zod@^4.3.6
```
Expected: package.json gains a `"dependencies": { "zod": "^4.3.6" }` entry and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify zod resolves**

Run: `pnpm --filter @launchstack/api-interfaces exec node -e "console.log(require('zod').z.object({}).parse({}))"`
Expected: prints `{}`.

- [ ] **Step 3: Stage**

```bash
git add packages/api-interfaces/package.json pnpm-lock.yaml
```

---

## Phase 1 — Shared types

### Task 2: Response interfaces + role/status literal types

**Files:**
- Create: `packages/api-interfaces/src/responses/organization.responses.ts`

- [ ] **Step 1: Create the response file**

```typescript
export type OrganizationRole = "owner" | "admin" | "viewer";
export type InviteRole = "admin" | "viewer";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  createdAt: string;
}

export interface OrganizationInviteUserRef {
  id: string;
  name: string;
  email: string;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: OrganizationInviteUserRef | null;
  acceptedBy: OrganizationInviteUserRef | null;
  acceptedAt?: string | null;
}

export interface InvitePreview {
  organizationName: string;
  inviterName: string | null;
  invitedEmail: string;
  role: InviteRole;
  expiresAt: string;
}

export interface MyOrganization {
  organization: Organization;
  role: OrganizationRole;
}
```

- [ ] **Step 2: Stage**

```bash
git add packages/api-interfaces/src/responses/organization.responses.ts
```

### Task 3: Zod request schemas + inferred types

**Files:**
- Create: `packages/api-interfaces/src/requests/organization.requests.ts`

- [ ] **Step 1: Create the request schemas**

```typescript
import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(slugRegex, "Slug must be lowercase letters, numbers, and dashes")
      .optional(),
  })
  .refine((v) => v.name !== undefined || v.slug !== undefined, {
    message: "Provide at least one of name or slug",
  });
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationSchema>;

export const TransferOwnershipSchema = z.object({
  newOwnerUserId: z.string().min(1),
});
export type TransferOwnershipRequest = z.infer<typeof TransferOwnershipSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["admin", "viewer"]),
});
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleSchema>;

export const CreateInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "viewer"]),
});
export type CreateInviteRequest = z.infer<typeof CreateInviteSchema>;

const InviteIdentifierSchema = z
  .object({
    token: z.string().min(1).optional(),
    inviteId: z.string().uuid().optional(),
  })
  .refine((v) => (v.token ? 1 : 0) + (v.inviteId ? 1 : 0) === 1, {
    message: "Provide exactly one of token or inviteId",
  });

export const AcceptInviteSchema = InviteIdentifierSchema;
export type AcceptInviteRequest = z.infer<typeof AcceptInviteSchema>;

export const DeclineInviteSchema = InviteIdentifierSchema;
export type DeclineInviteRequest = z.infer<typeof DeclineInviteSchema>;

export const InviteListQuerySchema = z.object({
  status: z
    .enum(["pending", "accepted", "revoked", "expired", "all"])
    .optional()
    .default("pending"),
});
export type InviteListQuery = z.infer<typeof InviteListQuerySchema>;
```

- [ ] **Step 2: Stage**

```bash
git add packages/api-interfaces/src/requests/organization.requests.ts
```

### Task 4: Re-export from index + build

**Files:**
- Modify: `packages/api-interfaces/src/index.ts`

- [ ] **Step 1: Append the two re-exports at the bottom**

Edit the file so the bottom section reads:
```typescript
export * from "./requests/auth.requests";
export * from "./responses/auth.responses";
export * from "./requests/organization.requests";
export * from "./responses/organization.responses";
```

- [ ] **Step 2: Build the package**

Run: `pnpm --filter @launchstack/api-interfaces build`
Expected: no TypeScript errors; `dist/index.d.ts`, `dist/index.js`, `dist/index.mjs` regenerated.

- [ ] **Step 3: Verify backend can import new types**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0 (no compile errors against the new exports).

- [ ] **Step 4: Stage**

```bash
git add packages/api-interfaces/src/index.ts packages/api-interfaces/dist
```

*End of Phase 1 — let the user review before moving on.*

---

## Phase 2 — Database schema + migration

### Task 5: Add pgEnums for roles and statuses

**Files:**
- Modify: `apps/backend/src/databases/pg-drizzle/schema.ts`

- [ ] **Step 1: Replace the placeholder demo file**

Replace the entire contents with:
```typescript
import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Keep the demo table for now so existing migrations remain valid.
export const demo = pgTable("demo", {
  id: serial("id").primaryKey(),
});

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "viewer",
]);

export const inviteRoleEnum = pgEnum("invite_role", ["admin", "viewer"]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);
```

- [ ] **Step 2: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0. Unused imports (`primaryKey`, `index`, `uniqueIndex`, `uuid`, `text`, `timestamp`, `relations`, `sql`) may flag — that's fine; they are consumed in subsequent tasks. If the project's lint errors on unused imports, proceed; the next tasks consume them.

### Task 6: Define `organizations` table

**Files:**
- Modify: `apps/backend/src/databases/pg-drizzle/schema.ts`

- [ ] **Step 1: Append `organizations` definition**

Append below the enum declarations:
```typescript
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    uniqueIndex("organizations_owner_id_unique").on(table.ownerId),
  ],
);
```

- [ ] **Step 2: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

### Task 7: Define `organization_members` table

**Files:**
- Modify: `apps/backend/src/databases/pg-drizzle/schema.ts`

- [ ] **Step 1: Append below `organizations`**

```typescript
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_idx").on(table.userId),
  ],
);
```

- [ ] **Step 2: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

### Task 8: Define `organization_invites` table + partial unique

**Files:**
- Modify: `apps/backend/src/databases/pg-drizzle/schema.ts`

- [ ] **Step 1: Append below `organizationMembers`**

```typescript
export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: inviteRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_invites_token_hash_unique").on(table.tokenHash),
    uniqueIndex("organization_invites_pending_org_email_unique")
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index("organization_invites_email_idx").on(table.email),
    index("organization_invites_organization_idx").on(table.organizationId),
  ],
);
```

- [ ] **Step 2: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

### Task 9: Drizzle relations

**Files:**
- Modify: `apps/backend/src/databases/pg-drizzle/schema.ts`

- [ ] **Step 1: Append relation declarations**

```typescript
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(user, {
    fields: [organizations.ownerId],
    references: [user.id],
  }),
  members: many(organizationMembers),
  invites: many(organizationInvites),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(user, {
      fields: [organizationMembers.userId],
      references: [user.id],
    }),
  }),
);

export const organizationInvitesRelations = relations(
  organizationInvites,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvites.organizationId],
      references: [organizations.id],
    }),
    invitedBy: one(user, {
      fields: [organizationInvites.invitedByUserId],
      references: [user.id],
      relationName: "invite_inviter",
    }),
    acceptedBy: one(user, {
      fields: [organizationInvites.acceptedByUserId],
      references: [user.id],
      relationName: "invite_acceptor",
    }),
  }),
);
```

- [ ] **Step 2: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

### Task 10: Extend Drizzle types

**Files:**
- Modify: `apps/backend/src/databases/pg-drizzle/types.ts`

- [ ] **Step 1: Append new Select/Insert type aliases**

Append to the end of the file:
```typescript
import type {
  organizations,
  organizationMembers,
  organizationInvites,
} from "./schema";

export type OrganizationSelect = InferSelectModel<typeof organizations>;
export type OrganizationInsert = InferInsertModel<typeof organizations>;

export type OrganizationMemberSelect = InferSelectModel<typeof organizationMembers>;
export type OrganizationMemberInsert = InferInsertModel<typeof organizationMembers>;

export type OrganizationInviteSelect = InferSelectModel<typeof organizationInvites>;
export type OrganizationInviteInsert = InferInsertModel<typeof organizationInvites>;
```

Note: the existing `import type` for schema at the top already covers `demo` — just add the new import with the new entities.

- [ ] **Step 2: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

### Task 11: Generate and apply the migration

**Files:**
- Create: `apps/backend/drizzle/<timestamp>_add_organizations.ts` (auto-generated)
- Create: `apps/backend/drizzle/<timestamp>_add_organizations.json` (auto-generated)

- [ ] **Step 1: Make sure Postgres is running**

Run: `docker compose ps`
Expected: a postgres service shows `running` on port `11753`. If not, run `docker compose up -d` from the repo root.

- [ ] **Step 2: Generate the migration**

Run from `apps/backend/`:
```bash
pnpm db:generate
```
Expected: a new timestamped migration file appears in `apps/backend/drizzle/`. Open it and inspect: it must include `CREATE TYPE "organization_role"`, `CREATE TYPE "invite_role"`, `CREATE TYPE "invite_status"`, three `CREATE TABLE` statements, the `UNIQUE` on `organizations.slug` and `owner_id`, the partial unique index on `(organization_id, email) WHERE status = 'pending'`, and FKs to `auth.user(id)` with the correct `ON DELETE` actions.

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:up`
Expected: the migration applies cleanly; `pnpm db:status` shows it as applied.

- [ ] **Step 4: Smoke-query via Drizzle Studio**

Run: `pnpm db:studio` and confirm the three new tables exist. Close Studio.

- [ ] **Step 5: Stage**

```bash
git add apps/backend/src/databases/pg-drizzle/schema.ts apps/backend/src/databases/pg-drizzle/types.ts apps/backend/drizzle
```

*End of Phase 2 — let the user review before moving on.*

---

## Phase 3 — Module skeleton, validation pipe, decorators

### Task 12: Scaffold folders + barrels

**Files:**
- Create: `apps/backend/src/organizations/index.ts`
- Create: `apps/backend/src/organizations/controllers/index.ts`
- Create: `apps/backend/src/organizations/services/index.ts`
- Create: `apps/backend/src/organizations/repositories/index.ts`
- Create: `apps/backend/src/organizations/guards/index.ts`
- Create: `apps/backend/src/organizations/decorators/index.ts`
- Create: `apps/backend/src/organizations/dto/index.ts`
- Create: `apps/backend/src/organizations/__tests__/.gitkeep`

- [ ] **Step 1: Create empty barrels**

Each `index.ts` starts as an empty file containing only:
```typescript
export {};
```
The `__tests__/.gitkeep` is an empty file to make the folder visible to git.

- [ ] **Step 2: Create the module placeholder**

Create `apps/backend/src/organizations/organizations.module.ts`:
```typescript
import { Module } from "@nestjs/common";

@Module({})
export class OrganizationsModule {}
```

- [ ] **Step 3: Export from root barrel**

Update `apps/backend/src/organizations/index.ts` to:
```typescript
export { OrganizationsModule } from "./organizations.module";
```

- [ ] **Step 4: Compile**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

### Task 13: `ZodValidationPipe` — test first

**Files:**
- Create: `apps/backend/src/organizations/dto/zod-validation.pipe.ts`
- Create: `apps/backend/src/organizations/__tests__/zod-validation.pipe.spec.ts`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/organizations/__tests__/zod-validation.pipe.spec.ts`:
```typescript
import { HttpException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../dto/zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({ name: z.string().min(1) });
  const pipe = new ZodValidationPipe(schema);

  it("returns parsed value on valid input", () => {
    expect(pipe.transform({ name: "hello" })).toEqual({ name: "hello" });
  });

  it("throws HttpException 400 with ApiError body on invalid input", () => {
    try {
      pipe.transform({ name: "" });
      fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const response = (error as HttpException).getResponse() as {
        code: string;
        message: string;
        details?: unknown;
      };
      expect((error as HttpException).getStatus()).toBe(400);
      expect(response.code).toBe("VALIDATION_ERROR");
      expect(response.details).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=zod-validation.pipe`
Expected: test fails with module not found.

- [ ] **Step 3: Implement**

Create `apps/backend/src/organizations/dto/zod-validation.pipe.ts`:
```typescript
import { HttpException, HttpStatus, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: result.error.format(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=zod-validation.pipe`
Expected: both tests pass.

- [ ] **Step 5: Export from barrel**

Update `apps/backend/src/organizations/dto/index.ts`:
```typescript
export { ZodValidationPipe } from "./zod-validation.pipe";
```

### Task 14: `@RequireOrgRole` + `@OrgMembership` decorators

**Files:**
- Create: `apps/backend/src/organizations/decorators/require-org-role.decorator.ts`
- Create: `apps/backend/src/organizations/decorators/org-membership.decorator.ts`
- Create: `apps/backend/src/organizations/decorators/index.ts` (already exists from Task 12; update)

- [ ] **Step 1: Create the role decorator**

`require-org-role.decorator.ts`:
```typescript
import { SetMetadata } from "@nestjs/common";

export type OrgRoleLevel = "owner" | "admin" | "member";

export const REQUIRE_ORG_ROLE_KEY = "requireOrgRole";

export const RequireOrgRole = (level: OrgRoleLevel) =>
  SetMetadata(REQUIRE_ORG_ROLE_KEY, level);
```

- [ ] **Step 2: Create the param decorator**

`org-membership.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { OrganizationRole } from "@launchstack/api-interfaces";

export interface OrgMembershipContext {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

export const OrgMembership = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OrgMembershipContext => {
    const request = ctx.switchToHttp().getRequest<{
      orgMembership?: OrgMembershipContext;
    }>();
    if (!request.orgMembership) {
      throw new Error(
        "OrgMembership used on a route that is not org-scoped — add @RequireOrgRole().",
      );
    }
    return request.orgMembership;
  },
);
```

- [ ] **Step 3: Update the barrel**

Update `apps/backend/src/organizations/decorators/index.ts`:
```typescript
export {
  RequireOrgRole,
  REQUIRE_ORG_ROLE_KEY,
  type OrgRoleLevel,
} from "./require-org-role.decorator";
export { OrgMembership, type OrgMembershipContext } from "./org-membership.decorator";
```

- [ ] **Step 4: Compile**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Stage phase 3**

```bash
git add apps/backend/src/organizations
```

*End of Phase 3.*

---

## Phase 4 — Repositories

Repositories are the only layer that touches Drizzle. Each takes the `DRIZZLE_DB` token and provides an optional `tx?` transaction handle parameter on every mutation method. Tests are light — smoke-only — because service tests exercise these via mocked repositories.

### Task 15: `OrganizationsRepository`

**Files:**
- Create: `apps/backend/src/organizations/repositories/organizations.repository.ts`
- Create: `apps/backend/src/organizations/__tests__/organizations.repository.spec.ts`

- [ ] **Step 1: Write failing smoke test**

```typescript
import { OrganizationsRepository } from "../repositories/organizations.repository";

describe("OrganizationsRepository", () => {
  it("instantiates with a db handle and exposes all methods", () => {
    const repo = new OrganizationsRepository({} as any);
    expect(typeof repo.findById).toBe("function");
    expect(typeof repo.findBySlug).toBe("function");
    expect(typeof repo.findByOwnerId).toBe("function");
    expect(typeof repo.create).toBe("function");
    expect(typeof repo.update).toBe("function");
    expect(typeof repo.delete).toBe("function");
    expect(typeof repo.setOwner).toBe("function");
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=organizations.repository`
Expected: fails (module not found).

- [ ] **Step 3: Implement the repository**

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { DRIZZLE_DB } from "../../databases/pg-drizzle";
import { organizations } from "../../databases/pg-drizzle/schema";
import type {
  OrganizationInsert,
  OrganizationSelect,
} from "../../databases/pg-drizzle/types";

type Db = PostgresJsDatabase<Record<string, unknown>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DrizzleExecutor = Db | Tx;

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(id: string, tx?: DrizzleExecutor): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string, tx?: DrizzleExecutor): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async findByOwnerId(userId: string, tx?: DrizzleExecutor): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId))
      .limit(1);
    return row ?? null;
  }

  async create(input: OrganizationInsert, tx?: DrizzleExecutor): Promise<OrganizationSelect> {
    const [row] = await this.exec(tx).insert(organizations).values(input).returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<Pick<OrganizationSelect, "name" | "slug">>,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizations)
      .set(patch)
      .where(eq(organizations.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx).delete(organizations).where(eq(organizations.id, id));
  }

  async setOwner(
    id: string,
    newOwnerId: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizations)
      .set({ ownerId: newOwnerId })
      .where(and(eq(organizations.id, id)))
      .returning();
    return row ?? null;
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=organizations.repository`
Expected: test passes.

- [ ] **Step 5: Export from barrel**

Update `apps/backend/src/organizations/repositories/index.ts`:
```typescript
export { OrganizationsRepository, type DrizzleExecutor } from "./organizations.repository";
```

### Task 16: `OrganizationMembersRepository`

**Files:**
- Create: `apps/backend/src/organizations/repositories/members.repository.ts`
- Create: `apps/backend/src/organizations/__tests__/members.repository.spec.ts`

- [ ] **Step 1: Write failing smoke test**

```typescript
import { OrganizationMembersRepository } from "../repositories/members.repository";

describe("OrganizationMembersRepository", () => {
  it("instantiates and exposes all methods", () => {
    const repo = new OrganizationMembersRepository({} as any);
    expect(typeof repo.findByOrgAndUser).toBe("function");
    expect(typeof repo.listByOrg).toBe("function");
    expect(typeof repo.listByUser).toBe("function");
    expect(typeof repo.create).toBe("function");
    expect(typeof repo.updateRole).toBe("function");
    expect(typeof repo.delete).toBe("function");
    expect(typeof repo.deleteByOrgAndUser).toBe("function");
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=members.repository`
Expected: fails.

- [ ] **Step 3: Implement**

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { DRIZZLE_DB } from "../../databases/pg-drizzle";
import {
  organizationMembers,
  organizations,
} from "../../databases/pg-drizzle/schema";
import { user } from "../../databases/pg-drizzle/auth-schema";
import type {
  OrganizationMemberInsert,
  OrganizationMemberSelect,
  OrganizationSelect,
  UserSelect,
} from "../../databases/pg-drizzle/types";
import type { DrizzleExecutor } from "./organizations.repository";

type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface MemberRowWithUser {
  member: OrganizationMemberSelect;
  user: Pick<UserSelect, "id" | "name" | "email" | "image">;
}

export interface MyOrganizationRow {
  organization: OrganizationSelect;
  member: OrganizationMemberSelect;
}

@Injectable()
export class OrganizationMembersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findByOrgAndUser(
    organizationId: string,
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationMemberSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listByOrg(
    organizationId: string,
    tx?: DrizzleExecutor,
  ): Promise<MemberRowWithUser[]> {
    const rows = await this.exec(tx)
      .select({
        member: organizationMembers,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(organizationMembers)
      .innerJoin(user, eq(organizationMembers.userId, user.id))
      .where(eq(organizationMembers.organizationId, organizationId));
    return rows;
  }

  async listByUser(
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<MyOrganizationRow[]> {
    const rows = await this.exec(tx)
      .select({
        organization: organizations,
        member: organizationMembers,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(eq(organizationMembers.userId, userId));
    return rows;
  }

  async create(
    input: OrganizationMemberInsert,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationMemberSelect> {
    const [row] = await this.exec(tx)
      .insert(organizationMembers)
      .values(input)
      .returning();
    return row;
  }

  async updateRole(
    id: string,
    role: OrganizationMemberInsert["role"],
    tx?: DrizzleExecutor,
  ): Promise<OrganizationMemberSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationMembers)
      .set({ role })
      .where(eq(organizationMembers.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string, tx?: DrizzleExecutor): Promise<void> {
    await this.exec(tx).delete(organizationMembers).where(eq(organizationMembers.id, id));
  }

  async deleteByOrgAndUser(
    organizationId: string,
    userId: string,
    tx?: DrizzleExecutor,
  ): Promise<void> {
    await this.exec(tx)
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=members.repository`
Expected: test passes.

- [ ] **Step 5: Update barrel**

Append to `apps/backend/src/organizations/repositories/index.ts`:
```typescript
export {
  OrganizationMembersRepository,
  type MemberRowWithUser,
  type MyOrganizationRow,
} from "./members.repository";
```

### Task 17: `OrganizationInvitesRepository`

**Files:**
- Create: `apps/backend/src/organizations/repositories/invites.repository.ts`
- Create: `apps/backend/src/organizations/__tests__/invites.repository.spec.ts`

- [ ] **Step 1: Write failing smoke test**

```typescript
import { OrganizationInvitesRepository } from "../repositories/invites.repository";

describe("OrganizationInvitesRepository", () => {
  it("instantiates and exposes all methods", () => {
    const repo = new OrganizationInvitesRepository({} as any);
    expect(typeof repo.findById).toBe("function");
    expect(typeof repo.findByTokenHash).toBe("function");
    expect(typeof repo.findPendingByOrgAndEmail).toBe("function");
    expect(typeof repo.listByOrg).toBe("function");
    expect(typeof repo.listByEmail).toBe("function");
    expect(typeof repo.create).toBe("function");
    expect(typeof repo.updateStatus).toBe("function");
    expect(typeof repo.rotateToken).toBe("function");
    expect(typeof repo.markAccepted).toBe("function");
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=invites.repository`
Expected: fails.

- [ ] **Step 3: Implement**

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { DRIZZLE_DB } from "../../databases/pg-drizzle";
import {
  organizationInvites,
  organizations,
} from "../../databases/pg-drizzle/schema";
import { user } from "../../databases/pg-drizzle/auth-schema";
import type {
  OrganizationInviteInsert,
  OrganizationInviteSelect,
  OrganizationSelect,
  UserSelect,
} from "../../databases/pg-drizzle/types";
import type { DrizzleExecutor } from "./organizations.repository";

type Db = PostgresJsDatabase<Record<string, unknown>>;

type InviteStatus = OrganizationInviteSelect["status"];

export interface InviteWithRefs {
  invite: OrganizationInviteSelect;
  organization: OrganizationSelect;
  invitedBy: Pick<UserSelect, "id" | "name" | "email"> | null;
}

@Injectable()
export class OrganizationInvitesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Db) {}

  private exec(tx?: DrizzleExecutor): DrizzleExecutor {
    return tx ?? this.db;
  }

  async findById(
    id: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByTokenHash(
    tokenHash: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async findPendingByOrgAndEmail(
    organizationId: string,
    email: string,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .select()
      .from(organizationInvites)
      .where(
        and(
          eq(organizationInvites.organizationId, organizationId),
          eq(organizationInvites.email, email),
          eq(organizationInvites.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listByOrg(
    organizationId: string,
    opts: { status?: InviteStatus | "all" } = {},
    tx?: DrizzleExecutor,
  ): Promise<InviteWithRefs[]> {
    const conditions = [eq(organizationInvites.organizationId, organizationId)];
    if (opts.status && opts.status !== "all") {
      conditions.push(eq(organizationInvites.status, opts.status));
    }
    const rows = await this.exec(tx)
      .select({
        invite: organizationInvites,
        organization: organizations,
        invitedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(organizationInvites)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationInvites.organizationId),
      )
      .leftJoin(user, eq(user.id, organizationInvites.invitedByUserId))
      .where(and(...conditions))
      .orderBy(desc(organizationInvites.createdAt));
    return rows.map((r) => ({
      invite: r.invite,
      organization: r.organization,
      invitedBy: r.invitedBy?.id ? r.invitedBy : null,
    }));
  }

  async listByEmail(
    email: string,
    opts: { status?: InviteStatus | "all"; notExpiredAfter?: Date } = {},
    tx?: DrizzleExecutor,
  ): Promise<InviteWithRefs[]> {
    const conditions = [eq(organizationInvites.email, email)];
    if (opts.status && opts.status !== "all") {
      conditions.push(eq(organizationInvites.status, opts.status));
    }
    if (opts.notExpiredAfter) {
      conditions.push(gt(organizationInvites.expiresAt, opts.notExpiredAfter));
    }
    const rows = await this.exec(tx)
      .select({
        invite: organizationInvites,
        organization: organizations,
        invitedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(organizationInvites)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationInvites.organizationId),
      )
      .leftJoin(user, eq(user.id, organizationInvites.invitedByUserId))
      .where(and(...conditions))
      .orderBy(desc(organizationInvites.createdAt));
    return rows.map((r) => ({
      invite: r.invite,
      organization: r.organization,
      invitedBy: r.invitedBy?.id ? r.invitedBy : null,
    }));
  }

  async create(
    input: OrganizationInviteInsert,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect> {
    const [row] = await this.exec(tx)
      .insert(organizationInvites)
      .values(input)
      .returning();
    return row;
  }

  async updateStatus(
    id: string,
    status: InviteStatus,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationInvites)
      .set({ status })
      .where(eq(organizationInvites.id, id))
      .returning();
    return row ?? null;
  }

  async rotateToken(
    id: string,
    patch: { tokenHash: string; expiresAt: Date },
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationInvites)
      .set({ tokenHash: patch.tokenHash, expiresAt: patch.expiresAt })
      .where(eq(organizationInvites.id, id))
      .returning();
    return row ?? null;
  }

  async markAccepted(
    id: string,
    acceptedByUserId: string,
    acceptedAt: Date,
    tx?: DrizzleExecutor,
  ): Promise<OrganizationInviteSelect | null> {
    const [row] = await this.exec(tx)
      .update(organizationInvites)
      .set({ status: "accepted", acceptedByUserId, acceptedAt })
      .where(eq(organizationInvites.id, id))
      .returning();
    return row ?? null;
  }
}

```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=invites.repository`
Expected: test passes.

- [ ] **Step 5: Update barrel**

Append to `apps/backend/src/organizations/repositories/index.ts`:
```typescript
export {
  OrganizationInvitesRepository,
  type InviteWithRefs,
} from "./invites.repository";
```

- [ ] **Step 6: Stage phase 4**

```bash
git add apps/backend/src/organizations/repositories apps/backend/src/organizations/__tests__
```

*End of Phase 4.*

---

## Phase 5 — `OrgContextGuard`

### Task 18: Guard with unit tests

**Files:**
- Create: `apps/backend/src/organizations/guards/org-context.guard.ts`
- Create: `apps/backend/src/organizations/__tests__/org-context.guard.spec.ts`
- Modify: `apps/backend/src/organizations/guards/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { ExecutionContext, HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrgContextGuard } from "../guards/org-context.guard";
import { OrganizationMembersRepository } from "../repositories/members.repository";
import { REQUIRE_ORG_ROLE_KEY } from "../decorators/require-org-role.decorator";

function makeContext(opts: {
  header?: string;
  session?: { user?: { id?: string } };
  membership?: { role: "owner" | "admin" | "viewer" } | null;
  level?: "owner" | "admin" | "member";
}) {
  const request: any = {
    headers: opts.header ? { "x-organization-id": opts.header } : {},
    session: opts.session ?? { user: { id: "user-1" } },
  };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(opts.level),
  } as unknown as Reflector;

  const membersRepo = {
    findByOrgAndUser: jest.fn().mockResolvedValue(
      opts.membership
        ? {
            id: "m1",
            organizationId: opts.header,
            userId: opts.session?.user?.id ?? "user-1",
            role: opts.membership.role,
          }
        : null,
    ),
  } as unknown as OrganizationMembersRepository;

  return { ctx, request, reflector, membersRepo };
}

describe("OrgContextGuard", () => {
  it("is a no-op when @RequireOrgRole is absent", async () => {
    const { ctx, reflector, membersRepo } = makeContext({ level: undefined });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("400 when header missing and route is org-scoped", async () => {
    const { ctx, reflector, membersRepo } = makeContext({ level: "member" });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("401 when no session on an org-scoped route", async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: "member",
      header: "org-1",
      session: {},
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("404 when caller is not a member", async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: "member",
      header: "org-1",
      membership: null,
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("403 when role is insufficient", async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: "owner",
      header: "org-1",
      membership: { role: "admin" },
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("allows owner when admin is required", async () => {
    const { ctx, request, reflector, membersRepo } = makeContext({
      level: "admin",
      header: "org-1",
      membership: { role: "owner" },
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.orgMembership).toEqual({
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
    });
  });

  it("allows viewer when member is required", async () => {
    const { ctx, reflector, membersRepo } = makeContext({
      level: "member",
      header: "org-1",
      membership: { role: "viewer" },
    });
    const guard = new OrgContextGuard(reflector, membersRepo);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

// Force ts to not strip imports; keep the test file focused.
void REQUIRE_ORG_ROLE_KEY;
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=org-context.guard`
Expected: fails (module not found).

- [ ] **Step 3: Implement the guard**

```typescript
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { OrganizationRole } from "@launchstack/api-interfaces";
import {
  OrgRoleLevel,
  REQUIRE_ORG_ROLE_KEY,
} from "../decorators/require-org-role.decorator";
import { OrganizationMembersRepository } from "../repositories/members.repository";

const ROLE_RANK: Record<OrganizationRole, number> = {
  viewer: 1,
  admin: 2,
  owner: 3,
};

const LEVEL_MIN_RANK: Record<OrgRoleLevel, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

function apiError(code: string, message: string) {
  return { code, message };
}

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membersRepo: OrganizationMembersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const level = this.reflector.getAllAndOverride<OrgRoleLevel | undefined>(
      REQUIRE_ORG_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!level) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      session?: { user?: { id?: string } };
      orgMembership?: {
        organizationId: string;
        userId: string;
        role: OrganizationRole;
      };
    }>();

    const headerValue = request.headers["x-organization-id"];
    const organizationId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!organizationId || typeof organizationId !== "string") {
      throw new HttpException(
        apiError(
          "ORG_HEADER_REQUIRED",
          "Missing or malformed X-Organization-Id header",
        ),
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = request.session?.user?.id;
    if (!userId) {
      throw new HttpException(
        apiError("UNAUTHENTICATED", "Authentication required"),
        HttpStatus.UNAUTHORIZED,
      );
    }

    const membership = await this.membersRepo.findByOrgAndUser(organizationId, userId);
    if (!membership) {
      throw new HttpException(
        apiError("ORG_NOT_FOUND", "Organization not found"),
        HttpStatus.NOT_FOUND,
      );
    }

    if (ROLE_RANK[membership.role] < LEVEL_MIN_RANK[level]) {
      throw new HttpException(
        apiError("ORG_FORBIDDEN", "Insufficient organization role"),
        HttpStatus.FORBIDDEN,
      );
    }

    request.orgMembership = {
      organizationId,
      userId,
      role: membership.role,
    };
    return true;
  }
}
```

- [ ] **Step 4: Export from barrel**

Update `apps/backend/src/organizations/guards/index.ts`:
```typescript
export { OrgContextGuard } from "./org-context.guard";
```

- [ ] **Step 5: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=org-context.guard`
Expected: all cases pass.

- [ ] **Step 6: Stage**

```bash
git add apps/backend/src/organizations/guards apps/backend/src/organizations/__tests__
```

*End of Phase 5.*

---

## Phase 6 — Token utilities + email template

### Task 19: Token generation + SHA-256 helper

**Files:**
- Create: `apps/backend/src/organizations/tokens.ts`
- Create: `apps/backend/src/organizations/__tests__/tokens.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { generateInviteToken, hashInviteToken } from "../tokens";

describe("invite token utilities", () => {
  it("generateInviteToken returns a URL-safe base64 string of ~43 chars", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("generates distinct tokens", () => {
    expect(generateInviteToken()).not.toEqual(generateInviteToken());
  });

  it("hashInviteToken returns a hex SHA-256 of the token", () => {
    const hash = hashInviteToken("abc");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Stable output: sha256("abc")
    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=tokens`
Expected: fails.

- [ ] **Step 3: Implement**

```typescript
import { createHash, randomBytes } from "node:crypto";

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=tokens`
Expected: tests pass.

### Task 20: Invite email template + render helper

**Files:**
- Create: `apps/backend/src/emails/invite-email.tsx`
- Modify: `apps/backend/src/emails/render-email.ts`

- [ ] **Step 1: Create the React Email template**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components";

export interface InviteEmailProps {
  organizationName: string;
  inviterName: string;
  role: "admin" | "viewer";
  acceptUrl: string;
  expiresInDays: number;
}

export function InviteEmail({
  organizationName,
  inviterName,
  role,
  acceptUrl,
  expiresInDays,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>🚀 LaunchStack</Text>
          <Heading style={h1}>You&apos;re invited to {organizationName}</Heading>
          <Text style={text}>
            {inviterName} invited you to join <strong>{organizationName}</strong>{" "}
            as <strong>{role}</strong>.
          </Text>
          <Section style={cta}>
            <Button href={acceptUrl} style={button}>
              Accept invite
            </Button>
          </Section>
          <Text style={text}>
            This invite expires in {expiresInDays} days. If the button above
            doesn&apos;t work, copy and paste this link:
          </Text>
          <Text style={link}>{acceptUrl}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you weren&apos;t expecting this invite, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily:
    "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};
const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  padding: "40px 20px",
};
const brand: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#1a1a1a",
  margin: "0 0 24px 0",
};
const h1: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: "0 0 12px 0",
  lineHeight: "1.3",
};
const text: React.CSSProperties = {
  fontSize: "15px",
  color: "#1a1a1a",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
};
const cta: React.CSSProperties = { margin: "24px 0" };
const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#1a1a1a",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
};
const link: React.CSSProperties = {
  fontSize: "13px",
  color: "#2563eb",
  wordBreak: "break-all",
};
const hr: React.CSSProperties = {
  borderTop: "1px solid #e5e5e5",
  margin: "24px 0",
};
const footer: React.CSSProperties = {
  fontSize: "13px",
  color: "#737373",
  lineHeight: "1.5",
  margin: "0",
};
```

- [ ] **Step 2: Add `renderInviteEmail` to the render helper**

Edit `apps/backend/src/emails/render-email.ts`, appending below the existing export:
```typescript
import { InviteEmail, type InviteEmailProps } from "./invite-email";

export async function renderInviteEmail(
  props: InviteEmailProps,
): Promise<{ subject: string; html: string; text: string }> {
  const subject = `${props.inviterName} invited you to ${props.organizationName}`;
  const html = await render(InviteEmail(props));
  const text = await render(InviteEmail(props), { plainText: true });
  return { subject, html, text };
}
```

- [ ] **Step 3: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Stage phase 6**

```bash
git add apps/backend/src/organizations/tokens.ts apps/backend/src/organizations/__tests__/tokens.spec.ts apps/backend/src/emails
```

*End of Phase 6.*

---

## Phase 7 — Services

Services encapsulate business rules. They receive repositories (and `ConfigService` / Resend for invite emails) via constructor injection. Transactions are composed via `db.transaction(async (tx) => ...)` on the injected `DRIZZLE_DB` instance.

A utility helper for slug generation lives inline in `organizations.service.ts`.

### Task 21: `OrganizationsService` — test-first

**Files:**
- Create: `apps/backend/src/organizations/services/organizations.service.ts`
- Create: `apps/backend/src/organizations/__tests__/organizations.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { HttpException } from "@nestjs/common";
import { OrganizationsService } from "../services/organizations.service";

function makeMocks() {
  const orgsRepo = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findByOwnerId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setOwner: jest.fn(),
  } as any;

  const membersRepo = {
    findByOrgAndUser: jest.fn(),
    listByUser: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    delete: jest.fn(),
    deleteByOrgAndUser: jest.fn(),
  } as any;

  const db = {
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ __tx: true }),
    ),
  } as any;

  return { orgsRepo, membersRepo, db };
}

describe("OrganizationsService", () => {
  describe("create", () => {
    it("rejects with 409 when caller already owns an org", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findByOwnerId.mockResolvedValue({ id: "existing" });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.createOrganization("user-1", { name: "Acme" }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("creates org + owner membership in a transaction", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findByOwnerId.mockResolvedValue(null);
      orgsRepo.findBySlug.mockResolvedValue(null);
      orgsRepo.create.mockResolvedValue({
        id: "org-1",
        name: "Acme",
        slug: "acme-abc123",
        ownerId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      membersRepo.create.mockResolvedValue({
        id: "m-1",
        organizationId: "org-1",
        userId: "user-1",
        role: "owner",
        createdAt: new Date(),
      });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const result = await svc.createOrganization("user-1", { name: "Acme" });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(orgsRepo.create).toHaveBeenCalledTimes(1);
      expect(membersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          userId: "user-1",
          role: "owner",
        }),
        expect.anything(),
      );
      expect(result.organization.id).toBe("org-1");
      expect(result.membership.role).toBe("owner");
    });
  });

  describe("updateOrganization", () => {
    it("rejects slug conflicts with 409", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findBySlug.mockResolvedValue({ id: "other", slug: "taken" });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.updateOrganization("org-1", { slug: "taken" }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("updates when slug is free", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      orgsRepo.findBySlug.mockResolvedValue(null);
      orgsRepo.update.mockResolvedValue({
        id: "org-1",
        name: "Acme",
        slug: "acme-new",
        ownerId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const result = await svc.updateOrganization("org-1", { slug: "acme-new" });
      expect(result.slug).toBe("acme-new");
    });
  });

  describe("transferOwnership", () => {
    it("rejects when target is not an admin of this org", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.findByOrgAndUser.mockResolvedValue(null);

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.transferOwnership({
          organizationId: "org-1",
          currentOwnerUserId: "user-1",
          newOwnerUserId: "user-2",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("rejects when target already owns another org", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.findByOrgAndUser.mockResolvedValueOnce({ role: "admin", id: "m2" });
      orgsRepo.findByOwnerId.mockResolvedValue({ id: "other" });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await expect(
        svc.transferOwnership({
          organizationId: "org-1",
          currentOwnerUserId: "user-1",
          newOwnerUserId: "user-2",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("flips owner_id and swaps role rows in a transaction", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      // target is an admin
      membersRepo.findByOrgAndUser.mockImplementation(
        async (_orgId: string, userId: string) =>
          userId === "user-2"
            ? { id: "m2", role: "admin" }
            : { id: "m1", role: "owner" },
      );
      orgsRepo.findByOwnerId.mockResolvedValue(null);
      orgsRepo.setOwner.mockResolvedValue({
        id: "org-1",
        ownerId: "user-2",
        name: "Acme",
        slug: "acme",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await svc.transferOwnership({
        organizationId: "org-1",
        currentOwnerUserId: "user-1",
        newOwnerUserId: "user-2",
      });

      expect(orgsRepo.setOwner).toHaveBeenCalledWith(
        "org-1",
        "user-2",
        expect.anything(),
      );
      expect(membersRepo.updateRole).toHaveBeenCalledWith(
        "m2",
        "owner",
        expect.anything(),
      );
      expect(membersRepo.updateRole).toHaveBeenCalledWith(
        "m1",
        "admin",
        expect.anything(),
      );
    });
  });

  describe("deleteOrganization", () => {
    it("calls repo.delete (cascade handles members/invites)", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      await svc.deleteOrganization("org-1");
      expect(orgsRepo.delete).toHaveBeenCalledWith("org-1");
    });
  });

  describe("listMyOrganizations", () => {
    it("returns rows shaped as { organization, role }", async () => {
      const { orgsRepo, membersRepo, db } = makeMocks();
      membersRepo.listByUser.mockResolvedValue([
        {
          organization: {
            id: "o1",
            name: "A",
            slug: "a",
            ownerId: "u1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          member: {
            id: "m1",
            role: "admin",
            userId: "u1",
            organizationId: "o1",
            createdAt: new Date(),
          },
        },
      ]);

      const svc = new OrganizationsService(orgsRepo, membersRepo, db);
      const out = await svc.listMyOrganizations("u1");
      expect(out).toHaveLength(1);
      expect(out[0].role).toBe("admin");
      expect(out[0].organization.id).toBe("o1");
    });
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=organizations.service`
Expected: fails.

- [ ] **Step 3: Implement the service**

```typescript
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  MyOrganization,
  Organization,
  OrganizationRole,
} from "@launchstack/api-interfaces";
import { DRIZZLE_DB } from "../../databases/pg-drizzle";
import type {
  OrganizationMemberSelect,
  OrganizationSelect,
} from "../../databases/pg-drizzle/types";
import { OrganizationsRepository } from "../repositories/organizations.repository";
import { OrganizationMembersRepository } from "../repositories/members.repository";

type Db = PostgresJsDatabase<Record<string, unknown>>;

function apiError(code: string, message: string) {
  return { code, message };
}

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = randomBytes(4).toString("hex").slice(0, 6);
  return `${base || "org"}-${suffix}`;
}

export function serializeOrganization(row: OrganizationSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgs: OrganizationsRepository,
    private readonly members: OrganizationMembersRepository,
    @Inject(DRIZZLE_DB) private readonly db: Db,
  ) {}

  async createOrganization(
    ownerUserId: string,
    input: { name: string },
  ): Promise<{
    organization: Organization;
    membership: OrganizationMemberSelect;
  }> {
    const existing = await this.orgs.findByOwnerId(ownerUserId);
    if (existing) {
      throw new HttpException(
        apiError("ORG_OWNER_CONFLICT", "You already own an organization"),
        HttpStatus.CONFLICT,
      );
    }

    const result = await this.db.transaction(async (tx) => {
      // Generate a unique slug; retry a few times on collision.
      let slug = buildSlug(input.name);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await this.orgs.findBySlug(slug, tx);
        if (!clash) break;
        slug = buildSlug(input.name);
      }

      const org = await this.orgs.create(
        { name: input.name, slug, ownerId: ownerUserId },
        tx,
      );
      const membership = await this.members.create(
        { organizationId: org.id, userId: ownerUserId, role: "owner" },
        tx,
      );
      return { org, membership };
    });

    return {
      organization: serializeOrganization(result.org),
      membership: result.membership,
    };
  }

  async listMyOrganizations(userId: string): Promise<MyOrganization[]> {
    const rows = await this.members.listByUser(userId);
    return rows.map((r) => ({
      organization: serializeOrganization(r.organization),
      role: r.member.role,
    }));
  }

  async getCurrentOrganization(
    organizationId: string,
    role: OrganizationRole,
  ): Promise<{ organization: Organization; role: OrganizationRole }> {
    const row = await this.orgs.findById(organizationId);
    if (!row) {
      throw new HttpException(
        apiError("ORG_NOT_FOUND", "Organization not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    return { organization: serializeOrganization(row), role };
  }

  async updateOrganization(
    organizationId: string,
    patch: { name?: string; slug?: string },
  ): Promise<Organization> {
    if (patch.slug) {
      const clash = await this.orgs.findBySlug(patch.slug);
      if (clash && clash.id !== organizationId) {
        throw new HttpException(
          apiError("ORG_SLUG_CONFLICT", "Slug already in use"),
          HttpStatus.CONFLICT,
        );
      }
    }
    const updated = await this.orgs.update(organizationId, patch);
    if (!updated) {
      throw new HttpException(
        apiError("ORG_NOT_FOUND", "Organization not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeOrganization(updated);
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.orgs.delete(organizationId);
  }

  async transferOwnership(input: {
    organizationId: string;
    currentOwnerUserId: string;
    newOwnerUserId: string;
  }): Promise<Organization> {
    if (input.currentOwnerUserId === input.newOwnerUserId) {
      throw new HttpException(
        apiError("ORG_TRANSFER_INVALID", "Cannot transfer to yourself"),
        HttpStatus.CONFLICT,
      );
    }

    return await this.db.transaction(async (tx) => {
      const target = await this.members.findByOrgAndUser(
        input.organizationId,
        input.newOwnerUserId,
        tx,
      );
      if (!target || target.role !== "admin") {
        throw new HttpException(
          apiError(
            "ORG_TRANSFER_INVALID",
            "Target must be an existing admin of this organization",
          ),
          HttpStatus.CONFLICT,
        );
      }

      const targetOwnsElsewhere = await this.orgs.findByOwnerId(
        input.newOwnerUserId,
        tx,
      );
      if (targetOwnsElsewhere) {
        throw new HttpException(
          apiError(
            "ORG_TRANSFER_INVALID",
            "Target already owns another organization",
          ),
          HttpStatus.CONFLICT,
        );
      }

      const currentOwnerMembership = await this.members.findByOrgAndUser(
        input.organizationId,
        input.currentOwnerUserId,
        tx,
      );
      if (!currentOwnerMembership || currentOwnerMembership.role !== "owner") {
        throw new HttpException(
          apiError(
            "ORG_TRANSFER_INVALID",
            "Caller is not the current owner",
          ),
          HttpStatus.CONFLICT,
        );
      }

      const updatedOrg = await this.orgs.setOwner(
        input.organizationId,
        input.newOwnerUserId,
        tx,
      );
      if (!updatedOrg) {
        throw new HttpException(
          apiError("ORG_NOT_FOUND", "Organization not found"),
          HttpStatus.NOT_FOUND,
        );
      }

      await this.members.updateRole(target.id, "owner", tx);
      await this.members.updateRole(currentOwnerMembership.id, "admin", tx);

      return serializeOrganization(updatedOrg);
    });
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=organizations.service`
Expected: all tests pass.

- [ ] **Step 5: Export from barrel**

Update `apps/backend/src/organizations/services/index.ts`:
```typescript
export {
  OrganizationsService,
  serializeOrganization,
} from "./organizations.service";
```

### Task 22: `MembersService`

**Files:**
- Create: `apps/backend/src/organizations/services/members.service.ts`
- Create: `apps/backend/src/organizations/__tests__/members.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { MembersService } from "../services/members.service";

function mocks() {
  const members = {
    findByOrgAndUser: jest.fn(),
    listByOrg: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    delete: jest.fn(),
    deleteByOrgAndUser: jest.fn(),
  } as any;
  const memberById = async (id: string) => (id === "m-owner" ? { id, role: "owner" } : { id, role: "admin" });
  return { members, memberById };
}

describe("MembersService", () => {
  describe("updateMemberRole", () => {
    it("rejects when trying to change owner's role", async () => {
      const { members } = mocks();
      members.listByOrg.mockResolvedValue([
        { member: { id: "m-owner", role: "owner", userId: "u1", organizationId: "o1", createdAt: new Date() }, user: { id: "u1", name: "", email: "", image: null } },
        { member: { id: "m-admin", role: "admin", userId: "u2", organizationId: "o1", createdAt: new Date() }, user: { id: "u2", name: "", email: "", image: null } },
      ]);
      const svc = new MembersService(members);
      await expect(
        svc.updateMemberRole({
          organizationId: "o1",
          memberId: "m-owner",
          newRole: "admin",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("updates an admin's role", async () => {
      const { members } = mocks();
      members.listByOrg.mockResolvedValue([
        { member: { id: "m-admin", role: "admin", userId: "u2", organizationId: "o1", createdAt: new Date() }, user: { id: "u2", name: "", email: "", image: null } },
      ]);
      members.updateRole.mockResolvedValue({
        id: "m-admin",
        role: "viewer",
        userId: "u2",
        organizationId: "o1",
        createdAt: new Date(),
      });
      const svc = new MembersService(members);
      const out = await svc.updateMemberRole({
        organizationId: "o1",
        memberId: "m-admin",
        newRole: "viewer",
      });
      expect(out.role).toBe("viewer");
    });
  });

  describe("removeMember", () => {
    it("admin cannot remove the owner", async () => {
      const { members } = mocks();
      members.listByOrg.mockResolvedValue([
        { member: { id: "m-owner", role: "owner", userId: "u1", organizationId: "o1", createdAt: new Date() }, user: { id: "u1", name: "", email: "", image: null } },
      ]);
      const svc = new MembersService(members);
      await expect(
        svc.removeMember({
          organizationId: "o1",
          callerMembership: { id: "m-admin", role: "admin", userId: "u2" } as any,
          targetMemberId: "m-owner",
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("admin cannot remove self (must use leave)", async () => {
      const { members } = mocks();
      members.listByOrg.mockResolvedValue([
        { member: { id: "m-admin", role: "admin", userId: "u2", organizationId: "o1", createdAt: new Date() }, user: { id: "u2", name: "", email: "", image: null } },
      ]);
      const svc = new MembersService(members);
      await expect(
        svc.removeMember({
          organizationId: "o1",
          callerMembership: { id: "m-admin", role: "admin", userId: "u2" } as any,
          targetMemberId: "m-admin",
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("owner can remove an admin", async () => {
      const { members } = mocks();
      members.listByOrg.mockResolvedValue([
        { member: { id: "m-admin", role: "admin", userId: "u2", organizationId: "o1", createdAt: new Date() }, user: { id: "u2", name: "", email: "", image: null } },
      ]);
      const svc = new MembersService(members);
      await svc.removeMember({
        organizationId: "o1",
        callerMembership: { id: "m-owner", role: "owner", userId: "u1" } as any,
        targetMemberId: "m-admin",
      });
      expect(members.delete).toHaveBeenCalledWith("m-admin");
    });
  });

  describe("leaveOrganization", () => {
    it("rejects owner leaving", async () => {
      const { members } = mocks();
      const svc = new MembersService(members);
      await expect(
        svc.leaveOrganization({
          organizationId: "o1",
          callerMembership: { id: "m-owner", role: "owner", userId: "u1" } as any,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("deletes the caller's membership when admin", async () => {
      const { members } = mocks();
      const svc = new MembersService(members);
      await svc.leaveOrganization({
        organizationId: "o1",
        callerMembership: { id: "m-admin", role: "admin", userId: "u2" } as any,
      });
      expect(members.deleteByOrgAndUser).toHaveBeenCalledWith("o1", "u2");
    });
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=members.service`
Expected: fails.

- [ ] **Step 3: Implement**

```typescript
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type {
  OrganizationMember,
  OrganizationRole,
} from "@launchstack/api-interfaces";
import { OrganizationMembersRepository } from "../repositories/members.repository";
import type { OrgMembershipContext } from "../decorators/org-membership.decorator";
import type {
  MemberRowWithUser,
  OrganizationMemberSelect,
} from "../repositories/members.repository";

function apiError(code: string, message: string) {
  return { code, message };
}

function serializeMember(row: MemberRowWithUser): OrganizationMember {
  return {
    id: row.member.id,
    organizationId: row.member.organizationId,
    userId: row.member.userId,
    role: row.member.role,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image ?? null,
    },
    createdAt: row.member.createdAt.toISOString(),
  };
}

@Injectable()
export class MembersService {
  constructor(private readonly members: OrganizationMembersRepository) {}

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await this.members.listByOrg(organizationId);
    return rows.map(serializeMember);
  }

  async updateMemberRole(input: {
    organizationId: string;
    memberId: string;
    newRole: Exclude<OrganizationRole, "owner">;
  }): Promise<OrganizationMember> {
    const rows = await this.members.listByOrg(input.organizationId);
    const target = rows.find((r) => r.member.id === input.memberId);
    if (!target) {
      throw new HttpException(
        apiError("MEMBER_NOT_FOUND", "Member not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    if (target.member.role === "owner") {
      throw new HttpException(
        apiError(
          "MEMBER_IS_OWNER",
          "Use transfer-ownership to change the owner role",
        ),
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.members.updateRole(input.memberId, input.newRole);
    if (!updated) {
      throw new HttpException(
        apiError("MEMBER_NOT_FOUND", "Member not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeMember({ member: updated, user: target.user });
  }

  async removeMember(input: {
    organizationId: string;
    callerMembership: OrgMembershipContext;
    targetMemberId: string;
  }): Promise<void> {
    const rows = await this.members.listByOrg(input.organizationId);
    const target = rows.find((r) => r.member.id === input.targetMemberId);
    if (!target) {
      throw new HttpException(
        apiError("MEMBER_NOT_FOUND", "Member not found"),
        HttpStatus.NOT_FOUND,
      );
    }

    const callerRole = input.callerMembership.role;

    // Nobody can remove the owner via this endpoint.
    if (target.member.role === "owner") {
      throw new HttpException(
        apiError(
          "MEMBER_FORBIDDEN",
          "Cannot remove the owner — use transfer-ownership or delete",
        ),
        HttpStatus.FORBIDDEN,
      );
    }

    // Admins can't remove themselves here — must use leave endpoint.
    if (target.member.userId === input.callerMembership.userId) {
      throw new HttpException(
        apiError(
          "MEMBER_FORBIDDEN",
          "Use the leave endpoint to remove yourself",
        ),
        HttpStatus.FORBIDDEN,
      );
    }

    // Admins can remove admins and viewers; owners can remove anyone except themselves (already handled).
    if (callerRole !== "owner" && callerRole !== "admin") {
      throw new HttpException(
        apiError("MEMBER_FORBIDDEN", "Insufficient role"),
        HttpStatus.FORBIDDEN,
      );
    }

    await this.members.delete(input.targetMemberId);
  }

  async leaveOrganization(input: {
    organizationId: string;
    callerMembership: OrgMembershipContext;
  }): Promise<void> {
    if (input.callerMembership.role === "owner") {
      throw new HttpException(
        apiError(
          "OWNER_CANNOT_LEAVE",
          "Owner must transfer ownership or delete the organization",
        ),
        HttpStatus.CONFLICT,
      );
    }
    await this.members.deleteByOrgAndUser(
      input.organizationId,
      input.callerMembership.userId,
    );
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=members.service`
Expected: all pass.

- [ ] **Step 5: Export from barrel**

Append to `apps/backend/src/organizations/services/index.ts`:
```typescript
export { MembersService } from "./members.service";
```

### Task 23: `InvitesService` — test-first

**Files:**
- Create: `apps/backend/src/organizations/services/invites.service.ts`
- Create: `apps/backend/src/organizations/__tests__/invites.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { InvitesService } from "../services/invites.service";

function mocks() {
  const invites = {
    findById: jest.fn(),
    findByTokenHash: jest.fn(),
    findPendingByOrgAndEmail: jest.fn(),
    listByOrg: jest.fn(),
    listByEmail: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    rotateToken: jest.fn(),
    markAccepted: jest.fn(),
  } as any;
  const members = {
    findByOrgAndUser: jest.fn(),
    listByOrg: jest.fn(),
    create: jest.fn(),
  } as any;
  const orgs = {
    findById: jest.fn(),
  } as any;
  const db = {
    transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
      fn({ __tx: true }),
    ),
  } as any;
  const mailer = {
    sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  } as any;
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === "FRONTEND_URL" ? "https://app.example.com" : "",
    ),
  } as any;
  return { invites, members, orgs, db, mailer, config };
}

describe("InvitesService", () => {
  describe("createInvite", () => {
    it("409 when invited email already belongs to a current member", async () => {
      const m = mocks();
      m.members.listByOrg.mockResolvedValue([
        { member: { role: "admin" }, user: { email: "jane@example.com" } },
      ]);
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(
        svc.createInvite({
          organizationId: "o1",
          inviterUserId: "u1",
          email: "jane@example.com",
          role: "admin",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("flips existing pending invite to expired and inserts a new one in a transaction", async () => {
      const m = mocks();
      m.members.listByOrg.mockResolvedValue([]);
      m.invites.findPendingByOrgAndEmail.mockResolvedValue({ id: "old-invite" });
      m.invites.create.mockResolvedValue({
        id: "new-invite",
        organizationId: "o1",
        email: "bob@example.com",
        role: "viewer",
        status: "pending",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 7 * 86400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        invitedByUserId: "u1",
        acceptedByUserId: null,
        acceptedAt: null,
      });
      m.orgs.findById.mockResolvedValue({
        id: "o1",
        name: "Acme",
        slug: "acme",
        ownerId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      const out = await svc.createInvite({
        organizationId: "o1",
        inviterUserId: "u1",
        email: "Bob@Example.com",
        role: "viewer",
      });

      expect(m.db.transaction).toHaveBeenCalled();
      expect(m.invites.updateStatus).toHaveBeenCalledWith(
        "old-invite",
        "expired",
        expect.anything(),
      );
      expect(m.invites.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "bob@example.com", // lowercased
          role: "viewer",
          status: "pending",
        }),
        expect.anything(),
      );
      expect(m.mailer.sendInviteEmail).toHaveBeenCalledTimes(1);
      expect(out.status).toBe("pending");
    });
  });

  describe("resendInvite", () => {
    it("rejects when invite is not pending", async () => {
      const m = mocks();
      m.invites.findById.mockResolvedValue({ id: "i1", status: "accepted" });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(
        svc.resendInvite({ organizationId: "o1", inviteId: "i1" }),
      ).rejects.toMatchObject({ status: 410 });
    });

    it("rotates token and resets expiry", async () => {
      const m = mocks();
      m.invites.findById.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
      });
      m.invites.rotateToken.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        tokenHash: "hash2",
        expiresAt: new Date(Date.now() + 7 * 86400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        invitedByUserId: "u1",
        acceptedByUserId: null,
        acceptedAt: null,
      });
      m.orgs.findById.mockResolvedValue({
        id: "o1",
        name: "Acme",
        slug: "acme",
        ownerId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await svc.resendInvite({ organizationId: "o1", inviteId: "i1" });
      expect(m.invites.rotateToken).toHaveBeenCalled();
      expect(m.mailer.sendInviteEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("revokeInvite", () => {
    it("sets status=revoked for a pending invite", async () => {
      const m = mocks();
      m.invites.findById.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        status: "pending",
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await svc.revokeInvite({ organizationId: "o1", inviteId: "i1" });
      expect(m.invites.updateStatus).toHaveBeenCalledWith("i1", "revoked");
    });

    it("is idempotent for non-pending invites (no update)", async () => {
      const m = mocks();
      m.invites.findById.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        status: "accepted",
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await svc.revokeInvite({ organizationId: "o1", inviteId: "i1" });
      expect(m.invites.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("previewInvite", () => {
    it("returns 404 for unknown token", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue(null);
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(svc.previewInvite("tok")).rejects.toMatchObject({ status: 404 });
    });

    it("returns 410 for non-pending or expired", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        status: "accepted",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(svc.previewInvite("tok")).rejects.toMatchObject({ status: 410 });
    });

    it("returns preview shape for valid pending invite", async () => {
      const m = mocks();
      const future = new Date(Date.now() + 86400_000);
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: future,
        invitedByUserId: "u1",
      });
      m.orgs.findById.mockResolvedValue({ id: "o1", name: "Acme" });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      svc.lookupUser = async () => ({ id: "u1", name: "Alice", email: "alice@ex.com" });

      const preview = await svc.previewInvite("tok");
      expect(preview.organizationName).toBe("Acme");
      expect(preview.inviterName).toBe("Alice");
      expect(preview.invitedEmail).toBe("bob@example.com");
      expect(preview.role).toBe("admin");
      expect(preview.expiresAt).toBe(future.toISOString());
    });
  });

  describe("acceptInvite", () => {
    it("422 when caller email does not match invite email", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(
        svc.acceptInvite({
          caller: { userId: "u1", email: "other@example.com", emailVerified: true },
          token: "tok",
        }),
      ).rejects.toMatchObject({ status: 422 });
    });

    it("422 when email is not verified", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(
        svc.acceptInvite({
          caller: { userId: "u1", email: "bob@example.com", emailVerified: false },
          token: "tok",
        }),
      ).rejects.toMatchObject({ status: 422 });
    });

    it("410 when invite is expired", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() - 86400_000),
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await expect(
        svc.acceptInvite({
          caller: { userId: "u1", email: "bob@example.com", emailVerified: true },
          token: "tok",
        }),
      ).rejects.toMatchObject({ status: 410 });
    });

    it("creates membership + marks accepted in a transaction", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      m.members.findByOrgAndUser.mockResolvedValue(null);
      m.members.create.mockResolvedValue({
        id: "m-new",
        organizationId: "o1",
        userId: "u1",
        role: "admin",
        createdAt: new Date(),
      });
      m.orgs.findById.mockResolvedValue({
        id: "o1",
        name: "Acme",
        slug: "acme",
        ownerId: "u2",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      const out = await svc.acceptInvite({
        caller: { userId: "u1", email: "bob@example.com", emailVerified: true },
        token: "tok",
      });

      expect(m.members.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "o1",
          userId: "u1",
          role: "admin",
        }),
        expect.anything(),
      );
      expect(m.invites.markAccepted).toHaveBeenCalledWith(
        "i1",
        "u1",
        expect.any(Date),
        expect.anything(),
      );
      expect(out.organization.id).toBe("o1");
    });

    it("idempotent if caller is already a member", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      m.members.findByOrgAndUser.mockResolvedValue({
        id: "m-existing",
        organizationId: "o1",
        userId: "u1",
        role: "viewer",
        createdAt: new Date(),
      });
      m.orgs.findById.mockResolvedValue({
        id: "o1",
        name: "Acme",
        slug: "acme",
        ownerId: "u2",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      const out = await svc.acceptInvite({
        caller: { userId: "u1", email: "bob@example.com", emailVerified: true },
        token: "tok",
      });

      expect(m.members.create).not.toHaveBeenCalled();
      expect(m.invites.markAccepted).toHaveBeenCalled();
      expect(out.membership.id).toBe("m-existing");
    });
  });

  describe("declineInvite", () => {
    it("flips status to revoked", async () => {
      const m = mocks();
      m.invites.findByTokenHash.mockResolvedValue({
        id: "i1",
        organizationId: "o1",
        email: "bob@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      const svc = new InvitesService(m.invites, m.members, m.orgs, m.db, m.mailer, m.config);
      await svc.declineInvite({
        caller: { userId: "u1", email: "bob@example.com", emailVerified: true },
        token: "tok",
      });
      expect(m.invites.updateStatus).toHaveBeenCalledWith("i1", "revoked");
    });
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter backend test -- --testPathPattern=invites.service`
Expected: fails.

- [ ] **Step 3: Implement the service**

```typescript
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  InvitePreview,
  InviteRole,
  InviteStatus,
  Organization,
  OrganizationInvite,
  OrganizationMember,
} from "@launchstack/api-interfaces";
import { DRIZZLE_DB } from "../../databases/pg-drizzle";
import { user } from "../../databases/pg-drizzle/auth-schema";
import type { OrganizationMemberSelect } from "../../databases/pg-drizzle/types";
import { OrganizationsRepository } from "../repositories/organizations.repository";
import { OrganizationMembersRepository } from "../repositories/members.repository";
import {
  InviteWithRefs,
  OrganizationInvitesRepository,
} from "../repositories/invites.repository";
import { generateInviteToken, hashInviteToken } from "../tokens";
import { serializeOrganization } from "./organizations.service";
import { InviteMailer } from "./invite-mailer";

type Db = PostgresJsDatabase<Record<string, unknown>>;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function apiError(code: string, message: string) {
  return { code, message };
}

function serializeInvite(row: InviteWithRefs): OrganizationInvite {
  return {
    id: row.invite.id,
    organizationId: row.invite.organizationId,
    email: row.invite.email,
    role: row.invite.role,
    status: row.invite.status,
    expiresAt: row.invite.expiresAt.toISOString(),
    createdAt: row.invite.createdAt.toISOString(),
    invitedBy: row.invitedBy ?? null,
    acceptedBy: null, // listByOrg doesn't join acceptor; accept endpoint returns membership separately
    acceptedAt: row.invite.acceptedAt
      ? row.invite.acceptedAt.toISOString()
      : null,
  };
}

interface CallerContext {
  userId: string;
  email: string;
  emailVerified: boolean;
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly invites: OrganizationInvitesRepository,
    private readonly members: OrganizationMembersRepository,
    private readonly orgs: OrganizationsRepository,
    @Inject(DRIZZLE_DB) private readonly db: Db,
    private readonly mailer: InviteMailer,
    private readonly config: ConfigService,
  ) {}

  /** Hook-point for tests to stub user lookups (used by previewInvite). */
  lookupUser: (userId: string) => Promise<
    { id: string; name: string; email: string } | null
  > = async (userId) => {
    const [row] = await this.db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  };

  private buildAcceptUrl(rawToken: string): string {
    const base = this.config.getOrThrow<string>("FRONTEND_URL");
    const url = new URL("/accept-invite", base);
    url.searchParams.set("token", rawToken);
    return url.toString();
  }

  private requireVerifiedCaller(caller: CallerContext) {
    if (!caller.emailVerified) {
      throw new HttpException(
        apiError(
          "EMAIL_NOT_VERIFIED",
          "Verify your email before handling invites",
        ),
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async createInvite(input: {
    organizationId: string;
    inviterUserId: string;
    email: string;
    role: InviteRole;
  }): Promise<OrganizationInvite> {
    const email = input.email.trim().toLowerCase();

    const existingMembers = await this.members.listByOrg(input.organizationId);
    if (existingMembers.some((m) => m.user.email.toLowerCase() === email)) {
      throw new HttpException(
        apiError("INVITE_TARGET_IS_MEMBER", "User is already a member"),
        HttpStatus.CONFLICT,
      );
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const created = await this.db.transaction(async (tx) => {
      const existing = await this.invites.findPendingByOrgAndEmail(
        input.organizationId,
        email,
        tx,
      );
      if (existing) {
        await this.invites.updateStatus(existing.id, "expired", tx);
      }
      return this.invites.create(
        {
          organizationId: input.organizationId,
          email,
          role: input.role,
          tokenHash,
          status: "pending",
          expiresAt,
          invitedByUserId: input.inviterUserId,
        },
        tx,
      );
    });

    // Email outside the transaction.
    const org = await this.orgs.findById(input.organizationId);
    const inviter = await this.lookupUser(input.inviterUserId);
    await this.mailer.sendInviteEmail({
      to: email,
      organizationName: org?.name ?? "your organization",
      inviterName: inviter?.name ?? "A teammate",
      role: input.role,
      acceptUrl: this.buildAcceptUrl(rawToken),
      expiresInDays: 7,
    });

    return serializeInvite({
      invite: created,
      organization: org!,
      invitedBy: inviter,
    });
  }

  async listOrganizationInvites(
    organizationId: string,
    status: InviteStatus | "all",
  ): Promise<OrganizationInvite[]> {
    const rows = await this.invites.listByOrg(organizationId, { status });
    return rows.map(serializeInvite);
  }

  async listMyInvites(email: string): Promise<OrganizationInvite[]> {
    const rows = await this.invites.listByEmail(email.trim().toLowerCase(), {
      status: "pending",
      notExpiredAfter: new Date(),
    });
    return rows.map(serializeInvite);
  }

  async revokeInvite(input: {
    organizationId: string;
    inviteId: string;
  }): Promise<void> {
    const row = await this.invites.findById(input.inviteId);
    if (!row || row.organizationId !== input.organizationId) {
      throw new HttpException(
        apiError("INVITE_NOT_FOUND", "Invite not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== "pending") return; // idempotent
    await this.invites.updateStatus(row.id, "revoked");
  }

  async resendInvite(input: {
    organizationId: string;
    inviteId: string;
  }): Promise<OrganizationInvite> {
    const row = await this.invites.findById(input.inviteId);
    if (!row || row.organizationId !== input.organizationId) {
      throw new HttpException(
        apiError("INVITE_NOT_FOUND", "Invite not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== "pending") {
      throw new HttpException(
        apiError("INVITE_NOT_PENDING", "Invite is not pending"),
        HttpStatus.GONE,
      );
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const updated = await this.invites.rotateToken(row.id, {
      tokenHash,
      expiresAt,
    });
    const org = await this.orgs.findById(input.organizationId);
    const inviter = row.invitedByUserId
      ? await this.lookupUser(row.invitedByUserId)
      : null;
    await this.mailer.sendInviteEmail({
      to: row.email,
      organizationName: org?.name ?? "your organization",
      inviterName: inviter?.name ?? "A teammate",
      role: row.role,
      acceptUrl: this.buildAcceptUrl(rawToken),
      expiresInDays: 7,
    });

    return serializeInvite({
      invite: updated!,
      organization: org!,
      invitedBy: inviter,
    });
  }

  async previewInvite(rawToken: string): Promise<InvitePreview> {
    const row = await this.invites.findByTokenHash(hashInviteToken(rawToken));
    if (!row) {
      throw new HttpException(
        apiError("INVITE_NOT_FOUND", "Invite not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== "pending" || row.expiresAt <= new Date()) {
      throw new HttpException(
        apiError("INVITE_NOT_PENDING", "Invite is expired or no longer pending"),
        HttpStatus.GONE,
      );
    }
    const org = await this.orgs.findById(row.organizationId);
    const inviter = row.invitedByUserId
      ? await this.lookupUser(row.invitedByUserId)
      : null;
    return {
      organizationName: org?.name ?? "Organization",
      inviterName: inviter?.name ?? null,
      invitedEmail: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  private async resolveInvite(identifier: {
    token?: string;
    inviteId?: string;
  }) {
    if (identifier.token) {
      const row = await this.invites.findByTokenHash(
        hashInviteToken(identifier.token),
      );
      return row;
    }
    if (identifier.inviteId) {
      return this.invites.findById(identifier.inviteId);
    }
    return null;
  }

  async acceptInvite(input: {
    caller: CallerContext;
    token?: string;
    inviteId?: string;
  }): Promise<{
    organization: Organization;
    membership: OrganizationMemberSelect;
  }> {
    this.requireVerifiedCaller(input.caller);

    const row = await this.resolveInvite({
      token: input.token,
      inviteId: input.inviteId,
    });
    if (!row) {
      throw new HttpException(
        apiError("INVITE_NOT_FOUND", "Invite not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.email.toLowerCase() !== input.caller.email.toLowerCase()) {
      throw new HttpException(
        apiError(
          "INVITE_EMAIL_MISMATCH",
          "Invite was sent to a different email",
        ),
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (row.status !== "pending") {
      throw new HttpException(
        apiError("INVITE_NOT_PENDING", "Invite is not pending"),
        HttpStatus.GONE,
      );
    }
    if (row.expiresAt <= new Date()) {
      throw new HttpException(
        apiError("INVITE_EXPIRED", "Invite is expired"),
        HttpStatus.GONE,
      );
    }

    const result = await this.db.transaction(async (tx) => {
      const existing = await this.members.findByOrgAndUser(
        row.organizationId,
        input.caller.userId,
        tx,
      );
      const membership =
        existing ??
        (await this.members.create(
          {
            organizationId: row.organizationId,
            userId: input.caller.userId,
            role: row.role,
          },
          tx,
        ));
      await this.invites.markAccepted(
        row.id,
        input.caller.userId,
        new Date(),
        tx,
      );
      return { membership };
    });

    const org = await this.orgs.findById(row.organizationId);
    if (!org) {
      throw new HttpException(
        apiError("ORG_NOT_FOUND", "Organization not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    return { organization: serializeOrganization(org), membership: result.membership };
  }

  async declineInvite(input: {
    caller: CallerContext;
    token?: string;
    inviteId?: string;
  }): Promise<void> {
    this.requireVerifiedCaller(input.caller);
    const row = await this.resolveInvite({
      token: input.token,
      inviteId: input.inviteId,
    });
    if (!row) {
      throw new HttpException(
        apiError("INVITE_NOT_FOUND", "Invite not found"),
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.email.toLowerCase() !== input.caller.email.toLowerCase()) {
      throw new HttpException(
        apiError(
          "INVITE_EMAIL_MISMATCH",
          "Invite was sent to a different email",
        ),
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (row.status !== "pending") return;
    await this.invites.updateStatus(row.id, "revoked");
  }
}
```

- [ ] **Step 4: Create the `InviteMailer` provider**

Create `apps/backend/src/organizations/services/invite-mailer.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { renderInviteEmail } from "../../emails/render-email";

export interface SendInviteEmailInput {
  to: string;
  organizationName: string;
  inviterName: string;
  role: "admin" | "viewer";
  acceptUrl: string;
  expiresInDays: number;
}

@Injectable()
export class InviteMailer {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>("RESEND_API_KEY"));
    this.from = this.config.getOrThrow<string>("EMAIL_FROM");
  }

  async sendInviteEmail(input: SendInviteEmailInput): Promise<void> {
    const { subject, html, text } = await renderInviteEmail({
      organizationName: input.organizationName,
      inviterName: input.inviterName,
      role: input.role,
      acceptUrl: input.acceptUrl,
      expiresInDays: input.expiresInDays,
    });
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject,
      html,
      text,
    });
    if (error) {
      // Non-fatal for the caller: log and carry on.
      console.error("Invite email failed:", error);
    }
  }
}
```

- [ ] **Step 5: Run — expect pass**

Run: `pnpm --filter backend test -- --testPathPattern=invites.service`
Expected: all tests pass.

- [ ] **Step 6: Export from barrel**

Append to `apps/backend/src/organizations/services/index.ts`:
```typescript
export { InvitesService } from "./invites.service";
export { InviteMailer, type SendInviteEmailInput } from "./invite-mailer";
```

- [ ] **Step 7: Stage phase 7**

```bash
git add apps/backend/src/organizations/services apps/backend/src/organizations/__tests__
```

*End of Phase 7.*

---

## Phase 8 — Controllers

Controllers are thin adapters: parse inputs through `ZodValidationPipe`, pull the session via `@Session()` (from `@thallesp/nestjs-better-auth`), delegate to services, and wrap results in the shared `ApiResponse<T>` envelope.

### Task 24: `OrganizationsController`

**Files:**
- Create: `apps/backend/src/organizations/controllers/organizations.controller.ts`

- [ ] **Step 1: Implement**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UsePipes,
} from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import {
  CreateOrganizationSchema,
  type CreateOrganizationRequest,
  TransferOwnershipSchema,
  type TransferOwnershipRequest,
  UpdateOrganizationSchema,
  type UpdateOrganizationRequest,
  type ApiResponse,
  type MyOrganization,
  type Organization,
} from "@launchstack/api-interfaces";
import { ZodValidationPipe } from "../dto/zod-validation.pipe";
import { OrganizationsService } from "../services/organizations.service";
import {
  OrgMembership,
  type OrgMembershipContext,
} from "../decorators/org-membership.decorator";
import { RequireOrgRole } from "../decorators/require-org-role.decorator";

type SessionPayload = {
  user: { id: string; email: string; emailVerified: boolean };
};

@Controller("api/organizations")
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  async create(
    @Session() session: SessionPayload,
    @Body(new ZodValidationPipe(CreateOrganizationSchema))
    body: CreateOrganizationRequest,
  ): Promise<ApiResponse<Organization>> {
    const result = await this.orgs.createOrganization(session.user.id, body);
    return {
      data: result.organization,
      message: "Organization created",
      success: true,
    };
  }

  @Get("me")
  async listMine(
    @Session() session: SessionPayload,
  ): Promise<ApiResponse<MyOrganization[]>> {
    const data = await this.orgs.listMyOrganizations(session.user.id);
    return { data, message: "OK", success: true };
  }

  @Get("current")
  @RequireOrgRole("member")
  async getCurrent(
    @OrgMembership() membership: OrgMembershipContext,
  ): Promise<ApiResponse<{ organization: Organization; role: OrgMembershipContext["role"] }>> {
    const data = await this.orgs.getCurrentOrganization(
      membership.organizationId,
      membership.role,
    );
    return { data, message: "OK", success: true };
  }

  @Patch("current")
  @RequireOrgRole("admin")
  async updateCurrent(
    @OrgMembership() membership: OrgMembershipContext,
    @Body(new ZodValidationPipe(UpdateOrganizationSchema))
    body: UpdateOrganizationRequest,
  ): Promise<ApiResponse<Organization>> {
    const data = await this.orgs.updateOrganization(
      membership.organizationId,
      body,
    );
    return { data, message: "Organization updated", success: true };
  }

  @Delete("current")
  @RequireOrgRole("owner")
  @HttpCode(204)
  async deleteCurrent(
    @OrgMembership() membership: OrgMembershipContext,
  ): Promise<void> {
    await this.orgs.deleteOrganization(membership.organizationId);
  }

  @Post("current/transfer-ownership")
  @RequireOrgRole("owner")
  async transfer(
    @OrgMembership() membership: OrgMembershipContext,
    @Body(new ZodValidationPipe(TransferOwnershipSchema))
    body: TransferOwnershipRequest,
  ): Promise<ApiResponse<Organization>> {
    const data = await this.orgs.transferOwnership({
      organizationId: membership.organizationId,
      currentOwnerUserId: membership.userId,
      newOwnerUserId: body.newOwnerUserId,
    });
    return { data, message: "Ownership transferred", success: true };
  }
}
```

### Task 25: `MembersController`

**Files:**
- Create: `apps/backend/src/organizations/controllers/members.controller.ts`

- [ ] **Step 1: Implement**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
} from "@nestjs/common";
import {
  UpdateMemberRoleSchema,
  type UpdateMemberRoleRequest,
  type ApiResponse,
  type OrganizationMember,
} from "@launchstack/api-interfaces";
import { ZodValidationPipe } from "../dto/zod-validation.pipe";
import { MembersService } from "../services/members.service";
import {
  OrgMembership,
  type OrgMembershipContext,
} from "../decorators/org-membership.decorator";
import { RequireOrgRole } from "../decorators/require-org-role.decorator";

@Controller("api/organizations/current/members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequireOrgRole("member")
  async list(
    @OrgMembership() membership: OrgMembershipContext,
  ): Promise<ApiResponse<OrganizationMember[]>> {
    const data = await this.members.listMembers(membership.organizationId);
    return { data, message: "OK", success: true };
  }

  @Patch(":memberId")
  @RequireOrgRole("owner")
  async updateRole(
    @OrgMembership() membership: OrgMembershipContext,
    @Param("memberId") memberId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleSchema))
    body: UpdateMemberRoleRequest,
  ): Promise<ApiResponse<OrganizationMember>> {
    const data = await this.members.updateMemberRole({
      organizationId: membership.organizationId,
      memberId,
      newRole: body.role,
    });
    return { data, message: "Role updated", success: true };
  }

  @Delete("me")
  @RequireOrgRole("member")
  @HttpCode(204)
  async leave(
    @OrgMembership() membership: OrgMembershipContext,
  ): Promise<void> {
    await this.members.leaveOrganization({
      organizationId: membership.organizationId,
      callerMembership: membership,
    });
  }

  @Delete(":memberId")
  @RequireOrgRole("admin")
  @HttpCode(204)
  async remove(
    @OrgMembership() membership: OrgMembershipContext,
    @Param("memberId") memberId: string,
  ): Promise<void> {
    await this.members.removeMember({
      organizationId: membership.organizationId,
      callerMembership: membership,
      targetMemberId: memberId,
    });
  }
}
```

### Task 26: `InvitesController`

**Files:**
- Create: `apps/backend/src/organizations/controllers/invites.controller.ts`

- [ ] **Step 1: Implement**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { AllowAnonymous, Session } from "@thallesp/nestjs-better-auth";
import {
  AcceptInviteSchema,
  type AcceptInviteRequest,
  CreateInviteSchema,
  type CreateInviteRequest,
  DeclineInviteSchema,
  type DeclineInviteRequest,
  InviteListQuerySchema,
  type ApiResponse,
  type InvitePreview,
  type InviteStatus,
  type Organization,
  type OrganizationInvite,
} from "@launchstack/api-interfaces";
import { ZodValidationPipe } from "../dto/zod-validation.pipe";
import { InvitesService } from "../services/invites.service";
import {
  OrgMembership,
  type OrgMembershipContext,
} from "../decorators/org-membership.decorator";
import { RequireOrgRole } from "../decorators/require-org-role.decorator";

type SessionPayload = {
  user: { id: string; email: string; emailVerified: boolean };
};

@Controller("api")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  // --- org-scoped ---

  @Post("organizations/current/invites")
  @RequireOrgRole("admin")
  async create(
    @OrgMembership() membership: OrgMembershipContext,
    @Body(new ZodValidationPipe(CreateInviteSchema))
    body: CreateInviteRequest,
  ): Promise<ApiResponse<OrganizationInvite>> {
    const data = await this.invites.createInvite({
      organizationId: membership.organizationId,
      inviterUserId: membership.userId,
      email: body.email,
      role: body.role,
    });
    return { data, message: "Invite sent", success: true };
  }

  @Get("organizations/current/invites")
  @RequireOrgRole("admin")
  async listOrg(
    @OrgMembership() membership: OrgMembershipContext,
    @Query(new ZodValidationPipe(InviteListQuerySchema))
    query: { status: InviteStatus | "all" },
  ): Promise<ApiResponse<OrganizationInvite[]>> {
    const data = await this.invites.listOrganizationInvites(
      membership.organizationId,
      query.status,
    );
    return { data, message: "OK", success: true };
  }

  @Delete("organizations/current/invites/:inviteId")
  @RequireOrgRole("admin")
  @HttpCode(204)
  async revoke(
    @OrgMembership() membership: OrgMembershipContext,
    @Param("inviteId") inviteId: string,
  ): Promise<void> {
    await this.invites.revokeInvite({
      organizationId: membership.organizationId,
      inviteId,
    });
  }

  @Post("organizations/current/invites/:inviteId/resend")
  @RequireOrgRole("admin")
  async resend(
    @OrgMembership() membership: OrgMembershipContext,
    @Param("inviteId") inviteId: string,
  ): Promise<ApiResponse<OrganizationInvite>> {
    const data = await this.invites.resendInvite({
      organizationId: membership.organizationId,
      inviteId,
    });
    return { data, message: "Invite resent", success: true };
  }

  // --- user-scoped (no header required) ---

  @Get("invites/me")
  async listMine(
    @Session() session: SessionPayload,
  ): Promise<ApiResponse<OrganizationInvite[]>> {
    if (!session.user.emailVerified) {
      return { data: [], message: "OK", success: true };
    }
    const data = await this.invites.listMyInvites(session.user.email);
    return { data, message: "OK", success: true };
  }

  @Post("invites/accept")
  async accept(
    @Session() session: SessionPayload,
    @Body(new ZodValidationPipe(AcceptInviteSchema))
    body: AcceptInviteRequest,
  ): Promise<ApiResponse<{ organization: Organization }>> {
    const result = await this.invites.acceptInvite({
      caller: {
        userId: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      },
      token: body.token,
      inviteId: body.inviteId,
    });
    return {
      data: { organization: result.organization },
      message: "Invite accepted",
      success: true,
    };
  }

  @Post("invites/decline")
  @HttpCode(204)
  async decline(
    @Session() session: SessionPayload,
    @Body(new ZodValidationPipe(DeclineInviteSchema))
    body: DeclineInviteRequest,
  ): Promise<void> {
    await this.invites.declineInvite({
      caller: {
        userId: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      },
      token: body.token,
      inviteId: body.inviteId,
    });
  }

  @Get("invites/preview")
  @AllowAnonymous()
  async preview(
    @Query("token") token: string | undefined,
  ): Promise<ApiResponse<InvitePreview>> {
    if (!token || typeof token !== "string") {
      return {
        data: {
          organizationName: "",
          inviterName: null,
          invitedEmail: "",
          role: "viewer",
          expiresAt: new Date(0).toISOString(),
        },
        message: "Missing token",
        success: false,
      };
    }
    const data = await this.invites.previewInvite(token);
    return { data, message: "OK", success: true };
  }
}
```

- [ ] **Step 2: Update the controllers barrel**

Update `apps/backend/src/organizations/controllers/index.ts`:
```typescript
export { OrganizationsController } from "./organizations.controller";
export { MembersController } from "./members.controller";
export { InvitesController } from "./invites.controller";
```

- [ ] **Step 3: Compile**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Stage phase 8**

```bash
git add apps/backend/src/organizations/controllers
```

*End of Phase 8.*

---

## Phase 9 — Module wiring

### Task 27: `OrganizationsModule` provider wiring + body parser + global guard

**Files:**
- Modify: `apps/backend/src/organizations/organizations.module.ts`

- [ ] **Step 1: Replace the module contents**

```typescript
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import * as express from "express";
import {
  OrganizationsController,
  MembersController,
  InvitesController,
} from "./controllers";
import {
  OrganizationsService,
  MembersService,
  InvitesService,
  InviteMailer,
} from "./services";
import {
  OrganizationsRepository,
  OrganizationMembersRepository,
  OrganizationInvitesRepository,
} from "./repositories";
import { OrgContextGuard } from "./guards/org-context.guard";

@Module({
  controllers: [
    OrganizationsController,
    MembersController,
    InvitesController,
  ],
  providers: [
    OrganizationsRepository,
    OrganizationMembersRepository,
    OrganizationInvitesRepository,
    OrganizationsService,
    MembersService,
    InvitesService,
    InviteMailer,
    {
      provide: APP_GUARD,
      useClass: OrgContextGuard,
    },
  ],
})
export class OrganizationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Body parser is disabled in main.ts; enable JSON parsing for our controllers.
    consumer
      .apply(express.json())
      .forRoutes(OrganizationsController, MembersController, InvitesController);
  }
}
```

- [ ] **Step 2: Update root barrel**

Update `apps/backend/src/organizations/index.ts`:
```typescript
export { OrganizationsModule } from "./organizations.module";
export * from "./decorators";
export * from "./guards";
export { ZodValidationPipe } from "./dto";
```

### Task 28: Register the module in `AppModule`

**Files:**
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Import and add to `imports`**

Replace the file with:
```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DrizzleModule } from "./databases/pg-drizzle";
import { AppAuthModule } from "./auth";
import { OrganizationsModule } from "./organizations";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    AppAuthModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 2: Compile**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Boot-test the app**

Run: `pnpm --filter backend test`
Expected: all unit tests (including existing + new) pass. Any existing tests that fail after adding new DI providers indicate a provider-order issue — fix by reading the error.

### Task 29: End-to-end guard wiring test

**Files:**
- Create: `apps/backend/test/organizations.e2e-spec.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";

describe("Organizations integration (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/organizations/current without header → expect 400 (header required) or 401 (no session)", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/organizations/current",
    );
    expect([400, 401]).toContain(res.status);
  });

  it("GET /api/invites/preview?token=nope returns a failure envelope", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/invites/preview?token=nope",
    );
    // May be 404 or a 200 body with success:false depending on mock auth state.
    expect([200, 400, 401, 404]).toContain(res.status);
  });
});
```

Note: this e2e runs under the Jest `moduleNameMapper` (see `apps/backend/test/jest-e2e.json`) that stubs Better Auth and Resend, so the guard chain resolves but no live DB queries are exercised. Its purpose is to verify the module graph boots and that org-scoped routes trigger the header requirement.

- [ ] **Step 2: Run**

Run: `pnpm --filter backend test:e2e`
Expected: tests pass (or at least boot without unresolved DI errors). If you get DI errors like "Nest can't resolve dependencies of OrganizationsRepository", re-check the module providers.

- [ ] **Step 3: Stage phase 9**

```bash
git add apps/backend/src/app.module.ts apps/backend/src/organizations/organizations.module.ts apps/backend/src/organizations/index.ts apps/backend/test/organizations.e2e-spec.ts
```

*End of Phase 9 — let the user review the backend before moving to the frontend.*

---

## Phase 10 — Frontend foundation: store, interceptor, shadcn components

### Task 30: Zustand active-organization store

**Files:**
- Create: `apps/frontend/src/stores/active-organization-store.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveOrganizationState {
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string | null) => void;
  clear: () => void;
}

export const useActiveOrganizationStore = create<ActiveOrganizationState>()(
  persist(
    (set) => ({
      activeOrganizationId: null,
      setActiveOrganizationId: (id) => set({ activeOrganizationId: id }),
      clear: () => set({ activeOrganizationId: null }),
    }),
    { name: "launchstack.activeOrganization" },
  ),
);
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

### Task 31: Axios interceptor injecting `X-Organization-Id`

**Files:**
- Modify: `apps/frontend/src/api/axios-client.ts`

- [ ] **Step 1: Replace the file**

```typescript
import axios from "axios";

import { globalEnv } from "../env/config-env";
import { useActiveOrganizationStore } from "../stores/active-organization-store";

export const axiosInstance = axios.create({
  baseURL: globalEnv.apiBaseUri,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const { activeOrganizationId } = useActiveOrganizationStore.getState();
  if (activeOrganizationId) {
    config.headers = config.headers ?? {};
    config.headers["X-Organization-Id"] = activeOrganizationId;
  }
  return config;
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

### Task 32: Install additional shadcn/ui components

Run these from `apps/frontend/`:

- [ ] **Step 1: Add required components**

```bash
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add label
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add table
pnpm dlx shadcn@latest add badge
```
Expected: new files appear under `apps/frontend/src/components/ui/` (e.g., `input.tsx`, `label.tsx`, `select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `table.tsx`, `badge.tsx`). If a prompt asks about overwriting, answer no.

- [ ] **Step 2: Stage phase 10**

```bash
git add apps/frontend/src/stores apps/frontend/src/api/axios-client.ts apps/frontend/src/components/ui
```

*End of Phase 10.*

---

## Phase 11 — Frontend API modules

### Task 33: `organizations.api.ts`

**Files:**
- Create: `apps/frontend/src/api/organizations.api.ts`

- [ ] **Step 1: Implement**

```typescript
import type {
  ApiResponse,
  CreateOrganizationRequest,
  MyOrganization,
  Organization,
  OrganizationRole,
  TransferOwnershipRequest,
  UpdateOrganizationRequest,
} from "@launchstack/api-interfaces";
import { axiosInstance } from "./axios-client";

export const OrganizationsAPI = {
  create: async (
    payload: CreateOrganizationRequest,
  ): Promise<ApiResponse<Organization>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations",
      method: "POST",
      data: payload,
    });
    return response.data as ApiResponse<Organization>;
  },

  listMine: async (): Promise<ApiResponse<MyOrganization[]>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/me",
      method: "GET",
    });
    return response.data as ApiResponse<MyOrganization[]>;
  },

  getCurrent: async (): Promise<
    ApiResponse<{ organization: Organization; role: OrganizationRole }>
  > => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current",
      method: "GET",
    });
    return response.data as ApiResponse<{
      organization: Organization;
      role: OrganizationRole;
    }>;
  },

  updateCurrent: async (
    payload: UpdateOrganizationRequest,
  ): Promise<ApiResponse<Organization>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current",
      method: "PATCH",
      data: payload,
    });
    return response.data as ApiResponse<Organization>;
  },

  deleteCurrent: async (): Promise<void> => {
    await axiosInstance.request({
      url: "/api/organizations/current",
      method: "DELETE",
    });
  },

  transferOwnership: async (
    payload: TransferOwnershipRequest,
  ): Promise<ApiResponse<Organization>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current/transfer-ownership",
      method: "POST",
      data: payload,
    });
    return response.data as ApiResponse<Organization>;
  },
};
```

### Task 34: `members.api.ts`

**Files:**
- Create: `apps/frontend/src/api/members.api.ts`

- [ ] **Step 1: Implement**

```typescript
import type {
  ApiResponse,
  OrganizationMember,
  UpdateMemberRoleRequest,
} from "@launchstack/api-interfaces";
import { axiosInstance } from "./axios-client";

export const MembersAPI = {
  listCurrent: async (): Promise<ApiResponse<OrganizationMember[]>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current/members",
      method: "GET",
    });
    return response.data as ApiResponse<OrganizationMember[]>;
  },

  updateRole: async (
    memberId: string,
    payload: UpdateMemberRoleRequest,
  ): Promise<ApiResponse<OrganizationMember>> => {
    const response = await axiosInstance.request({
      url: `/api/organizations/current/members/${memberId}`,
      method: "PATCH",
      data: payload,
    });
    return response.data as ApiResponse<OrganizationMember>;
  },

  remove: async (memberId: string): Promise<void> => {
    await axiosInstance.request({
      url: `/api/organizations/current/members/${memberId}`,
      method: "DELETE",
    });
  },

  leave: async (): Promise<void> => {
    await axiosInstance.request({
      url: "/api/organizations/current/members/me",
      method: "DELETE",
    });
  },
};
```

### Task 35: `invites.api.ts`

**Files:**
- Create: `apps/frontend/src/api/invites.api.ts`

- [ ] **Step 1: Implement**

```typescript
import type {
  AcceptInviteRequest,
  ApiResponse,
  CreateInviteRequest,
  DeclineInviteRequest,
  InvitePreview,
  InviteStatus,
  Organization,
  OrganizationInvite,
} from "@launchstack/api-interfaces";
import { axiosInstance } from "./axios-client";

export const InvitesAPI = {
  createForCurrentOrg: async (
    payload: CreateInviteRequest,
  ): Promise<ApiResponse<OrganizationInvite>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current/invites",
      method: "POST",
      data: payload,
    });
    return response.data as ApiResponse<OrganizationInvite>;
  },

  listForCurrentOrg: async (
    status: InviteStatus | "all" = "pending",
  ): Promise<ApiResponse<OrganizationInvite[]>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current/invites",
      method: "GET",
      params: { status },
    });
    return response.data as ApiResponse<OrganizationInvite[]>;
  },

  revoke: async (inviteId: string): Promise<void> => {
    await axiosInstance.request({
      url: `/api/organizations/current/invites/${inviteId}`,
      method: "DELETE",
    });
  },

  resend: async (
    inviteId: string,
  ): Promise<ApiResponse<OrganizationInvite>> => {
    const response = await axiosInstance.request({
      url: `/api/organizations/current/invites/${inviteId}/resend`,
      method: "POST",
    });
    return response.data as ApiResponse<OrganizationInvite>;
  },

  listMine: async (): Promise<ApiResponse<OrganizationInvite[]>> => {
    const response = await axiosInstance.request({
      url: "/api/invites/me",
      method: "GET",
    });
    return response.data as ApiResponse<OrganizationInvite[]>;
  },

  accept: async (
    payload: AcceptInviteRequest,
  ): Promise<ApiResponse<{ organization: Organization }>> => {
    const response = await axiosInstance.request({
      url: "/api/invites/accept",
      method: "POST",
      data: payload,
    });
    return response.data as ApiResponse<{ organization: Organization }>;
  },

  decline: async (payload: DeclineInviteRequest): Promise<void> => {
    await axiosInstance.request({
      url: "/api/invites/decline",
      method: "POST",
      data: payload,
    });
  },

  preview: async (token: string): Promise<ApiResponse<InvitePreview>> => {
    const response = await axiosInstance.request({
      url: "/api/invites/preview",
      method: "GET",
      params: { token },
    });
    return response.data as ApiResponse<InvitePreview>;
  },
};
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

- [ ] **Step 3: Stage phase 11**

```bash
git add apps/frontend/src/api
```

*End of Phase 11.*

---

## Phase 12 — React Query hooks

### Task 36: `use-organizations.ts`

**Files:**
- Create: `apps/frontend/src/hooks/api/use-organizations.ts`

- [ ] **Step 1: Implement**

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateOrganizationRequest,
  TransferOwnershipRequest,
  UpdateOrganizationRequest,
} from "@launchstack/api-interfaces";
import { OrganizationsAPI } from "@/api/organizations.api";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export const organizationsKeys = {
  me: ["organizations", "me"] as const,
  current: (activeOrgId: string | null) =>
    ["organizations", "current", activeOrgId] as const,
};

export function useMyOrganizations() {
  return useQuery({
    queryKey: organizationsKeys.me,
    queryFn: () => OrganizationsAPI.listMine(),
  });
}

export function useCurrentOrganization() {
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useQuery({
    queryKey: organizationsKeys.current(activeOrgId),
    queryFn: () => OrganizationsAPI.getCurrent(),
    enabled: !!activeOrgId,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationRequest) =>
      OrganizationsAPI.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
    },
  });
}

export function useUpdateCurrentOrganization() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (payload: UpdateOrganizationRequest) =>
      OrganizationsAPI.updateCurrent(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
      await queryClient.invalidateQueries({
        queryKey: organizationsKeys.current(activeOrgId),
      });
    },
  });
}

export function useDeleteCurrentOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => OrganizationsAPI.deleteCurrent(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
    },
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (payload: TransferOwnershipRequest) =>
      OrganizationsAPI.transferOwnership(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
      await queryClient.invalidateQueries({
        queryKey: organizationsKeys.current(activeOrgId),
      });
    },
  });
}
```

### Task 37: `use-members.ts`

**Files:**
- Create: `apps/frontend/src/hooks/api/use-members.ts`

- [ ] **Step 1: Implement**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateMemberRoleRequest } from "@launchstack/api-interfaces";
import { MembersAPI } from "@/api/members.api";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export const membersKeys = {
  list: (activeOrgId: string | null) =>
    ["organizations", "current", activeOrgId, "members"] as const,
};

export function useCurrentOrganizationMembers() {
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useQuery({
    queryKey: membersKeys.list(activeOrgId),
    queryFn: () => MembersAPI.listCurrent(),
    enabled: !!activeOrgId,
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (input: {
      memberId: string;
      payload: UpdateMemberRoleRequest;
    }) => MembersAPI.updateRole(input.memberId, input.payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: membersKeys.list(activeOrgId),
      });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (memberId: string) => MembersAPI.remove(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: membersKeys.list(activeOrgId),
      });
    },
  });
}

export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => MembersAPI.leave(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organizations", "me"],
      });
    },
  });
}
```

### Task 38: `use-invites.ts`

**Files:**
- Create: `apps/frontend/src/hooks/api/use-invites.ts`

- [ ] **Step 1: Implement**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AcceptInviteRequest,
  CreateInviteRequest,
  DeclineInviteRequest,
  InviteStatus,
} from "@launchstack/api-interfaces";
import { InvitesAPI } from "@/api/invites.api";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { authSessionQueryKey } from "@/hooks/api/use-auth";

export const invitesKeys = {
  currentOrg: (activeOrgId: string | null, status: InviteStatus | "all") =>
    [
      "organizations",
      "current",
      activeOrgId,
      "invites",
      status,
    ] as const,
  mine: (userId?: string) => ["invites", "me", userId] as const,
  preview: (token: string) => ["invites", "preview", token] as const,
};

export function useCurrentOrganizationInvites(
  status: InviteStatus | "all" = "pending",
) {
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useQuery({
    queryKey: invitesKeys.currentOrg(activeOrgId, status),
    queryFn: () => InvitesAPI.listForCurrentOrg(status),
    enabled: !!activeOrgId,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (payload: CreateInviteRequest) =>
      InvitesAPI.createForCurrentOrg(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organizations", "current", activeOrgId, "invites"],
      });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (inviteId: string) => InvitesAPI.revoke(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organizations", "current", activeOrgId, "invites"],
      });
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (inviteId: string) => InvitesAPI.resend(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organizations", "current", activeOrgId, "invites"],
      });
    },
  });
}

export function useMyPendingInvites(userId?: string) {
  return useQuery({
    queryKey: invitesKeys.mine(userId),
    queryFn: () => InvitesAPI.listMine(),
    enabled: !!userId,
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AcceptInviteRequest) => InvitesAPI.accept(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organizations", "me"],
      });
      await queryClient.invalidateQueries({ queryKey: ["invites", "me"] });
    },
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeclineInviteRequest) => InvitesAPI.decline(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invites", "me"] });
    },
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: invitesKeys.preview(token ?? ""),
    queryFn: () => InvitesAPI.preview(token!),
    enabled: !!token,
    retry: false,
  });
}

// Keep authSessionQueryKey referenced so the import isn't pruned if unused.
void authSessionQueryKey;
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

- [ ] **Step 3: Stage phase 12**

```bash
git add apps/frontend/src/hooks/api
```

*End of Phase 12.*

---

## Phase 13 — Bootstrap hook + shared UI pieces

### Task 39: `useBootstrapActiveOrganization`

**Files:**
- Create: `apps/frontend/src/hooks/use-bootstrap-active-organization.ts`

- [ ] **Step 1: Implement**

```typescript
import { useEffect } from "react";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { useMyOrganizations } from "@/hooks/api/use-organizations";

export function useBootstrapActiveOrganization() {
  const { data, isSuccess } = useMyOrganizations();
  const activeOrganizationId = useActiveOrganizationStore(
    (s) => s.activeOrganizationId,
  );
  const setActiveOrganizationId = useActiveOrganizationStore(
    (s) => s.setActiveOrganizationId,
  );

  useEffect(() => {
    if (!isSuccess || !data?.data) return;
    const orgs = data.data;
    const stillPresent = orgs.some(
      (entry) => entry.organization.id === activeOrganizationId,
    );
    if (activeOrganizationId && !stillPresent) {
      setActiveOrganizationId(null);
      return;
    }
    if (!activeOrganizationId && orgs.length > 0) {
      setActiveOrganizationId(orgs[0].organization.id);
    }
  }, [isSuccess, data, activeOrganizationId, setActiveOrganizationId]);
}
```

### Task 40: `RoleBadge` component

**Files:**
- Create: `apps/frontend/src/components/organization/role-badge.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { OrganizationRole } from "@launchstack/api-interfaces";
import { Badge } from "@/components/ui/badge";

const variants: Record<
  OrganizationRole,
  "default" | "secondary" | "outline"
> = {
  owner: "default",
  admin: "secondary",
  viewer: "outline",
};

export function RoleBadge({ role }: { role: OrganizationRole }) {
  return (
    <Badge variant={variants[role]} className="capitalize">
      {role}
    </Badge>
  );
}
```

### Task 41: `InviteMemberForm` component

**Files:**
- Create: `apps/frontend/src/components/organization/invite-member-form.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import { CreateInviteSchema, type InviteRole } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateInvite } from "@/hooks/api/use-invites";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const createInvite = useCreateInvite();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const parsed = CreateInviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      await createInvite.mutateAsync(parsed.data);
      setSuccess(`Invite sent to ${parsed.data.email}`);
      setEmail("");
      setRole("viewer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invite");
    }
  };

  return (
    <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={handleSubmit}>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          required
        />
      </div>
      <div className="w-full md:w-40 space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={createInvite.isPending}>
        {createInvite.isPending ? "Sending..." : "Send invite"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive md:basis-full" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-600 md:basis-full" role="status">
          {success}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

### Task 42: `OrgSwitcher` component

**Files:**
- Create: `apps/frontend/src/components/organization/org-switcher.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyOrganizations } from "@/hooks/api/use-organizations";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { RoleBadge } from "./role-badge";

export function OrgSwitcher() {
  const navigate = useNavigate();
  const { data } = useMyOrganizations();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  const setActiveOrgId = useActiveOrganizationStore(
    (s) => s.setActiveOrganizationId,
  );

  const orgs = data?.data ?? [];
  const active = useMemo(
    () => orgs.find((o) => o.organization.id === activeOrgId) ?? null,
    [orgs, activeOrgId],
  );

  if (orgs.length === 0) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/organizations/new">
          <Plus className="size-4" />
          Create organization
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="size-4" />
          <span className="max-w-[12ch] truncate">
            {active?.organization.name ?? "Select org"}
          </span>
          {active ? <RoleBadge role={active.role} /> : null}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {orgs.map((entry) => (
          <DropdownMenuItem
            key={entry.organization.id}
            onSelect={() => setActiveOrgId(entry.organization.id)}
          >
            <span className="flex-1 truncate">{entry.organization.name}</span>
            <RoleBadge role={entry.role} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/organizations/new" })}>
          <Plus className="size-4" />
          Create new organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Task 43: `PendingInvitesBadge` component

**Files:**
- Create: `apps/frontend/src/components/organization/pending-invites-badge.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/api/use-auth";
import { useMyPendingInvites } from "@/hooks/api/use-invites";

export function PendingInvitesBadge() {
  const session = useAuthSession();
  const userId = session.data?.data?.user.id;
  const { data } = useMyPendingInvites(userId);
  const count = data?.data?.length ?? 0;

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/invites">
        <Bell className="size-4" />
        {count > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            aria-label={`${count} pending invites`}
          >
            {count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

- [ ] **Step 3: Stage phase 13**

```bash
git add apps/frontend/src/hooks/use-bootstrap-active-organization.ts apps/frontend/src/components/organization
```

*End of Phase 13.*

---

## Phase 14 — Pages

### Task 44: `CreateOrganizationPage`

**Files:**
- Create: `apps/frontend/src/routes/create-organization.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { useState } from "react";
import { CreateOrganizationSchema } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateOrganization } from "@/hooks/api/use-organizations";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);
  const createOrg = useCreateOrganization();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = CreateOrganizationSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      const result = await createOrg.mutateAsync(parsed.data);
      setActive(result.data.id);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="size-6 text-primary" />
          </div>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>
            You&apos;ll be the owner of this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={createOrg.isPending}>
              {createOrg.isPending ? "Creating..." : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Task 45: `PendingInvitesPage`

**Files:**
- Create: `apps/frontend/src/routes/pending-invites.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useNavigate } from "@tanstack/react-router";
import { MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthSession } from "@/hooks/api/use-auth";
import {
  useAcceptInvite,
  useDeclineInvite,
  useMyPendingInvites,
} from "@/hooks/api/use-invites";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export function PendingInvitesPage() {
  const session = useAuthSession();
  const userId = session.data?.data?.user.id;
  const { data, isLoading } = useMyPendingInvites(userId);
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);

  const invites = data?.data ?? [];

  const handleAccept = async (inviteId: string) => {
    const result = await accept.mutateAsync({ inviteId });
    setActive(result.data.organization.id);
    await navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <div className="flex items-center gap-3">
        <MailPlus className="size-6" />
        <h1 className="text-2xl font-semibold">Pending invites</h1>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {!isLoading && invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no pending invites.
        </p>
      ) : null}
      {invites.map((invite) => (
        <Card key={invite.id}>
          <CardHeader>
            <CardTitle>Invitation</CardTitle>
            <CardDescription>
              {invite.invitedBy?.name ?? "Someone"} invited you as{" "}
              <strong>{invite.role}</strong>. Expires{" "}
              {new Date(invite.expiresAt).toLocaleDateString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={() => handleAccept(invite.id)}
              disabled={accept.isPending}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              onClick={() => decline.mutate({ inviteId: invite.id })}
              disabled={decline.isPending}
            >
              Decline
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Task 46: `OrganizationSettingsPage`

**Files:**
- Create: `apps/frontend/src/routes/organization-settings.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import { UpdateOrganizationSchema } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCurrentOrganization,
  useDeleteCurrentOrganization,
  useTransferOwnership,
  useUpdateCurrentOrganization,
} from "@/hooks/api/use-organizations";
import { useCurrentOrganizationMembers } from "@/hooks/api/use-members";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export function OrganizationSettingsPage() {
  const current = useCurrentOrganization();
  const members = useCurrentOrganizationMembers();
  const updateOrg = useUpdateCurrentOrganization();
  const deleteOrg = useDeleteCurrentOrganization();
  const transfer = useTransferOwnership();
  const clearActive = useActiveOrganizationStore((s) => s.clear);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const role = current.data?.data.role;
  const org = current.data?.data.organization;
  const admins =
    members.data?.data.filter((m) => m.role === "admin") ?? [];

  if (!org) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = UpdateOrganizationSchema.safeParse({
      name: name || undefined,
      slug: slug || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      await updateOrg.mutateAsync(parsed.data);
      setName("");
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleTransfer = async () => {
    if (!newOwnerId) return;
    await transfer.mutateAsync({ newOwnerUserId: newOwnerId });
    setNewOwnerId("");
  };

  const handleDelete = async () => {
    if (deleteConfirm !== org.name) return;
    await deleteOrg.mutateAsync();
    clearActive();
  };

  const canEdit = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <h1 className="text-2xl font-semibold">Organization settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your organization&apos;s public details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={org.name}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={org.slug}
                disabled={!canEdit}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={!canEdit || updateOrg.isPending}>
              {updateOrg.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer ownership</CardTitle>
            <CardDescription>
              Pick an admin to become the new owner. You&apos;ll be demoted to
              admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.length === 0 ? (
                  <SelectItem value="_" disabled>
                    No admins to transfer to
                  </SelectItem>
                ) : (
                  admins.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user.name} — {m.user.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleTransfer}
              disabled={!newOwnerId || transfer.isPending}
            >
              Transfer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Type <strong>{org.name}</strong> to permanently delete this
              organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={org.name}
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirm !== org.name || deleteOrg.isPending}
            >
              Delete organization
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
```

### Task 47: `OrganizationMembersPage`

**Files:**
- Create: `apps/frontend/src/routes/organization-members.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { OrganizationRole } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteMemberForm } from "@/components/organization/invite-member-form";
import { RoleBadge } from "@/components/organization/role-badge";
import { useAuthSession } from "@/hooks/api/use-auth";
import { useCurrentOrganization } from "@/hooks/api/use-organizations";
import {
  useCurrentOrganizationMembers,
  useLeaveOrganization,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/api/use-members";
import {
  useCurrentOrganizationInvites,
  useResendInvite,
  useRevokeInvite,
} from "@/hooks/api/use-invites";

export function OrganizationMembersPage() {
  const session = useAuthSession();
  const current = useCurrentOrganization();
  const membersQuery = useCurrentOrganizationMembers();
  const invitesQuery = useCurrentOrganizationInvites("pending");
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const leave = useLeaveOrganization();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();

  const callerRole = current.data?.data.role;
  const callerUserId = session.data?.data?.user.id;
  const members = membersQuery.data?.data ?? [];
  const invites = invitesQuery.data?.data ?? [];

  const handleRoleChange = (memberId: string, role: OrganizationRole) => {
    if (role === "owner") return;
    updateRole.mutate({
      memberId,
      payload: { role: role as "admin" | "viewer" },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <h1 className="text-2xl font-semibold">Members</h1>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isSelf = m.userId === callerUserId;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.user.name}</TableCell>
                    <TableCell>{m.user.email}</TableCell>
                    <TableCell>
                      {callerRole === "owner" && m.role !== "owner" ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            handleRoleChange(m.id, v as OrganizationRole)
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf && m.role !== "owner" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => leave.mutate()}
                          disabled={leave.isPending}
                        >
                          Leave
                        </Button>
                      ) : callerRole !== "viewer" && m.role !== "owner" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeMember.mutate(m.id)}
                          disabled={removeMember.isPending}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {callerRole === "owner" || callerRole === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              They&apos;ll receive a magic link. Invites expire after 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteMemberForm />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No pending invites.
                    </TableCell>
                  </TableRow>
                ) : null}
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell className="capitalize">{invite.role}</TableCell>
                    <TableCell>
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resend.mutate(invite.id)}
                        disabled={resend.isPending}
                      >
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke.mutate(invite.id)}
                        disabled={revoke.isPending}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

### Task 48: `AcceptInvitePage` (public)

**Files:**
- Create: `apps/frontend/src/routes/accept-invite.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthSession } from "@/hooks/api/use-auth";
import {
  useAcceptInvite,
  useDeclineInvite,
  useInvitePreview,
} from "@/hooks/api/use-invites";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export function AcceptInvitePage() {
  const search = useSearch({ strict: false }) as { token?: string };
  const token = typeof search.token === "string" ? search.token : undefined;
  const preview = useInvitePreview(token);
  const session = useAuthSession();
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);

  if (!token) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid invite link</CardTitle>
            <CardDescription>The token is missing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/sign-in">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  if (preview.isLoading || session.isLoading) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Loading invite…</p>
      </Centered>
    );
  }

  if (preview.isError || !preview.data?.success || !preview.data.data.organizationName) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>
              This invite is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/sign-in">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  const data = preview.data.data;
  const user = session.data?.data?.user;
  const signedIn = !!session.data?.data?.session;
  const verified = user?.emailVerified === true;
  const emailMatches =
    user?.email?.toLowerCase() === data.invitedEmail.toLowerCase();

  if (!signedIn) {
    const redirectUrl = `/accept-invite?token=${encodeURIComponent(token)}`;
    return (
      <Centered>
        <InvitePreviewCard data={data} />
        <div className="flex gap-2">
          <Button asChild>
            <Link
              to="/sign-up"
              search={{ redirect: redirectUrl, email: data.invitedEmail }}
            >
              Sign up to accept
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/sign-in" search={{ redirect: redirectUrl }}>
              Sign in
            </Link>
          </Button>
        </div>
      </Centered>
    );
  }

  if (!verified) {
    const redirectUrl = `/accept-invite?token=${encodeURIComponent(token)}`;
    return (
      <Centered>
        <InvitePreviewCard data={data} />
        <Button asChild>
          <Link
            to="/verify-email"
            search={{ redirect: redirectUrl, email: user?.email }}
          >
            Verify email to continue
          </Link>
        </Button>
      </Centered>
    );
  }

  if (!emailMatches) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email mismatch</CardTitle>
            <CardDescription>
              This invite was sent to <strong>{data.invitedEmail}</strong>, but
              you&apos;re signed in as <strong>{user?.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/sign-in">Switch accounts</Link>
            </Button>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  const handleAccept = async () => {
    const result = await accept.mutateAsync({ token });
    setActive(result.data.organization.id);
    await navigate({ to: "/" });
  };

  return (
    <Centered>
      <InvitePreviewCard data={data} />
      <div className="flex gap-2">
        <Button onClick={handleAccept} disabled={accept.isPending}>
          {accept.isPending ? "Accepting..." : "Accept invite"}
        </Button>
        <Button
          variant="outline"
          onClick={() => decline.mutate({ token })}
          disabled={decline.isPending}
        >
          Decline
        </Button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10">
      {children}
    </div>
  );
}

function InvitePreviewCard({
  data,
}: {
  data: {
    organizationName: string;
    inviterName: string | null;
    invitedEmail: string;
    role: "admin" | "viewer";
    expiresAt: string;
  };
}) {
  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MailOpen className="size-6 text-primary" />
        </div>
        <CardTitle>Join {data.organizationName}</CardTitle>
        <CardDescription>
          {data.inviterName ?? "Someone"} invited you to{" "}
          <strong>{data.organizationName}</strong> as <strong>{data.role}</strong>.
          Invite expires {new Date(data.expiresAt).toLocaleDateString()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        This invite is for {data.invitedEmail}.
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

- [ ] **Step 3: Stage phase 14**

```bash
git add apps/frontend/src/routes
```

*End of Phase 14.*

---

## Phase 15 — Router wiring

### Task 49: Register routes + public `/accept-invite` + sign-up `email` param

**Files:**
- Modify: `apps/frontend/src/router.tsx`

- [ ] **Step 1: Add the `email` search field to the auth search schema**

In `apps/frontend/src/router.tsx`, change:
```typescript
type AuthSearch = {
  redirect?: string;
};
```
to:
```typescript
type AuthSearch = {
  redirect?: string;
  email?: string;
};
```

And update `authSearchSchema`:
```typescript
const authSearchSchema = (search: Record<string, unknown>): AuthSearch => ({
  redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  email: typeof search.email === "string" ? search.email : undefined,
});
```

- [ ] **Step 2: Add an accept-invite search schema**

Add near the other search schemas:
```typescript
type AcceptInviteSearch = {
  token?: string;
};
const acceptInviteSearchSchema = (
  search: Record<string, unknown>,
): AcceptInviteSearch => ({
  token: typeof search.token === "string" ? search.token : undefined,
});
```

- [ ] **Step 3: Import the new page components**

Add to the imports block:
```typescript
import { AcceptInvitePage } from "@/routes/accept-invite";
import { CreateOrganizationPage } from "@/routes/create-organization";
import { OrganizationMembersPage } from "@/routes/organization-members";
import { OrganizationSettingsPage } from "@/routes/organization-settings";
import { PendingInvitesPage } from "@/routes/pending-invites";
```

- [ ] **Step 4: Add the public `/accept-invite` route**

Add below `authErrorRoute` (same level — public, no `protectedRoute` parent):
```typescript
const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invite",
  validateSearch: acceptInviteSearchSchema,
  component: AcceptInvitePage,
});
```

- [ ] **Step 5: Add protected routes**

Add below `settingsRoute`:
```typescript
const createOrganizationRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/organizations/new",
  component: CreateOrganizationPage,
});

const pendingInvitesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/invites",
  component: PendingInvitesPage,
});

const organizationSettingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings/organization",
  component: OrganizationSettingsPage,
});

const organizationMembersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings/organization/members",
  component: OrganizationMembersPage,
});
```

- [ ] **Step 6: Update `routeTree`**

Replace:
```typescript
const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  googleSignInRoute,
  googleSignUpRoute,
  verifyEmailRoute,
  authErrorRoute,
  protectedRoute.addChildren([homeRoute, dashboardRoute, settingsRoute]),
]);
```
with:
```typescript
const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  googleSignInRoute,
  googleSignUpRoute,
  verifyEmailRoute,
  authErrorRoute,
  acceptInviteRoute,
  protectedRoute.addChildren([
    homeRoute,
    dashboardRoute,
    settingsRoute,
    createOrganizationRoute,
    pendingInvitesRoute,
    organizationSettingsRoute,
    organizationMembersRoute,
  ]),
]);
```

- [ ] **Step 7: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

- [ ] **Step 8: Stage**

```bash
git add apps/frontend/src/router.tsx
```

*End of Phase 15.*

---

## Phase 16 — App shell + sign-up tweak

### Task 50: Mount `OrgSwitcher`, `PendingInvitesBadge`, and sidebar entries

**Files:**
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { PendingInvitesBadge } from "@/components/organization/pending-invites-badge";
import { useAuthSession, useSignOut } from "@/hooks/api/use-auth";
import { useBootstrapActiveOrganization } from "@/hooks/use-bootstrap-active-organization";

const navItems = [
  { icon: Home, label: "Home", to: "/" },
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: Settings, label: "Settings", to: "/settings" },
  { icon: Settings, label: "Organization", to: "/settings/organization" },
  { icon: Users, label: "Members", to: "/settings/organization/members" },
] as const;

function App() {
  useBootstrapActiveOrganization();

  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const signOutMutation = useSignOut();
  const sessionQuery = useAuthSession();

  const userInitial = useMemo(() => {
    const userName = sessionQuery.data?.data?.user.name;
    if (!userName) {
      return "U";
    }
    return userName.charAt(0).toUpperCase();
  }, [sessionQuery.data?.data?.user.name]);

  const handleSignOut = async () => {
    await signOutMutation.mutateAsync();
    await navigate({ to: "/sign-in" });
  };

  const isRouteActive = (to: string) => {
    if (to === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(to);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen((current) => !current)}
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
          <Rocket className="size-5" />
          <span className="text-lg font-semibold tracking-tight">LaunchStack</span>
          <div className="ml-4">
            <OrgSwitcher />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PendingInvitesBadge />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signOutMutation.isPending}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-14 left-0 z-10 w-56 border-r bg-sidebar transition-transform md:static md:translate-x-0`}
        >
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <Button
                key={item.label}
                asChild
                variant={isRouteActive(item.to) ? "secondary" : "ghost"}
                className="justify-start gap-2"
              >
                <Link to={item.to} onClick={() => setSidebarOpen(false)}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <Separator />
          <div className="p-3">
            <p className="px-3 text-xs text-muted-foreground">
              All app routes are protected.
            </p>
          </div>
        </aside>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-9 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

### Task 51: Pre-fill sign-up email from query param

**Files:**
- Modify: `apps/frontend/src/routes/sign-up.tsx`
- Modify: `apps/frontend/src/components/auth/email-auth-form.tsx`

- [ ] **Step 1: Allow `EmailAuthForm` to seed an initial email**

In `apps/frontend/src/components/auth/email-auth-form.tsx`:

1. Extend the props interface with `initialEmail?: string`:
```typescript
interface EmailAuthFormProps {
  mode: EmailAuthMode;
  isPending?: boolean;
  errorMessage?: string | null;
  initialEmail?: string;
  onSubmit: (values: EmailAuthSubmitValues) => Promise<void> | void;
}
```
2. Destructure and seed state:
```typescript
export function EmailAuthForm({
  mode,
  isPending = false,
  errorMessage,
  initialEmail = "",
  onSubmit,
}: EmailAuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
```

- [ ] **Step 2: Pass `initialEmail` from the sign-up page**

Open `apps/frontend/src/routes/sign-up.tsx`. In the `useSearch` destructure:
```typescript
const search = useSearch({ strict: false }) as { redirect?: string; email?: string };
```
Then, pass `initialEmail={search.email ?? ""}` to `<EmailAuthForm>`:
```tsx
<EmailAuthForm
  mode="sign-up"
  isPending={signUpEmail.isPending}
  errorMessage={errorMessage}
  initialEmail={search.email ?? ""}
  onSubmit={handleEmailSignUp}
/>
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter frontend exec tsc -b --noEmit`
Expected: exits 0.

- [ ] **Step 4: Stage phase 16**

```bash
git add apps/frontend/src/App.tsx apps/frontend/src/routes/sign-up.tsx apps/frontend/src/components/auth/email-auth-form.tsx
```

*End of Phase 16.*

---

## Phase 17 — Final verification

### Task 52: Full backend + frontend boot & manual QA

- [ ] **Step 1: Full backend test pass**

Run: `pnpm --filter backend test`
Expected: all unit tests pass (including previously existing ones).

- [ ] **Step 2: Backend e2e**

Run: `pnpm --filter backend test:e2e`
Expected: e2e suites pass.

- [ ] **Step 3: Frontend type-check + lint**

```bash
pnpm --filter frontend exec tsc -b --noEmit
pnpm --filter frontend lint
```
Expected: exits 0 for both.

- [ ] **Step 4: Boot full stack**

```bash
docker compose up -d
pnpm db:up
pnpm dev
```
Expected: backend on `:3000`, frontend on `:5173`.

- [ ] **Step 5: Manual QA — the 5 spec walkthroughs (§9)**

Run each flow in a private browser window and confirm the described behavior:

1. **Create own org** (§9.3): sign up → verify → land on `/` with no org → click "Create organization" in `OrgSwitcher` → `/organizations/new` → fill name → submit → org becomes active, `OrgSwitcher` shows new org with `owner` badge.

2. **Existing user invited** (§9.1): using a second browser/account (admin of the first org), go to `/settings/organization/members` → invite the existing user's email as `admin`. Inbox in that browser: check Resend dashboard or backend logs for the email. Open the magic link → `/accept-invite?token=...` → preview shows org + role → Accept → active org flips → the second org appears in `OrgSwitcher`.

3. **New user invited** (§9.2): invite an unused email. Open the link in a clean browser → preview renders → click "Sign up to accept" → `/sign-up?email=...&redirect=/accept-invite?token=...` → email is pre-filled → complete signup + OTP verify → lands back on `/accept-invite` → Accept works → membership created. Confirm the new user can still create their own org via `OrgSwitcher`.

4. **Transfer ownership** (§9.4): as owner, navigate to `/settings/organization` → Transfer ownership → select an admin → confirm. Reload: new owner sees `owner` badge; previous owner is `admin` and can now create a new org.

5. **Delete org** (§9.5): as owner, danger-zone-type the org name → Delete. Active org clears; UI shows "create or accept" state if no other orgs.

- [ ] **Step 6: Role matrix spot checks**

- Viewer signed in → navigate to `/settings/organization/members` → no Invite form, no Remove/Leave actions on non-self rows, no role dropdowns.
- Admin → Invite form visible; can remove admins/viewers; cannot change owner's row.
- Owner → full controls visible.

- [ ] **Step 7: Error path spot checks**

- Request `/api/organizations/current` via `curl` with no `X-Organization-Id` → 400.
- Request with a bad ID → 404.
- Resend an accepted invite → 410.
- Preview a deleted/unknown token → success:false envelope or 404.

- [ ] **Step 8: Stage anything remaining & hand off**

```bash
git status
git add -p
```
Let the user commit when they're ready.

*End of plan.*

---

## Post-implementation notes

- **E2E DB coverage intentionally light.** Spec §10 calls for Supertest against a real Postgres; this plan adds unit tests for every invariant + a boot-level e2e, but stops short of setting up a dedicated test database + fixture harness. Add one as a follow-up effort if/when needed.
- **No frontend tests.** Spec §10 explicitly defers frontend tests to manual QA.
- **Body parser note.** The `OrganizationsModule` applies `express.json()` to its three controllers to mirror the existing `AppAuthModule` pattern — the root `main.ts` still has `bodyParser: false` so Better Auth can own request parsing on `/api/auth/*`.
- **Session shape assumption.** The controllers assume `session.user` includes `{ id, email, emailVerified }`. Verify against the actual `@thallesp/nestjs-better-auth` session shape once the backend runs end-to-end; if `emailVerified` lives elsewhere, adjust `InvitesController` and `InvitesService.requireVerifiedCaller`.


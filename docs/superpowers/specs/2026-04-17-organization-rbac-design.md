# Organizations & Role-Based Access Control — Design Spec

**Status:** Approved for implementation planning
**Date:** 2026-04-17
**Scope:** Add first-class organization model with owner/admin/viewer roles, a magic-link invite flow, and a NestJS-side access control layer. Better Auth continues to handle authentication only — all authorization lives in application code.

---

## 1. Goals

- Any authenticated user can create **at most one** organization and be its owner.
- A user can be an **admin** or **viewer** in any number of organizations concurrently.
- Owners can invite anyone by email via a signed magic link. Invites work for both existing users and users who haven't signed up yet.
- The same user can own their own org and simultaneously be admin/viewer in others.
- All org-scoped access control is enforced by NestJS (decorator + guard). Better Auth is used solely to establish *who the caller is*.

## 2. Non-goals

- Per-resource ACLs beyond the three roles.
- Billing, plans, or seats.
- Audit log UI (the DB is rich enough to build one later, but no UI in this cut).
- Org avatars/logos (can be added later on the settings page).

## 3. Role semantics

| Action | Owner | Admin | Viewer |
|---|:---:|:---:|:---:|
| View org details & member list | ✓ | ✓ | ✓ |
| Update org profile (name, slug) | ✓ | ✓ | ✗ |
| Delete organization | ✓ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ |
| Invite members (as admin or viewer; never as owner) | ✓ | ✓ | ✗ |
| Revoke / resend pending invites | ✓ | ✓ | ✗ |
| Change another member's role | ✓ | ✗ | ✗ |
| Remove members (not self) | ✓ (anyone) | ✓ (admins, viewers — not owner) | ✗ |
| Leave organization | ✗ (must transfer or delete) | ✓ | ✓ |

## 4. Architectural decisions

| # | Decision |
|---|---|
| 1 | **Role model:** Owner = full control. Admin = member management + org profile edit. Viewer = read-only. |
| 2 | **Org scoping:** Header-scoped via `X-Organization-Id`. URLs stay un-scoped; a NestJS guard reads the header and enforces role. |
| 3 | **Invite discovery:** Signed magic link email *plus* an in-app pending-invites inbox. |
| 4 | **Ownership lifecycle:** DB-level `UNIQUE(ownerId)` on `organizations`. Ownership is transferable (old owner demoted to `admin`); deletion cascades. |
| 5 | **Invite tokens:** DB-backed random 32-byte tokens, hashed at rest (SHA-256). 7-day expiry. Single-use. Revocable. Duplicate invite for the same `(org, email)` flips the old row to `expired` and inserts a new row (audit-preserving). |
| 6 | **RBAC enforcement:** Decorator + Guard (`@RequireOrgRole(...)`). Idiomatic NestJS; matches the existing `@AllowAnonymous()` / `@OptionalAuth()` style from `@thallesp/nestjs-better-auth`. |
| 7 | **DTO validation:** Zod schemas, defined once in `@launchstack/api-interfaces` and shared between backend (validation pipe) and frontend (form validation + inferred types). |
| 8 | **Frontend state:** Active organization stored in a Zustand store with `persist` middleware to localStorage. Axios request interceptor reads from the store and injects `X-Organization-Id`. |

---

## 5. Database schema

All new tables live in `apps/backend/src/databases/pg-drizzle/schema.ts` (the application schema — **not** the `auth` schema). Cross-schema foreign keys to `auth.user(id)` are supported natively by Postgres.

All datetime columns use `timestamp with time zone` (i.e., `timestamp(..., { withTimezone: true })`). Note: Better Auth's existing tables use plain `timestamp`; this is a deliberate split accepted for the new app tables.

Table names are plural (`organizations`, `organization_members`, `organization_invites`). Column names are `snake_case` in the DB; Drizzle schema identifiers are `camelCase`.

### 5.1 `organizations`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `name` | `text` | `NOT NULL` |
| `slug` | `text` | `NOT NULL`, `UNIQUE` — URL-safe, auto-generated from `name` + 6-char random suffix (e.g., `acme-inc-k3h9pd`). Editable post-creation while preserving uniqueness. |
| `owner_id` | `text` | `NOT NULL`, FK → `auth.user(id)` `ON DELETE RESTRICT` |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()`, `$onUpdate` |

**Additional constraint:** `UNIQUE(owner_id)` — enforces one owned organization per user at the DB level.

**Delete behavior on `owner_id`:** `RESTRICT`. A user who owns an organization cannot be deleted until they transfer ownership or delete the org. This is deliberate — it prevents orphaned orgs and makes deletion a conscious business operation.

### 5.2 `organization_members`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `organization_id` | `uuid` | `NOT NULL`, FK → `organizations(id)` `ON DELETE CASCADE` |
| `user_id` | `text` | `NOT NULL`, FK → `auth.user(id)` `ON DELETE CASCADE` |
| `role` | `organization_role` (pgEnum: `'owner' \| 'admin' \| 'viewer'`) | `NOT NULL` |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` |

**Constraints:**
- `UNIQUE(organization_id, user_id)` — one membership row per user per org.
- Index on `user_id` — for the "list my organizations" query.

**Intentional denormalization:** The owner of an org is also present here with `role = 'owner'`. This keeps the membership-check query uniform (always one `join organization_members`), and the DB-level `UNIQUE(owner_id)` on `organizations` plus the invariants maintained by the service layer keep the two stores consistent.

### 5.3 `organization_invites`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `organization_id` | `uuid` | `NOT NULL`, FK → `organizations(id)` `ON DELETE CASCADE` |
| `email` | `text` | `NOT NULL` — always stored lowercased |
| `role` | `invite_role` (pgEnum: `'admin' \| 'viewer'`) | `NOT NULL` — owner role cannot be invited |
| `token_hash` | `text` | `NOT NULL`, `UNIQUE` — SHA-256 hex of the raw token |
| `status` | `invite_status` (pgEnum: `'pending' \| 'accepted' \| 'revoked' \| 'expired'`) | `NOT NULL`, `DEFAULT 'pending'` |
| `expires_at` | `timestamptz` | `NOT NULL` — default at insert: `now() + interval '7 days'` |
| `invited_by_user_id` | `text` | FK → `auth.user(id)` `ON DELETE SET NULL` (preserves audit after inviter is deleted) |
| `accepted_by_user_id` | `text` | FK → `auth.user(id)` `ON DELETE SET NULL`, nullable until accepted |
| `accepted_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()`, `$onUpdate` |

**Constraints:**
- Unique index on `token_hash` — fast lookup by token.
- Partial unique index: `UNIQUE(organization_id, email) WHERE status = 'pending'` — guarantees at most one *live* invite per (org, email). The duplicate-invite flow (flip old → `expired`, insert new) runs inside a single transaction so the partial index stays satisfied at every step.
- Index on `email` — powers the "invites for me" inbox (matched against the signed-in user's verified email).
- Index on `organization_id` — for "list invites in this org".

### 5.4 Token storage

1. At invite creation, generate 32 random bytes and URL-safe-base64 encode them → this is the **raw token** `T`. It appears once, in the email link: `<FRONTEND_URL>/accept-invite?token=<T>`.
2. Store `sha256_hex(T)` in `token_hash`. The plaintext token is never persisted.
3. At verification, hash the incoming token and look up by `token_hash`. Standard pattern — a DB compromise does not leak usable invite URLs.

### 5.5 Drizzle relations

```
organizations.owner             → user           (one)
organizations.members           → organization_members  (many)
organizations.invites           → organization_invites  (many)
organization_members.user       → user           (one)
organization_members.organization → organizations (one)
organization_invites.organization → organizations (one)
organization_invites.inviter    → user           (one, nullable)
organization_invites.accepter   → user           (one, nullable)
```

### 5.6 Migrations

One new Drizzle migration generated via `pnpm db:generate`, e.g. `2026xxxx_add_organizations.ts`. No data backfill required — clean slate. The migration creates the three pgEnum types, three tables, unique constraints, partial unique index, and all FK/indexes listed above.

---

## 6. Backend APIs

### 6.1 Module structure

```
apps/backend/src/organizations/
  index.ts                        # Re-exports module (and any public types)
  organizations.module.ts
  controllers/
    index.ts                      # Barrel — re-exports every controller
    organizations.controller.ts   # Org CRUD + my-orgs list + current-org details + transfer
    members.controller.ts         # Member read/update-role/remove/leave
    invites.controller.ts         # Invite org-scoped + user-scoped + public preview
  services/
    index.ts
    organizations.service.ts      # Core org/membership/transfer/delete business rules
    members.service.ts            # Member management + role invariants
    invites.service.ts            # Token gen + hash + email dispatch + accept/decline flow
  repositories/
    index.ts
    organizations.repository.ts   # All Drizzle queries against `organizations`
    members.repository.ts         # All Drizzle queries against `organization_members`
    invites.repository.ts         # All Drizzle queries against `organization_invites`
  guards/
    index.ts
    org-context.guard.ts
  decorators/
    index.ts
    require-org-role.decorator.ts
    org-membership.decorator.ts
  dto/
    index.ts                      # Re-exports Zod schemas + inferred types from @launchstack/api-interfaces; hosts tiny pipe adapters
```

Every folder has an `index.ts` barrel. Other files import from the folder (e.g., `import { OrganizationsRepository } from '../repositories';`) rather than from specific files — the barrel is the stable public surface.

`OrganizationsModule` is imported by `AppModule` alongside `AppAuthModule`. It depends on `DRIZZLE_DB` (already provided globally) and `ConfigService`.

### 6.1.1 Layering rules

The module follows a strict controller → service → repository flow:

- **Controllers** depend only on services (and decorators/guards). They are thin — parse input, delegate, shape response.
- **Services** depend only on repositories, other services, and `ConfigService`/Resend/etc. They hold business logic, invariants, and cross-entity transactions.
- **Repositories** are the *only* layer that touches Drizzle (the `DRIZZLE_DB` token). They expose method-style access to one table each, taking IDs/filters and returning rows or typed summaries. They do not contain business logic.
- Repositories accept an optional transaction handle so services can compose multiple repository calls into a single atomic transaction (transfer ownership, accept invite, duplicate-invite flow all need this).
- Cross-module DB access is forbidden — every module owns its tables. Any cross-feature query lives in a service that composes repositories from the owning modules.

### 6.1.2 Repository responsibilities

Each repository receives `@Inject(DRIZZLE_DB) db` in its constructor. Every mutating method accepts an optional `tx?: DrizzleTransaction` parameter; when provided the method runs inside that transaction, otherwise it runs on `db` directly.

**`OrganizationsRepository`**
- `findById(id)`
- `findBySlug(slug)`
- `findByOwnerId(userId)` — enforces the "does this user already own an org" check
- `create(input, tx?)`
- `update(id, patch, tx?)`
- `delete(id, tx?)` — cascades via FK to members + invites
- `setOwner(id, newOwnerId, tx?)` — used by transfer ownership

**`OrganizationMembersRepository`**
- `findByOrgAndUser(orgId, userId)` — used by `OrgContextGuard`
- `listByOrg(orgId)` — joins `auth.user` for display fields
- `listByUser(userId)` — powers `GET /api/organizations/me`
- `create(input, tx?)`
- `updateRole(id, role, tx?)`
- `delete(id, tx?)`
- `deleteByOrgAndUser(orgId, userId, tx?)` — used by the "leave" endpoint

**`OrganizationInvitesRepository`**
- `findById(id)`
- `findByTokenHash(hash)`
- `findPendingByOrgAndEmail(orgId, email)` — used by duplicate-invite flow
- `listByOrg(orgId, { status })`
- `listByEmail(email, { status })` — powers `GET /api/invites/me`
- `create(input, tx?)`
- `updateStatus(id, status, tx?)`
- `rotateToken(id, { tokenHash, expiresAt }, tx?)` — used by resend
- `markAccepted(id, userId, tx?)` — bundles `status='accepted'` + `accepted_by_user_id` + `accepted_at`

### 6.2 Access control layer

**`OrgContextGuard`** — global guard, runs after Better Auth's auth guard:

1. If the route handler does **not** have `@RequireOrgRole(...)` metadata, the guard is a no-op (the endpoint is not org-scoped).
2. If it does, require a Better Auth session (guaranteed by the upstream auth guard unless `@AllowAnonymous()` was used; using both together is a configuration error).
3. Read the `X-Organization-Id` header. Missing or malformed → **400**.
4. Look up `organization_members` by `(organizationId, userId)`.
   - No row → **404** (do not distinguish "org doesn't exist" from "you aren't in it" to avoid enumeration).
5. Compare `role` against the required level:
   - `'member'` — any of owner, admin, viewer.
   - `'admin'` — owner or admin.
   - `'owner'` — owner only.
   - Insufficient → **403**.
6. Attach `req.orgMembership = { organizationId, userId, role }`.

**`@RequireOrgRole(level: 'owner' | 'admin' | 'member')`** — a `SetMetadata` decorator used by `OrgContextGuard`.

**`@OrgMembership()`** — param decorator that returns `req.orgMembership` on validated handlers.

### 6.3 Endpoint map

Common response envelope is the project's `ApiResponse<T> = { data: T, message: string, success: boolean }`.

#### 6.3.1 Organizations (user-level — no header required)

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `POST` | `/api/organizations` | session | Body: `{ name: string }`. Inserts `organizations` row with caller as owner, inserts matching `organization_members` row with `role='owner'`. Slug derived from `name` plus a short random suffix. **409** if the caller already owns an org. |
| `GET` | `/api/organizations/me` | session | Returns a list of `{ organization, role }` for every org the caller is a member of. |

#### 6.3.2 Current organization (org-scoped; `X-Organization-Id` required)

| Method | Path | Role | Behavior |
|---|---|---|---|
| `GET` | `/api/organizations/current` | `member` | Returns the active org details plus caller's role. |
| `PATCH` | `/api/organizations/current` | `admin` | Body: `{ name?, slug? }`. Slug must remain unique; **409** on conflict. |
| `DELETE` | `/api/organizations/current` | `owner` | Deletes org (cascades memberships + invites). |
| `POST` | `/api/organizations/current/transfer-ownership` | `owner` | Body: `{ newOwnerUserId }`. Preconditions (all enforced in a single transaction): target is an existing `admin` in this org; target does not currently own another org. Effect: `organizations.owner_id` is flipped; the old owner's member row becomes `role='admin'`; the target's member row becomes `role='owner'`. |

#### 6.3.3 Members (org-scoped)

| Method | Path | Role | Behavior |
|---|---|---|---|
| `GET` | `/api/organizations/current/members` | `member` | List members with user details + role. |
| `PATCH` | `/api/organizations/current/members/:memberId` | `owner` | Body: `{ role: 'admin' \| 'viewer' }`. **409** if target is the owner (must use transfer endpoint). |
| `DELETE` | `/api/organizations/current/members/:memberId` | `admin` | Owner can remove anyone except self. Admin can remove admins/viewers — not the owner, not self. **403** for other cases. |
| `DELETE` | `/api/organizations/current/members/me` | `admin`/`viewer` | Caller leaves the org. **409** if caller is owner (must transfer/delete). |

#### 6.3.4 Invites — organization-scoped (header required)

| Method | Path | Role | Behavior |
|---|---|---|---|
| `POST` | `/api/organizations/current/invites` | `admin` | Body: `{ email, role: 'admin' \| 'viewer' }`. Email is lowercased. Transaction: (1) if a pending invite exists for `(orgId, email)`, flip its `status` to `'expired'`; (2) generate raw token `T`; (3) insert a new row with `token_hash = sha256(T)`, `expires_at = now() + 7d`, `invited_by_user_id = session.user.id`, `status='pending'`. Outside the transaction: send the email. **409** if the email already belongs to a current member of this org. |
| `GET` | `/api/organizations/current/invites` | `admin` | Query: `?status=pending\|accepted\|revoked\|expired\|all` (default `pending`). Returns invites for the active org. |
| `DELETE` | `/api/organizations/current/invites/:inviteId` | `admin` | Revoke a pending invite (`status='revoked'`). Idempotent on non-pending invites (returns the current state). |
| `POST` | `/api/organizations/current/invites/:inviteId/resend` | `admin` | Only valid for `pending`. Rotates token (new `token_hash`), resets `expires_at` to `now() + 7d`, dispatches a new email. |

#### 6.3.5 Invites — user-level (header **not** required)

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `GET` | `/api/invites/me` | session, `emailVerified=true` | Lists pending, non-expired invites whose `email` matches the caller's verified email. Joins org name + inviter name for display. |
| `POST` | `/api/invites/accept` | session, `emailVerified=true` | Body: `{ token }` (from magic link) or `{ inviteId }` (from in-app inbox). Validates: status=`pending`, not expired, and `lower(invite.email) === lower(session.user.email)`. Transaction: insert `organization_members` row with the invite's `role`; on `UNIQUE(organization_id, user_id)` conflict the caller is already a member — flip the invite to `accepted` anyway (idempotent outcome) and return the existing membership. Otherwise flip invite to `accepted`, set `accepted_by_user_id` and `accepted_at`. Returns the joined organization so the frontend can promote it to active. |
| `POST` | `/api/invites/decline` | session, `emailVerified=true` | Body: `{ token }` or `{ inviteId }`. Same matching rules as accept. Flips status to `'revoked'`. |
| `GET` | `/api/invites/preview` | **public** | Query: `?token=<raw>`. Returns `{ organizationName, inviterName, invitedEmail, role, expiresAt }` for the magic-link landing page. No session required — lets a new user see who invited them before signing up. Emits **404** for unknown tokens; **410** for expired/non-pending. |

### 6.4 Validation

A `ZodValidationPipe` takes a Zod schema and produces a NestJS pipe; invalid bodies produce **400** with the Zod error formatted into `ApiError`. Schemas are defined once in `@launchstack/api-interfaces/src/requests/organization.requests.ts` and imported by both the backend (validation) and the frontend (form validation + inferred TypeScript types).

### 6.5 Error code conventions

| HTTP | When |
|---|---|
| 400 | Zod validation failure; missing or malformed `X-Organization-Id`; malformed token |
| 401 | No Better Auth session |
| 403 | Session valid but role insufficient |
| 404 | Org not found OR caller not a member; invite not found |
| 409 | Already own an org; target already a member; owner trying to leave; invalid transfer target; slug conflict |
| 410 | Invite not `pending` (expired/accepted/revoked) |
| 422 | Invite email does not match caller's verified email |

All errors follow the shared `ApiError = { code, message, details? }` shape.

### 6.6 Email delivery

A new React Email template `apps/backend/src/emails/invite-email.tsx`, rendered via the same `renderEmail` helper used for OTPs. Email content: organization name, inviter name, role, expiry, and a CTA button linking to `<FRONTEND_URL>/accept-invite?token=<raw>`. A plaintext fallback with the same link is included. Dispatched via the existing Resend integration using `EMAIL_FROM`.

### 6.7 Email verification gate

Accepting or declining an invite requires `auth.user.emailVerified = true`. Enforced at the service layer. A new user arriving via magic link is routed through the existing `/verify-email` OTP flow (which already preserves a `redirect` query param) and lands back on `/accept-invite?token=...` after verification.

---

## 7. Shared types — `@launchstack/api-interfaces`

Two new files:

```
packages/api-interfaces/src/
  requests/
    organization.requests.ts
  responses/
    organization.responses.ts
```

**`organization.requests.ts`** exports Zod schemas *and* inferred types:
- `CreateOrganizationSchema` / `CreateOrganizationRequest`
- `UpdateOrganizationSchema` / `UpdateOrganizationRequest`
- `TransferOwnershipSchema` / `TransferOwnershipRequest`
- `UpdateMemberRoleSchema` / `UpdateMemberRoleRequest`
- `CreateInviteSchema` / `CreateInviteRequest`
- `AcceptInviteSchema` / `AcceptInviteRequest`
- `DeclineInviteSchema` / `DeclineInviteRequest`

**`organization.responses.ts`** exports response shapes:
- `Organization` — `{ id, name, slug, ownerId, createdAt, updatedAt }` (dates as ISO strings over the wire)
- `OrganizationMember` — `{ id, organizationId, userId, role, user: { id, name, email, image? }, createdAt }`
- `OrganizationInvite` — `{ id, organizationId, email, role, status, expiresAt, createdAt, invitedBy: { id, name, email } | null, acceptedBy: { id, name, email } | null, acceptedAt? }`
- `InvitePreview` — `{ organizationName, inviterName, invitedEmail, role, expiresAt }`
- `MyOrganization` — `{ organization: Organization, role: OrganizationRole }`
- `OrganizationRole` — `'owner' | 'admin' | 'viewer'`
- `InviteRole` — `'admin' | 'viewer'`
- `InviteStatus` — `'pending' | 'accepted' | 'revoked' | 'expired'`

Both files are re-exported from `packages/api-interfaces/src/index.ts`.

---

## 8. Frontend minimal scaffold

### 8.1 Active organization store — Zustand

New `apps/frontend/src/stores/active-organization-store.ts`:

```ts
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

No provider wrapping needed. Axios and React components both read from the store directly.

### 8.2 Axios interceptor — `src/api/axios-client.ts`

Extend the existing instance with a request interceptor that pulls the active org ID from the Zustand store and injects the header. The interceptor reads from `useActiveOrganizationStore.getState()` so it works outside the React tree.

### 8.3 Bootstrap rule

A small `useBootstrapActiveOrganization()` hook runs inside the protected route group (consumed in `App.tsx`):

1. Read `useMyOrganizations` (React Query).
2. On success:
   - If stored `activeOrganizationId` is not in the returned list → `setActiveOrganizationId(null)`.
   - If `activeOrganizationId` is `null` and the list is non-empty → set it to the first org.
   - If the list is empty → leave it `null` (the UI switches to a "create or accept" landing state).

### 8.4 API modules — `apps/frontend/src/api/`

Follow the existing pattern (plain object with async methods using `axiosInstance.request(...)`):

| File | Methods |
|---|---|
| `organizations.api.ts` | `create`, `listMine`, `getCurrent`, `updateCurrent`, `deleteCurrent`, `transferOwnership` |
| `members.api.ts` | `listCurrent`, `updateRole`, `remove`, `leave` |
| `invites.api.ts` | `createForCurrentOrg`, `listForCurrentOrg`, `revoke`, `resend`, `listMine`, `accept`, `decline`, `preview` |

### 8.5 React Query hooks — `apps/frontend/src/hooks/api/`

| File | Hooks |
|---|---|
| `use-organizations.ts` | `useMyOrganizations`, `useCurrentOrganization`, `useCreateOrganization`, `useUpdateCurrentOrganization`, `useDeleteCurrentOrganization`, `useTransferOwnership` |
| `use-members.ts` | `useCurrentOrganizationMembers`, `useUpdateMemberRole`, `useRemoveMember`, `useLeaveOrganization` |
| `use-invites.ts` | `useCreateInvite`, `useCurrentOrganizationInvites`, `useRevokeInvite`, `useResendInvite`, `useMyPendingInvites`, `useAcceptInvite`, `useDeclineInvite`, `useInvitePreview` |

**Query key conventions:**
- `["organizations", "me"]`
- `["organizations", "current", activeOrgId]`
- `["organizations", "current", activeOrgId, "members"]`
- `["organizations", "current", activeOrgId, "invites", statusFilter]`
- `["invites", "me", userId]`
- `["invites", "preview", token]`

Mutations invalidate the relevant scope. Switching active org invalidates every `["organizations", "current", ...]` key.

### 8.6 Routes — `apps/frontend/src/router.tsx`

**New protected routes** (under `protectedRoute`):

| Path | Component | Notes |
|---|---|---|
| `/organizations/new` | `CreateOrganizationPage` | Single-input form; creates owned org. |
| `/invites` | `PendingInvitesPage` | Lists invites for the caller's verified email. |
| `/settings/organization` | `OrganizationSettingsPage` | Profile, transfer, delete. Role-gated UI. |
| `/settings/organization/members` | `OrganizationMembersPage` | Members table + invite form + invite list. |

**New public route** (outside `protectedRoute`):

| Path | Component | Notes |
|---|---|---|
| `/accept-invite` | `AcceptInvitePage` | Reads `?token`. Branches on preview result + session state. |

### 8.7 Pages — `apps/frontend/src/routes/`

**`CreateOrganizationPage`** — form for `name`. On success: set active org to the new one; navigate `/`.

**`PendingInvitesPage`** — card list. Accept/Decline buttons. On accept: set active org to the joined one; navigate `/`.

**`OrganizationSettingsPage`** — three cards:
1. Profile (`name`, `slug`) — admin+ can edit.
2. Transfer ownership — owner only; dropdown of current admins as candidates; confirmation dialog.
3. Danger zone — delete org; owner only; typed confirmation.

**`OrganizationMembersPage`** — two sections:
1. Members table: name, email, role (editable dropdown when caller is owner and row is non-owner), actions (remove, leave-for-self).
2. Invites: `InviteMemberForm` (email + role select) and a table of pending invites with Revoke and Resend.

**`AcceptInvitePage`** — branching state machine:
1. Reads `token` from URL → calls `useInvitePreview(token)`.
2. If preview errors (invalid/expired): "invite is invalid or expired" plus a link to `/sign-in`.
3. If preview succeeds, branches on `useAuthSession`:
   - **No session** → CTA: `/sign-up?redirect=/accept-invite?token=...&email=<invitedEmail>` + `/sign-in?redirect=...`.
   - **Session, email not verified** → redirect to `/verify-email?redirect=/accept-invite?token=...`.
   - **Session, email mismatch** → message + "Sign out" link.
   - **Session, verified, match** → Accept / Decline buttons.
4. On accept success: set active org + navigate `/`.

**Minor tweak** to the existing `/sign-up` route: accept an `email` query param and pre-fill the email field. This lets the accept-invite page seed the signup form without introducing new logic to the OTP verification flow.

### 8.8 App shell — `apps/frontend/src/App.tsx`

Two additions to the existing header:

1. **`OrgSwitcher`** — dropdown next to the logo. Shows the active org's name and the caller's role badge. Opens a menu of the user's orgs (with role badges) plus a "Create new organization" entry linking to `/organizations/new`. Selecting an org calls `setActiveOrganizationId`. With zero orgs the component renders as a single "Create organization" button.
2. **`PendingInvitesBadge`** — icon next to the avatar showing the pending-invite count from `useMyPendingInvites`. Clicking navigates to `/invites`.

### 8.9 Sidebar additions

Under Settings, add:
- "Organization" → `/settings/organization`
- "Members" → `/settings/organization/members`

Kept minimal; the scaffold exposes all functionality but makes no claims about final IA.

---

## 9. User-flow walkthroughs

### 9.1 Existing user is invited

1. Owner on Acme sends an invite to `jane@existing.com`.
2. Jane gets the email, clicks the magic link → `/accept-invite?token=<T>`.
3. `useInvitePreview` loads: "Alice invited you to Acme as admin."
4. Jane is signed in + verified → Accept → membership created → active org flips to Acme → navigate `/`.

**Alternate path:** Jane ignores the email, later signs into the app, sees the bell badge ("1 pending invite") → `/invites` → accepts from there.

### 9.2 New user is invited

1. Owner sends invite to `bob@new.com`.
2. Bob clicks link → `/accept-invite?token=<T>`.
3. Preview shows org details and "Sign up to accept" → `/sign-up?redirect=/accept-invite?token=<T>&email=bob@new.com`.
4. Bob signs up. Better Auth sends an OTP to the same email. After verification via `/verify-email`, `redirect` returns him to `/accept-invite?token=<T>`.
5. Now signed in + verified + email matches → Accept → membership created.
6. Post-accept, Bob's `OrgSwitcher` shows Acme (role: admin) plus a "Create new organization" option — satisfying the requirement that invited users may still own an org.

### 9.3 User creates their own organization

1. User signs up normally (no invite) → verifies email → home.
2. `useMyOrganizations` returns empty → `OrgSwitcher` renders "Create organization" → `/organizations/new` → POST creates org, auto-inserts membership row with `role='owner'` → active org set to the new one → home is populated.

### 9.4 Ownership transfer

1. Owner navigates `/settings/organization` → Transfer ownership.
2. Dropdown lists admins of the org. Selecting an admin + confirmation triggers `POST .../transfer-ownership`.
3. Server validates: target is an admin, target does not own another org. Transaction updates `organizations.owner_id`, demotes old owner to `admin`, promotes target to `owner`.
4. After success, the UI refreshes `useMyOrganizations`; the old owner can now create their own org.

### 9.5 Owner deletes their org

1. Owner on `/settings/organization` → Danger zone → Delete (typed confirmation).
2. `DELETE /api/organizations/current` cascades the org, its memberships, and any invites.
3. Zustand store: active org removed from the list → `setActiveOrganizationId(null)`. If the list is otherwise empty, the UI shows the "create or accept" landing state.

---

## 10. Testing strategy (high level)

- **Backend unit tests** (Jest): services with in-memory mocks for Drizzle + Resend. Cover role matrix, invite lifecycle (create → resend → accept → expire → revoke), transfer-ownership invariants, duplicate-invite flow, email verification gate.
- **Backend e2e tests** (Supertest): full HTTP stack with a test Postgres database. Cover header-based org scoping, 404 vs 403 behavior, full invite → accept flow, new-user signup → accept.
- **Frontend:** no new test infrastructure; manual QA against the flows in §9.

Detailed test plans belong in the implementation plan, not here.

---

## 11. Out of scope for this cut

- Org avatars / logos.
- Multiple owned orgs per user (soft rule would allow this; we've opted for hard rule).
- Billing, plans, seats.
- Audit log UI (schema is sufficient to build one later).
- Fine-grained per-resource permissions beyond the three-role model.
- SSO / SAML / SCIM.
- Invite via domain (e.g., "anyone @acme.com can join").

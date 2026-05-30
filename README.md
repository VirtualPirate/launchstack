# LaunchStack

> **Stop wiring. Start shipping.**
> A production-grade, full-stack TypeScript template that hands you weeks of foundational work on day one — auth, multi-tenancy, RBAC, email, type-safe APIs, and a polished UI — all wired together and ready to extend.

LaunchStack is the SaaS starter you wish existed when you started your last side project. It's the boring-but-critical 80% you keep rebuilding from scratch — done right, once, with modern tooling and zero magic.

---

## Why LaunchStack?

Most "starter templates" leave you stranded the moment you need something real: organizations, role-based permissions, transactional email, token encryption, type-safe shared contracts. LaunchStack ships with all of it — and the parts you do build inherit the same quality bar.

- **Skip the auth rabbit hole.** Email + password, OAuth, email OTP verification, encrypted OAuth tokens, and session management — all working out of the box with **[Better Auth](https://better-auth.com)**, the modern, framework-agnostic auth library that doesn't lock you in to a vendor.
- **Multi-tenant from minute one.** Full organization model with owners, admins, and viewers. Invite flows, email invites with one-click accept, ownership transfer, member management — already built, already tested.
- **End-to-end type safety.** A shared `api-interfaces` package means the request you send from React is the exact shape your NestJS controller expects. Refactor a field and TypeScript catches it on both sides.
- **Server state, solved.** Powered by **[TanStack Query](https://tanstack.com/query)** — automatic caching, request deduplication, background refetching, and optimistic updates. No `useEffect` fetching, no stale state, no race conditions. Your UI stays in sync with your server, effortlessly.
- **A UI you'd actually ship.** **[shadcn/ui](https://ui.shadcn.com)** + **Tailwind CSS v4** + **Radix UI** primitives means accessible, beautiful components you own and can customize down to the last pixel.
- **Migrations you can trust.** **[Drizzle ORM](https://orm.drizzle.team)** with versioned migrations gives you SQL-grade control with TypeScript ergonomics — no ORM tax, no "what is this query actually doing?" moments.
- **Tested where it matters.** 50+ unit tests covering organizations, invites, members, RBAC guards, and token security. Plus e2e tests for the full auth + org flow.

This is what a real production foundation looks like. Fork it, rename it, and start building the part that actually makes your product yours.

---

## Features

### Authentication
- **Email + password** sign-up and sign-in with Better Auth
- **Email OTP verification** — users must verify their email before signing in (configurable hook in `auth.config.ts`)
- **Google OAuth** sign-in (optional — set env vars to enable)
- **Account linking** for users who sign up with email and later use OAuth
- **Encrypted OAuth tokens** — access and refresh tokens are AES-256-GCM encrypted at rest using a secret-derived key
- **Session-based auth** with secure HTTP-only cookies, served at `/api/auth/*`
- **OpenAPI playground** for auth routes in non-production environments
- **Beautiful transactional emails** built with React Email and sent via Resend

### Organizations & Multi-Tenancy
- **Create / update / delete organizations** with auto-generated unique slugs
- **Three-role RBAC**: `owner`, `admin`, `viewer` — enforced server-side via a global guard
- **Member management**: list members, change roles, remove members, leave organization
- **Ownership transfer** with full validation (target must be an existing admin)
- **Active org context** via `X-Organization-Id` header, set automatically by the frontend Axios interceptor
- **Per-route role requirements** with the `@RequireOrgRole('admin')` decorator

### Invites
- **Email invites** with secure token-hashed links (raw token never stored)
- **7-day expiry** with automatic status tracking (`pending`, `accepted`, `revoked`, `expired`)
- **Resend invite** — rotates the token and re-sends the email
- **Anonymous invite preview** — invitees can preview org details before signing up
- **Pending invite badge** in the app header so users never miss one
- **One-pending-invite-per-email-per-org** enforced via a partial unique index

### Frontend
- **File-based routing** with **[TanStack Router](https://tanstack.com/router)** — full type safety, including search params
- **Protected routes** with `beforeLoad` session checks and automatic redirect to sign-in
- **Server state** with TanStack Query — caching, mutations, optimistic updates
- **Client state** with **[Zustand](https://zustand-demo.pmnd.rs)** — currently used for active org switching
- **Form validation** with **Zod** schemas shared between client and server
- **Sidebar layout** with org switcher, pending invites badge, sign-out
- **Pages included:** sign-in, sign-up, Google sign-in/up, email verification, dashboard, settings, organization create/settings/members, accept invite, pending invites, auth error
- **Geist Variable** font preinstalled for that crisp, modern look

### Backend
- **NestJS 11** with global `ConfigModule`, global Drizzle DB provider, and modular feature areas (`auth`, `organizations`)
- **Body parser disabled at root** so Better Auth can handle its own parsing; JSON middleware is applied selectively per controller
- **Global `OrgContextGuard`** that resolves the active org from the `X-Organization-Id` header and attaches it to every request
- **Custom decorators**: `@OrgMembership()`, `@RequireOrgRole(level)`, `@AllowAnonymous()`, `@Session()`
- **Zod validation pipe** — every endpoint validates input against shared schemas from `@launchstack/api-interfaces`
- **Repository pattern** — clean separation between controllers, services, and Drizzle data access
- **Transactional integrity** — multi-step operations (create org + create owner membership, accept invite + add member) wrapped in DB transactions

### Database
- **PostgreSQL 18** via Docker Compose (port `11753` to avoid local conflicts)
- **Drizzle ORM** with full TypeScript schema definitions in `apps/backend/src/databases/pg-drizzle/`
- **Versioned migrations** with `@drepkovsky/drizzle-migrations` (generate / up / down / status / fresh)
- **Drizzle Studio** for visual DB browsing (`pnpm db:studio`)
- **Auth schema isolated** in the `auth` PostgreSQL schema; app tables in `public`
- **Indexes that matter** — unique slug, unique owner-per-org, unique pending-invite-per-email-per-org, plus lookup indexes

### Developer Experience
- **pnpm monorepo** with workspaces — packages build before apps, automatically
- **Parallel dev servers** — `pnpm dev` runs both Vite (`:5173`) and NestJS (`:3000`) at once
- **Shared types package** — `@launchstack/api-interfaces` exports request/response types and Zod schemas used by both backend and frontend
- **Shared utilities package** — `@launchstack/core` for cross-cutting helpers
- **tsup-built packages** — both CJS and ESM outputs
- **ESLint + Prettier** preconfigured across all workspaces
- **Jest test runner** with module mocks for `better-auth`, `resend`, and `@react-email` (so tests don't hit the network or need a DB)
- **Hot reload** on both frontend (Vite HMR) and backend (Nest watch mode)

---

## Tech Stack

### Backend
- **[NestJS 11](https://nestjs.com)** — modular Node.js framework with first-class TypeScript and DI
- **[Better Auth 1.6](https://better-auth.com)** — modern, plugin-based auth (via `@thallesp/nestjs-better-auth`)
- **[Drizzle ORM](https://orm.drizzle.team)** — type-safe SQL with `postgres` driver
- **[PostgreSQL 18](https://www.postgresql.org)** — running in Docker
- **[Zod 4](https://zod.dev)** — schema validation, shared with the frontend
- **[Resend](https://resend.com)** — transactional email API
- **[React Email](https://react.email)** — render emails with React components
- **AES-256-GCM** — token-at-rest encryption (Node `crypto`)

### Frontend
- **[React 19](https://react.dev)** with **[Vite 7](https://vitejs.dev)** for instant HMR and fast builds
- **[TanStack Router](https://tanstack.com/router)** — type-safe file-based routing
- **[TanStack Query 5](https://tanstack.com/query)** — server state, caching, mutations
- **[Tailwind CSS v4](https://tailwindcss.com)** — utility-first styling with the new Vite plugin
- **[shadcn/ui](https://ui.shadcn.com)** + **[Radix UI](https://www.radix-ui.com)** — accessible, themable components you own
- **[Zustand 5](https://zustand-demo.pmnd.rs)** — minimal client state
- **[Axios](https://axios-http.com)** — HTTP client with interceptors for active-org headers
- **[Lucide](https://lucide.dev)** — icon library
- **[Geist Variable](https://vercel.com/font)** — typeface

### Tooling
- **[pnpm](https://pnpm.io)** workspaces — fast, disk-efficient package manager
- **[TypeScript 5.9](https://www.typescriptlang.org)** strict mode, end to end
- **[Jest 30](https://jestjs.io)** — unit and e2e testing
- **[Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)** + **[`@drepkovsky/drizzle-migrations`](https://github.com/drepkovsky/drizzle-migrations)** — schema management
- **[Docker Compose](https://docs.docker.com/compose/)** — local Postgres
- **[ESLint 9](https://eslint.org)** + **[Prettier](https://prettier.io)** — flat config

---

## Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **pnpm** ≥ 9
- **Docker** (for the local Postgres container)

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/launchstack.git
cd launchstack
pnpm install
```

### 2. Start Postgres

```bash
docker compose up -d
```

This starts Postgres 18 on `localhost:11753` (we use a non-standard port so it doesn't collide with anything else you might be running).

### 3. Configure environment variables

Create `apps/backend/.env`:

```env
DATABASE_URL=postgresql://launchstack:launchstack@localhost:11753/launchstack
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=<your resend api key>
EMAIL_FROM=onboarding@resend.dev

# Optional — omit to disable Google sign-in
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
```

> **Tip:** [Resend](https://resend.com) gives you a free API key and `onboarding@resend.dev` works for local dev without domain verification.

### 4. Run migrations

```bash
pnpm db:up
```

### 5. Start the dev servers

```bash
pnpm dev
```

- Frontend → http://localhost:5173
- Backend → http://localhost:3000
- Auth OpenAPI playground → http://localhost:3000/api/auth/reference (non-production only)

Sign up with any email, enter the OTP from the email Resend sends you, and you're in.

---

## Available Scripts

### Root
| Script | What it does |
|---|---|
| `pnpm dev` | Run frontend + backend in parallel |
| `pnpm dev:frontend` | Frontend only |
| `pnpm dev:backend` | Backend only |
| `pnpm build` | Build packages, then both apps |
| `pnpm build:packages` | Build shared packages only |
| `pnpm lint` | Lint every workspace |
| `pnpm db:generate` | Generate a new Drizzle migration |
| `pnpm db:up` | Apply pending migrations |
| `pnpm db:down` | Roll back the last migration |
| `pnpm db:status` | Show migration status |
| `pnpm db:fresh` | Drop everything and re-apply (dev only) |
| `pnpm db:push` | Push schema directly without a migration file |
| `pnpm db:studio` | Open Drizzle Studio |

### Backend (`cd apps/backend`)
| Script | What it does |
|---|---|
| `pnpm test` | Run unit tests + email render integration test |
| `pnpm test:watch` | Watch mode |
| `pnpm test:e2e` | E2E tests |
| `pnpm test:cov` | Coverage report |

---

## Project Structure

```
launchstack/
├── apps/
│   ├── backend/                  # NestJS 11 API server (port 3000)
│   │   ├── src/
│   │   │   ├── auth/             # Better Auth config, OTP controller, token crypto
│   │   │   ├── databases/        # Drizzle module, schema, migrations
│   │   │   ├── emails/           # React Email templates (OTP, invite)
│   │   │   ├── organizations/    # Multi-tenancy: controllers, services, repos, guards
│   │   │   └── main.ts
│   │   ├── drizzle/              # Generated migration files
│   │   └── test/                 # E2E tests (auth, organizations)
│   └── frontend/                 # React 19 + Vite + Tailwind v4 (port 5173)
│       ├── src/
│       │   ├── api/              # Axios + Better Auth client wrappers
│       │   ├── components/       # auth/, organization/, ui/ (shadcn)
│       │   ├── hooks/api/        # TanStack Query hooks
│       │   ├── routes/           # Page components (TanStack Router)
│       │   ├── stores/           # Zustand stores (active org)
│       │   ├── lib/              # auth-client, redirect helpers
│       │   └── router.tsx
│       └── components.json       # shadcn/ui config
├── packages/
│   ├── api-interfaces/           # Shared request/response types + Zod schemas
│   └── core/                     # Shared utilities (formatDate, isValidEmail, etc.)
├── docker-compose.yaml           # Postgres 18 on port 11753
├── pnpm-workspace.yaml
└── package.json
```

---

## Architecture Highlights

### How org-scoped requests work

1. The frontend stores the active org ID in a Zustand store (`useActiveOrganizationStore`).
2. An Axios interceptor (`apps/frontend/src/api/axios-client.ts`) attaches it as `X-Organization-Id` on every request.
3. The backend's global `OrgContextGuard` reads the header, looks up the membership, checks the required role from `@RequireOrgRole(...)`, and attaches `request.orgMembership` for downstream use.
4. Controllers grab it with the `@OrgMembership()` decorator.

This means org context is automatic for the frontend and enforced for every protected route on the backend — no per-handler boilerplate.

### How invites work

1. **Admin sends invite** → backend hashes a freshly-generated token (raw token never stored), inserts a `pending` row, and emails an `/accept-invite?token=<raw>` link.
2. **Anyone with the link** can hit `GET /api/invites/preview?token=...` (anonymous) to see org name + inviter before signing up.
3. **Invitee signs up / signs in**, then `POST /api/invites/accept` looks up the hash, verifies email match + expiry + status, and atomically (transaction) creates the membership and marks the invite accepted.
4. Resending rotates the token; revoking flips the status. Pending invites are unique per `(org, email)` via a partial unique index.

### How encryption-at-rest works

OAuth access and refresh tokens are encrypted with **AES-256-GCM** in `databaseHooks.account.{create,update}.before` (see `apps/backend/src/auth/auth.config.ts`). The 256-bit key is derived from `BETTER_AUTH_SECRET` via scrypt. Format: `iv:authTag:ciphertext` (all base64). Rotate `BETTER_AUTH_SECRET` and you'll need to re-link OAuth accounts — by design.

---

## Testing

The backend ships with **50+ unit tests** covering:

- Organizations service (create, update, delete, transfer ownership)
- Members service + repository
- Invites service + repository (token hashing, expiry, status transitions)
- Org context guard (header parsing, role rank checks)
- Zod validation pipe
- Auth crypto (encrypt/decrypt round-trip, malformed input)
- Email rendering (OTP + invite templates)

Plus **e2e tests** for the full auth + org lifecycle:

```bash
cd apps/backend
pnpm test          # unit
pnpm test:e2e      # full lifecycle
```

Mocks for `better-auth`, `resend`, and `@react-email` mean tests run fast and don't need network or a real DB connection (unit suite).

---

## Deployment

The included scripts assume a typical Node.js + static-frontend split:

```bash
pnpm deploy:frontend     # Builds packages + frontend → apps/frontend/dist
pnpm deploy:backend      # Builds packages + backend, runs pnpm deploy --prod
pnpm start:prod:backend  # Runs the deployed backend
```

The `pnpm --filter backend deploy ./deploy/backend --prod` command produces a hoisted, production-only `node_modules` in `deploy/backend/` — perfect for Docker `COPY` or any Node.js host (Fly.io, Railway, Render, etc.).

The frontend `dist/` is just static files — drop them on Cloudflare Pages, Vercel, Netlify, or behind any CDN.

---

## Contributing

This is an open-source template, so the best contribution is to fork it, build something cool, and tell us what was rough. PRs welcome for:

- New OAuth providers (GitHub, Discord, Apple)
- More auth plugins (passkeys, 2FA via Better Auth)
- Billing integration (Stripe / Polar)
- Email customization patterns
- Deployment recipes (Dockerfiles, fly.toml examples, etc.)

---

## License

MIT — use it, fork it, ship it.

# pg-boss Dashboard — Design

**Date:** 2026-05-01
**Status:** Approved (brainstorming)
**Scope:** `apps/backend` (devDep + scripts) and the in-progress queue config (one-line flag)
**Depends on:** [2026-05-01 pg-boss integration](2026-05-01-pg-boss-integration-design.md) — the queue module must exist before the dashboard has anything useful to show.

## 1. Summary

Wire up [`@pg-boss/dashboard`](https://github.com/timgit/pg-boss/blob/master/packages/dashboard/README.md), a standalone web UI for inspecting pg-boss queues, as a local-dev tool for the LaunchStack monorepo. It runs as a sibling process to the NestJS API, reads from the same Postgres / `pgboss` schema, binds to `127.0.0.1:3210`, and uses no auth.

Production deployment is **out of scope**. The dashboard is delivered as a `devDependency` of `apps/backend` and a `pnpm dev:dashboard` script; it is never bundled into the API and never started in production builds. A future PR can ship it to prod (Docker / reverse proxy / Basic Auth); this spec calls out the path but does not implement it.

This design also folds a one-line change into the in-progress queue PR — flipping `persistWarnings: true` in `buildBossOptions()` so the dashboard's Warning History view has data.

## 2. Goals & non-goals

### Goals

- A `pnpm dev:dashboard` command (workable from repo root and from `apps/backend/`) that starts the dashboard against the local Postgres.
- Dashboard listens on `127.0.0.1:3210` only — never exposed to the LAN.
- Reads `DATABASE_URL` from the existing `apps/backend/.env`, so dashboard DB config can never drift from API DB config.
- The `pgboss` schema name is the upstream pg-boss default, used unchanged by both API and dashboard. The queue PR's existing `PG_BOSS_SCHEMA=pgboss` line is mirrored as `PGBOSS_SCHEMA=pgboss` (the dashboard's expected variable name) in `.env.example`.
- Pinned dashboard version via `apps/backend/package.json` + `pnpm-lock.yaml`.
- Warning History view has data (via `persistWarnings: true` in pg-boss config).
- `apps/backend/AGENTS.md` documents the dev workflow and the future prod deployment path.

### Non-goals (explicit)

- Production deployment of the dashboard (Docker image, reverse proxy, TLS, Basic Auth env vars, deploy pipeline). Handled in a future PR.
- Multi-database / multi-schema dashboard configuration (the `|`-separated `DATABASE_URL` form). YAGNI; we have one DB.
- Adding the dashboard to `pnpm dev` (the existing parallel frontend+backend script). The dashboard is opt-in.
- Embedding the dashboard inside the NestJS process. It is a separate Node app with its own server (Hono + React Router) and cannot be in-process.
- Automated tests for the dashboard UI. It is a third-party binary; we'd be testing their code.
- Authentication on the dashboard. Loopback-only bind is the access control for local dev.

## 3. Library & version pins

- `@pg-boss/dashboard` — added to `apps/backend/devDependencies`. Pin via `pnpm add -D` (resolves to a concrete `^x.y.z` range; `pnpm-lock.yaml` locks the exact version).
- `dotenv-cli` — added to `apps/backend/devDependencies`. The dashboard binary does not auto-load `.env`; we wrap it with `dotenv -e .env -- ...` so it picks up `DATABASE_URL` and friends from `apps/backend/.env` the same way the Nest app does.
- Requires Node `>=22.12` and pg-boss `>=12.11` per upstream README. Both already satisfied by the queue PR (Node engines bumped to `>=22.12.0`, `pg-boss@^12` installed).
- No new runtime deps for the API. The dashboard is only ever invoked from a script.

## 4. Architecture

### 4.1 Process model

The dashboard is a separate Node process started by a `pnpm` script. Three concurrent processes during local dev:

```
pnpm dev:frontend     → Vite      :5173
pnpm dev:backend      → NestJS    :3000
pnpm dev:dashboard    → pg-boss   :3210   ← new, opt-in
                          dashboard
                                ↓
                         Postgres :11753  ← shared with backend
                          (pgboss schema)
```

The dashboard never talks to the NestJS process. Both connect to the same Postgres. The dashboard does not own or migrate the `pgboss` schema — that remains pg-boss's responsibility from the API side.

### 4.2 Why not in-process

`@pg-boss/dashboard` is shipped as a full Hono + React Router app with its own bin entry (`pg-boss-dashboard`). Importing it into NestJS would mean reverse-engineering its build output, mounting it as middleware, and tracking upstream changes. Out of proportion to the value. Sibling-process is the supported integration pattern per the upstream README, and it costs nothing in dev.

### 4.3 Loopback bind

The dashboard must bind to `127.0.0.1` only. The upstream README documents `PORT` as a configuration env var but does not document a `HOST` env var. We try the env-var path first; if the binary ignores `HOST`, we fall back to a tiny Node entry that imports the dashboard's build server and calls `.listen(port, '127.0.0.1')` explicitly. The plan covers both paths and selects based on a smoke-test check (Section 8 step 6).

## 5. Public surface

### 5.1 Scripts

**`apps/backend/package.json`** — add one script:

```json
"dev:dashboard": "dotenv -e .env -- env HOST=127.0.0.1 PORT=3210 pg-boss-dashboard"
```

The script:

- `dotenv -e .env --` loads `apps/backend/.env` into the child process so `DATABASE_URL` and `PGBOSS_SCHEMA` reach the dashboard binary without being re-declared on the command line. The dashboard binary itself does not auto-load `.env`.
- POSIX `env KEY=VAL ...` then layers on `HOST=127.0.0.1` (loopback bind; subject to the binary honoring `HOST`, see §4.3) and `PORT=3210`.
- The port is hard-coded in the script. There is no env-var override. If a future need to change ports arises, edit the script — it is one line.
- macOS and Linux only. Windows is not a supported dev platform for this repo (Nest CLI watch mode and `docker compose up -d` are documented assumptions); we do not need a cross-platform variant.

**Schema env-var name:** the queue PR's `.env.example` declares `PG_BOSS_SCHEMA` (with underscore). The dashboard reads `PGBOSS_SCHEMA` (no underscore). Both point at the same value (`pgboss`). The implementation plan adds a single `PGBOSS_SCHEMA=pgboss` line to `apps/backend/.env.example` alongside the existing `PG_BOSS_SCHEMA=pgboss` line — duplication is intentional and cheap; renaming the existing API-side var would touch the queue PR for no benefit.

**Root `package.json`** — add a top-level passthrough:

```json
"dev:dashboard": "pnpm --filter backend dev:dashboard"
```

so `pnpm dev:dashboard` works from the repo root. The existing `pnpm dev` (parallel frontend+backend) is **unchanged**.

### 5.2 Env vars

Append to `apps/backend/.env.example`:

```
# pg-boss dashboard (local dev only — bound to 127.0.0.1:3210)
PGBOSS_SCHEMA=pgboss
```

`PGBOSS_SCHEMA` (no underscore) is the dashboard's expected variable; it duplicates the existing `PG_BOSS_SCHEMA=pgboss` from the queue PR. See §5.1 for why we keep both.

`DATABASE_URL` is already documented by the queue PR and is reused as-is.

The port is **not** an env var — it is hard-coded to `3210` in the script (see §5.1).

Auth env vars (`PGBOSS_DASHBOARD_AUTH_USERNAME` / `PGBOSS_DASHBOARD_AUTH_PASSWORD`) are deliberately **not** added — they belong in the future prod-deploy PR.

### 5.3 Contingency entry script (only if `HOST` is ignored)

If the smoke test in §8 step 6 shows the dashboard binding to all interfaces despite `HOST=127.0.0.1`, replace the script value with a small Node entry, committed at `apps/backend/scripts/pg-boss-dashboard.mjs`:

```js
// apps/backend/scripts/pg-boss-dashboard.mjs
// Loopback-only entry for the pg-boss dashboard.
// Used because the upstream binary does not honor a HOST env var.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const path = require.resolve('@pg-boss/dashboard/build/server/index.js');
process.env.HOST = '127.0.0.1';
await import(path);
```

And update the script to:

```json
"dev:dashboard": "dotenv -e .env -- env PORT=3210 node scripts/pg-boss-dashboard.mjs"
```

(`HOST` is set inside the .mjs file rather than the command line, since by hypothesis the binary ignored it externally.)

If the entry import path differs from `@pg-boss/dashboard/build/server/index.js` (the path documented in the upstream README's "Direct Node.js" deploy option), resolve via `require.resolve('@pg-boss/dashboard')` and walk up to the package root from there. The plan codifies the exact path verification step.

This file is created **only if** the env-var path fails. If `HOST` works, the file is never written.

## 6. Queue PR coordination — `persistWarnings`

The queue spec at `docs/superpowers/specs/2026-05-01-pg-boss-integration-design.md` is approved but not yet implemented (its plan at `docs/superpowers/plans/2026-05-01-pg-boss-integration.md` is unmerged at time of writing).

**Decision:** roll a single-line addition into the queue PR rather than amending it after the fact.

**Change:** in `apps/backend/src/queue/pg-boss.config.ts`, the `buildBossOptions` return adds `persistWarnings: true`:

```ts
return { connectionString, schema, max, application_name, persistWarnings: true };
```

**Test update:** the two existing assertions in `apps/backend/src/queue/pg-boss.config.spec.ts` ("reads connection string and applies defaults" and "overrides defaults from env") add `persistWarnings: true` to their expected shape. No new test case — the value is a constant, not a code path.

**Why hard-coded, not env-driven:** there is no scenario where you would want it off in this codebase. Cost is one row per warning event in pg-boss's internal warning table. If a future ops concern surfaces (e.g., warning storms in prod), it becomes env-driven then.

**Mechanics:** before starting implementation, the executing agent checks whether the queue PR has merged.

- If **not merged**, edit the queue plan in place to add `persistWarnings: true` to Task 4 step 3 (the `pg-boss.config.ts` body) and to the expected shapes in Task 4 step 1 (the test bodies). The dashboard PR then does not touch `pg-boss.config.ts` at all.
- If **already merged**, the dashboard PR ships a small follow-up commit that adds the line and updates the two tests.

## 7. Documentation

Append to the existing "Background jobs (pg-boss)" section in `apps/backend/AGENTS.md`:

```markdown
**Dashboard (local dev):**

A web UI for inspecting queues and jobs. Local-dev only — binds to 127.0.0.1, no auth.

In a separate terminal:

```bash
pnpm dev:dashboard
```

Open http://localhost:3210. Reads from the same `DATABASE_URL` / `pgboss` schema as the backend (`PGBOSS_SCHEMA` in `.env`, mirroring `PG_BOSS_SCHEMA`). Port `3210` is hard-coded in the `dev:dashboard` script; edit the script to change it. Warning history populates because the queue config sets `persistWarnings: true`.

**Production deployment** is intentionally not wired up. When the time comes, the dashboard ships as a standalone process (Node or Docker) fronted by a reverse proxy with auth (`PGBOSS_DASHBOARD_AUTH_USERNAME` / `PGBOSS_DASHBOARD_AUTH_PASSWORD`). See https://github.com/timgit/pg-boss/blob/master/packages/dashboard/README.md.
```

No new section in the root `CLAUDE.md` / `AGENTS.md` — the dashboard is a backend-only concern and the `pnpm dev:dashboard` passthrough is self-explanatory next to the existing `pnpm dev:*` scripts.

## 8. Smoke test

Manual, no automated test. The dashboard is a third-party binary; we'd be testing their code.

1. `docker compose up -d` — Postgres running on `:11753`.
2. `pnpm dev:backend` in one terminal — confirm `[PgBoss] pg-boss started` and `[PgBoss] WORKER_ROLE=both — registered 1 job handler(s)`.
3. `pnpm dev:dashboard` in a second terminal — expect a startup log with `http://127.0.0.1:3210` (or `http://localhost:3210`).
4. Open `http://localhost:3210` in a browser. Confirm:
   - The queue list loads without error.
   - The `noop` queue is listed.
5. Trigger a noop job (`curl -X POST http://localhost:3000/api/_internal/queue/noop -H "X-Internal-Token: $INTERNAL_API_TOKEN" -H "Content-Type: application/json" -d '{"message":"dashboard test"}'`). Refresh the dashboard. Confirm:
   - The job appears under the `noop` queue.
   - It transitions through `created` → `active` → `completed`.
   - The job-detail view shows the payload `{ "message": "dashboard test" }`.
6. From a second machine on the LAN (or run `curl http://<lan-ip>:3210` from the host using the LAN IP, not `localhost`), confirm the request is **refused / times out**. If it succeeds, the binary ignored `HOST=127.0.0.1`; switch to the Node-entry contingency in §5.3 and re-run from step 3.
7. `Ctrl-C` the dashboard. Confirm clean exit, no error logs.

If any step fails, the implementation is not complete.

## 9. File touch list

**Create:**

```
docs/superpowers/specs/2026-05-01-pg-boss-dashboard-design.md   # this file
apps/backend/scripts/pg-boss-dashboard.mjs                      # ONLY if HOST env var is ignored
```

**Modify:**

```
apps/backend/package.json                                       # +@pg-boss/dashboard, +dotenv-cli devDeps, +dev:dashboard script
package.json (root)                                             # +dev:dashboard passthrough
apps/backend/.env.example                                       # +PGBOSS_SCHEMA
apps/backend/AGENTS.md                                          # +"Dashboard (local dev)" subsection
pnpm-lock.yaml                                                  # auto-updated by pnpm add
```

**Modify (rolled into queue PR per §6, only if queue PR has not merged):**

```
docs/superpowers/plans/2026-05-01-pg-boss-integration.md        # +persistWarnings in Task 4
```

**Modify (only if queue PR has already merged):**

```
apps/backend/src/queue/pg-boss.config.ts                        # +persistWarnings: true
apps/backend/src/queue/pg-boss.config.spec.ts                   # +persistWarnings in two expected shapes
```

## 10. Open risks

- **`HOST` env var support is unverified.** The upstream README documents `PORT` but not `HOST`. If the binary doesn't honor `HOST`, we use the contingency Node entry in §5.3. Either way, the smoke test (§8 step 6) gates the implementation as complete — we do not ship a build that binds to `0.0.0.0`.
- **Dashboard requires pg-boss `>=12.11`.** The queue PR pins `pg-boss@^12`, which currently resolves to a `12.x.y` ≥ 12.11 — but if a future `pnpm install` lowers it, the dashboard breaks. Acceptable risk; surfaces immediately on dashboard startup, not as a silent failure.
- **First dashboard run requires the `pgboss` schema to exist.** Created by `boss.start()` from the API. The smoke test sequences API-first, dashboard-second, so this ordering is enforced in the docs.
- **Connection pool growth.** The dashboard opens its own pool against Postgres. Adds at most a handful of connections during local dev; trivial against the local Docker Postgres `max_connections` (default 100). Documented in `AGENTS.md` only if it bites someone.

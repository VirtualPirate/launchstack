# pg-boss Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up `@pg-boss/dashboard` as a local-dev tool that runs as a sibling process to the NestJS API on `127.0.0.1:3210`, no auth, reading the same Postgres / `pgboss` schema as the backend.

**Architecture:** Sibling process pattern. Dashboard installed as a `devDependency` of `apps/backend`, started via `pnpm dev:dashboard` (passthrough from repo root). `dotenv-cli` loads `apps/backend/.env` into the dashboard binary's child env so `DATABASE_URL` and `PGBOSS_SCHEMA` reach it without re-declaration. Loopback bind via `HOST=127.0.0.1` env var with a Node-entry contingency if the binary ignores it. Production deployment is intentionally out of scope.

**Tech Stack:** `@pg-boss/dashboard` (Hono + React Router 7), `dotenv-cli`, pnpm workspaces, pg-boss 12, Node `>=22.12`.

**Spec:** [`docs/superpowers/specs/2026-05-01-pg-boss-dashboard-design.md`](../specs/2026-05-01-pg-boss-dashboard-design.md)

**Depends on:** [pg-boss queue integration](2026-05-01-pg-boss-integration.md) — the queue module's `pgboss` schema and `noop` job/handler are required for the smoke test in Task 8 to be meaningful. Task 1 also coordinates a single-line addition to that integration.

**Repo convention — commits:** This repo follows the convention that the user creates commits, not the agent. Each task ends with a `git add ...` step and a suggested commit message; do **not** run `git commit` yourself. Leave changes staged for the user to review and commit.

---

## File Structure

**Modify:**

```
apps/backend/package.json                      # +@pg-boss/dashboard, +dotenv-cli devDeps, +dev:dashboard script
apps/backend/.env.example                      # +PGBOSS_SCHEMA=pgboss
apps/backend/AGENTS.md                         # +"Dashboard (local dev)" subsection in Background jobs
package.json (root)                            # +dev:dashboard passthrough
pnpm-lock.yaml                                 # auto-updated by pnpm add
```

**Conditionally modify (Task 1 — exactly one branch fires):**

```
# Branch A — queue work uncommitted/unmerged AND files exist on disk
apps/backend/src/queue/pg-boss.config.ts       # +persistWarnings: true (one-line)
apps/backend/src/queue/pg-boss.config.spec.ts  # +persistWarnings in two expected shapes

# Branch B — queue plan unmerged AND queue source files do NOT exist
docs/superpowers/plans/2026-05-01-pg-boss-integration.md  # +persistWarnings in Task 4

# Branch C — queue work merged on main
apps/backend/src/queue/pg-boss.config.ts       # +persistWarnings: true (follow-up commit)
apps/backend/src/queue/pg-boss.config.spec.ts  # +persistWarnings in two expected shapes
```

**Conditionally create (Task 6 — only if `HOST` env var is ignored by binary):**

```
apps/backend/scripts/pg-boss-dashboard.mjs     # Node entry that calls .listen(port, '127.0.0.1')
```

---

## Task 1: Coordinate `persistWarnings` change with queue work

**Files:**
- Read: `apps/backend/src/queue/pg-boss.config.ts` (probe — may not exist)
- Read: `apps/backend/src/queue/pg-boss.config.spec.ts` (probe — may not exist)
- Modify (exactly one of):
  - `apps/backend/src/queue/pg-boss.config.ts` + `apps/backend/src/queue/pg-boss.config.spec.ts`
  - `docs/superpowers/plans/2026-05-01-pg-boss-integration.md`

The spec §6 mandates `persistWarnings: true` in `buildBossOptions()` so the dashboard's Warning History view has data. Apply it in whichever surface is authoritative right now.

- [ ] **Step 1: Detect the queue-work state**

Run from repo root:

```bash
test -f apps/backend/src/queue/pg-boss.config.ts && echo "FILE EXISTS" || echo "FILE MISSING"
git log --oneline -1 -- apps/backend/src/queue/pg-boss.config.ts
git status --porcelain apps/backend/src/queue/
```

Decision tree based on the output:

- If `FILE EXISTS` and `git log` shows **no commit** (queue files are uncommitted local work): **Branch A**
- If `FILE MISSING`: **Branch B**
- If `FILE EXISTS` and `git log` shows a **real commit hash** (queue work has merged to current branch): **Branch C**

Branches A and C have identical file edits — the only difference is whether the change rides along with the in-progress queue work or ships as a follow-up commit. Branch B edits the queue plan instead.

- [ ] **Step 2 (Branch A or C): Add `persistWarnings: true` to `pg-boss.config.ts`**

Edit `apps/backend/src/queue/pg-boss.config.ts` — change the final `return` to include the new flag.

Replace this line:

```ts
  return { connectionString, schema, max, application_name };
```

with:

```ts
  return { connectionString, schema, max, application_name, persistWarnings: true };
```

- [ ] **Step 3 (Branch A or C): Update the two expected shapes in `pg-boss.config.spec.ts`**

Edit `apps/backend/src/queue/pg-boss.config.spec.ts` — find the test case `'reads connection string and applies defaults'` and add an `application_name` (already there) plus `persistWarnings` assertion. Find the test case `'overrides defaults from env'` and add the same assertion.

Add this line at the end of each of those two test bodies (after the existing `expect(...)` calls, before the closing `});`):

```ts
    expect(opts.persistWarnings).toBe(true);
```

- [ ] **Step 4 (Branch A or C): Run the spec to confirm green**

Run:

```bash
pnpm --filter backend test -- --testPathPattern=pg-boss.config
```

Expected: PASS — all four tests green (the two original cases now also assert `persistWarnings: true`, and the existing `throws when DATABASE_URL is missing` and `throws when PG_BOSS_POOL_MAX is not a positive integer` cases are unaffected).

- [ ] **Step 5 (Branch B only): Edit the queue plan document in place**

Edit `docs/superpowers/plans/2026-05-01-pg-boss-integration.md`.

Find Task 4, Step 3 — the `pg-boss.config.ts` body. Replace this line in the code block:

```ts
  return { connectionString, schema, max, application_name };
```

with:

```ts
  return { connectionString, schema, max, application_name, persistWarnings: true };
```

Then find Task 4, Step 1 — the test bodies for `'reads connection string and applies defaults'` and `'overrides defaults from env'`. Add this line at the end of each test body (just before the closing `});`):

```ts
    expect(opts.persistWarnings).toBe(true);
```

Save. The change will land when the queue plan is executed.

- [ ] **Step 6: Stage for the user to commit**

Branch A — leave changes staged with the queue work; the user will commit them together. Run:

```bash
git add apps/backend/src/queue/pg-boss.config.ts apps/backend/src/queue/pg-boss.config.spec.ts
```

Suggested commit message (user will run): `feat(queue): persist pg-boss warnings for dashboard Warning History`

Branch B — stage the plan edit:

```bash
git add docs/superpowers/plans/2026-05-01-pg-boss-integration.md
```

Suggested commit message: `docs(plan): add persistWarnings to pg-boss config in queue plan`

Branch C — same files as Branch A; this is the standalone follow-up commit:

```bash
git add apps/backend/src/queue/pg-boss.config.ts apps/backend/src/queue/pg-boss.config.spec.ts
```

Suggested commit message: `feat(queue): persist pg-boss warnings for dashboard Warning History`

Do **not** run `git commit` — the user handles commits.

---

## Task 2: Install `@pg-boss/dashboard` and `dotenv-cli` as devDependencies

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: Install both packages as devDependencies of `apps/backend`**

Run from repo root:

```bash
pnpm --filter backend add -D @pg-boss/dashboard dotenv-cli
```

Expected: both packages appear under `devDependencies` in `apps/backend/package.json` with concrete `^x.y.z` ranges. `pnpm-lock.yaml` updates with locked exact versions.

- [ ] **Step 2: Verify the dashboard binary is on the workspace path**

Run:

```bash
pnpm --filter backend exec which pg-boss-dashboard
```

Expected: a path inside `apps/backend/node_modules/.bin/pg-boss-dashboard` (or similar pnpm-style symlink). Non-empty output.

- [ ] **Step 3: Verify `dotenv-cli` exposes the `dotenv` binary**

Run:

```bash
pnpm --filter backend exec which dotenv
```

Expected: a path inside `apps/backend/node_modules/.bin/dotenv`. Non-empty output.

- [ ] **Step 4: Verify the install resolves cleanly**

Run:

```bash
pnpm install --frozen-lockfile=false
```

Expected: no errors. Postinstall completes.

- [ ] **Step 5: Confirm the dashboard meets its pg-boss version floor**

The dashboard's upstream README requires `pg-boss >=12.11`. Confirm:

```bash
pnpm --filter backend list pg-boss --depth=0
```

Expected: a `pg-boss` version that is `12.11.x` or higher. If the resolved version is `<12.11`, bump `pg-boss` in `apps/backend/package.json` to `^12.11.0` and re-run `pnpm install`.

- [ ] **Step 6: Stage for the user to commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
```

Suggested commit message: `chore(backend): add @pg-boss/dashboard and dotenv-cli as devDependencies`

---

## Task 3: Add `dev:dashboard` script to `apps/backend/package.json`

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Add the script**

Edit `apps/backend/package.json`. In the `"scripts"` block, add this entry (insert after the existing `"start:dev"` line so it sits with the other dev-time scripts):

```json
    "dev:dashboard": "dotenv -e .env -- env HOST=127.0.0.1 PORT=3210 pg-boss-dashboard",
```

Verify the trailing comma is correct relative to surrounding entries (no comma after the last script in the block).

- [ ] **Step 2: Confirm the script is wired correctly**

Run from repo root:

```bash
pnpm --filter backend run
```

Expected: the printed list of scripts includes `dev:dashboard`.

- [ ] **Step 3: Stage for the user to commit**

```bash
git add apps/backend/package.json
```

Suggested commit message: `feat(backend): add dev:dashboard script for local pg-boss dashboard`

---

## Task 4: Add root `dev:dashboard` passthrough

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add the passthrough script**

Edit `package.json` at the repo root. In the `"scripts"` block, add this entry just after `"dev:backend"`:

```json
    "dev:dashboard": "pnpm --filter backend dev:dashboard",
```

The existing `"dev"` parallel script is **not** modified — the dashboard remains opt-in.

- [ ] **Step 2: Confirm the passthrough resolves**

Run from repo root:

```bash
pnpm run | grep dev:dashboard
```

Expected: the line `dev:dashboard` shows the passthrough command.

- [ ] **Step 3: Stage for the user to commit**

```bash
git add package.json
```

Suggested commit message: `feat(repo): add dev:dashboard passthrough at root`

---

## Task 5: Add `PGBOSS_SCHEMA` to `apps/backend/.env.example`

**Files:**
- Modify: `apps/backend/.env.example`

The dashboard binary reads `PGBOSS_SCHEMA` (no underscore in the middle). The queue work declares `PG_BOSS_SCHEMA` (with underscore). Both point at the same value `pgboss`. We mirror them — duplication is intentional per spec §5.1.

- [ ] **Step 1: Append the dashboard env block**

Edit `apps/backend/.env.example`. Append to the end of the file (after the existing `INTERNAL_API_TOKEN` block):

```
# pg-boss dashboard (local dev only — bound to 127.0.0.1:3210)
PGBOSS_SCHEMA=pgboss
```

- [ ] **Step 2: Mirror the var into your local `apps/backend/.env`**

Open `apps/backend/.env` (untracked) and add `PGBOSS_SCHEMA=pgboss` at the bottom so the dashboard can boot. Do **not** commit `.env`.

- [ ] **Step 3: Stage for the user to commit**

```bash
git add apps/backend/.env.example
```

Suggested commit message: `docs(backend): document PGBOSS_SCHEMA for dashboard`

---

## Task 6: Verify loopback bind, install Node-entry contingency if needed

**Files (conditionally created):**
- Create: `apps/backend/scripts/pg-boss-dashboard.mjs` (only if `HOST` env var is ignored)
- Modify: `apps/backend/package.json` (only if contingency triggers)

This is the spec §4.3 + §5.3 + §8 step 6 verification. The spec lists `HOST` as the optimistic path with a Node-entry fallback. Pick the path here, before documenting in Task 7.

**Prerequisites:** Postgres running (`docker compose up -d` from repo root) and the backend has been booted at least once so the `pgboss` schema exists. If you have not done that yet:

```bash
docker compose up -d
pnpm dev:backend   # in a separate terminal; wait for "[PgBoss] pg-boss started", then Ctrl-C
```

- [ ] **Step 1: Start the dashboard with the optimistic script**

Run from repo root:

```bash
pnpm dev:dashboard
```

Expected: the dashboard prints a startup line containing port `3210`. If it errors on `DATABASE_URL`, your `.env` is missing it — fix and retry. Leave the process running.

- [ ] **Step 2: Inspect the bound address with `lsof`**

In a second terminal:

```bash
lsof -nP -iTCP:3210 -sTCP:LISTEN
```

Interpret the `NAME` column:

- `127.0.0.1:3210` (or `[::1]:3210`) → loopback only. **HOST works. Skip to Step 6.**
- `*:3210` (or `0.0.0.0:3210`, or both an IPv4 and an IPv6 wildcard line) → all interfaces. **HOST is ignored. Continue to Step 3 to install the contingency.**

- [ ] **Step 3 (only if HOST ignored): Locate the dashboard's server entry**

The spec §5.3 documents the upstream entry as `@pg-boss/dashboard/build/server/index.js`, but if that path differs in the installed version, the .mjs needs to point at whatever the package actually ships.

Probe it. From repo root:

```bash
pnpm --filter backend exec node -e "console.log(require.resolve('@pg-boss/dashboard'))"
```

Expected: an absolute path. Inspect the package directory it points at to find the server entry. Most likely candidates, in order:

```bash
ls $(pnpm --filter backend exec node -e "console.log(require('path').dirname(require.resolve('@pg-boss/dashboard')))")
```

Look for `build/server/index.js` or `build/server/index.mjs` or a `bin/` folder. Note the resolved path; you will hard-code it in Step 4.

- [ ] **Step 4 (only if HOST ignored): Stop the dashboard and create the Node entry**

Stop the dashboard (`Ctrl-C` in the dashboard terminal).

Create `apps/backend/scripts/pg-boss-dashboard.mjs` (the directory does not exist; create it):

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const path = require.resolve('@pg-boss/dashboard/build/server/index.js');
process.env.HOST = '127.0.0.1';
await import(path);
```

If Step 3 found the entry at a different path (e.g., `build/server/index.mjs`), replace the string in `require.resolve(...)` with that exact path.

- [ ] **Step 5 (only if HOST ignored): Update the script in `apps/backend/package.json`**

Edit `apps/backend/package.json`. Replace the `dev:dashboard` script value:

```json
    "dev:dashboard": "dotenv -e .env -- env HOST=127.0.0.1 PORT=3210 pg-boss-dashboard",
```

with:

```json
    "dev:dashboard": "dotenv -e .env -- env PORT=3210 node scripts/pg-boss-dashboard.mjs",
```

(`HOST` is now set inside the .mjs since the binary ignored it externally.)

Restart the dashboard:

```bash
pnpm dev:dashboard
```

In the second terminal, re-run `lsof -nP -iTCP:3210 -sTCP:LISTEN`. Expected: bind shows `127.0.0.1:3210` (or `[::1]:3210`). If it still shows `*:3210`, the contingency did not work — stop and report the failure for triage; do not proceed.

- [ ] **Step 6: Confirm loopback works and LAN is refused**

With the dashboard running and bind confirmed loopback-only:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3210
```

Expected: `200` (or any 2xx/3xx response — the dashboard is up).

Then probe from a non-loopback address. On macOS:

```bash
LAN_IP=$(ipconfig getifaddr en0); echo "LAN IP = $LAN_IP"
curl -m 3 -s -o /dev/null -w "%{http_code}\n" "http://$LAN_IP:3210"
```

If `ipconfig getifaddr en0` is empty (e.g., on Wi-Fi via `en1`), try `en1`. If still empty, run `ifconfig | grep "inet " | grep -v 127.0.0.1` and pick a non-loopback IPv4 address manually.

Expected: `curl` exits non-zero (`Connection refused` or timeout). The HTTP code printed is `000` or empty. If you instead see `200`, the bind is **not** loopback-only — return to Step 3.

- [ ] **Step 7: Stop the dashboard cleanly**

`Ctrl-C` in the dashboard terminal. Expected: process exits without error logs.

- [ ] **Step 8: Stage any contingency files for the user to commit**

If Steps 3–5 fired, stage:

```bash
git add apps/backend/scripts/pg-boss-dashboard.mjs apps/backend/package.json
```

Suggested commit message: `feat(backend): use Node entry to enforce loopback bind for pg-boss dashboard`

If the optimistic path worked (no contingency), there is nothing new to stage from this task.

---

## Task 7: Document dashboard in `apps/backend/AGENTS.md`

**Files:**
- Modify: `apps/backend/AGENTS.md`

- [ ] **Step 1: Append a "Dashboard (local dev)" subsection**

Edit `apps/backend/AGENTS.md`. Find the existing section heading `### Background jobs (pg-boss)`. Walk down through that section to find the last subsection (currently `**Operational risks:**` followed by its bullet list). Insert this new subsection **after** the operational risks bullet list and **before** the next top-level subsection (`### Testing`):

````markdown
**Dashboard (local dev):**

A web UI for inspecting queues and jobs. Local-dev only — binds to 127.0.0.1, no auth.

In a separate terminal:

```bash
pnpm dev:dashboard
```

Open http://localhost:3210. Reads from the same `DATABASE_URL` / `pgboss` schema as the backend (`PGBOSS_SCHEMA` in `.env`, mirroring `PG_BOSS_SCHEMA`). Port `3210` is hard-coded in the `dev:dashboard` script; edit the script to change it. Warning history populates because the queue config sets `persistWarnings: true`.

**Production deployment** is intentionally not wired up. When the time comes, the dashboard ships as a standalone process (Node or Docker) fronted by a reverse proxy with auth (`PGBOSS_DASHBOARD_AUTH_USERNAME` / `PGBOSS_DASHBOARD_AUTH_PASSWORD`). See https://github.com/timgit/pg-boss/blob/master/packages/dashboard/README.md.
````

(The block above uses a four-backtick outer fence so the inner three-backtick `bash` block stays intact. When pasting into `AGENTS.md`, drop the outer four-backtick fence and copy only the content between them — the inner `​```bash` … `​```` fence stays as plain three-backtick fences.)

- [ ] **Step 2: Verify the placement**

Open `apps/backend/AGENTS.md` and confirm:

- The new subsection sits inside the `### Background jobs (pg-boss)` section.
- It appears after `**Operational risks:**` and before `### Testing`.
- The triple-backtick code fence around `pnpm dev:dashboard` renders as a normal Markdown code block.

- [ ] **Step 3: Stage for the user to commit**

```bash
git add apps/backend/AGENTS.md
```

Suggested commit message: `docs(backend): document pg-boss dashboard local-dev workflow`

---

## Task 8: Full end-to-end smoke test

This task does not change code. It runs the manual smoke test from spec §8 against the local Docker Postgres and confirms every claim made by Tasks 1–7.

- [ ] **Step 1: Postgres is running**

Run from repo root:

```bash
docker compose up -d
```

Expected: Postgres container listening on `:11753`. If already running, command is a no-op.

- [ ] **Step 2: Boot the backend**

In terminal 1, from repo root:

```bash
pnpm dev:backend
```

Expected log lines (from spec §8 step 2):

```
[PgBoss] pg-boss started
[PgBoss] WORKER_ROLE=both — registered 1 job handler(s)
```

Leave the backend running.

- [ ] **Step 3: Boot the dashboard**

In terminal 2, from repo root:

```bash
pnpm dev:dashboard
```

Expected: a startup log mentioning `http://127.0.0.1:3210` or `http://localhost:3210`. No errors. Leave it running.

- [ ] **Step 4: Open the dashboard in a browser**

Browse to `http://localhost:3210`. Confirm:

- The queue list loads without error.
- The `noop` queue is listed (it was registered by the backend when `WORKER_ROLE=both`).

If the page is blank or the queue list does not appear, check the dashboard terminal for errors and verify `DATABASE_URL` and `PGBOSS_SCHEMA` are reaching the dashboard process.

- [ ] **Step 5: Trigger a noop job and watch the dashboard**

In terminal 3:

```bash
curl -i -X POST http://localhost:3000/api/_internal/queue/noop \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $(grep '^INTERNAL_API_TOKEN=' apps/backend/.env | cut -d= -f2-)" \
  -d '{"message":"dashboard test"}'
```

Expected: `200 OK` with body `{"data":{"jobId":"<uuid>"},"message":"enqueued","success":true}`.

Refresh the dashboard. Confirm:

- The job appears under the `noop` queue.
- It transitions through `created` → `active` → `completed` (may complete fast — refresh).
- The job-detail view shows the payload `{ "message": "dashboard test" }`.

If any of those checks fail, the implementation is not complete. Most likely cause: `WORKER_ROLE` is set to `api` (job sits in `created` indefinitely) — verify with `grep WORKER_ROLE apps/backend/.env`.

- [ ] **Step 6: Re-confirm loopback bind**

Already verified in Task 6 — re-run as a final sanity check:

```bash
lsof -nP -iTCP:3210 -sTCP:LISTEN
```

Expected: `127.0.0.1:3210` (or `[::1]:3210`). Not `*:3210`.

- [ ] **Step 7: Stop the dashboard cleanly**

`Ctrl-C` in terminal 2. Expected: clean exit, no error logs. Connections to Postgres close gracefully.

- [ ] **Step 8: Stop the backend cleanly**

`Ctrl-C` in terminal 1. Expected log line:

```
[PgBoss] pg-boss stopped
```

No error logs.

- [ ] **Step 9: Final stage (no new files)**

If steps 1–8 revealed a bug, fix it and stage the fix. Otherwise nothing new to stage from this task — Tasks 1–7 already produced the staged changes, and the user will commit them as a coherent batch.

---

## Self-Review

Cross-checking the plan against `docs/superpowers/specs/2026-05-01-pg-boss-dashboard-design.md`:

| Spec section | Covered by |
| --- | --- |
| §1 Summary (sibling process, loopback, no auth, `pgboss` schema) | Tasks 3, 4, 6 |
| §2 Goals: `pnpm dev:dashboard` from repo root and `apps/backend/` | Tasks 3, 4 |
| §2 Goals: loopback only | Task 6 |
| §2 Goals: reads `DATABASE_URL` from `apps/backend/.env` | Task 3 (script form) |
| §2 Goals: `PGBOSS_SCHEMA` mirroring `PG_BOSS_SCHEMA` | Task 5 |
| §2 Goals: pinned dashboard version | Task 2 |
| §2 Goals: Warning History has data | Task 1 |
| §2 Goals: `AGENTS.md` documents the workflow | Task 7 |
| §2 Non-goals (no production wiring) | Task 7 (calls out future path), no impl tasks |
| §3 Library pins (`@pg-boss/dashboard`, `dotenv-cli`, Node ≥22.12, pg-boss ≥12.11) | Task 2 (incl. version-floor check at Step 5) |
| §4.1 Process model (sibling) | Tasks 3, 4 — separate script, separate process |
| §4.2 Why not in-process | No code change required |
| §4.3 Loopback bind (HOST env var, with Node-entry contingency) | Task 6 |
| §5.1 Backend script form | Task 3 |
| §5.1 Schema env-var name dual-write | Task 5 |
| §5.1 Root passthrough | Task 4 |
| §5.1 `pnpm dev` unchanged | Task 4 (note in Step 1) |
| §5.2 Env vars (`PGBOSS_SCHEMA`, no port env var, no auth env vars) | Task 5 |
| §5.3 Contingency Node entry script | Task 6 (Steps 3–5) |
| §6 Queue PR coordination (`persistWarnings`) — three branches | Task 1 |
| §7 Documentation | Task 7 |
| §8 Smoke test (steps 1–7) | Task 8 (full sequence) |
| §8 step 6 (loopback bind verification) | Task 6 step 6 + Task 8 step 6 |
| §9 File touch list | Reflected in this plan's File Structure section |
| §10 Open risks (HOST unverified, pg-boss ≥12.11, schema-must-exist ordering) | Task 6 (HOST), Task 2 step 5 (version floor), Task 8 step 2 (boot backend before dashboard) |

**Naming consistency check:** Script name `dev:dashboard` is consistent across `apps/backend/package.json` (Task 3), root `package.json` (Task 4), `AGENTS.md` (Task 7), and smoke test (Task 8). Env var `PGBOSS_SCHEMA` (no underscore) is consistent across Task 5, Task 7 documentation, and the rationale in spec §5.1. The contingency file path `apps/backend/scripts/pg-boss-dashboard.mjs` is consistent across Task 6 and the File Structure listing.

**Placeholder scan:** No "TBD", "implement later", "similar to above", or vague "add appropriate handling" instructions. Every code step shows the exact change. Every command has expected output. The Branch B path is fully written out (not deferred to "edit accordingly").

**Type/path consistency:** The `pg-boss.config.ts` change is a single property addition — `persistWarnings: true` — with no type drift. The contingency .mjs uses `require.resolve('@pg-boss/dashboard/build/server/index.js')` with an explicit step (Task 6 Step 3) to verify the actual installed entry path before writing the file, so a divergent upstream layout is caught and corrected.

**Repo-convention consistency:** Every task ends with `git add ...` and a suggested commit message; no task runs `git commit`. This matches the user's stated preference.

---

## Execution Notes

- **Order matters between Task 1 and Task 8.** If Task 1 takes Branch B (queue plan edit), Task 8 step 2 will fail until the queue plan has been executed and `WORKER_ROLE` plus the noop handler are wired up. In that case, run Task 8 only after the queue work has shipped.
- **Branches A and C of Task 1 produce identical file diffs** but live in different commits. The decision is purely about which commit the change rides in.
- **No automated tests for the dashboard itself** (spec §2). The only test changes in this plan are in Task 1 (two assertion additions in `pg-boss.config.spec.ts`).

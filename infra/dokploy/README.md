# Dokploy deployment

Production stacks for a self-hosted [Dokploy](https://dokploy.com) host. The repo-root
`docker-compose.yaml` is the **local dev** stack; nothing here runs as part of `pnpm dev`.

## Topology

LaunchStack runs as **two** Dokploy apps. One directory per app; the directory name IS the
app name.

| Dokploy app | Compose path (set in Dokploy → General) | Services | Lifecycle |
|---|---|---|---|
| `temporal` | `infra/dokploy/temporal/docker-compose.yaml` | `temporal-schema`, `temporal-history`, `temporal-matching`, `temporal-frontend`, `temporal-worker`, `temporal-bootstrap`, `temporal-admin`, `temporal-ui` | Infra. Deploy once; redeploy only on a version bump. |
| `launchstack` | `infra/dokploy/launchstack/docker-compose.yaml` | `backend`, `worker`, `frontend`, `otel-collector`, `migrate` (profile-gated) | App. Redeploys on every code change. |

Images are built from `infra/docker/` (`Dockerfile.backend` for API + worker + migrator,
`Dockerfile.frontend` for the SPA on nginx). Build context is always the repo root.

```
                        dokploy-network (external, host-wide)
  ┌──────────────────────────┴───────────────────────────────┐
  │                                                          │
┌─┴──────────────── app: temporal ─┐      ┌──────────────────┴── app: launchstack ─┐
│  temporal-frontend alias temporal│◄─────┤  backend   :3000  ← API_DOMAIN         │
│    :7233 gRPC                    │◄─────┤  worker    (xWORKER_REPLICAS)          │
│  history / matching / worker     │      │  frontend  :80    ← APP_DOMAIN         │
│  temporal-ui :8080 ← UI_DOMAIN   │      │  otel-collector → Grafana Cloud        │
└──────────────────────────────────┘      └────────────────────────────────────────┘
                     └──────── external Postgres ────────┘
```

Each directory holds its own `.env.example`; the two env sets do not overlap. Compose
resolves `.env` and `env_file:` against the **compose file's** directory, so the env lands
beside the compose file, not at the repo root.

### Why the worker is not a third app

Backend and worker share one image. Splitting them would let them deploy independently —
the backend starts workflows the worker replays, so version skew produces non-determinism
errors on in-flight workflows. One app keeps the deploy atomic. Scale with
`WORKER_REPLICAS` instead.

## First deploy

1. **Postgres.** Provision it (Dokploy-managed is fine). The Temporal user needs
   `CREATE DATABASE`.
2. **`temporal` app.** Fill env from `temporal/.env.example` (set
   `TEMPORAL_NUM_HISTORY_SHARDS` now — it is immutable), deploy, wait for
   `temporal-bootstrap` to exit 0 (~30–60s on first boot).
3. **`launchstack` app.** Fill env from `launchstack/.env.example`. In the Domains tab add
   `backend:3000` → `API_DOMAIN` and `frontend:80` → `APP_DOMAIN`.
4. **Migrate** (operator step, deploys never migrate). From the Dokploy host, in the app's
   deploy directory:
   ```bash
   docker compose -f infra/dokploy/launchstack/docker-compose.yaml run --rm --build migrate
   ```
5. **Deploy** the `launchstack` app.

Later code changes: redeploy `launchstack`. Run step 4 first whenever the change adds a
migration.

## Things that will bite

**`depends_on` cannot cross compose files.** Nothing in `launchstack` waits for Temporal.
`worker.ts` connects eagerly, so if Temporal is unreachable it exits and
`restart: unless-stopped` retries. Redeploying `temporal` causes restart churn in
`launchstack`; that is expected.

**`TEMPORAL_ALIAS` is host-wide.** Only one stack on the box may publish the alias
`temporal`. A second one makes Docker DNS round-robin between two clusters, silently.
Change `TEMPORAL_ALIAS` and the app's `TEMPORAL_ADDRESS` together.

**Temporal has no authentication.** Any container on `dokploy-network` can dial
`temporal:7233` and terminate or reset any workflow. The boundary is the network. See
"HARDENING 7233" at the bottom of `temporal/docker-compose.yaml`.

**Temporal UI must not be added in the Domains tab.** Its Traefik labels carry a basicauth
middleware; the Domains tab cannot, and a second router on the same host may win and serve
the console unauthenticated.

**`API_DOMAIN` is baked into the SPA.** Changing it needs a rebuild of `frontend`. Keep
`APP_DOMAIN` and `API_DOMAIN` sibling subdomains so auth cookies stay same-site.

**Worker log files are per replica** (`worker-<container-id>.log`). Dead replicas leave
orphans on `app_logs`, and the collector keeps a checkpoint per file. Prune periodically.

**Concurrency limits are per replica.** Ceiling = `WORKER_REPLICAS ×
TEMPORAL_MAX_CONCURRENT_ACTIVITIES` against the Postgres pool.

**Backups.** `temporal` and `temporal_visibility` are production databases now; put them
in the same backup policy as the app DB.

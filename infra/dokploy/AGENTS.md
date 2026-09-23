# AGENTS.md

Guidance for editing the Dokploy stacks in this directory. Topology and deploy order are in
[README.md](./README.md).

Every compose file here is deployed by Dokploy as **Compose type**, not by developers and
not as Swarm Stack. Each rule below is a mistake whose failure mode is silent.

## Dokploy owns Traefik, TLS and ports 80/443

Never add `ports:` for anything Traefik fronts, and never ship a proxy container. Publish a
service by attaching it to `dokploy-network` and routing it via the Domains tab or Traefik
labels. Entrypoints are `web` (80) and `websecure` (443); the ACME resolver is
`letsencrypt`.

## Traefik labels vs the Domains tab: one per hostname

The Domains tab cannot attach middleware. A service needing basicauth, IP allowlists or
redirect chains gets hand-written labels instead, and its hostname must NOT also appear in
the Domains tab — two routers with the same `Host()` rule may serve the unauthenticated one.
`temporal-ui` is exactly this case.

Router, middleware and service names in labels are global to the Traefik instance.
`traefik.http.routers.temporal-ui` collides with any other stack using that name.

## `dokploy-network` is host-wide

Declared `external: true` everywhere. DNS aliases on it are host-unique (only one stack may
publish `temporal`), and anything on it can reach `temporal-frontend:7233` unauthenticated.
A network declared inside a compose file (`internal:`) is project-scoped, so cross-stack
traffic must use `dokploy-network`.

## Paths are relative to the compose file

`.env`, `env_file:`, `context:` and bind-mount sources resolve against the compose file's
directory. `launchstack/` relies on this (`context: ../../..`,
`../../otel-collector/config.yaml`); moving a compose file breaks both silently.

Files tracked in the repo are bind-mountable directly (Dokploy clones the repo). Avoid
Dokploy UI mounts (`../files/<name>`): if the source is missing on a host, Docker creates a
**directory** there and the container dies at boot. Prefer a repo file, then an env var,
then a file baked into an image.

## Env: `.env` is written by Dokploy, `.env.example` is tracked

Add every new `${VAR}` to the matching `.env.example` in the same change — a var that only
exists in the compose file silently takes its `:-default`.

Auto-loaded `.env` only feeds `${...}` interpolation in the compose file. A variable the app
reads at runtime also needs `env_file:` or `environment:`. `launchstack/` uses
`env_file: [.env]`; `temporal/` passes everything through `environment:`.

`$` in a value is interpolation. Bcrypt hashes must have every `$` doubled to `$$`.
Inside `command:` scripts, `$${VAR}` and `$$(cmd)` reach the container as `${VAR}` and
`$(cmd)`.

## Compose type, not Stack type

`depends_on` conditions, `restart: unless-stopped` and `deploy.resources.limits` are Compose
semantics. Under Swarm, `depends_on` is ignored and Temporal's server roles would start
against an unmigrated database.

## One-shot jobs re-run on every deploy

`temporal-schema` and `temporal-bootstrap` (`restart: "no"`) start again on every
`docker compose up`. Keep them idempotent, with internal retry loops — they gate the rest
of the stack via `service_completed_successfully`, so a failure fails the whole deploy.
Exited-0 containers may make Dokploy show the stack as degraded; that is cosmetic.

## Before committing a change here

```bash
(cd infra/dokploy/temporal && docker compose --env-file .env.example config -q)
(cd infra/dokploy/launchstack && cp .env.example .env && docker compose config -q; rm .env)
```

Extract shell embedded in `command:` blocks and check it with `sh -n` — Compose validates
the YAML, not the script.

## References

- [Dokploy Docker Compose](https://docs.dokploy.com/docs/core/docker-compose) and [Domains](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Dokploy Environment Variables](https://docs.dokploy.com/docs/core/variables)
- [Dokploy Volumes & Mounts troubleshooting](https://docs.dokploy.com/docs/core/troubleshooting/volumes-mounts)
- [Temporal production checklist](https://docs.temporal.io/self-hosted-guide/production-checklist)
- [temporalio/docker-builds](https://github.com/temporalio/docker-builds) — `config_template.yaml` and `docker/entrypoint.sh`, the authority on server env vars
- [Traefik basicauth](https://doc.traefik.io/traefik/middlewares/http/basicauth/)

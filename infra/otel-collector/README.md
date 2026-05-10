# OTel Collector — Log Shipping to Grafana Cloud

This sidecar tails the NestJS backend's JSON log file (`<repo-root>/logs/app.log`) and forwards records to Grafana Cloud's OTLP gateway. Grafana Cloud routes them into Loki, where they're queryable as structured fields.

```
NestJS (host) ── ./logs/app.log ── bind-mount ──► otel-collector ──► Grafana Cloud OTLP ──► Loki
```

## Prerequisites

1. A Grafana Cloud stack with OpenTelemetry enabled.
2. The OTLP HTTP endpoint and a pre-encoded Basic auth token. Both are visible at:
   **Grafana Cloud → Connections → Add new connection → "OpenTelemetry (OTLP)"**

## One-time setup

Copy the root `.env.example` to `.env` and fill in the three OTLP variables:

```bash
cp .env.example .env
```

Edit `.env`:

```
DEPLOY_ENV=local
GRAFANA_CLOUD_OTLP_ENDPOINT=https://otlp-gateway-prod-<region>-<n>.grafana.net/otlp
GRAFANA_CLOUD_OTLP_AUTH=<base64 of instance_id:api_token>
```

> If you have the instance ID and token but not the encoded value:
> ```bash
> echo -n "<instance_id>:<api_token>" | base64
> ```

The backend's own logging vars live in `apps/backend/.env`:

```
LOG_LEVEL=info
LOG_FILE_PATH=../../logs/app.log
LOG_FILE_MAX_SIZE=50M       # optional, default 50M
LOG_FILE_KEEP_FILES=7       # optional, default 7
```

`LOG_FILE_PATH` is resolved relative to `apps/backend/` (where `pnpm dev:backend` runs), so `../../logs/app.log` points at the repo-root `logs/` directory the collector bind-mounts.

### Rotation

Pino writes via `pino-roll`, which rotates the active file when it hits `LOG_FILE_MAX_SIZE` and keeps at most `LOG_FILE_KEEP_FILES` rolled files. Filenames look like:

```
logs/app.log         # active
logs/app.log.1       # rotated
logs/app.log.2
...
```

The collector's `filelog` receiver glob picks up both `*.log` and `*.log.*`, so rolled files are still ingested if rotation fires before the collector reads them. Use `: > logs/app.log` (truncate in place) rather than `rm logs/app.log` if you want a clean slate while everything is running — it preserves the inode the collector is tailing.

## Run it

```bash
docker compose up -d otel-collector
```

Tail the collector's own logs to confirm it started cleanly:

```bash
docker compose logs -f otel-collector
```

Look for `Everything is ready. Begin running and processing data.` Press Ctrl-C to stop tailing — the container stays running.

## Verify the pipeline end-to-end

1. Start the backend:
   ```bash
   pnpm dev:backend
   ```
2. Generate a request:
   ```bash
   curl -i http://localhost:3000/
   ```
   Note the `x-request-id` header in the response.
3. Confirm the line landed on disk:
   ```bash
   tail -n 1 logs/app.log
   ```
   Expect a single JSON object with `level`, `time`, `req`, `msg`.
4. In Grafana Cloud → Explore → your Loki data source, run:
   ```
   {service_name="launchstack-backend"}
   ```
   Lines should appear within ~10s (5s batch + ingestion lag).
5. Filter by request id (replace `<id>` with the value from step 2):
   ```
   {service_name="launchstack-backend"} | json | req_id=`"<id>"`
   ```

> **Loki label-name detail:** OTLP→Loki ingestion replaces dots with underscores in resource attribute names. The OTel attribute `service.name` becomes the Loki label `service_name`.

## Stop it

```bash
docker compose stop otel-collector       # leave container, keep checkpoint volume
docker compose down                      # stop everything (postgres + collector); volume persists
docker compose down -v                   # also wipe the named volume `otel_checkpoints`
```

## Reset the file-tail position

The collector tracks how far it has read into `app.log` in the `otel_checkpoints` named volume. To re-ingest the file from scratch:

```bash
docker compose down
docker volume rm launchstack_otel_checkpoints
docker compose up -d otel-collector
```

The receiver is configured with `start_at: end`, so on first boot (or after a reset) it only reads **new** lines — not historical ones. If you want to backfill on first boot, change `start_at` to `beginning` in `config.yaml`.

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Collector logs `401 Unauthorized` | `GRAFANA_CLOUD_OTLP_AUTH` is missing, malformed, or for the wrong stack | Re-generate the encoded token (`echo -n "id:token" \| base64`), update `.env`, `docker compose up -d otel-collector` |
| Collector logs `connection refused` or DNS errors | `GRAFANA_CLOUD_OTLP_ENDPOINT` is missing the `/otlp` path or wrong region | Compare against Grafana Cloud's OTLP onboarding page; the URL must include the trailing `/otlp` |
| `tail logs/app.log` shows lines, but nothing in Loki | Collector is buffering. Check `docker compose logs otel-collector` for export errors | If clean, wait 30s — first batch send is delayed by `batch.timeout: 5s` plus Loki indexing lag |
| `logs/app.log` doesn't exist | Backend hasn't written yet, or `LOG_FILE_PATH` resolves to the wrong place | From `apps/backend/`, run `pwd` and confirm `../../logs/app.log` resolves to the repo-root `logs/` directory |
| `permission denied` writing `logs/app.log` | Docker created the bind-mount target as root because `logs/` didn't exist when `docker compose up` ran | `sudo chown -R "$(id -u):$(id -g)" logs/` and ensure `logs/.gitkeep` is committed so the dir always exists |
| Collector restarts in a loop | YAML syntax error in `config.yaml` | `python3 -c "import yaml; yaml.safe_load(open('infra/otel-collector/config.yaml'))"` to validate; check the container's first-line error |

## Outage simulation (sanity check)

Logs are durable across collector outages because the file is the buffer:

```bash
docker compose stop otel-collector
curl http://localhost:3000/        # write some lines while collector is down
curl http://localhost:3000/
docker compose start otel-collector
```

Within ~30s those lines should appear in Loki. The filelog receiver replays from the last checkpoint stored in `otel_checkpoints`.

## Pretty terminal output (optional)

The default config writes JSON-only — convenient for the collector, less so when reading the terminal directly. To add a pretty stream alongside the rolling file, install `pino-pretty` and add a second target in `apps/backend/src/logger/pino.config.ts`:

```bash
pnpm add pino-pretty --filter backend
```

```ts
transport: {
  targets: [
    {
      target: 'pino-pretty',
      level,
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    },
    // ...the existing pino-roll target
  ],
},
```

Both targets run in their own worker threads, so the file output (used by the collector) stays untouched.

## Configuration files

| File | What it does |
|---|---|
| `config.yaml` | The collector pipeline: filelog receiver → resource/batch processors → otlphttp exporter, plus the `file_storage` extension for checkpoints and persistent send queue |
| `../../docker-compose.yaml` (`otel-collector` service) | Image pin, bind mounts, env passthrough, named volume for checkpoints |

## Adding traces or metrics later

The exporter is OTLP HTTP, which Grafana Cloud accepts for all three signal types through the same endpoint and auth token. To add traces or metrics:

1. Add a receiver (e.g., `otlp` for OTLP from the app, or `hostmetrics` / `prometheus`).
2. Add a `traces:` or `metrics:` pipeline under `service.pipelines:`, reusing the same `otlphttp/grafana` exporter.
3. Restart the collector. No new credentials needed.

#!/usr/bin/env bash
# Drop the local Temporal databases and let auto-setup rebuild them.
#
#   pnpm temporal:reset        # asks for confirmation
#   pnpm temporal:reset -y     # no prompt
#
# DESTRUCTIVE. Every workflow, workflow history, task queue and registered
# search attribute in the local cluster is gone, and nothing comes back. The
# application database (`launchstack`) is NOT touched — only `temporal` and
# `temporal_visibility`.
#
# Local development only. It targets the launchstack-postgres container by name,
# so it cannot reach a deployed cluster.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_CONTAINER=launchstack-postgres
PG_USER=${POSTGRES_USER:-launchstack}
# Connect through a database we are not dropping.
PG_MAINT_DB=${POSTGRES_DB:-launchstack}
CORE_DB=temporal
VIS_DB=temporal_visibility
# Restarted after the drop so auto-setup recreates the schema. admin-tools is
# included because it is the container used to poll for cluster health.
TEMPORAL_SERVICES=(temporal temporal-ui temporal-admin-tools)

if ! docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
  echo "error: container $PG_CONTAINER not found — start it with: docker compose up -d postgres" >&2
  exit 1
fi

if [ "${1:-}" != "-y" ] && [ "${1:-}" != "--yes" ]; then
  echo "This DROPS the local Temporal databases: $CORE_DB, $VIS_DB"
  echo "All workflow history in the local cluster will be permanently lost."
  printf "Type 'drop' to continue: "
  read -r reply
  if [ "$reply" != "drop" ]; then
    echo "aborted"
    exit 1
  fi
fi

# The server holds open connections to both databases, and DROP DATABASE cannot
# run while they exist. WITH (FORCE) would terminate them, but a running server
# reconnects immediately, so stop it first.
echo "==> stopping ${TEMPORAL_SERVICES[*]}"
docker compose stop "${TEMPORAL_SERVICES[@]}"

echo "==> dropping $CORE_DB and $VIS_DB"
# FORCE (Postgres 13+) cleans up any connection that outlived the container stop.
docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_MAINT_DB" \
  -c "DROP DATABASE IF EXISTS $CORE_DB WITH (FORCE)" \
  -c "DROP DATABASE IF EXISTS $VIS_DB WITH (FORCE)"

echo "==> starting ${TEMPORAL_SERVICES[*]}"
docker compose up -d "${TEMPORAL_SERVICES[@]}"

# auto-setup recreates both databases, migrates them and registers the default
# namespace on boot. That takes 30-60s on an empty database, so wait rather than
# handing back a prompt while the cluster is still unusable.
echo "==> waiting for cluster to serve (up to 120s)"
for i in $(seq 1 40); do
  # busybox timeout: the health call blocks on its own gRPC deadline when the
  # frontend is not listening yet, which would stall this loop.
  if docker exec launchstack-temporal-admin \
    timeout 5 temporal operator cluster health --address temporal:7233 >/dev/null 2>&1; then
    echo "==> temporal is serving on localhost:7233 with fresh databases"
    exit 0
  fi
  sleep 3
done

echo "error: cluster did not become healthy — check: docker compose logs temporal" >&2
exit 1

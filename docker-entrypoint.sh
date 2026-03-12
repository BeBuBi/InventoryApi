#!/bin/sh
set -e

# Ensure data and logs directories exist (no-op if already present).
# Volume-level permissions must be handled at the orchestration layer
# (e.g. Kubernetes securityContext.fsGroup) since this container runs
# as coxapp (non-root) and cannot chown mounted volumes.
mkdir -p /opt/cox/data /opt/cox/logs

exec "$@"

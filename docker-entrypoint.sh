#!/bin/sh
set -e

# When /app/data is volume-mounted, the host directory is typically owned by
# root, shadowing the chown done at image build time. Fix ownership here
# (runs as root) before dropping to the app user.


exec "$@"

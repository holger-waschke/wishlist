#!/usr/bin/env sh
set -euo pipefail

# Copy reservations.json if it doesn't exist
if [ ! -f /data/reservations.json ]; then
    touch /data/reservations.json
fi

# Copy wishes.private.json if it doesn't exist
if [ ! -f /data/wishes.private.json ]; then
   touch /data/wishes.private.json
fi

# Set ownership
chown app:app /data/wishes.private.json /data/reservations.json || true

# Drop privileges and exec main app
exec su-exec app:app /app/wishlist-linux-arm64
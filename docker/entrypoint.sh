#!/bin/sh
set -e

# Ensure the storage tree exists (named volumes mount in empty).
mkdir -p \
    storage/app/private storage/app/chunks storage/app/trash storage/app/thumbs \
    storage/framework/cache storage/framework/sessions storage/framework/views \
    storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

# Rebuild the package manifest (composer ran with --no-scripts at build time).
php artisan package:discover --ansi >/dev/null 2>&1 || true

# Migrations + seed only on the web service (RUN_MIGRATIONS=true). Idempotent.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] running migrations…"
    php artisan migrate --force
    php artisan db:seed --force || true
    php artisan storage:link 2>/dev/null || true
fi

# Cache config + events (NOT routes — the app has closure routes).
php artisan config:cache >/dev/null 2>&1 || true
php artisan event:cache >/dev/null 2>&1 || true

exec docker-php-entrypoint "$@"

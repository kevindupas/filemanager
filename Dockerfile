# syntax=docker/dockerfile:1

# ── Stage 1: build front-end assets (Vite) ────────────────────────────────────
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY resources resources
COPY public public
COPY vite.config.js tsconfig.json components.json eslint.config.js .prettierrc .prettierignore ./
RUN npm run build

# ── Stage 2: PHP dependencies (no dev) ────────────────────────────────────────
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# Platform extensions are guaranteed by the FrankenPHP runtime stage, so skip the
# check here (the composer image lacks ext-ftp / ext-pgsql / etc).
RUN composer install --no-dev --no-scripts --prefer-dist --optimize-autoloader --no-interaction --ignore-platform-reqs

# ── Stage 3: runtime (FrankenPHP — multi-arch: arm64 + amd64) ────────────────
FROM dunglas/frankenphp:1-php8.4 AS app
WORKDIR /app

# PHP extensions the app needs (postgres, redis, image thumbnails, ftp, queue).
RUN install-php-extensions \
    pdo_pgsql pgsql redis gd exif ftp intl zip pcntl bcmath opcache

# Production opcache + JIT tuning + upload limits (> 5 MB chunk size).
COPY docker/opcache.ini /usr/local/etc/php/conf.d/zz-opcache.ini
COPY docker/uploads.ini /usr/local/etc/php/conf.d/zz-uploads.ini

# App code + vendored deps + built assets.
COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

# Drop any cached package/config manifest that leaked in from a dev checkout
# (e.g. laravel/pail, a dev-only provider) — regenerated at runtime --no-dev.
RUN rm -f bootstrap/cache/*.php \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker/entrypoint.sh

# FrankenPHP serves /app/public. SERVER_NAME=:80 → plain HTTP (no auto-TLS for IPs).
ENV SERVER_NAME=:80
EXPOSE 80

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]

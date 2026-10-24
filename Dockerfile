# syntax=docker/dockerfile:1

# --- Build: offizielles Vite+-Toolchain-Image; Bun kommt über devEngines/bun.lock ---
FROM ghcr.io/voidzero-dev/vite-plus:1.4.0 AS build
WORKDIR /app

COPY --chown=vp:vp package.json bun.lock .node-version* ./
RUN vp install --frozen-lockfile

COPY --chown=vp:vp . .
RUN vp check && vp run typecheck && vp test && vp build

# --- Runtime: statische Auslieferung mit nginx als Nicht-Root-Benutzer (uid 101) ---
FROM docker.io/nginxinc/nginx-unprivileged:1.31-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=755 docker/40-jailfin-config.sh /docker-entrypoint.d/40-jailfin-config.sh
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

# Leer = Login-Feld ohne Vorbelegung. Enthält nur die öffentliche Server-Adresse, nie Tokens.
ENV JELLYFIN_URL=""

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

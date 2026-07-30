# Build recipe for the Expo web bundle, served as static files by nginx.
#
# Build context is the REPO ROOT, not mediacion-app: pnpm needs the workspace
# lockfile and every member manifest to install with --frozen-lockfile.
#
#   docker build -f mediacion-app/Dockerfile -t mediacion-web \
#     --build-arg EXPO_PUBLIC_API_URL=... \
#     --build-arg EXPO_PUBLIC_SUPABASE_URL=... \
#     --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=... .
#
# In Coolify: build pack Dockerfile, Dockerfile path `mediacion-app/Dockerfile`,
# base directory the repo root, port 80. The three EXPO_PUBLIC_* variables must
# be marked as BUILD variables, not just runtime ones — see the guard below.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Keeps pnpm from asking for interactive confirmation it can never get.
ENV CI=true
RUN corepack enable
WORKDIR /app

# ---- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY mediacion-app/package.json mediacion-app/
COPY apps/api/package.json apps/api/
COPY packages/db-types/package.json packages/db-types/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM base AS build

# These are read by the app at BUILD time and inlined into the bundle; nothing
# reads them at runtime. All three are public by design — the anon key is meant
# to ship to browsers, and config/env.ts refuses to boot if that slot ever holds
# a service_role key instead.
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY

# Fail the build rather than ship a bundle silently wired to nothing. Without
# this, a missing build variable produces a working-looking site whose requests
# all go to undefined — a failure that only shows up in the browser.
RUN for v in EXPO_PUBLIC_API_URL EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY; do \
      eval "val=\$$v"; \
      if [ -z "$val" ]; then \
        echo "ERROR: build argument $v is empty." >&2; \
        echo "These are inlined into the bundle at build time, so they must be" >&2; \
        echo "passed as --build-arg (in Coolify: mark them as build variables)." >&2; \
        exit 1; \
      fi; \
    done

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mediacion-app/node_modules ./mediacion-app/node_modules
COPY . .

# app.json sets web.output to "static", so this emits plain HTML/JS under
# mediacion-app/dist. `.dockerignore` excludes **/dist, so no stale local build
# can leak into the image and be served instead.
RUN pnpm --filter mediacion-app exec expo export --platform web

# ---- runtime ----------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY mediacion-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mediacion-app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# Build recipe for the NestJS API inside the pnpm workspace.
#
# Build context is the REPO ROOT, not apps/api: the API depends on
# @mediacion/db-types and @mediacion/shared via `workspace:*`, so the lockfile
# and both packages have to be present for the install to resolve.
#
#   docker build -f apps/api/Dockerfile -t mediacion-api .
#
# In Coolify: set the build pack to Dockerfile, the Dockerfile path to
# `apps/api/Dockerfile`, and leave the base directory at the repo root.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Without this the prod re-resolve below dies on
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY: pruning dev dependencies means
# purging node_modules, and pnpm asks for confirmation it can never get inside
# a build. Purging is precisely what is wanted here, so let it through.
ENV CI=true
# The Coolify host prefers IPv6 for registry.npmjs.org and its v6 egress is
# broken. Two consecutive web builds died fetching the pnpm tarball: once with
# UND_ERR_SOCKET after 5.9 MB from source address 2a02:c207:2347:1126::1, once
# with ECONNRESET. `runtime` is a separate stage and does not inherit this.
ENV NODE_OPTIONS=--dns-result-order=ipv4first
RUN corepack enable
WORKDIR /app

# Fetch the pnpm pinned by `packageManager` once, here, into corepack's cache.
# `corepack enable` only installs a shim; the tarball is downloaded lazily on the
# first pnpm call. Every stage below derives from `base` but caches its own
# layers, so without this `deps` and `build` each fetch pnpm again over that
# broken route — one flaky download became three chances to fail the build.
COPY package.json ./
RUN for attempt in 1 2 3; do \
      corepack install && exit 0; \
      echo "corepack install failed (attempt $attempt of 3), retrying" >&2; \
      sleep 5; \
    done; \
    echo "ERROR: could not fetch the pinned pnpm after 3 attempts." >&2; \
    exit 1

# ---- dependencies -----------------------------------------------------------
# Only manifests are copied first so this layer is reused whenever source
# changes but dependencies do not.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db-types/package.json packages/db-types/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db-types/node_modules ./packages/db-types/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

# The trailing `...` selects the API *and its workspace dependencies*, built in
# topological order. @mediacion/shared resolves to ./dist/index.js and has to be
# compiled first; building only @mediacion/api fails with TS2307 because
# packages/shared/dist is absent from a fresh clone (gitignored, and excluded
# here by .dockerignore). @mediacion/db-types needs no build — it points
# straight at ./src/index.ts — and pnpm simply skips packages without the script.
RUN pnpm --filter "@mediacion/api..." build

# Re-resolve with dev dependencies pruned. `--frozen-lockfile` keeps this
# honest: it fails rather than silently resolving something the lockfile
# does not pin.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Never run the API as root.
RUN addgroup -S nodejs -g 1001 && adduser -S nestjs -u 1001 -G nodejs

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=nestjs:nodejs /app/packages ./packages

USER nestjs
EXPOSE 3000

# GET /health is public (no bearer token), which is exactly what a container
# healthcheck needs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# nest build emits under dist/src/ because the project's rootDir resolves to the
# package root, not to src/.
CMD ["node", "apps/api/dist/src/main.js"]

# Deploying the API on Coolify

The VPS at `169.58.88.64:8000` runs **Coolify**, and Supabase is already deployed
through it. This describes how the NestJS API (`apps/api`) joins it.

## 1. Create the resource

New resource → **Private/Public Repository** → `github.com/MagneStudios/Mediacion`.

| Setting | Value |
|---|---|
| Build pack | `Dockerfile` |
| Dockerfile location | `apps/api/Dockerfile` |
| Base directory | `/` (repo root — **not** `apps/api`) |
| Port | `3000` |
| Branch | `main` |

The base directory must stay at the repo root: the API depends on
`@mediacion/db-types` and `@mediacion/shared` through `workspace:*`, so the
lockfile and both packages have to be inside the build context.

## 2. `DATABASE_URL` — the one that bites

Postgres is **not** reachable from outside the server. Verified:

```
$ psql postgresql://…@169.58.88.64:5432/postgres
connect ECONNREFUSED 169.58.88.64:5432
```

Coolify keeps the database inside its Docker network, which is the correct
posture — do not publish 5432 to fix this.

So the `DATABASE_URL` that uses the public IP works from **nowhere**, including
from another container on the same host unless they share a network. Attach the
API to the same Docker network as the Supabase service and point
`DATABASE_URL` at the **internal** hostname, which Coolify shows on the Supabase
service page (it looks like `supabase-db-<id>`):

```
DATABASE_URL=postgresql://postgres:<password>@<internal-db-host>:5432/postgres
```

Same for `SUPABASE_URL`: the internal Kong hostname avoids a pointless round trip
back out through nginx.

## 3. Environment variables

### Required — the API refuses to boot without these

| Variable | Where it comes from |
|---|---|
| `SUPABASE_JWT_SECRET` | Coolify → Supabase service → the JWT secret. Must be the value the `anon`/`service_role` keys were signed with, or every request 401s. |
| `DATABASE_URL` | See section 2 — internal host, not the public IP. |
| `CRON_SECRET` | Any strong random string you choose. Guards `GET /sweep`. |

### Recommended

| Variable | Notes |
|---|---|
| `PORT` | Defaults to `3000`. |
| `CORS_ORIGINS` | Comma-separated. **Leave unset and CORS stays off**, which breaks Expo Web but is safe for native. Set it to the web origin once there is one. |

### Optional — features degrade gracefully when absent

Since PR #44 these no longer block startup; the feature that needs them is
simply inert.

| Variable | Feature |
|---|---|
| `OPENROUTER_API_KEY` | AI proposal generation |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | MercadoPago checkout and webhook |
| `DOCUSIGN_*` | Agreement signature flow |
| `SMTP_*`, `FCM_KEY`, `APNS_KEY` | Notification delivery |
| `OPERACIONES_EMAIL` | Destination inbox for the legal module: version-change notices, arrepentimiento and contacto submissions. **Empty means those emails are logged instead of sent** — the instructivo TyC §5 requires a channel someone actually answers, so set it before going live. |
| `LEGAL_AVISO_DIAS_ANTICIPACION` | How many days before `valid_from` the version-change notice goes out. Defaults to `10`, the instructivo minimum. |
| `LEGAL_PUBLIC_REQUESTS_PER_WINDOW` | Per-IP rate limit for the public legal forms (arrepentimiento/contacto). Defaults to `5` requests per window. |
| `LEGAL_PUBLIC_WINDOW_MS` | Window size for that rate limit. Defaults to `3600000` (1 hour). |

**Never** set `SUPABASE_SERVICE_ROLE_KEY` on the API. It does not read it: the
API connects with its own `DATABASE_URL` and enforces isolation in code.

## 4. Verifying a deploy

`GET /health` is public and needs no token — it is what the container
healthcheck uses:

```
curl -s https://<api-host>/health          # {"status":"ok"}
```

`/health` does not touch the database, so it says nothing about `DATABASE_URL`.

**An unauthenticated `401` proves nothing either.** An earlier version of this
document claimed a `401` from `/casos` showed the guard was reaching
`public.usuarios`. It does not: with no token the guard rejects the request
before any query runs, so a completely broken `DATABASE_URL` returns the same
`401`. That claim cost real debugging time and is why the deploy looked healthy
while nothing worked.

To actually prove the API reaches the database, send a **valid** token and read
the error code, not the status:

```
TOKEN=$(curl -s -X POST "https://<kong-host>/auth/v1/token?grant_type=password" \
  -H "apikey: <anon-key>" -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' | jq -r .access_token)

curl -s https://<api-host>/me -H "Authorization: Bearer $TOKEN"
```

| response | meaning |
|---|---|
| `200` with the user object | fully working |
| `401 user_not_provisioned` | **the database is reachable** — the query ran and found no `public.usuarios` row. Usually the `on_auth_user_created` trigger is missing |
| `401 unauthorized` / `Invalid or expired token` | the token is bad or `SUPABASE_JWT_SECRET` does not match. Says nothing about the database |
| `500` | the database is unreachable, or a trigger on the read path is broken |

For the write path, create a caso — that is the only thing that exercises the
audit triggers, and a broken `audit_trigger_func` fails **only** on write:

```
curl -s -X POST https://<api-host>/casos -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"probe","metodo":"negociacion"}'   # 201 {"id":"…","estado":"nuevo"}
```

CI now covers both paths against a real Postgres — see the `integration` job in
`.github/workflows/ci-node.yml`.

## 5. The frontend

`mediacion-app` is an Expo app. It reads `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_URL` (see
`mediacion-app/env.example`). Those are inlined into the bundle at build time,
so they are set wherever the bundle is built, not on the API container.

`config/env.ts` refuses to start if the anon slot holds a `service_role` key —
that key bypasses RLS for every caller and must never ship to a client.

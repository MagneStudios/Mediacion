# Vercel: what it can and cannot host

Vercel serves the Expo web bundle and nothing else. The API is **not** deployable
there, and the configuration that tried was removed rather than left as a trap.

## Why the API cannot run on Vercel

`api/index.js` wrapped `apps/api/src/serverless.ts` in a Vercel function. Every
request to it answered `500 FUNCTION_INVOCATION_FAILED`, and the reason is not
fixable with configuration:

Postgres is not reachable from outside the VPS. Coolify keeps the database inside
its Docker network, which is the correct posture — `docs/deploy-coolify.md`
states plainly that 5432 must not be published to work around it. Verified:

```
$ nc -z -w 8 169.58.88.64 5432
CERRADO/FILTRADO
```

A Vercel function runs outside that network. Supplying `DATABASE_URL` and
`SUPABASE_JWT_SECRET` makes the function boot and then fail on every route that
touches the database — it changes the symptom, not the outcome.

The scheduled `crons` entry pointed at that same dead function. The sweep is
triggered by `.github/workflows/vencimiento-sweep.yml` instead.

## What still blocks serving the frontend from Vercel

The bundle itself builds fine. Two things stop it from working in a browser:

1. **Mixed content.** Vercel serves over HTTPS; both backends are plain HTTP.
   Verified: `https://api-solmi…/health` answers 503 and the Supabase Kong
   hostname fails TLS outright. A browser blocks every http request made from an
   https page, with no user override.

2. **CORS.** `CORS_ORIGINS` is an allow-list and currently holds only
   `http://app-solmi.169.58.88.64.sslip.io`. Verified — the API echoes
   `Access-Control-Allow-Origin` for that origin and omits it for any other. A
   Vercel origin has to be added to the variable.

CORS is a variable change. Mixed content is not: it needs real certificates on
`api-solmi` and on the Supabase Kong hostname. Coolify can issue them through
Let's Encrypt, and `sslip.io` names resolve, so HTTP-01 works.

**Do not work around mixed content by proxying the backends through Vercel
rewrites.** It does remove the browser error, because the proxied leg is
server-to-server. But the Vercel→VPS hop stays unencrypted across the public
internet with session JWTs inside it, while the padlock tells the user the
opposite. Plain HTTP end to end is at least honest about what it is; a padlock
over a plaintext backend is worse than the problem it hides.

Fix TLS first. It is needed regardless of where the frontend is served from.

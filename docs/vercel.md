# Vercel: qué hostea y qué no

Vercel sirve el bundle web de Expo **y** la API, como serverless function.
Ambos viven en el mismo origen: el front en la raíz, la API bajo `/api`.

Verificado en producción el 10/09/2026 sobre `https://mediacion-mu.vercel.app`:

| Ruta | Resultado |
|---|---|
| `/` | 200, bundle de Expo |
| `/api/health` | 200 `{"status":"ok"}` |
| `/api/me` con JWT | 200, usuario real desde la DB |
| `/api/planes` con JWT | 200, planes reales desde la DB |
| `/api/me` sin JWT | 401 |

## Cómo está cableado

Tres piezas en `vercel.json`, y las tres tienen que estar:

1. `buildCommand` compila el backend con `pnpm --filter @mediacion/api build`
   antes de exportar el front. Sin eso no existe `apps/api/dist/`.
2. `rewrites` manda `/api/:path*` a `/api`, o sea a la function.
3. `functions` declara `api/index.js`, que requiere
   `../apps/api/dist/src/serverless` y expone el handler.

`apps/api/src/serverless.ts` hace `app.setGlobalPrefix("api")`, así que la
function recibe la URL completa y Nest resuelve la ruta sin reescrituras extra.

El front apunta a la API con `EXPO_PUBLIC_API_URL=/api`, ruta relativa. Al ser
el mismo origen no hay CORS de por medio, y por eso `CORS_ORIGINS` no está
seteada en el proyecto de Vercel.

## Historia: por qué antes decía que no se podía

Hasta agosto de 2026 este documento afirmaba lo contrario, y tenía razón para
el stack de entonces. La API apuntaba al Postgres del VPS de Coolify, que vive
dentro de la red Docker con el 5432 sin publicar. Una function de Vercel corre
fuera de esa red, así que booteaba y fallaba en toda ruta que tocara la base.
El 5432 del VPS sigue cerrado hoy, y está bien que así sea.

Lo que cambió es la base, no Vercel: producción usa Supabase cloud
(`jjgdewvaeyncdksurdbr.supabase.co`), cuyo pooler responde desde internet.
Con eso el impedimento original desapareció.

Queda vigente una advertencia de aquel texto, por si algún día la API vuelve a
un backend HTTP plano: **no tapar mixed content con rewrites de Vercel.** Saca
el error del browser porque el tramo proxeado es server-to-server, pero deja el
salto Vercel→VPS sin cifrar por internet abierto con los JWT de sesión adentro,
mientras el candado le dice al usuario lo contrario. Primero TLS.

## Trampa conocida

`api/` estuvo sin trackear en git durante semanas, y el `vercel.json`
commiteado no tenía ni el rewrite ni el bloque `functions`. La configuración
existía solo en la working tree de una máquina. Los deploys salían con el front
en 200 y la API entera en 404, mientras el bundle publicado seguía llamando a
`/api`. Corregido en `74c149a`. Si volvés a ver 404 en toda la API, lo primero
es `git status` y `git show HEAD:vercel.json`.

## Cron de vencimientos

El sweep lo dispara `.github/workflows/vencimiento-sweep.yml`, cada hora. **No**
agregar un `crons` en `vercel.json` apuntando a
`/api/internal/vencimiento/sweep`: duplicaría las corridas.

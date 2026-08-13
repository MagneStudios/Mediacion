# Deploy de Supabase en Coolify — paso a paso desde la UI

Guía para aplicar cambios al Supabase de producción **sin contexto previo y sin
terminal propia**: todo se hace desde el navegador, en la UI de Coolify.
Companion de [`deploy-coolify.md`](./deploy-coolify.md), que cubre la API.

**La idea central**: el stack de Supabase ya está corriendo en Coolify — no se
"sube" nada. Lo único que se deploya día a día son las **migraciones de base de
datos** (`supabase/migrations/` en la rama `main` de este repo). Eso es lo que
cubre el paso a paso.

---

## 0. Lo que necesitás antes de empezar

| Cosa | Valor / dónde conseguirlo |
|---|---|
| URL de Coolify | `http://169.58.88.64:8000` |
| Usuario y contraseña de Coolify | Los tiene Bruno — pedíselos |
| El servicio de Supabase | Se llama **"Solmi (mediacion)"** |
| La(s) migración(es) a aplicar | Archivos `.sql` nuevos en [`supabase/migrations/`](https://github.com/MagneStudios/Mediacion/tree/main/supabase/migrations) de `main` |

> ⚠️ **Solo la rama `main` cuenta.** Hoy `main` tiene 23 migraciones y ese es el
> set canónico. Existió una rama `feat/supabase-db` con 4 migraciones extra:
> fue **revertida** — no apliques nada que no esté en `main`.

---

## 1. Entrar al servicio de Supabase

1. Abrí `http://169.58.88.64:8000` y logueate.
2. En el menú lateral izquierdo, entrá a **Projects**.
3. Abrí el proyecto de Mediación y su environment (normalmente **production**).
4. En la lista de recursos, hacé click en el servicio **"Solmi (mediacion)"**
   (tipo *Service*, ícono de Supabase).

Vas a ver el "Service Stack": la lista de contenedores que forman Supabase
(`supabase-db`, `supabase-kong`, `supabase-auth`, `supabase-studio`, etc.).
El que nos importa para migraciones es **`supabase-db`** — el Postgres. Su
contenedor se llama `supabase-db-qh5a6xd5ju7302obz5ozb74n`.

---

## 2. Abrir una terminal dentro de la base de datos

1. Dentro del servicio, buscá la pestaña/sección **Terminal** (en el menú
   lateral del servicio).
2. Si te pide elegir contenedor, elegí el que empieza con **`supabase-db-`**.
3. Cuando cargue el prompt, entrá al cliente de Postgres:

```bash
psql -U postgres
```

Deberías ver el prompt `postgres=#`. Todo lo que sigue se pega ahí.

> Si la terminal de Coolify no responde o no carga, refrescá la página y volvé
> a entrar. No toques botones de Restart/Redeploy del servicio para "arreglarla"
> — eso reinicia la base de producción.

---

## 3. Chequeo previo: ¿en qué estado está el schema?

Antes de aplicar nada, pegá esto en `psql`:

```sql
SELECT count(*) AS tablas
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

Resultado esperado hoy (con las 23 migraciones de `main` aplicadas):

- `tablas` = **22**
- el trigger `on_auth_user_created` aparece (1 fila)

**Si `tablas` da 0**: la base se reseteó (ya pasó una vez, entre julio y el
12-08-2026 — el schema `public` quedó vacío aunque los usuarios de login
seguían en `auth.users`). En ese caso no apliques "la migración nueva": hay que
re-aplicar **las 23 en orden** (mismo procedimiento del paso 4, archivo por
archivo, de la primera a la última) y avisarle a Bruno, porque además hay que
backfillear usuarios (ver Gotchas).

---

## 4. Aplicar una migración

Repetí esto por cada archivo `.sql` nuevo, **en orden de nombre de archivo**
(los nombres empiezan con fecha-hora, así que orden alfabético = orden
correcto):

1. Abrí el archivo en GitHub:
   `https://github.com/MagneStudios/Mediacion/tree/main/supabase/migrations`
   → click en el archivo → botón **Raw** (o el ícono de copiar el contenido).
2. Copiá **todo** el contenido.
3. En la terminal de Coolify (dentro de `psql`), pegalo y dale Enter.
4. Leé la salida:

| Salida | Qué significa | Qué hacer |
|---|---|---|
| `CREATE TABLE`, `ALTER TABLE`, `INSERT 0 4`, etc., sin errores | Migración aplicada | Seguir con la próxima |
| `ERROR: ... already exists` | Esa migración **ya estaba aplicada** | Saltearla y seguir — no es grave |
| Cualquier otro `ERROR` | Algo está mal de verdad | **Parar acá.** No apliques las siguientes (dependen de esta). Copiá el error completo y pasáselo a Bruno |

> Nota: `psql` ejecuta cada sentencia por separado. Si una migración larga
> falla por la mitad, queda aplicada a medias — por eso ante un error real se
> para y se pide ayuda, no se re-pega "a ver si pasa".

---

## 5. Verificar que quedó bien

### 5a. En la base (terminal de Coolify, dentro de `psql`)

Repetí las queries del paso 3. La cantidad de tablas tiene que coincidir con lo
esperado (22 hoy; si la migración nueva crea una tabla, 22 + las nuevas).

Para salir de `psql`: `\q`

### 5b. De punta a punta (desde tu navegador / terminal local)

La prueba real es que la **API** lea la base migrada. El procedimiento completo
está en [`deploy-coolify.md`](./deploy-coolify.md) §4, resumen:

1. Conseguir un token: login contra Kong con un usuario real.
2. `GET /me` en la API con ese token.
3. `200` con el usuario → todo funciona. `401 user_not_provisioned` → la base
   responde pero falta la fila del usuario en `public.usuarios` (ver Gotchas).
   `500` → la API no llega a la base: avisar a Bruno.

---

## 6. Gotchas — leer antes de tocar nada

1. **La base ya se reseteó una vez.** Después de cualquier restart o redeploy
   del servicio Supabase, correr el chequeo del paso 3 antes de asumir que el
   schema está.
2. **El trigger `on_auth_user_created` solo crea el perfil de usuarios que se
   registran DESPUÉS de existir el trigger.** Si hay usuarios en `auth.users`
   sin fila en `public.usuarios` (síntoma: `401 user_not_provisioned` al
   loguearse), hay que backfillearlos a mano — eso lo maneja Bruno.
3. **No usar el SQL Editor del Studio para migrar.** El 12-08-2026 se migró por
   ahí porque el Studio estaba expuesto a internet **sin autenticación** — eso
   es un agujero de seguridad, no una feature. Tarea pendiente: en Coolify →
   servicio → `supabase-studio` → **borrar el dominio/FQDN**. Hasta que se
   haga, cualquiera en internet puede ejecutar SQL como admin.
4. **Redeployar Supabase ≠ redeployar la API.** El pool de conexiones de la API
   se reconecta solo tras un restart de la base. Pero si cambia el password de
   Postgres o el JWT secret, hay que actualizar `DATABASE_URL` /
   `SUPABASE_JWT_SECRET` en el recurso de la API y redeployarla.
5. **Nunca** publicar el puerto 5432 ni setear `SUPABASE_SERVICE_ROLE_KEY` en
   la API (no lo usa).

---

## 7. Operaciones raras (no son el deploy habitual)

### Cambiar variables de entorno del servicio (SMTP, etc.)

Coolify → servicio "Solmi (mediacion)" → **Environment Variables** → editar →
**Restart** del servicio. Ojo con el gotcha 4 si tocás credenciales.

### Backups

Ya existen dos scheduled tasks en el servicio: `nightly-postgres-dump`
(3:00 AM) y `backup-rotation-7d` (3:30 AM). No hay que hacer nada; solo
verificar en Coolify → servicio → **Scheduled Tasks** que sigan *enabled*.

### Recrear el stack entero (solo ante desastre total)

1. Coolify → **+ New → Service → Supabase** → Deploy. Genera contenedores y
   keys (`anon`, `service_role`, JWT secret) nuevos.
2. Setear en el servicio: `SMTP_HOST/PORT/USER/PASS`, `SMTP_SENDER_NAME`,
   `SMTP_ADMIN_EMAIL`.
3. **No** asignarle dominio a `supabase-studio` (gotcha 3).
4. Aplicar las 23+ migraciones de `main` (paso 4, todas en orden).
5. Recrear las dos scheduled tasks de backup. Nota: crear **dos tareas
   separadas** — la API de Coolify falla con comandos largos encadenados
   con `&&`.
6. Actualizar `DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_JWT_SECRET` en el
   recurso de la API y redeployarla; regenerar las `EXPO_PUBLIC_*` del
   frontend (van inlined en el bundle → hay que rebuildear).

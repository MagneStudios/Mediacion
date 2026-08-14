# Producción real — Supabase self-hosted en el VPS (stack separado)

Decisión 2026-08-14: la producción real vive en un **segundo stack Supabase en
Coolify**, separado del de prueba (`qh5a6xd5ju7302obz5ozb74n`). El stack de prueba
sigue siendo producción-de-prueba (tiene fixtures de test mezclados con datos
reales; nunca resets, solo deltas).

## 1. Crear el stack (Coolify UI)

1. Coolify → Proyecto de producción → New resource → Supabase (one-click).
2. Anotar: **stackid** (`supabase-db-<id>`), nombre de red, y el
   `POSTGRES_PASSWORD` generado.
3. **No publicar el 5432**; mantener la DB dentro de la red Docker del stack.
4. Secretos: si Coolify expone `SERVICE_PASSWORD_POSTGRES`/`POSTGRES_PASSWORD`
   por defecto, **cambiarlos a un valor nuevo** (no reusar el del stack de
   prueba). Los JWT secrets/anon keys los genera el stack.

## 2. Provisionar (script)

En la sesión SSH del VPS, con el repo en `/root/mediacion-repo`:

```bash
bash /root/mediacion-repo/scripts/provision-produccion-vps.sh
```

El script (interactivo, con confirmaciones):

| Paso | Qué hace |
|------|----------|
| 0 | Credenciales: password del stack NUEVO (read -rs) + contenedor origen (prueba) |
| 1 | Pre-flight: el stack nuevo existe y su `public` está vacío (o solo base) |
| 2 | Aplica las 28 migraciones (loop psql + registro, igual que `db push`) |
| 3 | Dump de datos del stack de PRUEBA (`pg_dump -Fc --data-only --disable-triggers`, excluye `schema_migrations`) |
| 4 | Restore al stack nuevo (`pg_restore --data-only --disable-triggers --no-owner --exit-on-error`) |
| 5 | Limpieza de fixtures (confirmación interactiva con conteos) |
| 6 | Verificación: 28 versiones / 24 tablas / `smoke_migrations.py` 66/66 / sin fixtures |
| 7 | Backup post-provisión en `/root/backups/` |

## 3. Limpieza de fixtures (paso 5)

La copia de datos trae del stack de prueba usuarios reales (`jmmagne99*`) y
residuos de test. Se borran SOLO los identificados:

- auth.users/usuarios: `partea@test.com`, `parteb@test.com`, `mediador@test.com`,
  `admin@test.com`, `no_parte@test.com`, `estudio@test.com`,
  `claude-verify-probe@example.com`, `dev@mediacion.test`, `dev@solmi.test`,
  `prueba+e616634@solmi.test`, `parteb-1785422205@solmi.test`
- Casos: `Custodia de hijos menores`, `Caso aislado` (y sus `caso_partes`/`items`)
- `suscripciones` de `aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa`

> Revisar los conteos que muestra el script antes de confirmar. Si aparece
> algún dato real nuevo en la lista de borrado, ajustarla.

## 4. Post-provisión (operativo)

- **API**: apuntar `DATABASE_URL` del servicio de la API al hostname interno del
  stack de producción (`supabase-db:<id>`), con credenciales nuevas.
- **Backups**: cron diario en el VPS (ej. `pg_dump -Fc` + retención 14 días) —
  no hay PITR manejado; el dump es la red de seguridad. Drill de restore
  mensual en el stack de prueba.
- **validate_rls.py NO se corre en producción** (requiere fixtures). La
  validación RLS queda en staging; en producción se valida con smoke + queries
  puntuales documentadas si hace falta.
- **Rollback**: backup previo al primer push (paso 7) + pg_restore documentado
  en `docs/db-push-remoto.md`.

## 5. Criterios de aceptación

- [ ] 28 versiones en `schema_migrations` del stack de producción.
- [ ] 24 tablas en `public`; `smoke_migrations.py` 66/66.
- [ ] Cero fixtures de test (`partea@test.com` etc. no existen).
- [ ] Usuarios reales accesibles (login de prueba con `jmmagne99*`).
- [ ] 5432 no publicado; password único y distinto del stack de prueba.

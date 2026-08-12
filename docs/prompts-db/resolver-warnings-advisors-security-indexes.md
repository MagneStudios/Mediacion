# Plan — Resolver warnings pendientes del panel de Advisors (SECURITY + índices)

**Fecha:** 10/08/2026
**Origen:** Panel **Database → Advisors** de Supabase (Dashboard) + CLI de usuario de Supabase.

> **Aclaración de contexto:** aunque los comandos internos del linter (`supabase db lint` con el tooling del proyecto) puedan reportar 0 hallazgos, los warnings de abajo **los veo desde el panel de Advisors** del Dashboard de Supabase y desde la CLI de usuario de Supabase (los reporta `supabase` en la cuenta con la que entro). El panel de Advisors es la fuente de verdad para saber qué corregir y verificar que la corrección quedó aplicada: tras correr la migración, el panel deja de listar estos hallazgos.

---

## Resumen de pendientes

| Tipo | Nivel | Cantidad | Detalle |
|---|---|---|---|
| `authenticated_security_definer_function_executable` | WARN | 6 | Helpers de RLS expuestos como RPC para usuarios logueados |
| `unused_index` | INFO | 33 | Índices sin tráfico (BD de desarrollo sin datos / sin carga) |

---

## Bloque 1 · SECURITY — REVOKE EXECUTE a helpers de RLS (6 funciones)

Las 6 funciones son **helper functions** usadas únicamente dentro de policies `USING (...)`:

| Función | Firma | Usada en policies de |
|---|---|---|
| `is_admin` | `()` | usuarios, notificaciones, configuracion, metricas, auditoria, etc. |
| `is_estudio` | `()` | estudios, casos |
| `is_mediator_of_case` | `(uuid)` | mediaciones, items |
| `is_own_subscription` | `(uuid)` | suscripciones, pagos |
| `is_owner_estudio_of_case` | `(uuid)` | estudios, casos, carpetas |
| `is_part_of_case` | `(uuid)` | casos, items, acuerdos, firmas, tareas, etc. |

**Por qué es seguro revocar EXECUTE:** las políticas RLS se evalúan con los privilegios del **dueño de la tabla**, no del usuario que ejecuta la query. El usuario `authenticated` nunca necesita llamar estas funciones directamente; solo se invocan internamente por el motor de RLS. Además, el API (NestJS/Kysely) se conecta con `service_role`/superusuario vía `DATABASE_URL`, que no se ve afectado por este `REVOKE`. La única vía que se corta es `POST /rest/v1/rpc/<función>` (PostgREST), que no debe estar expuesta.

### Migración sugerida: `YYYYMMDDHHmmss_advisors_revoke_helpers_rls.sql`

```sql
-- Helpers de RLS: solo se evalúan dentro de policies (dueño de la tabla).
-- Los usuarios no deben poder invocarlas por PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_estudio() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_mediator_of_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_own_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner_estudio_of_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_part_of_case(uuid) FROM PUBLIC, anon, authenticated;
```

> Nota: se revoca también de `PUBLIC` (cubre el grant implícito que PostgreSQL otorga por defecto a las funciones nuevas).

### Verificación

1. Panel de Advisors → ya no listan las 6 funciones como ejecutables por `authenticated`.
2. `scripts/validate_rls.py` debe seguir pasando (las policies usan las funciones vía RLS, que se evalúa como dueño).
3. Sanity check manual esperado:
   ```sql
   -- Como usuario autenticado (no admin):
   SET ROLE authenticated;
   SELECT public.is_admin(); -- debe dar: permission denied for function is_admin
   RESET ROLE;
   ```
4. El API (vía Kysely/service_role) sigue funcionando igual.

---

## Bloque 2 · PERFORMANCE (INFO) — Índices reportados como "unused"

Los 33 índices marcados como `unused_index` son **INFO, no WARN**, y son **falsos positivos en desarrollo**: la BD local está vacía o sin carga real, por lo que `pg_stat_user_indexes` registra 0 scans en todos. **No se deben eliminar.** Todos cumplen una de estas dos funciones:

- **Cobertura de FK:** PostgreSQL no crea índice automático para las columnas de FK; sin índice, los `DELETE`/`UPDATE` de la tabla referenciada hacen sequential scan sobre la tabla hija y los `JOIN` por esa columna degradan.
- **Soporte de consultas del app:** los repositories de la API filtran por estas columnas (listar casos del usuario, notificaciones no leídas, items de un caso, etc.).

### Inventario y motivo de conservación

| Tabla | Índice | Columnas | Motivo |
|---|---|---|---|
| casos | `idx_casos_creador` | creador_id | Listar "mis casos" (creador) |
| casos | `idx_casos_estudio` | estudio_id | Listar casos del estudio |
| casos | `idx_casos_estudio_carpeta` | estudio_id, carpeta_id | Consulta por carpeta dentro de estudio |
| casos | `idx_fk_casos_carpeta` | carpeta_id | Cobertura FK `casos.carpeta_id` |
| caso_partes | `idx_fk_caso_partes_usuario` | usuario_id | FK + "casos en los que participo" |
| invitaciones | `idx_invitaciones_token` | token (WHERE token IS NOT NULL) | Join por token (unirse a caso) |
| invitaciones | `idx_fk_invitaciones_caso` | caso_id | FK + listar invitaciones de un caso |
| items | `idx_items_caso_parte` | caso_id, parte_id | Posiciones por caso+parte (RN-01) |
| items | `idx_fk_items_parte` | parte_id | FK (el compuesto no cubre lookup solo por parte) |
| propuestas | `idx_fk_propuestas_ronda` | ronda_id | FK + propuestas por ronda |
| respuestas_propuesta | `idx_respuestas_propuesta` | propuesta_id | Respuestas de una propuesta |
| respuestas_propuesta | `idx_fk_respuestas_parte` | parte_id | FK |
| mediaciones | `idx_mediaciones_caso` | caso_id | Única mediación activa por caso |
| mediaciones | `idx_fk_mediaciones_mediador` | mediador_id | FK |
| firmas | `idx_firmas_acuerdo` | acuerdo_id | Firmas de un acuerdo (bandeja) |
| firmas | `idx_fk_firmas_usuario` | usuario_id | FK + "mis firmas" |
| tareas | `idx_tareas_acuerdo` | acuerdo_id | Tareas derivadas del acuerdo |
| tareas | `idx_fk_tareas_caso` | caso_id | FK |
| incumplimientos | `idx_fk_incumplimientos_acuerdo` | acuerdo_id | FK |
| incumplimientos | `idx_fk_incumplimientos_reportante` | reportante_id | FK |
| auditoria | `idx_auditoria_entidad` | entidad_id | Trazabilidad por entidad |
| auditoria | `idx_auditoria_usuario_fecha` | usuario_id, created_at | Listado/paginación de auditoría |
| notificaciones | `idx_notificaciones_usuario_estado` | usuario_id, estado | Bandeja por estado |
| notificaciones | `notificaciones_usuario_no_leidas` | usuario_id WHERE leido_at IS NULL | Contador de no leídas (parcial, no solapado) |
| suscripciones | `idx_suscripciones_usuario` | usuario_id | Historial de suscripción del usuario |
| suscripciones | `idx_suscripciones_estudio` | estudio_id | Suscripción del estudio |
| suscripciones | `idx_fk_suscripciones_plan` | plan_id | FK + ABM de planes |
| pagos | `idx_fk_pagos_suscripcion` | suscripcion_id | FK + pagos de una suscripción |
| estudios | `idx_fk_estudios_plan` | plan_id | FK |
| carpetas | `idx_fk_carpetas_estudio` | estudio_id | FK + carpetas de un estudio |
| usuarios | `idx_fk_usuarios_estudio` | estudio_id | FK |
| facturas | `idx_facturas_pago_id` | pago_id | FK (tabla nueva de R-09) |
| envios_email | `idx_envios_email_notificacion_id` | notificacion_id | FK (tabla nueva de R-12) |

> **Sobre los pares que parecen solapados:** `idx_items_caso_parte` vs `idx_fk_items_parte` (distintas columnas; el compuesto `(caso_id, parte_id)` no sirve para filtrar solo por `parte_id`), y `idx_notificaciones_usuario_estado` vs `notificaciones_usuario_no_leidas` (el parcial `WHERE leido_at IS NULL` cubre el contador; el compuesto cubre la bandeja). Ninguno es redundante.

### Qué hacer (y qué no)

- **No eliminar** ningún índice en esta ronda. Borrar índices es destructivo y prematuro sin datos reales.
- **No hay migración** para este bloque: es una decisión de conservación + verificación futura.
- **Verificación del estado real** (monitoreo, para re-evaluar tras staging con datos):
  ```sql
  SELECT
    schemaname,
    relname AS tabla,
    indexrelname AS indice,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY relname, indexrelname;
  ```
- **Re-evaluación post-MVP:** cuando haya staging con datos reales (seed `scripts/seed_data.py` o tráfico de QA), repetir la query. Todo índice que siga con `idx_scan = 0` **después** de un mes de tráfico real es candidato a revisión. Hasta entonces se conservan.

---

## Orden de implementación

| Paso | Bloque | Acción | Migración |
|---|---|---|---|
| 1 | SECURITY (WARN) | Aplicar los 6 `REVOKE EXECUTE` | `YYYYMMDDHHmmss_advisors_revoke_helpers_rls.sql` |
| 2 | PERFORMANCE (INFO) | Sin migración — conservar índices y registrar monitoreo | — |
| 3 | Verificación | Correr `validate_rls.py`, smoke de integración y revisar panel de Advisors | — |

## Reglas

- `search_path = ''` y `is_admin()` como InitPlan se mantienen como están; acá **no se crean ni alteran funciones**, solo se revocan permisos de ejecución.
- No se toca ninguna policy RLS existente en esta entrega (las policies ya fueron consolidadas en la pasada anterior).
- No se borra ningún índice (INFO, decisión de conservación documentada).

## Criterio de aceptación

- Panel **Database → Advisors**: los 6 hallazgos `authenticated_security_definer_function_executable` dejan de aparecer.
- `scripts/validate_rls.py` pasa sin cambios en los resultados esperados.
- `SELECT public.is_admin();` con `SET ROLE authenticated` devuelve `permission denied` (esperado).
- El API (Kysely + `service_role`) funciona idéntico (suites de integración verdes).
- Los 33 índices permanecen creados; la query de monitoreo queda documentada para re-evaluación post-MVP.

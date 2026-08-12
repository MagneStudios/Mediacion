# Plan — Corrección de warnings del linter de Supabase (RLS + performance)

**Fecha:** 10/08/2026
**Origen:** `supabase db lint` con las 23 migraciones aplicadas.

---

## Resumen de warnings (agrupados por tipo)

| Categoría | Severidad | Cantidad | Causa raíz |
|---|---|---|---|
| RLS policy sempretrue (INSERT) | WARN | 1 | `inversores_insert_anon` tiene `WITH CHECK (true)` sin validación |
| SECURITY DEFINER ejecutable por anon | WARN | 8 | Funciones de trigger y helpers de RLS expuestas como RPC públicas |
| SECURITY DEFINER ejecutable por authenticated | WARN | 8 | Las mismas 8 funciones, visible también para usuarios logueados |
| Múltiples permissive policies (misma tabla/rol/acción) | WARN | ~30 (4 tablas × varios roles) | Firmas, items, notificaciones y usuarios tienen 2-3 policies SELECT separadas en vez de una sola con OR |
| FKs sin índice de cobertura | INFO | 16 | Faltan índices en FK columns que pueden generar sequential scans en JOINs |
| Índices no usados | INFO | 18 | Índices sin tráfico; la mayoría están en tablas nuevas o path de consultas poco usadas hasta ahora |

---

## Plan de corrección por bloque

### Bloque 1 — SECURITY (prioridad alta, 1 migración)

#### 1.1 REVOKE EXECUTE a funciones de trigger (3 funciones)

Estas funciones solo las invoca el trigger; ningún usuario debe llamarlas por RPC.

```sql
REVOKE EXECUTE ON FUNCTION public.assign_caso_codigo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
```

Verificación: los triggers asociados (`trg_assign_caso_codigo`, `audit_trigger`, `on_auth_user_created`) siguen ejecutándose porque el trigger corre con permisos del dueño de la tabla, no del rol que llama.

#### 1.2 REVOKE EXECUTE a helpers de RLS (5 funciones)

Estas funciones solo se evalúan dentro de policies `USING (...)`. PostgreSQL ejecuta la policy como dueño de la tabla (SECURITY DEFINER implícito), no como el rol del request. El usuario nunca necesita EXECUTE directo.

```sql
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_estudio() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_mediator_of_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_own_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner_estudio_of_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_part_of_case(uuid) FROM PUBLIC, anon, authenticated;
```

#### 1.3 `inversores_insert_anon` — hardening mínimo

El INSERT de inversores es público por diseño (landing de inversores). En vez de `WITH CHECK (true)`, se agrega una validación básica que no restringe el negocio pero calma al linter y rechaza basura:

```sql
DROP POLICY IF EXISTS inversores_insert_anon ON inversores;
CREATE POLICY inversores_insert_anon ON inversores
  FOR INSERT TO anon
  WITH CHECK (
    nombre IS NOT NULL
    AND length(trim(nombre)) > 0
    AND email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
```

> La SELECT (`inversores_select / inversores_select_admin_only`) no se toca. Ya está bien con `USING (is_admin() OR ...)` para `authenticated` y restricción admin.
> El INSERT correcto deja `inversores.id` con `gen_random_uuid()`, `created_at` con `now()` y `fecha` con `now()` — el policy CHECK no interfiere con defaults.

---

### Bloque 2 — PERFORMANCE: consolidar multi-policy en una sola (prioridad media, 1 migración)

Cuatro tablas tienen políticas SELECT separadas para admin/own/case. Consolidarlas en una sola por tabla con `OR`:

#### 2.1 `firmas`

Antes (2 policies): `firmas_select_case` + `firmas_select_own`
Después:

```sql
DROP POLICY IF EXISTS firmas_select_case ON firmas;
DROP POLICY IF EXISTS firmas_select_own ON firmas;
CREATE POLICY firmas_select ON firmas
  FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    OR is_part_of_case(
      (SELECT acuerdo.caso_id FROM acuerdos WHERE acuerdos.id = firmas.acuerdo_id)
    )
  );
```

#### 2.2 `items`

Antes (3 policies): `items_select_admin`, `items_select_mediator`, `items_select_own`
Después:

```sql
DROP POLICY IF EXISTS items_select_admin ON items;
DROP POLICY IF EXISTS items_select_mediator ON items;
DROP POLICY IF EXISTS items_select_own ON items;
CREATE POLICY items_select ON items
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_mediator_of_case(caso_id)
    OR parte_id = (SELECT auth.uid())
  );
```

#### 2.3 `notificaciones`

Antes (2 policies): `notificaciones_select_admin`, `notificaciones_select_own`
Después:

```sql
DROP POLICY IF EXISTS notificaciones_select_admin ON notificaciones;
DROP POLICY IF EXISTS notificaciones_select_own ON notificaciones;
CREATE POLICY notificaciones_select ON notificaciones
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR usuario_id = (SELECT auth.uid())
  );
```

#### 2.4 `usuarios`

Antes (2 policies): `usuarios_select_admin`, `usuarios_select_own`
Después:

```sql
DROP POLICY IF EXISTS usuarios_select_admin ON usuarios;
DROP POLICY IF EXISTS usuarios_select_own ON usuarios;
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR id = (SELECT auth.uid())
  );
```

> **Cuidado:** Las políticas para `service_role` (que suelen usar `USING (true)`) **no se tocan** — el linter de security no las reporta y son correctas así.

---

### Bloque 3 — PERFORMANCE: índices en FKs sin cobertura (prioridad baja, 1 migración)

16 FKs sin índice. Esto es aditivo puro (solo `CREATE INDEX`), riesgo cero. Sugerido post-MVP o junto con la migración de consolidación de RLS si cabe en el mismo archivo.

```sql
CREATE INDEX IF NOT EXISTS idx_fk_carpetas_estudio         ON carpetas(estudio_id);
CREATE INDEX IF NOT EXISTS idx_fk_caso_partes_usuario       ON caso_partes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fk_casos_carpeta             ON casos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_fk_estudios_plan             ON estudios(plan_id);
CREATE INDEX IF NOT EXISTS idx_fk_firmas_usuario            ON firmas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fk_incumplimientos_acuerdo   ON incumplimientos(acuerdo_id);
CREATE INDEX IF NOT EXISTS idx_fk_incumplimientos_reportante ON incumplimientos(reportante_id);
CREATE INDEX IF NOT EXISTS idx_fk_invitaciones_caso         ON invitaciones(caso_id);
CREATE INDEX IF NOT EXISTS idx_fk_items_parte               ON items(parte_id);
CREATE INDEX IF NOT EXISTS idx_fk_mediaciones_mediador      ON mediaciones(mediador_id);
CREATE INDEX IF NOT EXISTS idx_fk_pagos_suscripcion         ON pagos(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_fk_propuestas_ronda          ON propuestas(ronda_id);
CREATE INDEX IF NOT EXISTS idx_fk_respuestas_parte          ON respuestas_propuesta(parte_id);
CREATE INDEX IF NOT EXISTS idx_fk_suscripciones_plan        ON suscripciones(plan_id);
CREATE INDEX IF NOT EXISTS idx_fk_tareas_caso               ON tareas(caso_id);
CREATE INDEX IF NOT EXISTS idx_fk_usuarios_estudio          ON usuarios(estudio_id);
```

> No hacen falta para `facturas.pago_id` ni `envios_email.notificacion_id`: ya existen (`idx_facturas_pago_id`, `idx_envios_email_notificacion_id` según el reporte de unused indexes).

---

### Bloque 4 — Índices no usados (INFO, no acción inmediata)

Los 18 índices marcados como "unused" son INFO, no WARN. La mayoría son funcionales (el app los usará con datos reales). No se borra ninguno en esta ronda. Los únicos que podrían ser candidatos a discutirse en una limpieza post-MVP son los compuestos donde dos cubren la misma consulta (ej. `idx_notificaciones_usuario_estado` + `notificaciones_usuario_no_leidas` sobre la misma tabla `notificaciones`), pero sin datos de producción no se decide.

---

## Orden de implementación

| Paso | Bloque | Archivo de migración sugerido | Severidad |
|---|---|---|---|
| 1 | REVOKE EXECUTE (8 funciones) + hardening `inversores_insert_anon` | `YYYYMMDDHHmmss_linter_security_revoke.sql` | WARN → limpio |
| 2 | Consolidar multi-policy SELECT en 4 tablas | `YYYYMMDDHHmmss_linter_perf_consolidate_policies.sql` | WARN → limpio |
| 3 | Índices de FK (16 CREATE INDEX) | `YYYYMMDDHHmmss_linter_perf_fk_indexes.sql` | INFO → limpio |

Los pasos 1 y 2 pueden fusionarse en una sola migración si se prefiere (ambos son aditivos, pero el DROP POLICY + CREATE POLICY del paso 2 no es reversible como un ALTER — el efecto neto es funcionalmente idéntico). El paso 3 va en migración separada por claridad y porque es el único puramente aditivo.

## Reglas

- `search_path = ''` se mantiene en funciones nuevas (no se crean funciones nuevas acá, solo se revoca).
- `is_admin()` como InitPlan se conserva (la migración de InitPlan de la 029 ya está aplicada).
- Los tests `validate_rls.py` deben re-correr tras cada migración: las policies consolidadas deben devolver los mismos resultados que las separadas.
- Revisar que los integración specs del API no rompan (el API usa `service_role` vía Kysely, así que los REVOKE a `anon`/`authenticated` no la afectan).

## Criterio de aceptación

- `supabase db lint` no emite WARN (solo INFO de unused indexes, que se dejan por ahora).
- `smoke_migrations.py` y `validate_rls.py` pasan con el nuevo set de policies.
- `POST /rest/v1/rpc/is_admin` devuelve `403` (o lo que corresponda) cuando se llama con JWT de usuario autenticado.
- Las queries del API vía Kysely (`service_role`) siguen funcionando idéntico.

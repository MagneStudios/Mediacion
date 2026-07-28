# Proyecto Mediación — Documentación de Base de Datos

> Última actualización: 2026-07-28

## Objetivo

Diseñar e implementar la capa de datos de **Proyecto Mediación** en PostgreSQL/Supabase, cubriendo:

1. **Aislamiento de posiciones entre partes** (RN-01 / CA-02) — defensa en profundidad vía RLS + API
2. **Motor de propuestas de IA por rondas** (RN-03 / RN-04) — iteración con mediador desde ronda 3 (RN-05)
3. **Máquinas de estado** — Caso, Ronda, Propuesta, Acuerdo, Pago con transiciones válidas
4. **Trazabilidad** — Auditoría de acciones sensibles (RNF-10)
5. **Monetización** — Planes, suscripciones y pagos vía Mercado Pago

## Stack de datos

| Capa | Tecnología |
|------|-----------|
| Base de datos | PostgreSQL 17 (Supabase local) |
| Auth | Supabase Auth nativo (`auth.uid()`) |
| RLS | Habilitado en las 22 tablas |
| Migraciones | Supabase CLI (`supabase/migrations/`) |
| Config local | `supabase/config.toml` (puertos: API 55001, DB 55002, Studio 55003) |

## Archivos de migración

```
supabase/migrations/
├── 20260721191631_extensions.sql    # pgcrypto
├── 20260721191644_enums.sql         # 19 tipos enum
├── 20260721191651_tables.sql        # 22 tablas + grants
├── 20260721191655_constraints_indexes.sql  # CHECK XOR, UNIQUE, 16 índices
├── 20260721191658_functions_triggers.sql   # 12 funciones, 47 triggers
├── 20260721191704_rls_policie.sql   # 41 policies en 22 tablas
├── 20260721191707_seed_catalog.sql  # 4 planes + 5 configs
├── 20260723210000_acuerdos_caso_unique.sql          # UNIQUE acuerdos.caso_id
├── 20260724011737_propuestas_ronda_unique.sql       # UNIQUE propuestas(caso_id, ronda_id)
├── 20260724130000_propuesta_estado_trigger.sql      # validate_propuesta_estado_transition()
├── 20260724150000_mediaciones_write_rls.sql         # INSERT/UPDATE RLS mediaciones
├── 20260724160000_mediaciones_caso_activa_unique.sql # partial unique mediaciones
├── 20260724170000_notificaciones_vencimiento_unique.sql  # partial unique notif vencimiento
├── 20260728000000_notificaciones_estado_enum.sql    # notificaciones.estado TEXT → enum
└── 20260728010000_write_rls_notif_incump_tareas.sql # INSERT/UPDATE RLS notif/incump/tareas
```

## Modelo de datos (22 tablas)

### Identidad
- `usuarios` — id FK → auth.users(id), roles, documento (nullable en signup)
- `estudios` — estudios jurídicos con plan y marca
- `carpetas` — organización de casos por estudio

### Casos y vinculación
- `casos` — sala de mediación, estado, ronda_actual, SLA
- `caso_partes` — relación caso-usuario (parte_a, parte_b, mediador)
- `invitaciones` — link/código/correo para unir contraparte

### Negociación
- `items` — posiciones privadas con rango (text) por categoría
- `rondas` — iteraciones de negociación (unique caso_id + numero)
- `propuestas` — puntos de encuentro generados por IA (JSONB)
- `respuestas_propuesta` — acepta/rechaza de cada parte

### Mediación
- `mediaciones` — mediador humano, habilitado desde ronda 3

### Acuerdos y post-acuerdo
- `acuerdos` — resultado firmado con DocuSign
- `firmas` — estado de firma por usuario
- `tareas` — accionables y eventos de calendario
- `incumplimientos` — avisos de incumplimiento

### Monetización
- `planes` — catálogo público (base, simple, plus, estudio)
- `suscripciones` — FK XOR (usuario_id ↔ estudio_id)
- `pagos` — confirmados por webhook de Mercado Pago

### Sistema
- `notificaciones` — email/push
- `inversores` — formulario público de captación
- `auditoria` — log inmutable de acciones sensibles
- `configuracion` — key-value para settings del sistema

## Decisiones de diseño

| Decisión | Razón |
|----------|-------|
| `items.valor_min` / `valor_max` como `text` | Categorías mixtas (numéricas + textuales). Interpretación en capa de aplicación |
| `suscripciones` CHECK XOR | Exactamente uno de usuario_id / estudio_id debe ser no-nulo |
| `documento` nullable en `usuarios` | Se provee durante onboarding, no en el signup inicial |
| `handle_new_user` trigger | Crea registro en `usuarios` al hacer signup vía Supabase Auth |
| RLS + GRANTS | RLS filtra filas; GRANTS dan acceso a nivel tabla a roles authenticated/anon/service_role |
| `planes` e `inversores` con policies permisivas | Catálogo público y formulario público — lectura para todos |
| Funciones helper SECURITY DEFINER | `is_part_of_case`, `is_mediator_of_case`, `is_admin` bypassan RLS internamente |

## Comandos útiles

```bash
# Reset completo (aplica todas las migraciones desde cero)
pnpm supabase db reset

# Verificar estado
pnpm supabase status

# Crear nueva migración
pnpm supabase migration new nombre_descriptivo

# Aplicar migraciones pendientes
pnpm supabase migration up

# Detener Supabase local
pnpm supabase stop

# Conexión directa a la DB
docker exec -it supabase_db_Mediacion psql -U postgres -d postgres
```

## Testing

### Scripts Python

```bash
# Verificar schema (56 checks: tablas, funciones, enums, RLS, triggers, seeds)
python scripts/smoke_migrations.py

# Validar RLS multi-rol (13 checks: items, casos, suscripciones, helper functions)
python scripts/validate_rls.py

# Generar datos de prueba con Faker
python scripts/seed_data.py --reset --count 5

# Setup completo después de db reset (SQL tests + validación)
.\scripts\setup_test_env.ps1
```

### Suite SQL de tests (tmp/)

Los tests SQL se ejecutan contra Supabase local vía Docker:

```bash
Get-Content tmp/test_01_setup.sql -Raw | docker exec -i supabase_db_Mediacion psql -U postgres -d postgres
```

| Archivo | Qué verifica |
|---------|-------------|
| `test_01_setup.sql` | Trigger handle_new_user crea registro en usuarios |
| `test_02_caso.sql` | Inserción de caso + vinculación de partes |
| `test_03_items.sql` | Items con valor_min/valor_max tipo text |
| `test_04_rls_isolation.sql` | RLS RN-01: parte solo ve sus items |
| `test_05_estados.sql` | Máquina de estados del caso |
| `test_06_xor.sql` | CHECK XOR en suscripciones |
| `test_07_audit.sql` | Triggers de auditoría + updated_at |
| `test_08_rondas.sql` | Sync ronda_actual + unique constraint |
| `test_09_integridad.sql` | FK y unique constraints |
| `test_10_rls_deep.sql` | Mediator/admin/non-member vs RLS |
| `test_11_helper_functions.sql` | is_part_of_case, is_admin, etc. |
| `test_12_e2e_flow.sql` | Flujo completo: caso → rondas → propuestas → mediación → acuerdos → cierre |

### Resultados de testing (2026-07-22)

**Schema validation (smoke_migrations.py):** 64/64 PASS
- 22 tablas, 12 funciones, 19 enums, 22 RLS, 4 planes, 5 configs, 16 updated_at triggers, 9 audit triggers

**RLS validation (validate_rls.py):** 13/13 PASS
- Parte ve solo sus items, mediator ve ambos, admin ve todo, non-member no ve nada
- Helper functions: is_part_of_case, is_mediator_of_case, is_admin correctos

**SQL tests (A1-E4):** 24/24 PASS
- RLS: items, casos, configuración, auditoría, notificaciones, suscripciones
- Integrity: CHECK XOR, unique constraints, FK protection, state machine
- Triggers: handle_new_user (rol default + explícito), sync_ronda_actual, audit trail, updated_at
- Grants: authenticated/anon/service_role con CRUD completo

### Hallazgo: FK sin CASCADE (D1)

`items.parte_id` → `usuarios.id` no tiene ON DELETE CASCADE. Esto es **intencional**: en un sistema de mediación, borrar un usuario no debe borrar sus posiciones de un caso. El flujo correcto es desactivar (`activo = false`), no borrar.

## Pendiente

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 — DBML | ✅ Cerrada | Schema.dbml con 22 tablas, 19 enums, relaciones y notas |
| Fase 2 — Migraciones | ✅ Cerrada | 7 archivos SQL aplicados y testeados |
| Fase 3 — Scripts Python | ✅ Cerrada | seed_data.py, validate_rls.py, smoke_migrations.py |
| Fase 4 — QA/E2E | ⏳ Pendiente | Esperando backend listo para tests de integración |

### Pendiente del backend
- Endpoint de webhooks (`/webhooks/docusign`, `/webhooks/mercadopago`): validación del secret/header
- Usar service role para operaciones server-side (bypass RLS)

### Pendiente del cliente (a confirmar)
- Precios y límites finales de los planes
- Proveedor de biometría
- Calendario nativo vs proveedor externo

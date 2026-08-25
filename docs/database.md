# Proyecto Mediación — Documentación de Base de Datos

> Última actualización: 2026-08-21

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
| RLS | Habilitado en las 33 tablas |
| Migraciones | Supabase CLI (`supabase/migrations/`) |
| Config local | `supabase/config.toml` (puertos: API 57001, DB 57002, Studio 57003) |

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
├── 20260728010000_write_rls_notif_incump_tareas.sql # INSERT/UPDATE RLS notif/incump/tareas
├── 20260728120000_usuarios_consentimiento.sql       # consentimiento_fecha + consentimiento_envelope_id en usuarios
├── 20260728130000_tareas_acuerdo_generation_unique.sql  # UNIQUE tareas(acuerdo_id, descripcion) — idempotencia RN-14
├── 20260728200000_function_search_path.sql     # SET search_path en 11 funciones
├── 20260728210000_rls_auth_initplan.sql        # (SELECT auth.uid()) en RLS policies
├── 20260729180000_inversores_select_admin_only.sql  # inversores SELECT solo admin
├── 20260729190000_is_admin_initplan.sql       # is_admin() con initplan
├── 20260730130000_audit_trigger_qualify_auditoria.sql  # audit trigger califica auditoria
├── 20260730180000_backend_gap_features.sql    # features gap del backend
├── 20260810120000_cambios_reunion_07_08.sql   # reunion 07/08: expirado, facturas, envios_email, pago_a_cargo, plan estudio
├── 20260811130000_linter_security_revoke.sql  # REVOKE EXECUTE triggers + helpers (anon/PUBLIC); hardening inversores_insert_anon
├── 20260811140000_linter_perf_consolidate_policies.sql  # 1 policy SELECT por tabla (firmas, items, notificaciones, usuarios)
├── 20260811150000_linter_perf_fk_indexes.sql  # 16 índices de cobertura en FKs
├── 20260814160000_grants_schema_public.sql   # GRANT USAGE schema public a roles JWT (stack Coolify)
├── 20260814170000_tyc_legal.sql    # Módulo legal: legal_documents, user_agreements (append-only), solicitudes_arrepentimiento, estado_arrepentimiento, has_accepted_current, trigger anti-contratación, 3 policies, seeds terms/privacy v1.0
├── 20260815120000_legal_avisos_contacto.sql  # avisos_version_legal (idempotencia del preaviso) y solicitudes_contacto (canal de contacto), ambas de rol de servidor
├── 20260817120000_suscripcion_aceptacion_estudio.sql  # Anti-contratación para suscripciones de estudio: rama estudio_id en validate_suscripcion_aceptacion, trigger UPDATE titularidad
├── 20260817130000_rate_limit_counters.sql  # Contador de rate limit compartido para módulo legal (PK compuesta, ventana fija, server-only)
├── 20260817140000_has_accepted_current_vigencia.sql  # Fix: has_accepted_current usa vigencia real (valid_from/valid_to) en vez de valid_to IS NULL
├── 20260821000000_revert_has_accepted_current_grant.sql  # O1: REVOKE EXECUTE has_accepted_current de authenticated (helper de servidor, decisión revertida)
└── 20260821120000_monetizacion_fase1.sql  # O2: Monetización Pactum Fase 1 — enum pausada + estado_solicitud_abogado, planes.max_*, suscripciones billing/MP, usage_counters, lawyer_requests, payment_events, consume_quota, seeds particular/corporativo
```

## Modelo de datos (33 tablas)

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
- `planes` — catálogo público (base, simple, plus, estudio, particular, corporativo; `limite_casos` NULL = ilimitado). Pactum Fase 1: `max_negotiations_per_period` (particular=3, estudio=3/cliente, corporativo=NULL) y `max_clients_per_period` (estudio=20, corporativo=NULL), NULL = ilimitado
- `suscripciones` — FK XOR (usuario_id ↔ estudio_id). Pactum Fase 1: `current_period_start/end` (período anclado al alta), `cancel_at_period_end`, `mp_preapproval_id` (UNIQUE), `mp_payer_email`; estado `pausada` agregado al enum
- `pagos` — confirmados por webhook de Mercado Pago
- `facturas` — facturación por pago (neto, IVA, impuestos, CAE, URL PDF)
- `usage_counters` — fuente de verdad de las cuotas: PK compuesta `(usuario_id, period_start)`, contador por usuario real (cliente de estudio incluido), período del pagador; escritura solo service_role/postgres, SELECT owner vía RLS
- `lawyer_requests` — escalamiento a abogado (pago único): FK `caso_id → casos` (CASCADE), `solicitante_id → auth.users`, precio congelado en `monto_minor` (integer minor units) + `moneda` (ARS/USD), `external_reference` UNIQUE (`lawreq_<uuid>`), status enum `estado_solicitud_abogado`; SELECT participantes del caso vía RLS, escritura service_role/postgres
- `payment_events` — idempotencia de webhooks MP: UNIQUE `(provider, event_type, resource_id)`; patrón server-only (sin policies, GRANTs solo service_role/postgres)

### Sistema
- `notificaciones` — email/push
- `envios_email` — rastreo de envíos por notificación (intentos, último error)
- `inversores` — formulario público de captación
- `auditoria` — log inmutable de acciones sensibles
- `configuracion` — key-value para settings del sistema (incluye `impuestos` AR y `invitacion_ttl_horas`)
- `rate_limit_counters` — contador de rate limit compartido para módulo legal; PK compuesta `(clave, ventana_inicio)`, ventana fija (no deslizante), upsert atómico `ON CONFLICT DO UPDATE SET hits = hits + 1`; tabla de rol de servidor

### Módulo legal (TyC)
- `legal_documents` — texto legal versionado (terms/privacy) en la base; una sola versión vigente por tipo (partial unique); lectura pública (anon/authenticated) solo de la vigente
- `user_agreements` — log append-only real de aceptaciones: INSERT solo service_role/postgres, SELECT propio vía RLS, UPDATE/DELETE rechazados por trigger para todos los roles (incluido service_role, que bypasea RLS)
- `solicitudes_arrepentimiento` — traza del POST público /legal/arrepentimiento (Res. 424/2020); `codigo` ARR-0001… por trigger; sin policies (solo roles de servidor)
- `avisos_version_legal` — traza e idempotencia del aviso de cambio de versión (#15); UNIQUE (usuario_id, tipo, version) + `enviado_at` para separar "reclamado" de "entregado"; sin policies
- `solicitudes_contacto` — canal de contacto público (#23); `codigo` CON-0001… por trigger; `received_at` es la fecha de ingreso que sostiene el plazo de respuesta declarado; sin policies

### Enums (21)

`estado_caso` tiene 8 valores: `nuevo, activo, en_negociacion, acordado, cerrado, terminado, vencido, expirado`. **No existe tabla `estados_caso`** — el endpoint de onboarding devuelve el catálogo de este enum (falso positivo N-3 de la auditoría, respuesta 7 del 18/08).

`estado_arrepentimiento` tiene 4 valores: `recibida, en_proceso, resuelta, rechazada`. Usado tanto por `solicitudes_arrepentimiento` como por `solicitudes_contacto` (reutilizado por diseño).

`estado_suscripcion` tiene 5 valores: `activa, cancelada, vencida, pendiente_pago, pausada`. `vencida` = past_due del spec Pactum; `pausada` = paused (agregado en monetización Fase 1).

`estado_solicitud_abogado` tiene 7 valores: `pendiente_pago, pagada, notificada, asignada, cerrada, reembolsada, fallida` (spec Pactum §4, lawyer_request_status).

### Patrón: tabla de rol de servidor (A-4/Q-4/R-2)

> RLS habilitada + sin policies + GRANTs solo a `service_role`/`postgres` + escritura únicamente vía BE (rol de servidor). El usuario final no lee ni escribe; su comprobante es el `codigo` (`ARR-…`/`CON-…`).

| Tabla | Patrón server-only | Código |
|-------|-------------------|--------|
| `solicitudes_arrepentimiento` | Sí | `ARR-0001…` |
| `avisos_version_legal` | Sí | — |
| `solicitudes_contacto` | Sí | `CON-0001…` |
| `rate_limit_counters` | Sí | — |
| `user_agreements` | **No** | Tiene SELECT propio para `authenticated` (contrato FE) |

### Enforcement de cuotas: consume_quota (Pactum Fase 1)

`consume_quota(p_usuario_id UUID, p_kind TEXT)` — SECURITY DEFINER, `search_path=''`, EXECUTE solo `service_role`/`postgres` (nunca desde el cliente).

- `p_kind` ∈ {`negotiation`, `clients`}; otro valor → errcode `22023`
- Resuelve la suscripción **efectiva** (spec §5.1.1): la propia del usuario, o la del estudio que lo gestiona (`usuarios.estudio_id`); prefiere la propia. `FOR UPDATE` serializa consumo concurrente por suscripción
- Sin suscripción `activa`/`vencida` → `NO_ACTIVE_SUBSCRIPTION` (P0001); sin período de facturación → `NO_BILLING_PERIOD` (P0001)
- Contador por **usuario real** (`usage_counters.usuario_id`), período del pagador; `ON CONFLICT DO NOTHING` crea la fila por período (histórico completo, nada se borra)
- Incremento atómico (`UPDATE ... RETURNING` toma el lock de la fila) — dos requests simultáneas no pueden pasarse el límite (verificado: 2/3 concurrentes → 3/3, no 4/3)
- Límite del plan: `negotiation` → `max_negotiations_per_period`, `clients` → `max_clients_per_period`; `NULL` = ilimitado
- Exceso → `QUOTA_EXCEEDED` (P0002) — la excepción hace rollback del incremento, el contador nunca queda inflado
- BE traduce P0001/P0002 → HTTP 402 con body `{ error: 'quota_exceeded', limit, used, period_end, upgrade_url }` (spec §8)

**Defaults reversibles** (decisión #3/#4 del spec, ver `docs/decisiones-db/2026-08-21-monetizacion-fase1.md`):
- #3: cliente de estudio hereda la cuota del plan del estudio (plan estudio = 3 negociaciones/mes por cliente)
- #4: flujo mensual — el contador se resetea creando una fila nueva por período, sin tope de cartera

### Retención de datos (FKs legales)

Ninguna FK legal usa `ON DELETE CASCADE`:

| Tabla | FK | ON DELETE |
|-------|-----|-----------|
| `user_agreements` | `user_id → auth.users` | RESTRICT (retención 5 años) |
| `solicitudes_arrepentimiento` | `usuario_id → auth.users` | SET NULL (traza se conserva) |
| `avisos_version_legal` | `usuario_id → auth.users` | RESTRICT (prueba de cumplimiento de plazo) |
| `solicitudes_contacto` | `usuario_id → auth.users` | SET NULL (traza se conserva) |

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
| `user_agreements` append-only | UPDATE/DELETE rechazados por trigger para todos los roles; `service_role` con `bypassrls` también lo sufre |
| Aviso de versión sin duplicados | UNIQUE (usuario_id, tipo, version) en `avisos_version_legal`; el barrido inserta con ON CONFLICT DO NOTHING, no con un existence check en transacción |
| No contratar sin aceptación | Trigger `validate_suscripcion_aceptacion` en `suscripciones`: usuario_id exige aceptación vigente de terms (`has_accepted_current`) |
| Texto legal en la base | `legal_documents` versionado con `valid_to IS NULL` = vigente; partial unique por tipo evita dos vigentes |
| `has_accepted_current` SECURITY DEFINER | `search_path=''`, EXECUTE solo service_role/postgres (no expuesta al cliente); el trigger la invoca como InitPlan interno. El GRANT a authenticated de `20260817140000` fue revertido en `20260821000000` (helper de servidor) |

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
# Verificar schema (80 checks: tablas, funciones, enums, RLS, triggers, seeds)
python scripts/smoke_migrations.py

# Validar RLS multi-rol (45 checks: items, casos, suscripciones, helper functions, módulo legal, monetización, carrera concurrente)
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
| `test_13_backend_migrations.sql` | UNIQUE acuerdos, propuestas, máquina de estados propuesta, mediaciones write RLS |
| `test_14_bug41_regression.sql` | Regression bug #4.1: transición activo→en_negociacion + idempotencia |
| `test_15_e2e_flow_full.sql` | E2E full: 17 pasos (A-Q) cubriendo toda la máquina de estados + auditoría |
| `test_16_tyc_legal.sql` | Módulo legal: has_accepted_current, append-only (UPDATE/DELETE), trigger anti-contratación, codigo ARR, única vigente |
| `test_17_cuotas.sql` | Monetización: consume_quota 3x + 4ta QUOTA_EXCEEDED (P0002), contador no se infla, NULL = ilimitado, herencia default (cliente de estudio), histórico por período |

### Resultados de testing

**Schema validation (smoke_migrations.py):** 80/80 PASS
- 33 tablas, 14 funciones (incluye consume_quota), 21 enums, 33 RLS, 6 planes, 7 configs, 2 legal docs, 21 updated_at triggers, 12 audit triggers

**RLS validation (validate_rls.py):** 45/45 PASS
- Parte ve solo sus items, mediator ve ambos, admin ve todo, non-member no ve nada
- Helper functions: is_part_of_case, is_mediator_of_case, is_admin correctos; has_accepted_current denegado a anon Y authenticated
- Módulo legal: anon lee legal_documents vigente; cada usuario ve solo sus user_agreements; INSERT/has_accepted_current denegados a authenticated
- Monetización Fase 1: usage_counters owner-only (SELECT propio), lawyer_requests participantes del caso, payment_events server-only, consume_quota denegado a authenticated
- Carrera concurrente: 2 requests con 2/3 consumidas terminan en 3/3 (no 4/3)

**SQL tests (16 tests — setup + 12 standalone + 2 E2E + cuotas):**
- RLS: items, casos, configuración, auditoría, notificaciones, suscripciones, mediaciones write
- Integrity: CHECK XOR, unique constraints (caso_partes, rondas, acuerdos, propuestas, tareas), FK protection, state machine
- Triggers: handle_new_user (rol default + explícito), sync_ronda_actual, audit trail, updated_at
- Grants: authenticated/anon/service_role con CRUD completo
- E2E: flujo completo caso→cierre + regression bug #4.1 (transición activo→en_negociacion + idempotencia)

### Hallazgo: FK sin CASCADE (D1)

`items.parte_id` → `usuarios.id` no tiene ON DELETE CASCADE. Esto es **intencional**: en un sistema de mediación, borrar un usuario no debe borrar sus posiciones de un caso. El flujo correcto es desactivar (`activo = false`), no borrar.

## Pendiente

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 — DBML | ✅ Cerrada | Schema.dbml con 30 tablas, 20 enums, relaciones y notas |
| Fase 2 — Migraciones | ✅ Cerrada | 33 archivos SQL aplicados y testeados |
| Fase 3 — Scripts Python | ✅ Cerrada | seed_data.py, validate_rls.py, smoke_migrations.py |
| Fase 4 — QA/E2E | ✅ Cerrada | 16 tests SQL + smoke + RLS verdes |
| Módulo 4 post-acuerdo (backend) | ✅ Implementado | tareas, incumplimientos, onboarding — merge del backend (#45) |
| Reunión 07/08 (R-04…R-12) | ✅ Implementado | expirado, facturas, envios_email, pago_a_cargo, plan estudio 25.00 |
| Módulo legal (TyC) | ✅ Implementado | legal_documents, user_agreements append-only, solicitudes_arrepentimiento, trigger anti-contratación, seeds v1.0 (texto con [COMPLETAR] pendientes de Administración) |
| Aviso de versión y contacto | ✅ Implementado | avisos_version_legal (idempotencia del preaviso) y solicitudes_contacto, consumidas por el módulo `legal/` de la API |
| Rate limit compartido | ✅ Implementado | rate_limit_counters (PK compuesta, ventana fija), cierra limitación de réplicas/serverless en rutas públicas legales |
| Anti-contratación estudio | ✅ Implementado | rama estudio_id en validate_suscripcion_aceptacion (titular con aceptación vigente), trigger UPDATE titularidad |
| Fix has_accepted_current | ✅ Implementado | vigencia real (valid_from/valid_to) alineada con LegalRepository.findVigente |
| Patrón server-only documentado | ✅ Implementado | 4 tablas con RLS sin policies + GRANTs solo service_role/postgres |
| Deuda has_accepted_current EXECUTE | ✅ Cerrada | `20260821000000` revierte el GRANT a authenticated; helper de servidor |
| Monetización Pactum Fase 1 | ✅ Implementado | planes/suscripciones extendidos, usage_counters, lawyer_requests, payment_events, consume_quota, seeds particular/corporativo |

### Pendiente técnico
- Usar service role para operaciones server-side (bypass RLS)
- Monetización Fase 2 (checkout + webhooks MP) y Fase 3 (abogado) — ver `docs/PACTUM-monetizacion-spec.md` §14

### Pendiente del cliente (a confirmar)
- Precios y límites finales de los planes (restantes: base, simple, plus)
- Calendario nativo vs proveedor externo

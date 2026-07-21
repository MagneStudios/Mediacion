# Proyecto Mediación — Documentación de Base de Datos

> Última actualización: 2026-07-21

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
├── 20260721191644_enums.sql         # 18 tipos enum
├── 20260721191651_tables.sql        # 22 tablas + grants
├── 20260721191655_constraints_indexes.sql  # CHECK XOR, UNIQUE, 16 índices
├── 20260721191658_functions_triggers.sql   # 11 funciones, 45 triggers
├── 20260721191704_rls_policie.sql   # 41 policies en 22 tablas
└── 20260721191707_seed_catalog.sql  # 4 planes + 5 configs
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

## Pendiente

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 — DBML | ✅ Cerrada | Schema.dbml con 22 tablas, 18 enums, relaciones y notas |
| Fase 2 — Migraciones | ✅ Cerrada | 7 archivos SQL aplicados y testeados |
| Fase 3 — Scripts Python | ⏳ Pendiente | seed_data.py, validate_rls.py, smoke_migrations.py |
| Fase 4 — QA/E2E | ⏳ Pendiente | Matriz de casos + suite ejecutable + flujo completo |

### Pendiente del backend
- Endpoint de webhooks (`/webhooks/docusign`, `/webhooks/mercadopago`): validación del secret/header
- Usar service role para operaciones server-side (bypass RLS)

### Pendiente del cliente (a confirmar)
- Precios y límites finales de los planes
- ¿El mediador accede a posiciones privadas o solo a propuestas agregadas? (asumimos: ve posiciones)
- ¿Basta una parte para solicitar mediador? (asumimos: sí)
- Proveedor de biometría
- Calendario nativo vs proveedor externo

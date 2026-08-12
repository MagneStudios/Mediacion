# Prompt — Implementar cambios de schema (R-04, R-05, R-06, R-07, R-09, R-10, R-12)

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación" (plataforma de mediación y acuerdos extrajudiciales). Seguís el pipeline: **DBML → migraciones (RLS/triggers) → testing de migraciones → scripts Python → QA/E2E → staging → producción en Supabase**. Stack: PostgreSQL 17, Supabase local (`supabase/config.toml` puertos 55001/55002/55003), RLS con 47 policies activas, 23 migraciones secuenciales en `supabase/migrations/`. Los tipos de BD (`packages/db-types`) se mantienen **a mano** — cada cambio de schema exige actualizarlos.

## Estado inicial

- 22 tablas en `public`, 19 enums, 23 migraciones (última: `20260730180000_backend_gap_features.sql`).
- `estado_caso` enum actual: `'nuevo', 'activo', 'en_negociacion', 'acordado', 'cerrado', 'terminado', 'vencido'`.
- `estado_invitacion` enum actual: `'pendiente', 'aceptada', 'rechazada', 'expirada'` (ya existe, no se toca).
- `invitaciones` no tiene columna de vencimiento ni TTL en DB; la expiración se calcula en el backend con una constante de 7 días.
- `usuarios` ya tiene `desactivacion_solicitada_at` y `consentimiento_fecha` (migraciones 028 y 030).
- `planes` ya tiene `precio`, `limite_carpetas`, `limite_casos`, `limite_iteraciones_ia` (todos INT NOT NULL).
- Existe `GET /planes` en la API (lectura), pero no hay ABM.
- El sweep de vencimientos actual solo notifica; no modifica estados de invitación ni de caso.

## Contexto de negocio y decisiones

El documento `docs/decisiones-db/2026-08-10-cambios-reunion.md` contiene las decisiones tomadas. Resumen relevante:

- **R-04:** las invitaciones vencen a las **72 horas** desde el envío. El caso pasa a estado `expirado`. No se puede reenviar la invitación sobre un caso expirado. La TTL debe ser configurable (`configuracion.invitacion_ttl_horas`).
- **R-05:** los abogados/estudios cargan su matrícula al registrarse (número + adjunto). Sin verificación. Adjunto en bucket privado.
- **R-06:** a los **6 meses de la baja** se **anonimiza** al usuario (no se borra). La contraparte es notificada. Usuario con suscripción activa: retención 10 años.
- **R-07:** el invitador elige quién paga al invitar. El invitado que paga se registra, acepta la invitación y **después** paga (post-registro). Sin pagos pre-auth.
- **R-09:** facturación ARCA desde el día 1. Tabla `facturas` con estado (`pendiente / emitida / fallida`) para reintentos. `configuracion.impuestos` JSONB parametrizable por país. `planes.precio` se interpreta como neto.
- **R-10:** ABM de planes para admin. Plan "Estudio": USD 25/mes, casos ilimitados. `planes.limite_casos` nullable = ilimitado.
- **R-12:** log de envíos de email con reintentos. Eventos: invitación enviada/aceptada/rechazada, recordatorio 72 h, invitación vencida, nueva propuesta/cambio, acuerdo firmado.

## Tareas (en orden de pipeline)

### 1. DBML (`mediacion.dbml`)

Actualizar el archivo DBML en la raíz del repo con:
- `estado_caso` + `expirado`.
- `invitaciones.pago_a_cargo` (nota: `'invitador' | 'invitado'`).
- `usuarios.{numero_matricula, matricula_url, fecha_baja, depuracion_programada_at}`.
- Tabla `facturas` completa con FK a `pagos`.
- Tabla `envios_email` con FK a `notificaciones`.
- `planes.limite_casos` como nullable.
- Notas de máquina de estados: nuevas transiciones `nuevo → expirado`, `activo → expirado` (actualizar diagrama Mermaid si existe).

### 2. Migraciones (nuevo archivo `supabase/migrations/YYYYMMDDHHmmss_cambios_reunion_07_08.sql`)

Crear **una única migración** (aditiva, sin `DROP`, sin `ALTER COLUMN TYPE`) que contenga:

**ALTER TYPE:**
```sql
ALTER TYPE estado_caso ADD VALUE 'expirado'; -- no usar BEFORE/AFTER (riesgo de posición errónea)
```

**ALTER TABLE usuarios:**
```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS numero_matricula TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS matricula_url TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS depuracion_programada_at TIMESTAMPTZ;
```

**ALTER TABLE invitaciones:**
```sql
ALTER TABLE invitaciones ADD COLUMN IF NOT EXISTS pago_a_cargo TEXT;
-- + CHECK constraint en la misma migración (CONSTRAINT o ALTER DOMAIN a futuro)
```

**ALTER TABLE planes:**
```sql
ALTER TABLE planes ALTER COLUMN limite_casos DROP NOT NULL; -- permitir NULL = ilimitado
```

**CREATE TABLE facturas:**
```sql
CREATE TABLE facturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pago_id UUID NOT NULL REFERENCES pagos(id),
  numero TEXT,
  cae TEXT,
  url_pdf TEXT,
  neto NUMERIC(10,2),
  iva NUMERIC(10,2),
  impuestos NUMERIC(10,2),
  total NUMERIC(10,2),
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**CREATE TABLE envios_email:**
```sql
CREATE TABLE envios_email (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notificacion_id UUID NOT NULL REFERENCES notificaciones(id),
  intentos INT NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**CREATE INDEX:**
```sql
CREATE INDEX idx_facturas_pago_id ON facturas(pago_id);
CREATE INDEX idx_envios_email_notificacion_id ON envios_email(notificacion_id);
```

**INSERT / UPSERT seeds:**
```sql
INSERT INTO planes (nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio)
VALUES ('estudio', 0, NULL, 0, 25.00)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO configuracion (clave, valor, descripcion)
VALUES
  ('invitacion_ttl_horas', '72', 'Horas de vigencia de la invitación (R-04)'),
  ('impuestos', '{"AR":{"iva":21,"otros_impuestos":0}}', 'Impuestos por país (R-09)')
ON CONFLICT (clave) DO NOTHING;
```

**Transición de estado del caso (nuevo trigger o modificar existente):**
```sql
CREATE OR REPLACE FUNCTION validate_caso_estado_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Añadir las transiciones hacia expirado
  IF OLD.estado = 'nuevo' AND NEW.estado = 'expirado' THEN RETURN NEW; END IF;
  IF OLD.estado = 'activo' AND NEW.estado = 'expirado' THEN RETURN NEW; END IF;
  -- ... (el resto se conserva tal cual)
END;
$$ LANGUAGE plpgsql;
```

> **Cuidado:** `CREATE OR REPLACE FUNCTION` sobre `validate_caso_estado_transition` requiere copiar la lógica existente (chequeala en `20260721191658_functions_triggers.sql`). No reemplaces la función completa sin verificar que incluís todas las transiciones ya existentes.

### 3. Testing de migraciones

- Correr `scripts/smoke_migrations.py` (debe pasar con las nuevas tablas/columnas; actualizar el script si hace falta).
- Correr `scripts/validate_rls.py` (sin cambios de RLS en esta migración; debe pasar tal cual).
- Suite SQL en `scripts/tmp/`: agregar tests de las nuevas transiciones `nuevo → expirado`, `activo → expirado`, y de la anonimización futura.
- Verificar que `plans.limite_casos = NULL` (ilimitado) no rompe el backend que consume la tabla.

### 4. Actualizar db-types (hand-maintained)

El archivo `packages/db-types/src/database.types.ts` está **mantenido a mano** (no tiene script de generación). Cada cambio de schema requiere reflejarlo ahí:

- Agregar `"expirado"` en el union type de `estado_caso`.
- Agregar columnas nuevas en `usuarios`, `invitaciones`, `planes`.
- Agregar las tablas `facturas` y `envios_email` al tipo `Database`.
- Ajustar `limite_casos` a nullable (`number | null`).
- Los cambios deben pasarse a `ColumnType<...>` de Kysely.

### 5. Actualizar docs

- `docs/database.md` — nueva migración, estado `expirado`, columnas nuevas.
- `docs/mediacion_db_develop.md` — diagrama Mermaid actualizado, sección de facturación, jobs programados.
- Regenerar `backup.sql` / `solo_public.sql` al cerrar la fase.

## Reglas estrictas

1. **Solo cambios aditivos.** Nada de DROP / RENAME / ALTER COLUMN TYPE que pueda romper el backend existente o las migraciones ya aplicadas.
2. **No tocar RLS existente.** Las 47 policies quedan como están. Las tablas nuevas (`facturas`, `envios_email`) deben tener sus propias policies nuevas.
3. **`search_path = ''` en funciones nuevas** (por la regla del linter de Supabase). `is_admin()` y `(SELECT auth.uid())` como InitPlan donde aplique.
4. **FK con REFERENCES explícitas, sin CASCADE** (consistente con el resto del schema).
5. **CHECK constraint no bloqueante** para `pago_a_cargo` y `facturas.estado`.
6. El **nombre del archivo de migración** debe respetar el prefijo de timestamp (`YYYYMMDDHHmmss`) y ser posterior a `20260730180000`.

## Criterio de aceptación

- `smoke_migrations.py` pasa (23 tablas → 25 tablas).
- `validate_rls.py` pasa.
- El tipo `expired` en `estado_caso` es validado en transición por el trigger.
- `plans.limite_casos IS NULL` = ilimitado, y el seed del plan "estudio" se inserta sin error.
- `invitacion_ttl_horas` y `impuestos` existen en `configuracion` y se leen desde el backend.
- Los tests de integración existentes (ci-node.yml con Postgres) no rompen.
- `packages/db-types` compila (el typecheck `tsc -b` en raíz no da errores en `@mediacion/db-types`).

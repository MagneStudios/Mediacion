# Pedido DB → Backend — Acuerdos modulares (P1, P3, P4, P5)

**Fecha:** 06/09/2026
**Origen:** `docs/pedidos-frontend-a-db-acuerdos-modulares.md` + `docs/decisiones-db/2026-09-06-acuerdos-modulares.md`
**Migraciones:** 39 `20260906100000_pendiente_suscripciones_writable`, 40 `20260906110000_negociaciones`, 41 `20260906120000_acuerdos_recolocar` (breaking), 42 `20260906130000_acuerdos_versionado`
**Estado:** schema commiteado en `feat/supabase-db`. `npx tsc -b` queda ROJO en `apps/api` hasta que BE porte los cambios de abajo.

---

## 1. Cambios breaking (acciones obligatorias en BE)

### 1.1 `rondas`, `propuestas`, `acuerdos` y `items` ahora exigen `negociacion_id`
- `negociacion_id` es **NOT NULL** en `rondas`/`propuestas`/`acuerdos`; **nullable** en `items` (legacy sin materia).
- Todo INSERT en esas tablas debe pasar `negociacion_id`. El `caso_id` sigue existiendo para queries caso-nivel, pero la FK de integridad y los UNIQUE ahora cuelgan de `negociacion_id`.
- UNIQUE viejos caídos: `acuerdos_caso_unique`, `rondas_caso_numero_unique`, `propuestas_caso_ronda_unique`. Nuevos: `rondas_negociacion_numero_unique (negociacion_id, numero)`, `propuestas_negociacion_ronda_unique (negociacion_id, ronda_id)`.

### 1.2 `casos.ronda_actual` y `sync_ronda_actual()` se eliminaron
- La ronda vigente se lee por negociación: `SELECT round FROM negociaciones WHERE id = $negociacion_id`.
- No más `casos.ronda_actual`, ni trigger `trigger_sync_ronda_actual`, ni función `sync_ronda_actual()`.
- FE ya consume `CaseSummary.roundNumber` por tarjeta (por negociación).

### 1.3 `pendiente_suscripciones` ahora es estado escribible (P1)
- `validate_caso_estado_transition()` permite `nuevo → pendiente_suscripciones` y `pendiente_suscripciones → {activo, en_negociacion, terminado, vencido, expirado}`.
- El gate C-01 (`trg_casos_gate_suscripciones`) sigue siendo el único que frena la activación real si no ambas partes tienen suscripción activa.

---

## 2. Nuevo contrato (lo que BE debe consumir)

### 2.1 Tabla `negociaciones`
```
negociaciones (
  id uuid PK,
  caso_id uuid NOT NULL → casos(id),
  materia materia_acuerdo,            -- NULLABLE; legacy (modelo viejo) = NULL, NUNCA 'otro'
  method metodo_caso NOT NULL,
  estado estado_negociacion NOT NULL DEFAULT 'borrador',
  round int NOT NULL DEFAULT 1,
  created_at, updated_at
)
UNIQUE (caso_id, materia)             -- NULLs no colisionan: 1 negociación legacy NULL por caso
```
- Enums: `materia_acuerdo = (tenencia, alimentos, bienes, otro)` · `estado_negociacion = (borrador, activa, acordada, cerrada, terminada)`.
- `'otro'` queda reservado como materia explícita no clasificada; el modelo viejo se representa con `materia = NULL` (no usar `'otro'` como relleno).

### 2.2 Versionado de `acuerdos` (P5)
- Nuevas columnas: `version int NOT NULL DEFAULT 1`, `supersedes_agreement_id uuid → acuerdos(id)`, `vigente boolean NOT NULL DEFAULT true`, `valid_from timestamptz NOT NULL DEFAULT now()`.
- **No** se agregó miembro a `estado_acuerdo` (evita el bug de render como "borrador" en los ternarios del front).
- "Acuerdo vigente de la negociación" = `SELECT … WHERE negociacion_id = $1 AND vigente = true` (índice `idx_acuerdos_negociacion_vigente`).
- Renegociar: precargar vigente → crear nuevo con `version = vigente.version + 1`, `supersedes_agreement_id = vigente.id` → UPDATE viejo `vigente = false`.

### 2.3 `estado_caso = 'acordado'` es derivado
- Solo cuando **todas** las materias del caso tienen acuerdo vigente+firmado. Lo calcula un trigger/BE; el estado por materia vive en `acuerdos`.

---

## 3. Puntos de rotura en `apps/api` (tsc -b, pre-existentes al commit DB)

Estos archivos usan el esquema viejo y deben portarse al nuevo contrato:

| Archivo | Línea | Problema |
|---|---|---|
| `apps/api/src/acuerdos/acuerdos-firmar.integration.spec.ts` | 136 | INSERT en `acuerdos` sin `negociacion_id` |
| `apps/api/src/acuerdos/acuerdos.repository.ts` | 147 | INSERT en `acuerdos` sin `negociacion_id` |
| `apps/api/src/acuerdos/webhook/docusign-webhook.integration.spec.ts` | 117 | INSERT en `acuerdos` sin `negociacion_id` |
| `apps/api/src/acuerdos/acuerdos-generation.integration.spec.ts` | 128 / 134 | INSERT en `rondas` / `propuestas` sin `negociacion_id` |
| `apps/api/src/acuerdos/agreement-content.spec.ts` | 8 | objeto `propuestas` sin `negociacion_id` |
| `apps/api/src/negociacion/rondas.repository.ts` | 15 | INSERT en `rondas` sin `negociacion_id` **y** referencia a `casos.ronda_actual` (eliminada) |

**Acción BE:** crear/obtener la `negociacion_id` correspondiente (por `caso_id` + `materia`, o la legacy NULL) y pasarla en los INSERT; reemplazar toda lectura de `casos.ronda_actual` por `negociaciones.round`.

`packages/db-types` queda **verde** (`npm run typecheck` exit 0) — los tipos ya reflejan el nuevo contrato.

---

## 4. Notas para FE (fuera de alcance de este pedido, para coordinar)
- `materia` en `negociaciones` es `null` para casos del modelo viejo; renderizar como "Sin materia / modelo anterior".
- `vigente` / `supersedes_agreement_id` para historial de versiones; no usar `estado_acuerdo` para "reemplazado".
- `roundNumber` por tarjeta de caso ya viene por negociación.

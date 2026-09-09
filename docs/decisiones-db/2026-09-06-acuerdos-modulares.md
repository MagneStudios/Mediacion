# Decisiones — Acuerdos modulares por materia (evolución de C-08)

**Fecha:** 06/09/2026
**Fuente:** `docs/pedidos-frontend-a-db-acuerdos-modulares.md` (FE→DB) sobre `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` (reunión Victor Solmi 01/09).
**Contexto:** el modelo pasa de "1 caso = 1 acuerdo" a "1 caso = N negociaciones por materia (tenencia/alimentos/bienes), cada una con su acuerdo, firma y versionado".

## Decisiones (§5 del pedido FE, confirmadas)

1. **Materia** → nuevo enum `materia_acuerdo = (tenencia, alimentos, bienes, otro)`. **No** reusar `categoria_item` (es categoría de posición privada; confundirlos renderiza "Cuidado de niñas" donde el cliente pidió "Tenencia"). `items` gana `negociacion_id` (nullable + backfill) para acotar "listo para proponer" por materia.
2. **Versionado** → `vigente BOOLEAN` + `supersedes_agreement_id` + `version INT` + `valid_from TIMESTAMPTZ`. **No** se agrega miembro a `estado_acuerdo` (evita el bug de render como "borrador" en los ternarios del front).
3. **`estado_caso='acordado'`** → solo cuando **todas** las materias tienen acuerdo vigente+firmado. Es estado derivado (trigger/BE lo calcula). El estado por materia vive en `acuerdos`.
4. **`casos.ronda_actual` + `sync_ronda_actual`** → se retiran. La ronda se lee por negociación (`negociaciones.round`); FE ya consume `CaseSummary.roundNumber` por tarjeta.

## Principio de ejecución (por partes, commit individual)

- **Parte 3** (aditivo): tabla `negociaciones` + `materia_acuerdo` + `estado_negociacion`. No rompe el path caso→acuerdo actual.
- **Parte 4** (breaking): mover `rondas`/`propuestas`/`acuerdos`/`items` bajo `negociacion_id`; caen `acuerdos_caso_unique` y `rondas_caso_numero_unique`; retirar `casos.ronda_actual` + `sync_ronda_actual`.
- **Parte 5**: versionado en `acuerdos`.
- **Plantillas**: **fuera de alcance** (cliente no entregó modelos por materia; diseño cambió a "catálogo de cláusulas con selección por caso" — `docs/respuestas-cliente-01-09-2026.md` §7).
- **Arbitraje H.5–H.6** (TyC): sin cambios en esta etapa (decisión del estudio pendiente; ver C-02 en `docs/decisiones-db/2026-09-02-c01-c02-cliente.md`).

## Frontera congelada (DB→BE/FE)

`negociacion_id` estable · `materia` nullable con meaning "viejo modelo" (nunca relleno `otra`) · `vigente`/`supersedes` para historial · `roundNumber` por negociación · `acordado` derivado de caso.

## Referencias

- `docs/pedidos-frontend-a-db-acuerdos-modulares.md`, `docs/CAMBIOS-PACTUM-v2-2026-09-01.md`
- Prompts: `docs/prompts-db/2026-09-06-acuerdos-negociaciones.md`, `…acuerdos-recolocar.md`, `…acuerdos-versionado.md`
- Inventario de bloqueos verificados en el pedido FE §2 (constraints, contador, `markAcordado`, falta versionado/plantillas, RLS).

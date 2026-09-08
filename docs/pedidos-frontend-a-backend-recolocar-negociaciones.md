> ## ✅ Estado al 08/09/2026 — resuelto lo que compilaba, abierto lo demás
>
> **Backend cerró §1 a §6** en [`af1c6f5`](https://github.com/MagneStudios/Mediacion/pull/123) (PR #123). `dev` está verde: los 7 call sites, los 3 inserts, el `biome`, y la decisión del §6 tomada por la salida conservadora (la negociación legacy, `materia IS NULL`). `createCaseWithParteA` además crea esa negociación para los casos nuevos, que el checklist no había pedido y sin lo cual todo caso nuevo rompía al primer acceso.
>
> **Sumó una pieza que no estaba en el checklist y hacía falta:** `insertNextRonda` ahora bumpea `negociaciones.round` en la misma transacción (`rondas.repository.ts:31-46`). La migración se llevó `sync_ronda_actual()` y nada más lo mantenía — sin eso la ronda quedaba congelada en 1 para siempre, que es el número que dibuja nuestro dashboard.
>
> **Lo mejor para nosotros: `ronda_actual` sigue siendo clave del payload.** No se eliminó, se reproyectó como subquery contra `negociaciones.round` (`casos.repository.ts:42-56`, `.as("ronda_actual")`), y no hay DTO ni serializer en el camino. El contrato de wire quedó idéntico y **el front no tocó una línea**. Anotado acá porque es justo el tipo de cosa que alguien "limpia" más adelante creyendo que es código muerto.
>
> ### Sigue abierto — verificado a mano el 08/09, no leído de un changelog
>
> | # | Qué | Dónde se ve que no está |
> |---|---|---|
> | §7.1 | `acordado` derivado por materia | `casos.repository.ts:59-64` sigue siendo `UPDATE casos SET estado='acordado' WHERE id=?`. No hay trigger nuevo: la última migración es `20260906130000` |
> | §7.2 | Que alguien escriba `pendiente_suscripciones` | `grep pendiente_suscripciones apps/api/src` ⇒ **cero matches** |
> | §8.1 | `GET /acuerdos/:id` | `acuerdos.controller.ts` expone `POST/GET casos/:casoId/acuerdo`, `POST acuerdos/:id/firmar`, `GET acuerdos/:id/exportar`, `GET acuerdos/:id/firmas` y `GET firmas`. Falta ésta |
> | §8.2 | `subject_type` y `version` en `GET /firmas` | `acuerdos.types.ts:43-52` y el select de `firmas.repository.ts:128-141` no los traen |
> | §8.3 | `GET /casos/:id/negociaciones` | Ningún `*.controller.ts` menciona `negociaciones` |
>
> **Los tres del §8 son los que nos tienen frenados.** DB entregó el modelo el 06/09 y nosotros integramos por ustedes, así que el refactor de acuerdos modulares está bloqueado ahí y en ningún otro lado.
>
> ### Dos observaciones del fix, ninguna bloqueante
>
> - **`withRondaActual()` usa `sql<number>`, que *afirma* no-nulidad.** Si un caso llegara a quedar sin negociación legacy, la API manda `ronda_actual: null` contra un tipo que dice `number` (y si tuviera dos, Postgres tira *"more than one row returned by a subquery"*). Hoy lo impide la construcción, no una constraint. De nuestro lado no rompe —`CaseSummary.roundNumber` es `number | null`—, pero `ApiCaseSummary.ronda_actual: number` pasaría a ser mentira.
> - **El predicado `caso_id = ? AND materia IS NULL` quedó duplicado en cuatro módulos** (`rondas`, `casos`, `mediaciones`, `acuerdos`), en tres dialectos distintos, en vez de un helper. Es exactamente la superficie que hay que tocar cuando aparezca la segunda materia.
>
> ### Y una asimetría de monetización que nos toca mostrar en pantalla
>
> De su propio changelog del 03/09 ("Deuda conocida"): `consume_quota` resuelve la suscripción del estudio para **cualquier** miembro, pero `/uso` sólo para el titular. Un miembro no titular consume contra el plan del estudio, recibe el `402` sin detalle, y en Mi plan lee **"no tenés plan"** — porque `/uso` le responde 404 y nosotros lo mapeamos a "sin plan", que es lo único honesto que podemos hacer con esa respuesta. No lo tapamos. Se arregla de un lado o del otro: o `consume_quota` adopta el criterio de titularidad, o `/uso` se abre a los miembros.

---

# `dev` está roto — la API no se actualizó a las migraciones de acuerdos modulares

**Fecha:** 07/09/2026 · **Autor:** Frontend · **Para:** Backend
**Origen:** PR #120 (`feat/supabase-db`, mergeado 07/09), migraciones 39–42 de `docs/decisiones-db/2026-09-06-acuerdos-modulares.md`
**Urgencia:** alta — **la API no compila, así que hoy no se puede deployar `dev`**.

Esto no es un reproche a DB: las migraciones están bien y `packages/db-types` quedó regenerado correctamente. Justamente por eso el compilador ahora tiene razón y la API no. Lo que falta es poner `apps/api` al día, y el PR se mergeó con tres checks en rojo.

---

## 1 · Qué está fallando

| Check | Resultado | Causa |
|---|---|---|
| `docker-build` | ❌ | **La API no compila** — 11 errores de TS |
| `integration` | ❌ | **6 suites, 21 tests** — `column "ronda_actual" does not exist` y `null value in column "negociacion_id" violates not-null constraint` |
| `lint-typecheck-test` | ❌ | `biome ci` por formato en `packages/db-types/src/database.types.ts`. **Trivial, pero corre antes que `tsc -b` y tapa los 11 errores de arriba** |

Corrida: [`ci-node` 34075919119](https://github.com/MagneStudios/Mediacion/actions/runs/34075919119).

**Empezá por el `biome`** (`pnpm biome format --write packages/db-types/src/database.types.ts`): es un comando, y hasta que no pase, `tsc` no corre y no vas a ver el resto en CI.

Suites de integración caídas:
```
src/casos/... (vía app-isolation)      src/negociacion/negociacion-rondas
src/negociacion/negociacion-noleak      src/acuerdos/acuerdos-generation
src/acuerdos/acuerdos-firmar            src/acuerdos/webhook/docusign-webhook
```

---

## 2 · Qué cambió en el schema, en una línea

- **`casos.ronda_actual` se eliminó**, junto con `sync_ronda_actual()` y su trigger. La ronda ahora vive en `negociaciones.round`.
- **`rondas`, `propuestas` y `acuerdos` ganaron `negociacion_id NOT NULL`** con FK a `negociaciones`.
- **Cayeron** `acuerdos_caso_unique`, `rondas_caso_numero_unique` y `propuestas_caso_ronda_unique`; en su lugar hay `rondas_negociacion_numero_unique (negociacion_id, numero)` y `propuestas_negociacion_ronda_unique (negociacion_id, ronda_id)`.
- **`caso_id` se mantiene** en las tres tablas, a propósito, para las queries a nivel caso. No hay que sacarlo.
- La migración 41 creó **una negociación por cada caso existente, con `materia = NULL`** (= "modelo viejo"), y backfilleó todo hacia ella.

---

## 3 · Los 7 lugares que leen `ronda_actual`

### 3.1 · Lecturas del contador (4)

| # | Dónde | Qué hace |
|---|---|---|
| 1 | `casos/casos.repository.ts:28` | `caseDetailColumns` incluye `"casos.ronda_actual"` |
| 2 | `casos/casos.repository.ts:40` | `caseSummaryColumns` incluye `"casos.ronda_actual"` |
| 3 | `negociacion/rondas.repository.ts:23` | `buildCurrentRondaActualQuery` → `selectFrom("casos").select("ronda_actual")` |
| 4 | `mediacion/mediaciones.repository.ts:44` | La misma query, duplicada en este módulo |

### 3.2 · Tipos derivados (2)

| # | Dónde | Qué hace |
|---|---|---|
| 5 | `casos/casos.types.ts:44` | `CaseSummaryRow = Pick<Caso, … \| "ronda_actual">` |
| 6 | `casos/casos.types.ts:60` | `CaseDetailRow = Pick<Caso, … \| "ronda_actual">` |

### 3.3 · Consumidor (1)

| # | Dónde | Qué hace |
|---|---|---|
| 7 | `negociacion/propuestas.repository.ts:321` | En `resolveRespuesta`, al rechazar: lee `ronda_actual` y abre la ronda `numeroActual + 1` |

Más `negociacion/negociacion.service.ts:229`, que no consulta la columna pero menciona `ronda_actual` en un mensaje de error de `ensureActiveRondaId`.

---

## 4 · Los 3 inserts que necesitan `negociacion_id`

| Tabla | Dónde | Values hoy |
|---|---|---|
| `rondas` | `negociacion/rondas.repository.ts:15` (`buildInsertNextRondaQuery`) | `{ caso_id, numero }` |
| `propuestas` | `negociacion/propuestas.repository.ts:68` | `{ caso_id, ronda_id, contenido, modelo_ia }` |
| `acuerdos` | `acuerdos/acuerdos.repository.ts:147` (`insertDraft`) | `{ caso_id, contenido, estado }` |

En `propuestas` el dato ya está a mano: la ronda que se está usando conoce su `negociacion_id`, así que sale de ahí sin una query extra.

---

## 5 · Errores de compilación, para cruzar

```
src/casos/casos.types.ts:36:3          TS2344
src/casos/casos.types.ts:49:3          TS2344
src/casos/casos.repository.ts:107:5    TS2322
src/casos/casos.repository.ts:110:15   TS2769
src/casos/casos.repository.ts:151:5    TS2322
src/casos/casos.repository.ts:154:15   TS2769
src/negociacion/rondas.repository.ts:15:13   TS2345   ← insert sin negociacion_id
src/negociacion/rondas.repository.ts:23:40   TS2769
src/negociacion/propuestas.repository.ts:68:13  TS2345 ← insert sin negociacion_id
src/acuerdos/acuerdos.repository.ts:147:19      TS2345 ← insert sin negociacion_id
src/mediacion/mediaciones.repository.ts:44:40   TS2769
```

---

## 6 · La decisión que no podemos tomar por vos

**¿En qué negociación se inserta una ronda nueva cuando el caso tiene tres?**

Hoy `ensureActiveRondaId(casoId)` resuelve la ronda **por caso**, y con materias eso deja de tener un único resultado correcto. No es un find-and-replace: es a qué se le cuelga la ronda.

La salida conservadora, y la que sugerimos para desbloquear hoy, es **resolver la negociación legacy del caso** (`WHERE caso_id = ? AND materia IS NULL`) y colgar todo ahí. Es exactamente lo que hizo el backfill de la migración 41, y **no cambia ningún comportamiento** mientras haya una sola negociación por caso — que es el estado de todos los casos existentes. Cuando aparezca la segunda materia, la firma pasa a tomar `negociacionId` y el `casoId` deja de alcanzar.

Si preferís ir directo a `negociacionId` en las firmas de repositorio, mejor todavía — pero es más trabajo y `dev` está rojo ahora.

---

## 7 · Dos cosas que quedaron pendientes de la decisión de DB

Ninguna bloquea el compilado, pero conviene que no se pierdan.

**7.1 · `estado_caso = 'acordado'` sigue sin ser derivado.** La decisión (`docs/decisiones-db/2026-09-06-acuerdos-modulares.md` §3) dice que pasa a marcarse *"solo cuando todas las materias tienen acuerdo vigente+firmado"*, y que lo calcula un trigger o BE. **Las migraciones no traen ese trigger**, y `markAcordado(casoId)` sigue poniendo el caso entero en `acordado` a la primera aceptación.

Consecuencia concreta del lado nuestro: **firmar tenencia apagaría alimentos y bienes**. Nuestra elegibilidad devuelve `read_only` para `acordado`, así que las otras materias quedarían de solo lectura sin explicar por qué. No urge hasta que exista la segunda materia, pero es de BE.

**7.2 · `pendiente_suscripciones` ya se puede escribir, y todavía no lo escribe nadie.** La migración 39 abrió las transiciones (`nuevo → pendiente_suscripciones` y de ahí a `activo`/`en_negociacion`/etc.), y el comentario de la propia migración dice *"BE escribe el estado en el catch del P0001 del gate"*.

Hoy `trg_casos_gate_suscripciones` sólo aborta con `409 caso_bloqueado_suscripciones` y el caso queda en `nuevo` — indistinguible de uno recién creado. **El front ya lo consume entero** (`types/case.ts`, el mapper, copy en los dos idiomas, las tres utils de elegibilidad) y desde el 04/09 muestra el 409 con mensaje propio en vez de "revisá el código". En cuanto BE escriba el estado, aparece *"Falta activar suscripciones"* sin una línea de código nueva de nuestro lado.

---

## 8 · Qué sigue esperando FE, cuando esto esté verde

De `docs/pedidos-frontend-acuerdos-modulares.md`, por orden de valor:

1. **`GET /acuerdos/:id`** — re-address del handler que ya existe. Ahora que cayó `acuerdos_caso_unique`, es lo que evita que la bandeja de firmas abra el acuerdo equivocado.
2. **`GET /firmas` con `subject_type` y `version`** — el `acuerdo_id` ya lo mandabas y nosotros ya lo consumimos; sin materia y versión, dos acuerdos del mismo caso se ven como dos filas idénticas.
3. **`GET /casos/:id/negociaciones`** — ya existe la tabla, así que el shape del §2.3 es implementable.

---

*Cualquier cosa, respondemos sobre este doc.*

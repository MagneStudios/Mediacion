# Pedidos de Frontend → DB — acuerdos modulares por materia

**Fecha:** 04/09/2026 · **Autor:** Frontend · **Para:** DB (y Producto, en §5)
**Origen:** `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` puntos 1 y 2 · análisis en `docs/plan-frontend-v2-04-09-2026.md`
**Hermano:** `docs/pedidos-frontend-acuerdos-modulares.md` (lo que le pedimos a BE)

Se separa de la ficha de BE porque **el trabajo de DB acá es más grande que el de BE**, y meterlo como una sección de tres preguntas dentro de un doc de endpoints lo enterraba. Esto es un inventario, no una lista de deseos: cada punto está verificado contra el schema, con archivo y línea.

**No prescribimos el diseño del schema — es de ustedes.** Lo que traemos es: qué bloquea hoy, qué necesita leer el front, y qué decisiones nos cambian el alcance.

---

## 1 · El cambio, en una línea

El cliente pasó de **"un caso = un acuerdo"** a **"un caso = N negociaciones, una por materia (tenencia / alimentos / bienes), cada una con su propia negociación, su propio acuerdo y su propia firma"**, más versionado: un acuerdo se renegocia, el nuevo reemplaza al viejo, y el viejo queda en historial.

El modelo que propuso el cliente (no es normativo, es su boceto):

```
cases → negotiations (case_id, subject_type, method, status, round)
          → agreements (negotiation_id, template_id, version, status, signed_at)
agreement_templates (subject_type, version, body, active)
```

---

## 2 · Lo que bloquea hoy — inventario verificado

Esto es lo que encontramos leyendo las migraciones. Ninguno es una sorpresa evitable; los listamos para que el presupuesto de la migración sea realista desde el principio.

### 2.1 · Constraints que impiden más de uno

| Constraint | Archivo | Qué impide |
|---|---|---|
| `acuerdos_caso_unique UNIQUE (caso_id)` | `20260723210000_acuerdos_caso_unique.sql:14` | **El bloqueante duro.** Está declarado con el comentario *"un caso solo puede tener un acuerdo"* — es una regla de negocio explícita, no un accidente |
| `rondas_caso_numero_unique UNIQUE (caso_id, numero)` | `20260721191655_constraints_indexes.sql:20` | Dos materias no pueden tener ambas "ronda 1" |
| `propuestas_caso_ronda_unique UNIQUE (caso_id, ronda_id)` | `20260724011737_propuestas_ronda_unique.sql:14` | Habría que revisar qué significa con rondas por negociación |

### 2.2 · Un contador escalar y un trigger que lo sincroniza

`casos.ronda_actual INT NOT NULL DEFAULT 1` (`20260721191651_tables.sql:124`) y `sync_ronda_actual()` (`20260721191658_functions_triggers.sql:107`), que hace:

```sql
UPDATE casos SET ronda_actual = NEW.numero
WHERE id = NEW.caso_id AND NEW.numero > ronda_actual;
```

**Con N negociaciones este trigger deja de tener sentido:** la ronda 3 de bienes pisaría el contador del caso, y la pantalla de tenencia mostraría "Ronda 3" sobre una negociación que va por la primera. El front lo consume como `CaseSummary.roundNumber` en cada tarjeta del dashboard.

Decisión de ustedes: ¿se retira, o pasa a ser el máximo entre las negociaciones? Cualquiera nos sirve; necesitamos saber cuál.

### 2.3 · Una aceptación cierra el caso entero

`propuestas.repository.ts` → ambas partes aceptan → `markAcordado(casoId)` → `estado_caso = 'acordado'`. Y `acuerdos.service.ts` exige `caso.estado === 'acordado'` para generar el acuerdo.

Con materias, **firmar tenencia apagaría alimentos y bienes**: la elegibilidad del front devuelve `read_only` para `acordado`, así que las otras dos negociaciones quedarían de solo lectura sin explicar por qué. Es el riesgo más caro del cambio y no se ve mirando la tabla `acuerdos`.

### 2.4 · Sin versionado

`estado_acuerdo = borrador | enviado_a_firma | firmado | con_aviso` (`20260721191644_enums.sql`). No hay `version`, ni `supersedes_id`, ni `vigente`/`reemplazado`, ni fecha de vigencia.

### 2.5 · Sin plantillas

No existe ninguna infraestructura de plantillas. `buildAgreementContent` arma un snapshot JSONB de la propuesta aceptada, y `acuerdo-export.ts` genera **texto plano** — `acuerdos.documento_url` no se escribe nunca. Esto está bloqueado por el cliente (ver §5), pero conviene que esté en el mapa.

### 2.6 · RLS y tipos

Las policies de `acuerdos`, `rondas` y `propuestas` (`20260721191704_rls_policie.sql:176, 188, 236`) resuelven todo por `is_part_of_case(caso_id)`. Una tabla `negociaciones` nueva necesita su propia policy, y las tablas que pasen a colgar de ella tienen que llegar al caso por el salto extra. Más `packages/db-types` regenerado y `mediacion.dbml` sincronizado, como siempre.

---

## 3 · Un pedido chico y separable, que se puede hacer ya

**`pendiente_suscripciones` no se puede escribir hoy — y no es culpa de BE.**

El estado se agregó al enum el 02/09 con el gate C-01, y **el front lo soporta entero**: `types/case.ts`, el mapper, copy en los dos idiomas, y las tres utils de elegibilidad. Pero ningún caso lo alcanza jamás.

En la ficha de BE lo habíamos anotado como pedido para ellos. **Estaba mal dirigido, y lo corregimos acá:** el validador de transiciones lo rechaza antes de llegar a la fila. `validate_caso_estado_transition()`, en su versión vigente (`20260810120000_cambios_reunion_07_08.sql`), sólo admite:

```
nuevo          → activo | terminado | expirado
activo         → en_negociacion | terminado | vencido | expirado
en_negociacion → acordado | terminado | vencido
acordado       → cerrado
```

`pendiente_suscripciones` no aparece en ningún lado, así que cualquier `UPDATE` hacia ese estado muere en `Transición de estado inválida: nuevo → pendiente_suscripciones`. **Aunque BE escribiera el código, no pasaría.**

Lo que hace falta, y es chico:
1. Agregar las transiciones que correspondan al validador (como mínimo `nuevo → pendiente_suscripciones` y `pendiente_suscripciones → activo`).
2. Decidir **quién** escribe el estado: hoy `trg_casos_gate_suscripciones` sólo aborta la transición con `P0001`; no cambia el estado. Puede ser el propio gate, o BE en el catch.

**Por qué importa más de lo que parece:** hoy, cuando alguien intenta unirse a un caso sin suscripción, la transacción hace rollback entero y el caso queda en `nuevo` — indistinguible de uno recién creado. La contraparte no tiene forma de saber que hay algo pendiente. Con el estado escrito, el front ya muestra *"Falta activar suscripciones"* sin ninguna línea de código nueva.

Esto **no depende del acuerdo marco ni del modelo de materias**. Es independiente y se puede hacer solo.

---

## 4 · Qué necesita leer el front del modelo nuevo

No pedimos columnas concretas — pedimos que estos datos existan y sean consultables por caso. El shape del endpoint está en `docs/pedidos-frontend-acuerdos-modulares.md` §2.3.

| Dato | Para qué | Regla de borde que nos importa |
|---|---|---|
| **Identidad de negociación** | Direccionar rutas y listas | Que sea estable; hoy no existe y **no lo vamos a inventar del lado del front** |
| **Materia** | Etiquetar cada negociación | Nullable durante la transición, con el significado "viene del modelo viejo". **Nunca un valor de relleno tipo `otra`** — preferimos decir "todavía no está dividido por materia" |
| **Estado y ronda por negociación** | La tarjeta de cada una | Que no dependan del estado global del caso (§2.3) |
| **Acuerdo vigente de la negociación** | Saber si hay algo que mostrar | `null` cuando no hay, nunca un objeto con campos vacíos |
| **Versión y a quién reemplaza** | Historial y la acción "Renegociar" | Ver la pregunta 2 de §5 |

**Una taxonomía que NO queremos confundir:** `categoria_item` (`cuidado_ninos | cronogramas | bienes | economico | personalizado`) es la categoría de una **posición privada**, y sólo `bienes` coincide por nombre con las materias del cliente. Si la materia reusa ese enum vamos a terminar mostrando *"Cuidado de niñas, niños y adolescentes"* donde el cliente pidió *"Tenencia"*. Del lado del front ya lo tratamos como dos vocabularios separados, sin puentes.

---

## 5 · Decisiones que necesitamos, y por qué cambian nuestro alcance

**1. ¿La materia reemplaza o convive con `categoria_item`? ¿Y las posiciones pasan a colgar de la negociación?**
Hoy calculamos "esta parte está lista para proponer" contando posiciones **por caso** (`items.caso_id`). Con tres materias y posiciones cargadas sólo en bienes, **las tres negociaciones van a leer "listo"** y ofrecer generar propuesta — y el motor recibiría una negociación de tenencia sin ningún insumo de tenencia. Es la dependencia oculta más cara del cambio y no se ve mirando acuerdos.

**2. ¿`reemplazado` es un miembro nuevo de `estado_acuerdo`, o `vigente boolean` + `supersedes_id`?**
Cambia si nuestro trabajo es "agregar un caso a tres switches" o "agregar una dimensión". Aviso concreto: tenemos tres escaleras de ternarios sobre `estado` que terminan en el default `borrador`, así que **un miembro nuevo del enum se renderiza hoy como "borrador"** hasta que las toquemos. Un acuerdo histórico mostrado como borrador es peor que no mostrarlo.

**3. ¿Sigue existiendo `estado_caso = 'acordado'`, y qué significa con 2 de 3 materias firmadas?** (§2.3)

**4. ¿`casos.ronda_actual` se retira o se redefine?** (§2.2)

---

## 6 · Lo que sugerimos NO hacer todavía

- **Las plantillas de acuerdo.** El cliente todavía no entregó los modelos por materia, y en las respuestas del 01/09 ya movió el diseño de *"plantilla editable con variables"* a *"catálogo de cláusulas con selección por caso"* (`docs/respuestas-cliente-01-09-2026.md` §7). Congelar un modelo de sustitución de variables ahora sería congelar la arquitectura equivocada. Además sigue sin respuesta **quién selecciona las cláusulas**, y eso decide si el front necesita una pantalla de armado que hoy no está en ningún plan.
- **Tocar las cláusulas de arbitraje H.5–H.6 de los TyC** sin decidir antes lo de siempre: los documentos legales son versionados y `has_accepted_current` matchea por versión exacta, así que tocar el articulado puede mandar a **todos los usuarios activos** a reaceptar. Sigue abierto desde el 01/09 (el cliente ahora confirmó que en familia el arbitraje está expresamente prohibido, así que el texto ofrece un método que la plataforma no presta y no va a prestar).

---

## 7 · Orden que nos sirve, y por qué

| # | Qué | Depende de | Nota |
|---|---|---|---|
| 1 | **`pendiente_suscripciones` escribible** (§3) | nada | Independiente del resto. El front ya lo consume |
| 2 | **Las cuatro decisiones** (§5) | nada, es una conversación | Desbloquean que sepamos qué construir |
| 3 | Tabla de negociaciones + materia, **aditivo** | (2) | Mientras sea aditivo, no rompe nada existente |
| 4 | Mover rondas/propuestas/acuerdos a la negociación; **caen `acuerdos_caso_unique` y `rondas_caso_numero_unique`** | (3) | Es el paso que rompe. Conviene que sea uno solo y bien anunciado |
| 5 | Versionado (`version`, supersedes, vigente) | (2), (4) | Habilita "Renegociar" |
| 6 | Plantillas | **el acuerdo marco del cliente** | Bloqueado afuera |

El **1 y el 2 no esperan a nadie**, y el 1 arregla algo que hoy está roto de punta a punta.

---

## 8 · Del lado del front, para que se vea qué ya está listo

No estamos esperando de brazos cruzados. Ya está mergeado (`docs/changelogs/2026-09-04.md`):

- La bandeja de firmas **direcciona por acuerdo, no por caso**, y la pantalla verifica que abrió el que corresponde. Con `UNIQUE (caso_id)` vivo esto es inalcanzable; el día que caiga, evita que alguien firme el documento equivocado.
- Las negociaciones del caso **se dibujan como lista** de una sola entrada, para que el día que devuelvan tres no haya que tocar la pantalla.
- El `409 caso_bloqueado_suscripciones` del gate **ya se muestra como lo que es**, con el código tipado que BE dejó en `pg-error.ts`.

Lo que no hicimos a propósito: **inventar un identificador de negociación**. Con una por caso no resuelve ninguna ambigüedad, y sintetizarlo sería meter un dato falso que después viaja a params de ruta.

---

*Dudas o cambios: responder sobre este doc, o en `docs/decisiones-db/` como vienen haciendo.*

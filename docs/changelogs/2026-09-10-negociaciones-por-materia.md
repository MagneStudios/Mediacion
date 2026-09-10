# Changelog — Proyecto Mediación

## 2026-09-10 (2) — El detalle del caso dibuja N materias, y una firmada se puede renegociar

**Origen:** §2.3 y §2.4 de `docs/pedidos-backend-a-frontend-acuerdos-modulares.md`. Cierra los cuatro pedidos de acuerdos modulares del lado del front; los dos primeros salieron en `2026-09-10.md`. Toca sólo `mediacion-app` y `docs/`.

---

**El acuerdo se muestra porque existe, no porque el caso esté `acordado`.**

La sección de negociaciones del detalle fabricaba su lista con un elemento —*"la negociación del caso"*— y decidía si dibujar el acuerdo con `casos.estado === 'acordado'`. Ese gate se rompe dos veces con el modelo nuevo: `acordado` ahora se deriva **al completarse la última firma** (Bruno §3.1), o sea que llega al final del ciclo y no al principio, y con dos materias firmar tenencia no dice nada de alimentos.

Ahora la lista es la de `GET /casos/:id/negociaciones`: una tarjeta por materia con **su propio estado** (`negociaciones.estado`, cinco valores, ninguno del caso), su método, su ronda y su acuerdo vigente. El acuerdo se dibuja cuando `acuerdo_vigente` no es `null`, y la tarjeta que lo dibuja **lee y navega por ese id** — lo que el PR anterior dejó preparado.

**El resumen del flujo de propuestas se dibuja una vez, arriba, no una vez por materia.** Sigue siendo por caso: las rutas de propuestas no llevan `negotiationId` porque nosotros dijimos que no lo consumíamos (Bruno §5). Dibujarlo N veces mostraría N copias del mismo dato. Ahora sí lo necesitamos, y va pedido abajo.

---

**`null` no es "Otro", y el mock no finge materias.**

Una negociación con `subject_type: null` viene del modelo viejo. La tarjeta dice **"Sin materia asignada"**, nunca "Otro": `otro` es una materia real del enum, y ponérsela a una negociación que no tiene ninguna es una etiqueta falsa. Es exactamente lo que le pedimos a Backend, aplicado de este lado.

Y el mock devuelve **una** negociación por caso, sin materia. No porque sea más fácil: es lo que la API devuelve hoy para todo caso existente, y un mock con tres materias inventadas vendería una pantalla que ningún backend puede producir todavía (ver QA).

---

**Renegociar: el botón aparece sólo donde el servidor no respondería 409.**

`POST /negociaciones/:id/renegociar` exige un acuerdo vigente **y firmado** — un borrador (renegociar dos veces seguidas) o un `con_aviso` es `409 negociacion_not_acordada`. La tarjeta ofrece el botón con la misma regla, como `utils/case-actions.ts` con terminar: no ofrecer lo que devolvería un 409 genérico sin explicación.

Va detrás de un diálogo de confirmación, porque tiene tres consecuencias que la persona no ve desde el botón: el acuerdo firmado deja de estar vigente (se conserva), se abre una ronda nueva que parte de su contenido, y **el caso vuelve de `acordado` a `en_negociacion`**. Por eso la sección recibe `onCaseChanged`: el chip, el semáforo, el plazo y el botón de terminar dependen del estado del caso, y todos cambian.

**El `409` tiene copy propio y relee la lista.** Con `is-negotiation-not-acordada-error.ts` —mismo patrón que el del gate C-01— un `negociacion_not_acordada` no cae en el error genérico con "reintentar", que no arreglaría nada: lo más probable es que la otra parte haya renegociado primero, y lo que corresponde es ver la lista actualizada. Cualquier otro error queda en el diálogo con reintento. **Nada ramifica por `status` HTTP, sólo por `code`**, como el resto de la app.

**Después de renegociar, "Ver acuerdo" abre el borrador v2 y "preparar" lo manda a firmar sin regenerarlo.** Eso es lo que Bruno pide en su §5, y es lo que el PR anterior dejó cableado en `prepareSignatureDocument(caseId, agreementId)`.

---

**Un ciclo de imports que había que romper, y un store que se mudó.**

`agreements.service.ts` importa `negotiationService` para saber qué propuesta se aceptó. Para responder `listNegotiations` con el acuerdo vigente, `negotiation.service.ts` necesitaba leer los acuerdos del mock — que vivían adentro de `agreements.service.ts`. Importarlo sería un ciclo (`agents/front/AGENTS.md:176`). Y no leerlos tampoco servía: con la sección nueva nadie lee el acuerdo "por caso" antes de que la tarjeta pida su id, así que un acuerdo aceptado en la sesión **no se habría materializado nunca**, y el detalle habría dejado de mostrarlo.

El store (acuerdos, firmantes, historial) y la materialización se mudaron a `services/mock-agreement-store.ts`, un módulo hoja que no importa a ningún servicio. Los dos servicios leen y escriben el mismo array a través de él. El id de la negociación del mock es un fixture determinista (`negotiation-${caseId}`), como `agreement-case-3-1`: ahora que la API tiene ids reales, un id de fixture es espejo y no invento — y nunca viaja a un param de ruta.

---

**Y un bug vivo que los errores de tsc "preexistentes" tapaban.**

`negotiation.service.ts:348` usaba `casesService` **sin importarlo**. Era uno de los cuatro errores de tsc que cada changelog venía anotando como "siguen los 4 preexistentes en `dev`". No era sólo de tipos: contra backend real, la primera lectura de la negociación tiraba `ReferenceError` — la tarjeta y la pantalla de negociación caían en error contra la API. Nadie lo vio porque, como también decían los changelogs, nadie los ejercitó contra la API.

Corregido junto con los otros tres (`backend` perdiendo el narrowing dentro de closures async en `negotiation.service.ts` y `agreements.service.ts`; `codigo` faltante en el fixture de `case-mapper.test.ts`). **`tsc --noEmit` queda en cero por primera vez.**

---

### QA

- `npx tsc --noEmit` — **0 errores.**
- `npx jest` — **145/145 suites, 1295/1295 tests** (28 nuevos, 5 suites nuevas).
- `npx expo lint` — limpio. Paridad `es-AR`/`en` a mano y por el guard nuevo `negotiation-estado-copy.test.ts`.
- **En el navegador, contra el mock:** case-3 muestra *"Sin materia asignada · Acordada · Conciliación · Ronda 1 · Acuerdo v1 · Firmado"* con "Renegociar"; el diálogo; y después de confirmar, el chip del caso pasa a **"En revisión"**, la materia a *"Activa · Ronda 2 · Acuerdo v2 · En preparación"*, aparecen el plazo de respuesta y "Terminar la negociación" (que dependen del estado del caso), y la tarjeta de acuerdo pasa a "En preparación" con "Ver acuerdo" por el id nuevo. Cero errores de consola en una pestaña nueva (una pestaña abierta durante el desarrollo arrastraba un error de HMR anterior a la recarga del servicio).

**Lo que no se pudo verificar, dicho claro:**

- **Nada con dos materias, contra ningún backend.** La única inserción en `negociaciones` es la de `POST /casos` (`casos.repository.ts:188`, una por caso) y el controller de negociación no tiene ruta de alta (`negociacion.controller.ts:28-61`). La pantalla dibuja N porque el array es de largo N; hoy ningún entorno puede producir N > 1. **Pedido a Backend abajo.**
- **Nada contra la API real.** Cubierto por tests —los alias del mapper, los dos nullables intactos, el POST sin body, el 409 con copy propio, el gate del botón— pero nadie lo vio funcionar de punta a punta.

**Sobre CI:** `integration` sigue rojo por la migración 44 de DB contra los seeds de 8 specs de Backend (desde `58e8023`). Verificado que son las mismas 8 suites en el run de este PR y en el de `dev`.

---

### Lo que queda, y a quién se lo pedimos

**A Backend, chico:**

1. **Cómo nace la segunda negociación de un caso.** Sin ruta de alta, "N materias" es una pantalla que sólo un seed puede llenar.
2. **`negotiationId` en las rutas de propuestas.** Ahora sí lo consumimos: es lo que deja que el resumen del flujo de propuestas y `getNegotiationEligibility` sean por materia en vez de por caso. Hasta entonces, el resumen se dibuja una vez y la elegibilidad sigue leyendo `casos.estado` — Bruno tiene razón en que con N materias no alcanza, pero la fuente que él nombra (`negociaciones.estado`) gobierna una tarjeta que hoy no puede actuar por materia.

**Nuestro:** cuando exista la segunda materia, `getNegotiationEligibility` pasa a recibir `negociacion.estado`. Es un cambio de un parámetro, y no se hace antes porque no se puede verificar.

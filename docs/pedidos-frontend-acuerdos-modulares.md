# Pedidos de Frontend — acuerdos modulares por materia

**Fecha:** 04/09/2026, corregido el 04/09 (§2.5) · **Autor:** Frontend · **Para:** Backend
**Hermano:** `docs/pedidos-frontend-a-db-acuerdos-modulares.md` — lo que le toca a DB, que en este cambio es más grande que lo de acá.
**Origen:** `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` puntos 1 y 2 · análisis en `docs/plan-frontend-v2-04-09-2026.md`
**Rama de FE:** `feat/front-cambios-v2-0409`

Mismo formato que `docs/pedidos-frontend-monetizacion.md`, que salió bien: shapes listos para implementar, reglas de borde explícitas. **Si algún shape no les cierra, avisen antes de implementar** — es más barato ajustar el contrato que descubrirlo integrando.

---

## 1 · El cambio, y qué parte les pedimos ahora

El cliente pasó de **"un caso = un acuerdo"** a **"un caso = N negociaciones, una por materia (tenencia / alimentos / bienes), cada una con su propia plantilla, su propia firma y su propio versionado"**.

**No les estamos pidiendo eso entero.** El bloqueante que declaró el cliente —que todavía no entregó los modelos de acuerdo por materia— frena el generador de documentos y el contenido de la firma, pero **no** la capa de identidad y navegación. Son dos contratos separables, y este documento pide sólo el segundo.

Concretamente: **§2.1 se puede implementar hoy, contra el modelo actual de un acuerdo por caso, y sigue siendo correcto cuando lleguen N.** Es el pedido más barato y más valioso de la tanda.

---

## 2 · Los pedidos

### 2.1 · `GET /acuerdos/:id` — el que desbloquea todo y no toca el modelo

**Qué desbloquea:** que las pantallas de acuerdo dejen de estar direccionadas por caso. Hoy son `app/case/[id]/agreement/*` y leen `GET /casos/:id/acuerdo`, que devuelve *un* acuerdo del caso.

**Por qué es urgente aunque el modelo nuevo no exista todavía.** El día que un caso tenga dos acuerdos, la bandeja de firmas —que hoy navega con el id del **caso**— va a abrir el acuerdo equivocado. El usuario toca la fila "Alimentos" y se le abre, y potencialmente firma, el de tenencia. Sin error y sin warning: la pantalla se ve perfecta. **Es el único riesgo de este refactor con consecuencia legal**, y conviene cerrarlo antes de que sea alcanzable.

| | |
|---|---|
| Auth | Bearer, con el mismo `acuerdo-access.service.ts` que ya usan las rutas `/acuerdos/:id/*` |
| Respuesta | **El mismo bundle** que devuelve hoy `GET /casos/:id/acuerdo`: `{ acuerdo, firmas }`. No un shape nuevo — así reusamos el mapper que ya tenemos |
| Errores | `404 acuerdo_not_found` (ya existe en nuestro `api-error.ts`) |

Es un re-address del handler que ya existe. No toca el modelo, no depende del acuerdo marco, y sirve igual antes y después del cambio estructural.

**Mientras no exista**, nuestro cliente lo resuelve como `getForCase(caseId)` + verificar `acuerdo.id === agreementId`. Es un filtro, no una invención: `UNIQUE (caso_id)` garantiza que hay como mucho uno, así que es demostrablemente correcto hoy y **falla ruidosamente** —no en silencio— el día que haya dos y esta ruta todavía no esté.

---

### 2.2 · `GET /firmas` — dos campos más, y usen el que ya mandan

**Ya devuelven `acuerdo_id`** en cada fila y nosotros lo estábamos descartando; eso lo arreglamos de nuestro lado en esta misma rama. Lo que falta:

```json
{
  "acuerdo_id": "…",
  "caso_id": "…",
  "caso_nombre": "Caso Pérez",
  "subject_type": "tenencia",     ← nuevo
  "version": 2,                    ← nuevo
  "acuerdo_estado": "enviado_a_firma",
  "own_status": "pendiente",
  "own_fecha_firma": null,
  "pending_signers": 1
}
```

**Por qué:** hoy armamos el título de cada fila con `caso_nombre`, porque es lo único que hay. Con dos acuerdos del mismo caso, **la bandeja muestra dos filas idénticas** y no hay forma de distinguirlas. Con `subject_type` y `version` la fila se puede etiquetar "Tenencia · v2".

Los dos pueden venir `null` mientras el modelo nuevo no exista — lo tratamos como "este acuerdo viene del modelo viejo" y caemos al título actual.

---

### 2.3 · `GET /casos/:id/negociaciones` — la lista

**Qué desbloquea:** la sección del detalle de caso que lista las negociaciones. La estamos construyendo ya contra mocks, con un array que hoy tiene un elemento y mañana N — es la misma pantalla en los dos casos.

```json
[
  {
    "id": "…",
    "caso_id": "…",
    "subject_type": "tenencia",
    "metodo": "mediacion",
    "estado": "en_negociacion",
    "ronda_actual": 2,
    "acuerdo_vigente": { "id": "…", "estado": "firmado", "version": 2 },
    "created_at": "…"
  }
]
```

**Reglas de borde que nos importan, porque son las que rompen callado:**

- **`acuerdo_vigente: null`** cuando la negociación todavía no produjo ninguno. Nunca un objeto con campos vacíos o en cero: la diferencia entre "no hay acuerdo" y "hay uno en borrador" cambia qué botón dibuja la tarjeta.
- **`subject_type` nullable**, con el significado *"esta negociación viene del modelo viejo y no tiene materia asignada"*. **Nunca `'otra'` como relleno** — la pantalla sabe decir "todavía no está dividido por materia", y un `'otra'` inventado nos haría mostrar una etiqueta falsa. Es el mismo criterio que ya acordamos con `pago_a_cargo`.
- **Un caso sin negociaciones devuelve `[]`, no 404.** Un array vacío es un estado normal (caso recién creado); un 404 nos obliga a tratar "no hay" como error.

**Y una pregunta que arrastra:** ¿qué pasa con `casos.ronda_actual`? Hoy lo consumimos como `CaseSummary.roundNumber` en cada tarjeta del dashboard. Con N negociaciones, ¿se retira, o pasa a ser el máximo entre las negociaciones? Cualquiera nos sirve, pero necesitamos saber cuál.

---

### 2.4 · `POST /negociaciones/:id/renegociar` — shape congelado, implementación diferida

```json
{ "negotiation_id": "…", "agreement_id": "…" }
```

Abre una ronda nueva sobre la misma materia, precargando el acuerdo vigente como punto de partida, y devuelve los ids de la ronda nueva.

**No lo implementen todavía** — depende del acuerdo marco y de que se caiga `UNIQUE (caso_id)`. Lo congelamos ahora sólo para poder escribir el ruteo de FE sin tener que rehacerlo.

---

### 2.5 · ~~Escribir `pendiente_suscripciones`~~ — mal dirigido, va a DB

> ⚠️ **Corregido el 04/09.** Esto estaba pedido acá y **no es de BE, o no todavía.** El validador de transiciones lo rechaza antes de llegar a la fila: `validate_caso_estado_transition()`, en su versión vigente (`20260810120000_cambios_reunion_07_08.sql`), no admite ninguna transición hacia `pendiente_suscripciones`, así que **aunque escribieran el código, el `UPDATE` moriría** en `Transición de estado inválida`.
>
> Pasa a `docs/pedidos-frontend-a-db-acuerdos-modulares.md` §3, donde va con el detalle. Si después de que DB abra la transición hace falta que BE lo escriba en el catch del gate, se lo pedimos ahí — pero primero es de DB.

El estado existe en el enum de `estado_caso` desde la migración del 02/09, y **el front lo soporta entero**: tipo, mapper, copy en los dos idiomas, y las tres utils de elegibilidad. Pero **nada lo escribe nunca**, así que el caso se queda en `nuevo` — indistinguible de uno recién creado.

---

## 3 · Preguntas que decidían alcance de FE — movidas al doc de DB

> **Movidas el 04/09 a `docs/pedidos-frontend-a-db-acuerdos-modulares.md` §5**, junto con el inventario de lo que bloquea el cambio del lado del schema. Se dejan acá para que BE sepa qué está esperando respuesta, porque los shapes de §2.3 dependen de las dos primeras.

Ninguna cuesta implementar; las tres cambian qué construimos.

**1. ¿`subject_type` reemplaza o convive con `categoria_item`?**
Hoy `items.categoria` (`cuidado_ninos | cronogramas | bienes | economico | personalizado`) es la única taxonomía del repo, y sólo `bienes` coincide con las materias del cliente. Si conviven, **¿las posiciones privadas pasan a colgar de la negociación en vez del caso?** Importa: hoy calculamos "esta parte está lista para proponer" contando posiciones **por caso**. Con tres materias y posiciones cargadas sólo en bienes, las tres negociaciones van a leer "listo" y ofrecer generar propuesta — y el motor recibiría una negociación de tenencia sin insumos de tenencia.

**2. ¿`reemplazado` es un miembro nuevo de `estado_acuerdo`, o `vigente boolean` + `supersedes_id`?**
Cambia si nuestro trabajo es "agregar un caso a tres switches" o "agregar una dimensión". Aviso concreto: tenemos tres escaleras de ternarios sobre `estado` que terminan todas en el default `borrador`, así que **un miembro nuevo del enum se renderiza hoy como "borrador"** hasta que las toquemos. Un acuerdo histórico presentado como borrador es peor que no mostrarlo.

**3. ¿Sigue existiendo `estado_caso = 'acordado'`, y qué significa con 2 de 3 materias firmadas?**
Hoy una sola aceptación dispara `markAcordado(casoId)` y pone el **caso entero** en `acordado`, y nuestra elegibilidad devuelve `read_only` para ese estado. Con materias, firmar tenencia apagaría alimentos y bienes sin explicar por qué.

---

## 4 · Lo que explícitamente NO les pedimos, y por qué

Para que no construyan de más:

- **Plantillas, catálogo de cláusulas, `agreement_data`, PDF.** `docs/respuestas-cliente-01-09-2026.md` §7 ya registra que el cliente movió el diseño de *"plantilla editable con variables"* a *"catálogo de cláusulas con selección por caso"*. Congelar un shape de sustitución de variables ahora sería congelar la arquitectura equivocada. Además sigue abierta la pregunta de **quién selecciona las cláusulas** — si lo hace una persona, hace falta una pantalla de armado que no está en ningún plan.
- **`negotiationId` en las rutas de propuestas.** Todavía no lo consumimos: mientras haya una negociación por caso, un id de negociación no resuelve ninguna ambigüedad real y no queremos inventarlo.
- **El abono recurrente con `preapproval`.** Está en la spec y lo vamos a necesitar, pero es otro ciclo — va por `docs/pedidos-frontend-monetizacion.md`.

---

## 5 · Orden que más nos sirve

**§2.1 (`GET /acuerdos/:id`) → §2.2 (dos campos en `/firmas`) → §2.3 (la lista, cuando exista el modelo) → §2.4 (renegociar, cuando llegue el acuerdo marco).**

Los dos primeros son chicos, no dependen del modelo nuevo y se pueden hacer contra el schema de hoy. `pendiente_suscripciones` sale de esta lista: es de DB primero (§2.5).

---

*Dudas o cambios a estos shapes: responder sobre este doc.*

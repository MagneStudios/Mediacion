# Pedidos de Frontend — acuerdos modulares por materia

**Fecha:** 04/09/2026 · **Revisado:** 08/09/2026 contra el schema que DB entregó el 06/09 · **Autor:** Frontend · **Para:** Backend
**Hermano:** `docs/pedidos-frontend-a-db-acuerdos-modulares.md` — lo que le toca a DB, que en este cambio es más grande que lo de acá.
**Origen:** `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` puntos 1 y 2 · análisis en `docs/plan-frontend-v2-04-09-2026.md`
**Rama de FE:** `feat/front-cambios-v2-0409`

Mismo formato que `docs/pedidos-frontend-monetizacion.md`, que salió bien: shapes listos para implementar, reglas de borde explícitas. **Si algún shape no les cierra, avisen antes de implementar** — es más barato ajustar el contrato que descubrirlo integrando.

> ## 🔄 Revisado el 08/09 contra lo que DB entregó el 06/09
>
> Este doc se escribió el 04/09, **dos días antes** de que existieran las tablas. Ahora existen, así que los shapes dejaron de ser propuestas y pasaron a tener columnas concretas detrás. Repasado entero contra el schema real; lo que cambió:
>
> - **§2.3 tenía mal el ejemplo de `estado`.** Decía `"en_negociacion"`, que es un valor de `estado_caso`. El enum real es otro. Corregido, con los nombres de columna de cada campo al lado — son tres los que no coinciden con el JSON.
> - **§2.1 justificaba mal el workaround.** Se apoyaba en `UNIQUE (caso_id)`, que la migración 41 eliminó. El argumento cambia; la urgencia del pedido, no.
> - **La pregunta sobre `casos.ronda_actual` está contestada y ya implementada.** Ver §2.3.
> - **DB contestó la pregunta 2 del §3** —versionado— y tomó la advertencia que le habíamos hecho. Ver §3.
>
> **Nada de esto agranda el pedido.** §2.1 y §2.2 siguen siendo chicos y ya se pueden hacer; §2.3 pasó de "cuando exista el modelo" a **implementable hoy**, porque la tabla está.

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

**Mientras no exista**, nuestro cliente lo resuelve como `getForCase(caseId)` + verificar `acuerdo.id === agreementId`. Es un filtro, no una invención: hay como mucho un acuerdo por caso, así que es correcto hoy y **falla ruidosamente** —no en silencio— el día que haya dos y esta ruta todavía no esté.

> ⚠️ **Actualizado el 08/09: ese "como mucho uno" ya no lo garantiza el schema.** La migración 41 eliminó `acuerdos_caso_unique`. Lo que lo sostiene hoy es que `insertDraft` (`acuerdos.repository.ts:137-143`) reimplementó la regla en código de aplicación, chequeando por caso antes de insertar. Sigue siendo cierto, pero pasó de invariante de base de datos a invariante de una función — y el día que alguien la relaje para permitir la segunda materia, **nuestro workaround deja de ser correcto en el mismo commit**. Razón de más para que esta ruta exista antes.

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

> ✅ **Los dos ya tienen de dónde salir (08/09).** `version` es `acuerdos.version`, columna directa con `DEFAULT 1` (migración 42) — para todo acuerdo existente vale `1`, así que ni siquiera hay caso nulo. `subject_type` sale de `negociaciones.materia` cruzando por `acuerdos.negociacion_id`, que es `NOT NULL` desde la migración 41; viene `null` para las negociaciones legacy, que es exactamente el "modelo viejo" del párrafo de arriba.
>
> Con esto **§2.2 dejó de depender de nada**: es el select que ya tienen más un join y dos columnas.

---

### 2.3 · `GET /casos/:id/negociaciones` — la lista

**Qué desbloquea:** la sección del detalle de caso que lista las negociaciones. La estamos construyendo ya contra mocks, con un array que hoy tiene un elemento y mañana N — es la misma pantalla en los dos casos.

> ✅ **Implementable hoy.** Cuando escribimos esto la tabla no existía. Existe: `negociaciones (id, caso_id, materia, method, estado, round, created_at, updated_at)`, migración 40.

```json
[
  {
    "id": "…",
    "caso_id": "…",
    "subject_type": "tenencia",
    "metodo": "mediacion",
    "estado": "activa",
    "ronda_actual": 2,
    "acuerdo_vigente": { "id": "…", "estado": "firmado", "version": 2 },
    "created_at": "…"
  }
]
```

**Tres campos del JSON no se llaman como la columna.** No es capricho: los nombres del wire ya están cableados en nuestros tipos y son los que usa el resto de la API que consumimos. Los alias van de su lado:

| Campo JSON | Columna | Por qué difiere |
|---|---|---|
| `subject_type` | `negociaciones.materia` | El wire ya usa `subject_type` en el pedido de `/firmas` (§2.2); que las dos rutas lo llamen igual es lo que nos deja reusar el mapper |
| `metodo` | `negociaciones.method` | `GET /casos` ya devuelve `metodo` en español y el front lo consume así. Dos nombres para el mismo enum en la misma app sería el problema |
| `ronda_actual` | `negociaciones.round` | Mismo nombre que ya devuelve `GET /casos` para la ronda del caso |

**Y el `estado` es del enum de la negociación, no del caso.** El ejemplo de arriba decía `"en_negociacion"` hasta el 08/09, que es un valor de `estado_caso` — error nuestro. El bueno es:

```
estado_negociacion = borrador | activa | acordada | cerrada | terminada
```

Los cinco nos sirven; no hace falta mapearlos a nada. Si necesitan agregar uno, avisen: tenemos ternarios sobre estados que caen a un default, así que un miembro nuevo se renderiza como el default hasta que lo agreguemos.

`acuerdo_vigente` sale de `acuerdos` filtrando `negociacion_id = ? AND vigente = true`, con `version` de la columna homónima — las cuatro columnas del versionado llegaron en la migración 42.

**Reglas de borde que nos importan, porque son las que rompen callado:**

- **`acuerdo_vigente: null`** cuando la negociación todavía no produjo ninguno. Nunca un objeto con campos vacíos o en cero: la diferencia entre "no hay acuerdo" y "hay uno en borrador" cambia qué botón dibuja la tarjeta.
- **`subject_type` nullable**, con el significado *"esta negociación viene del modelo viejo y no tiene materia asignada"*. **Nunca `'otro'` como relleno** — la pantalla sabe decir "todavía no está dividido por materia", y un `'otro'` inventado nos haría mostrar una etiqueta falsa. (DB congeló el enum el 06/09 como `materia_acuerdo = tenencia | alimentos | bienes | **otro**`, con `materia` nullable — tal cual lo pedimos.) Es el mismo criterio que ya acordamos con `pago_a_cargo`.
- **Un caso sin negociaciones devuelve `[]`, no 404.** Un array vacío es un estado normal (caso recién creado); un 404 nos obliga a tratar "no hay" como error.

**~~Y una pregunta que arrastra:~~ contestada, y ya resuelta de los dos lados.**

Preguntábamos qué pasaba con `casos.ronda_actual`. DB decidió retirarlo y que la ronda se lea por negociación; ustedes lo reproyectaron como subquery contra `negociaciones.round`, con el mismo nombre de campo en el payload (`casos.repository.ts:42-56`). **El front no tuvo que tocar nada.** Queda anotado para que nadie lo "limpie" más adelante creyendo que es código muerto: `ronda_actual` sigue siendo la clave que lee el dashboard.

---

### 2.4 · `POST /negociaciones/:id/renegociar` — shape congelado, implementación diferida

```json
{ "negotiation_id": "…", "agreement_id": "…" }
```

Abre una ronda nueva sobre la misma materia, precargando el acuerdo vigente como punto de partida, y devuelve los ids de la ronda nueva.

**No lo implementen todavía** — depende del acuerdo marco, que el cliente no entregó. La otra condición que poníamos, que se cayera `UNIQUE (caso_id)`, **ya se cumplió** (migración 41), así que cuando lleguen las plantillas esto queda sin bloqueos de schema. Lo congelamos ahora sólo para poder escribir el ruteo de FE sin tener que rehacerlo.

---

### 2.5 · ~~Escribir `pendiente_suscripciones`~~ — mal dirigido, va a DB

> ⚠️ **Corregido el 04/09.** Esto estaba pedido acá y **no es de BE, o no todavía.** El validador de transiciones lo rechaza antes de llegar a la fila: `validate_caso_estado_transition()`, en su versión vigente (`20260810120000_cambios_reunion_07_08.sql`), no admite ninguna transición hacia `pendiente_suscripciones`, así que **aunque escribieran el código, el `UPDATE` moriría** en `Transición de estado inválida`.
>
> Pasa a `docs/pedidos-frontend-a-db-acuerdos-modulares.md` §3, donde va con el detalle. Si después de que DB abra la transición hace falta que BE lo escriba en el catch del gate, se lo pedimos ahí — pero primero es de DB.
>
> ### ✅ DB lo destrabó el 06/09 — ahora sí es de BE
>
> `20260906100000_pendiente_suscripciones_writable.sql` abrió las dos transiciones que faltaban: `nuevo → pendiente_suscripciones`, y de ahí a `activo`/`en_negociacion`/`terminado`/`vencido`/`expirado`. El comentario de la propia migración dice a quién le toca: *"BE escribe el estado en el catch del P0001 del gate"*.
>
> Hoy `trg_casos_gate_suscripciones` sólo aborta con `409 caso_bloqueado_suscripciones` y el caso queda en `nuevo`, **indistinguible de uno recién creado**. El front ya lo consume entero —tipo, mapper, copy en los dos idiomas, las tres utils de elegibilidad— y desde el 04/09 muestra ese 409 con mensaje propio en vez de "revisá el código". **En cuanto lo escriban aparece "Falta activar suscripciones" sin una línea nueva de nuestro lado.**
>
> Pedido formalmente en §7.2 de `docs/pedidos-frontend-a-backend-recolocar-negociaciones.md`.

El estado existe en el enum de `estado_caso` desde la migración del 02/09, y **el front lo soporta entero**: tipo, mapper, copy en los dos idiomas, y las tres utils de elegibilidad. Pero **nada lo escribe nunca**, así que el caso se queda en `nuevo` — indistinguible de uno recién creado.

---

## 3 · Preguntas que decidían alcance de FE — movidas al doc de DB

> **Movidas el 04/09 a `docs/pedidos-frontend-a-db-acuerdos-modulares.md` §5**, junto con el inventario de lo que bloquea el cambio del lado del schema. Se dejan acá para que BE sepa qué está esperando respuesta.

> ### Estado al 08/09
>
> | # | Pregunta | Estado |
> |---|---|---|
> | 1 | `subject_type` vs `categoria_item` | 🟡 **Contestada a medias.** DB decidió que son enums separados y agregó `items.negociacion_id` (nullable), o sea que las posiciones **pueden** colgar de una negociación. Pero nadie decidió si van a hacerlo, y de eso depende el bug de abajo |
> | 2 | `reemplazado` en el enum, o `vigente` + `supersedes` | ✅ **Contestada: `vigente BOOLEAN` + `supersedes_agreement_id` + `version` + `valid_from`.** DB tomó la advertencia textualmente — el header de la migración 42 dice *"NO se agrega miembro a `estado_acuerdo` (evita que el front renderice 'reemplazado' como 'borrador' en sus ternarios)"*. **Nuestros ternarios no se tocan** |
> | 3 | Qué significa `acordado` con 2 de 3 materias | 🟡 **Decidida, no implementada.** DB definió que es derivado —*"solo cuando todas las materias tienen acuerdo vigente+firmado"*— y que lo calcula un trigger o BE. **Las migraciones no traen el trigger y `markAcordado` sigue poniendo el caso entero en `acordado` a la primera aceptación.** Es de ustedes; ver §7.1 de `docs/pedidos-frontend-a-backend-recolocar-negociaciones.md` |
>
> **La 1 es la única que sigue abierta de verdad**, y sigue decidiendo alcance nuestro: el texto de abajo describe el bug que aparece si las posiciones se quedan colgando del caso.

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

**§2.1 (`GET /acuerdos/:id`) → §2.2 (dos campos en `/firmas`) → §2.3 (la lista) → §2.4 (renegociar, cuando llegue el acuerdo marco).**

> **Actualizado el 08/09: los tres primeros se pueden hacer ya.** §2.3 decía "cuando exista el modelo" y el modelo existe desde el 06/09, así que salió de la espera. El orden sigue siendo por valor, no por dependencia — ninguno depende del anterior:
>
> - **§2.1** es un re-address del handler que ya tienen. Cierra el único riesgo del refactor con consecuencia legal, y **se vuelve urgente el día que alguien relaje el chequeo por caso de `insertDraft`** (ver el aviso en §2.1).
> - **§2.2** es su select de hoy más un join y dos columnas que ya existen.
> - **§2.3** es una tabla nueva con tres alias de nombre. Es lo que nos deja dibujar N negociaciones en vez de una.
>
> Y aparte de estos tres, lo de `docs/pedidos-frontend-a-backend-recolocar-negociaciones.md`: **§7.1** (`acordado` derivado, que DB ya decidió y nadie implementó) y **§7.2** (que alguien escriba `pendiente_suscripciones`, que ya se puede desde la migración 39).

`pendiente_suscripciones` sale de esta lista de endpoints: era de DB primero (§2.5), **y DB ya lo destrabó** — la migración 39 abrió las transiciones el 06/09. Ahora sí es de BE, y está pedido en §7.2 del otro doc.

---

*Dudas o cambios a estos shapes: responder sobre este doc.*

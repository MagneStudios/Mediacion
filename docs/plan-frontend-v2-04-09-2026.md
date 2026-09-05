# Plan de Frontend — Cambios Pactum v2 (reunión del 01/09/2026)

**Fecha:** 04/09/2026 · **Autor:** Frontend
**Fuente:** `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` (reunión de 24 min con Victor Solmi + respuestas del cliente).
**Reemplaza:** `docs/Cambios_Cliente_Pactum_27-08-2026.md`, ya marcado como superado.
**Actualiza:** `docs/respuestas-cliente-01-09-2026.md` §8 (el carril de FE) y `docs/PACTUM-monetizacion-spec.md` §7.

---

## 0 · Resumen

De los 12 puntos, **cuatro ya están hechos**, **cuatro son de otro carril** (BE, motor de IA, generador de documentos, marketing), **dos son features nuevas que no existían** y **dos son el cambio estructural que reordena el modelo entero**.

| # | Punto | Carril | Estado |
|---|---|---|---|
| 1 | Acuerdos separados por materia (N por caso) | DB → BE → FE | 🟡 **~60% de FE se puede hacer ya** (ver §2) |
| 2 | Versionado y renegociación de acuerdos | DB → BE → FE | 🔴 Bloqueado por el modelo |
| 3 | Suscripción individual por parte | BE | ✅ La decisión ya está aplicada · 🔴 el abono recurrente es de BE |
| 4 | Asesoramiento $50.000 → WhatsApp | FE | ✅ **Hecho el 03/09** · falta el número |
| 5 | Arbitraje fuera de familia | — | ✅ Nunca estuvo · el flag por materia es prematuro |
| 6 | Nivel de IA distinto por método | Motor + copy | 🔴 **Contradicción sin resolver** (§5) |
| 7 | Sacar frase de orden público + moderación | Copy + feature | ✅ La frase nunca se agregó · 🟡 la moderación es nueva |
| 8 | IA elige entre opciones + sesgo de orden | Motor (BE) | ⚪ Fuera del carril de FE |
| 9 | Ficha de contexto del caso | FE | 🟡 Nueva, sin campos definidos |
| 10 | Cronograma embebido en el acuerdo | Generador (BE) | 🔴 Bloqueado por las plantillas |
| 11 | Copy legal sin promesa de homologación | Copy | 🟢 **Un solo string en toda la app** (§4) |
| 12 | Posicionamiento: costo, velocidad, adaptabilidad | Marketing | ⚪ **No existe landing en el repo** |

**Lo que entra en esta tanda:** los dos bugs de aceptación que le rompen las demos al cliente, la parte del refactor estructural que no depende de nadie, y el string de copy legal. Las dos features nuevas quedan diseñadas acá, sin construir.

---

## 1 · Primero: por qué "la simulación de aceptación no funciona"

El cliente lo reportó y la hipótesis inicial fue que faltaba mergear algo al deploy. **No es eso.** Son dos cosas distintas, las dos reales, y la segunda es la que importa.

### 1.1 · El flujo real de unirse está bloqueado por el gate C-01, y el error miente

Cuando alguien acepta una invitación de verdad (`POST /casos/unirse`), `joinCase` inserta la parte y llama a `activateIfNuevo`, que transiciona el caso a `activo`. Eso dispara `trg_casos_gate_suscripciones` (la migración del 02/09): si **alguna de las dos partes** no tiene suscripción activa, `409 caso_bloqueado_suscripciones` y **la transacción hace rollback entero** — la contraparte ni siquiera queda registrada como miembro del caso.

Del lado del front, `app/case/join.tsx` sólo distingue `invitation_expired`. Todo lo demás cae en el mismo estado y muestra:

> *"Revisá el enlace o código e intentá de nuevo."*

Es decir: **un problema de suscripción se le presenta al usuario como un código mal tipeado.** No hay forma de que el cliente descubra qué está pasando mirando la pantalla. Ésta es, casi con seguridad, la causa de lo que reportó.

### 1.2 · El botón "Simular aceptación" no hace nada contra el backend real

`services/api/cases.backed-service.ts` implementa `simulateInvitationAcceptance` como **un `GET /casos/:id` y nada más**. No transiciona, no acepta, no escribe. El diálogo confirma, la request resuelve OK, la pantalla recarga, y el caso sigue en `nuevo`.

Es deliberado —no se puede simular la decisión de otra persona contra datos reales— pero está **sin comunicar**: el usuario ve un botón que aparenta funcionar. Un botón que no puede cumplir lo que ofrece es peor que no tenerlo.

### 1.3 · `pendiente_suscripciones` es código muerto

El estado existe en el enum de DB desde el 02/09, y el front lo soporta entero: `types/case.ts`, el mapper, el copy en los dos idiomas, las tres utils de elegibilidad. Pero **nada lo escribe nunca** — el trigger sólo aborta la transición, no cambia el estado. El caso se queda en `nuevo` y el join falla con un error genérico.

No hay trabajo de FE acá; va como pedido a BE.

---

## 2 · El cambio estructural (puntos 1 y 2)

El cliente pasó de "un caso = un acuerdo" a **"un caso = N negociaciones, una por materia (tenencia / alimentos / bienes), cada una con su plantilla y su firma"**, más versionado y renegociación permanente. El motivo que dio es bueno: en familia, negociar todo junto "mezcla un montón de cosas y sentires".

### 2.1 · Contra qué choca esto hoy

| Qué asume el código | Dónde |
|---|---|
| **Un acuerdo por caso, como regla declarada** | `UNIQUE (caso_id)` en `supabase/migrations/20260723210000_acuerdos_caso_unique.sql`, con el comentario *"un caso solo puede tener un acuerdo"* |
| No existe la entidad "negociación" | Hay `rondas` colgando del caso y `casos.ronda_actual` como contador escalar |
| No existe el concepto de materia | Lo más cercano es `categoria_item` en las posiciones privadas |
| **Una sola aceptación cierra el caso entero** | `propuestas.repository.ts` → `markAcordado(casoId)` → `estado_caso = 'acordado'` |
| Ninguna ruta acepta un id de acuerdo ni de negociación | Todo cuelga de `app/case/[id]/` |
| Sin versionado | `estado_acuerdo = borrador \| enviado_a_firma \| firmado \| con_aviso` |

### 2.2 · Lo que sí se puede hacer ya, y por qué no es adelantarse

**El bloqueante que declaró el cliente (faltan los modelos de acuerdo por materia) bloquea el generador de documentos y el contenido de la firma — no la capa de identidad y navegación.** Son dos contratos separables, y tratarlos como uno hace que el carril de FE parezca 100% trabado cuando está ~60% desbloqueado.

**a) Direccionar los acuerdos por `agreementId` en vez de por caso.** Esto no anticipa nada: corrige un desalineamiento que **ya existe**. `GET /firmas` ya devuelve `acuerdo_id`, está tipado en `services/api/agreements.api-service.ts` como `ApiSignatureInboxEntry.acuerdo_id` — y el `.map()` lo descarta porque `SignatureInboxItem` no tiene el campo. Otros cuatro endpoints ya son `/acuerdos/:id/*`.

> ⚠️ **Es el único riesgo de todo el refactor con consecuencia legal.** Hoy la bandeja navega a `/case/[id]/agreement` sin id de acuerdo. El día que haya dos, tocar la fila "Alimentos" abre —y potencialmente hace firmar— el acuerdo de tenencia. Sin error, sin warning: la pantalla se ve perfecta. Vale arreglarlo antes de que sea alcanzable, no después.

**b) Convertir la columna del detalle de caso en una lista de negociaciones.** Con un elemento se ve casi igual que hoy; con N funciona sin tocar la pantalla. Es isomórfico en el largo del array, así que se construye contra mocks sin saber nada del modelo real.

### 2.3 · Lo que NO se hace todavía, y por qué

- **`negotiationId` en tipos y rutas.** Con una negociación por caso no hay ambigüedad que resolver: el id no compra corrección, sólo forma. Sintetizarlo sería inventar un identificador que viaja a params de ruta y algún día a un body de POST — exactamente lo que este repo se prohíbe en `types/case.ts` con `pagoACargo`. El costo de esperar es bajo: cuando todos los consumidores entran por la lista, agregar el segmento de ruta es barato.
- **Mover `metodo` de caso a negociación.** Hoy `metodo` es presentación pura y no ramifica ningún comportamiento, así que es barato después. Antes hay que decidir qué muestra la tarjeta del dashboard cuando un caso tiene tres métodos distintos, y qué hace el filtro "Mediación" con ese caso. Es decisión de producto.
- **"Renegociar" y versionado.** Doblemente bloqueado: la elegibilidad devuelve `read_only` para `acordado`, `startNextRound` tiene un guard explícito contra rondas después de un acuerdo, y `UNIQUE (caso_id)` sigue vivo en DB. Construirlo contra el mock es fácil; habilitarlo contra el backend real antes de esa migración es un 409 garantizado.

---

## 3 · La trampa de las dos taxonomías

El cliente habla de materias: **tenencia, alimentos, bienes**. El repo ya tiene un enum que se le parece: `categoria_item` = `cuidado_ninos | cronogramas | bienes | economico | personalizado`, usado en las posiciones privadas.

**No son lo mismo.** Sólo `bienes` coincide por nombre. Y hay una vía de contagio concreta: `app/case/[id]/negotiation/index.tsx` ya hace `t('positions.category.${entry.categoria}.label')` sobre los puntos de encuentro. Si alguien reutiliza esas claves para materias, la pantalla va a mostrar *"Cuidado de niñas, niños y adolescentes"* donde el cliente pidió *"Tenencia"* — y el `defaultValue` va a tapar el error mostrando el slug crudo en vez de fallar.

**Dos enums, dos espacios de i18n, sin puentes.** Va anotado acá porque es el tipo de atajo que parece ahorro y cuesta una pantalla mal etiquetada.

Y queda una pregunta para DB que decide alcance invisible: **¿`subject_type` reemplaza o convive con `categoria_item`?** Si las posiciones siguen siendo por caso y las negociaciones son por materia, un caso con tres materias y posiciones cargadas sólo en bienes va a leer "listo para proponer" en las tres.

---

## 4 · Copy legal (punto 11) — mejor de lo esperado

Auditamos todo el copy de producto (i18n en los dos idiomas, componentes, mocks, textos legales) buscando promesas de valor judicial: homologación, ejecutabilidad, fuerza de sentencia, título ejecutivo.

**Hay exactamente un string que hay que corregir**, y ni siquiera está en las pantallas de acuerdo:

> `profile.edit.matriculaHint` — *"La matrícula no se verifica: **lo que da validez al acuerdo es la firma digital**, no este dato."*

Además de prometer validez, **se contradice con los otros cuatro lugares donde la app dice que la firma es simulada y sin validez legal**.

Todo el resto ya niega valor judicial correctamente. Y la cláusula **J.7 de los TyC no se toca**: dice explícitamente que el acuerdo *"no constituye por sí mismo título ejecutivo"*, que es justo lo que el cliente quiere que digamos.

### 4.1 · El hallazgo inverso: tres advertencias que los TyC prometen y la app no muestra

Buscando promesas de más, apareció lo contrario. Las cláusulas **J.2, J.8 y K.3** dicen cada una *"Esta advertencia se exhibe en la Plataforma"*:

1. que la revisión de la plataforma **no es un control de legalidad**;
2. que **los acuerdos sobre niñas, niños y adolescentes requieren homologación judicial** para producir plenos efectos;
3. que se **recomienda asistencia letrada** antes de firmar.

**Ninguna de las tres existe en el copy de la app.** La segunda es la más expuesta —es el corazón del producto, acuerdos de familia— y engancha directo con lo que el cliente pidió en el punto 11: *"agregar un texto claro antes de firmar sobre qué implica el acuerdo y qué no"*. Va a la lista de preguntas para Victor, porque la redacción final la tiene que aprobar él.

---

## 5 · La contradicción del punto 6, que el propio doc marca

El cliente definió en la reunión:

| Método | Qué hace el sistema | Injerencia de la IA |
|---|---|---|
| Negociación | Sólo que las partes se hablen | Mínima |
| **Conciliación** | **Ordena la charla** | Media |
| **Mediación** | **Propone soluciones** | Máxima |

Pero en agosto había pedido que conciliación dijera *"el proceso incorpora orientación y **propone opciones** para acercar las posiciones"* — y **ése es el copy que está hoy en la app**. O sea: el texto vigente sigue la versión de agosto, la reunión dice otra cosa, y el propio documento del cliente marca la discrepancia como pendiente.

**No tocamos el copy hasta que Victor conteste.** Cambiarlo adivinando cuesta lo mismo que cambiarlo bien, y adivinar mal desplaza "proponer soluciones" al método equivocado.

### 5.1 · Y hay un problema de nomenclatura más profundo

La cláusula **H.7 de los TyC** dice que los mecanismos de la plataforma *"no constituyen mediación ni conciliación en los términos de la Ley 26.589 ni de las normas provinciales que regulan dichos institutos"*. Los propios TyC los nombran **"Negociación directa asistida"**, **"Negociación asistida con facilitación"** y **"Negociación asistida con tercero neutral"**.

La UI, en cambio, los llama **"Conciliación"** y **"Mediación"** — los dos nombres que el texto legal aclara que no son. Conviene resolverlo junto con la pregunta anterior, en una sola conversación.

---

## 6 · Las dos features nuevas (puntos 7 y 9)

No entran en esta tanda, pero la investigación está hecha para cuando se retomen.

### 6.1 · Moderación de lenguaje ofensivo

Hoy hay **14 superficies de texto libre y cero validación de contenido** — ni siquiera un `maxLength` en ningún lado del repo.

**Recomendación: priorizar las 4 que cruzan a la otra parte**, no las 14. Las posiciones privadas son de aislamiento absoluto (RN-01) y la contraparte no las ve nunca; moderarlas primero es gastar en el lugar equivocado. Las que sí cruzan:

1. **Nombre y descripción del caso** — el propio copy avisa *"La contraparte verá el nombre y la descripción"*.
2. **Aviso de incumplimiento** — *"Esta nota queda visible para ambas partes"*. Es la superficie más expuesta.
3. **Nombre y apellido del perfil** — es la etiqueta de "contraparte" en cada tarjeta.

**El reparto correcto:** el aviso para reformular es de FE; **la detección y el registro tienen que ser de BE**. Un chequeo que vive sólo en el cliente se saltea abriendo las devtools, y el cliente pidió explícitamente *"registro del evento para trazabilidad"* — eso es una tabla, no un estado de React.

Dato que ayuda a dimensionar: hoy **el texto libre del usuario no llega al modelo de IA**. El prompt se arma sólo con categoría y rangos numéricos.

### 6.2 · Ficha de contexto del caso

No existe nada equivalente: ni tabla de integrantes del grupo familiar, ni domicilios, ni colegio, ni actividades, ni cronograma semanal.

Lo que sí existe y sirve de base: dos wizards multi-paso con el mismo patrón (`useCaseCreationFlow`, `usePositionDraft` — Context+Provider con un draft que se descarta si se abandona el flujo), `PositionFormFields` como formulario reutilizable con modo read-only, `CaseCreationProgress` para el indicador, y el token `contentWidths.form`. El pedido de "cargable de forma incremental, no un formulario gigante" ya tiene molde.

**Lo que falta es del cliente:** dio ejemplos vívidos (*"los lunes a las 2 va a X, a las 4 inglés, a las 6 el colegio"*) pero no un modelo de campos. Construir a ciegas acá es rework asegurado.

---

## 7 · Lo que está fuera del carril de FE

- **Punto 8 (motor de IA).** Elegir entre opciones en vez de redactar, y evaluar cada set con el orden permutado para mitigar el sesgo de posición. Es del motor, en BE. La observación del cliente sobre que un modelo se queda con la primera opción y un juez con la última es buena y merece quedar registrada.
- **Punto 10 (cronograma embebido).** Depende de las plantillas, que no llegaron. Además hoy el "documento" es **texto plano**, no PDF: `acuerdos.documento_url` no se escribe nunca.
- **Punto 12 (posicionamiento).** **No existe landing ni sitio de marketing en el repo** — `apps/panel/` está vacío de código. No hay dónde aplicarlo.
- **Punto 3, la mitad recurrente.** El checkout hoy es de **pago único** (preferencia de MP), no un abono con `preapproval`. Las columnas de recurrencia existen en DB desde la fase 1 de monetización pero nadie las escribe, y `consume_quota` fallaría siempre porque exige un período de facturación que nunca se llena. Curiosidad: `app/billing/callback.tsx` **ya está escrito asumiendo preapproval** —con polling y todo— y hoy nada del checkout navega ahí. Es trabajo de BE primero.

---

## 8 · Preguntas abiertas

### Al cliente

| # | Pregunta | Bloquea |
|---|---|---|
| 1 | **Los modelos de acuerdo por materia, con las variables identificadas** | El generador, la firma, el punto 10 entero. **Bloqueante principal, declarado por él mismo** |
| 2 | **¿Conciliación "ordena la charla" o "propone opciones"?** (§5) | El copy de los tres métodos |
| 3 | **¿Quién selecciona las cláusulas?** Ya preguntada el 01/09, sin respuesta | Si es automático, FE consume el documento. Si lo elige una persona, hace falta **una pantalla de armado que no está en ningún plan** |
| 4 | Precio y estructura del abono | El checkout real |
| 5 | Número de WhatsApp del estudio | El handoff, que ya está construido |
| 6 | **¿Aprobás el texto de las tres advertencias que los TyC prometen y no mostramos?** (§4.1) | El disclaimer previo a firmar del punto 11 |
| 7 | ¿Los nombres "Conciliación" y "Mediación" en la UI, contra lo que dice H.7? (§5.1) | Nomenclatura de producto |

### A DB / BE

Van en ficha aparte, `docs/pedidos-frontend-acuerdos-modulares.md`.

---

## 9 · El carril de FE, ordenado

### Entra ahora

1. **El 409 del gate se muestra como lo que es**, no como un código inválido (§1.1). Es lo que le rompe las demos al cliente.
2. **La afordancia de simulación deja de mentir** contra backend real (§1.2).
3. **Acuerdos direccionados por `agreementId`** (§2.2a). Cierra el riesgo con consecuencia legal.
4. **Lista de negociaciones en el detalle de caso** (§2.2b), con array de largo 1.
5. **El string de copy legal** (§4).
6. **Las fichas de pedidos a BE.**

### Espera un dato, ya diseñado

7. Moderación de lenguaje (§6.1) — falta decidir el reparto con BE.
8. Ficha de contexto (§6.2) — faltan los campos.

### Bloqueado

9. Versionado, "Renegociar", `negotiationId` en rutas — esperan el modelo de DB.
10. Copy de los tres métodos — espera la respuesta de Victor.
11. Plantillas, PDF, cronograma embebido — esperan el acuerdo marco.
